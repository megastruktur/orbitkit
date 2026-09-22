#!/usr/bin/env bash
# scripts/linux-desktop.sh — OrbitKit Linux Desktop containerized build & test runner
set -euo pipefail

IMAGE_NAME="orbitkit-linux-desktop:1"
CARGO_VOLUME="orbitkit-cargo-cache"
PNPM_VOLUME="orbitkit-pnpm-store"

SCRIPT_PATH="$(realpath "${BASH_SOURCE[0]}")"
REPO_ROOT="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: scripts/linux-desktop.sh <command> [args...]

Commands:
  image                                        Build/refresh the orbitkit-linux-desktop:1 container image
  build <app-dir>                              Build the Linux desktop Tauri app in container
  run-screenshot <app-dir> <out.png> [sec=15]  Run app under Xvfb :77, take screenshot, dump windows & log
  exec <app-dir> -- <cmd...>                   Run arbitrary command with Xvfb and app running ($APP_PID exported)
EOF
  exit 1
}

find_binary() {
  local app_dir="$1"
  local target_debug="$app_dir/src-tauri/target-linux/debug"

  # 1. Standard name check
  if [ -f "$target_debug/orbitkit" ] && [ -x "$target_debug/orbitkit" ]; then
    echo "$target_debug/orbitkit"
    return 0
  fi

  # 2. Package name check from Cargo.toml
  if [ -f "$app_dir/src-tauri/Cargo.toml" ]; then
    local pkg_name
    pkg_name=$(grep -E '^\s*name\s*=' "$app_dir/src-tauri/Cargo.toml" | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -n "$pkg_name" ] && [ -f "$target_debug/$pkg_name" ] && [ -x "$target_debug/$pkg_name" ]; then
      echo "$target_debug/$pkg_name"
      return 0
    fi
  fi

  # 3. Executable file scan in target-linux/debug
  if [ -d "$target_debug" ]; then
    local candidate
    candidate=$(find "$target_debug" -maxdepth 1 -type f -executable ! -name "*.d" ! -name "build-script-*" | head -n 1)
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  fi

  return 1
}

validate_app_dir() {
  local target="$1"
  if [ ! -d "$target" ]; then
    echo "Error: Directory '$target' does not exist." >&2
    exit 1
  fi
  local abs_target
  abs_target="$(cd "$target" && pwd -P)"
  case "$abs_target" in
    "$REPO_ROOT" | "$REPO_ROOT"/*)
      ;;
    *)
      echo "Error: Application directory '$abs_target' is outside repository root '$REPO_ROOT'." >&2
      exit 1
      ;;
  esac
  if [ ! -f "$abs_target/package.json" ] || [ ! -d "$abs_target/src-tauri" ]; then
    echo "Error: '$abs_target' does not contain package.json and src-tauri/." >&2
    exit 1
  fi
}

is_in_container() {
  if [ -n "${ORBITKIT_IN_CONTAINER:-}" ]; then
    return 0
  fi
  return 1
}

ensure_image() {
  if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
    echo "Image '$IMAGE_NAME' not found. Building image..."
    host_image
  fi
}

# ==============================================================================
# CONTAINER-SIDE IMPLEMENTATION
# ==============================================================================

CLEANUP_APP_PID=""
CLEANUP_WM_PID=""
CLEANUP_XVFB_PID=""
CLEANUP_DBUS_PID=""

cleanup() {
  if [ -n "$CLEANUP_APP_PID" ]; then
    kill -TERM "$CLEANUP_APP_PID" 2>/dev/null || true
    sleep 0.2
    kill -9 "$CLEANUP_APP_PID" 2>/dev/null || true
    CLEANUP_APP_PID=""
  fi
  if [ -n "$CLEANUP_WM_PID" ]; then
    kill -TERM "$CLEANUP_WM_PID" 2>/dev/null || true
    CLEANUP_WM_PID=""
  fi
  if [ -n "$CLEANUP_XVFB_PID" ]; then
    kill -TERM "$CLEANUP_XVFB_PID" 2>/dev/null || true
    CLEANUP_XVFB_PID=""
  fi
  if [ -n "$CLEANUP_DBUS_PID" ]; then
    kill -TERM "$CLEANUP_DBUS_PID" 2>/dev/null || true
    CLEANUP_DBUS_PID=""
  fi
}
container_build() {
  local app_dir="$1"
  echo "=== Running in-container build for: $app_dir ==="
  echo "Repository root: $REPO_ROOT"

  cd "$REPO_ROOT"
  echo "--> Installing dependencies at repo root..."
  pnpm install --frozen-lockfile --store-dir /pnpm-store

  cd "$app_dir"
  export CARGO_TARGET_DIR="$app_dir/src-tauri/target-linux"
  echo "--> Building Tauri desktop application (debug, no-bundle)..."
  echo "--> CARGO_TARGET_DIR=$CARGO_TARGET_DIR"
  pnpm tauri build --debug --no-bundle

  local bin_path
  if bin_path=$(find_binary "$app_dir"); then
    echo "=== Build successful ==="
    echo "Binary: $bin_path"
    file "$bin_path"
  else
    echo "Error: Build finished but could not locate binary in $CARGO_TARGET_DIR/debug" >&2
    exit 1
  fi
}

container_run_screenshot() {
  local app_dir="$1"
  local out_png="$2"
  local seconds="${3:-15}"

  local bin_path
  if ! bin_path=$(find_binary "$app_dir"); then
    echo "Error: Binary not found in '$app_dir/src-tauri/target-linux/debug/'. Run 'build' first." >&2
    exit 1
  fi

  local out_base="${out_png%.png}"
  local out_log="${out_base}.log"
  local out_txt="${out_base}.windows.txt"
  mkdir -p "$(dirname "$out_png")"

  trap cleanup EXIT

  # Clean any stale X lock
  rm -f /tmp/.X77-lock /tmp/.X11-unix/X77 2>/dev/null || true

  export DISPLAY=:77
  Xvfb :77 -screen 0 1280x800x24 -ac &
  CLEANUP_XVFB_PID=$!

  # Wait for Xvfb readiness
  local xvfb_ready=0
  for _ in $(seq 1 50); do
    if xdpyinfo -display :77 >/dev/null 2>&1; then
      xvfb_ready=1
      break
    fi
    sleep 0.1
  done
  if [ "$xvfb_ready" -ne 1 ]; then
    echo "Error: Xvfb failed to start on display :77" >&2
    exit 1
  fi

  # Launch dbus session if available
  if command -v dbus-launch >/dev/null 2>&1; then
    eval "$(dbus-launch --sh-syntax)"
    CLEANUP_DBUS_PID="${DBUS_SESSION_BUS_PID:-}"
  fi

  # Launch minimal window manager for EWMH (_NET_CLIENT_LIST / wmctrl) support
  openbox >/dev/null 2>&1 &
  CLEANUP_WM_PID=$!
  sleep 0.5

  # WebKit software rendering & sandbox settings for headless container
  export WEBKIT_DISABLE_COMPOSITING_MODE=1
  export WEBKIT_DISABLE_DMABUF_RENDERER=1
  export WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1
  export LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11

  echo "--> Launching $bin_path in Xvfb :77..."
  cd "$app_dir"
  "$bin_path" > "$out_log" 2>&1 &
  CLEANUP_APP_PID=$!

  echo "--> Waiting $seconds seconds for app to render..."
  sleep "$seconds"

  local app_alive=0
  if kill -0 "$CLEANUP_APP_PID" 2>/dev/null; then
    app_alive=1
  fi

  echo "--> Capturing screenshot to $out_png..."
  import -window root "$out_png"

  echo "--> Dumping window list to $out_txt..."
  wmctrl -l > "$out_txt" 2>&1 || true

  # Duplicate with .png suffix for verifier compatibility
  if [ "$out_txt" != "${out_png}.windows.txt" ]; then
    cp -f "$out_txt" "${out_png}.windows.txt" 2>/dev/null || true
  fi
  if [ "$out_log" != "${out_png}.log" ]; then
    cp -f "$out_log" "${out_png}.log" 2>/dev/null || true
  fi

  if [ "$app_alive" -ne 1 ]; then
    echo "Error: App (PID $CLEANUP_APP_PID) crashed or exited prematurely!" >&2
    if [ -f "$out_log" ]; then
      echo "=== Application Output ($out_log) ===" >&2
      cat "$out_log" >&2
    fi
    exit 1
  fi

  echo "=== Run-screenshot successful ==="
  echo "App was alive at screenshot time."
  echo "Screenshot: $out_png"
  echo "Windows list: $out_txt"
  echo "App log: $out_log"
}

container_exec() {
  local app_dir="$1"
  shift

  local bin_path
  if ! bin_path=$(find_binary "$app_dir"); then
    echo "Error: Binary not found in '$app_dir/src-tauri/target-linux/debug/'. Run 'build' first." >&2
    exit 1
  fi

  rm -f /tmp/.X77-lock /tmp/.X11-unix/X77 2>/dev/null || true

  trap cleanup EXIT

  export DISPLAY=:77
  Xvfb :77 -screen 0 1280x800x24 -ac &
  CLEANUP_XVFB_PID=$!

  local xvfb_ready=0
  for _ in $(seq 1 50); do
    if xdpyinfo -display :77 >/dev/null 2>&1; then
      xvfb_ready=1
      break
    fi
    sleep 0.1
  done
  if [ "$xvfb_ready" -ne 1 ]; then
    echo "Error: Xvfb failed to start on display :77" >&2
    exit 1
  fi

  if command -v dbus-launch >/dev/null 2>&1; then
    eval "$(dbus-launch --sh-syntax)"
    CLEANUP_DBUS_PID="${DBUS_SESSION_BUS_PID:-}"
  fi

  # Launch minimal window manager for EWMH (_NET_CLIENT_LIST / wmctrl) support
  openbox >/dev/null 2>&1 &
  CLEANUP_WM_PID=$!
  sleep 0.5
  export WEBKIT_DISABLE_COMPOSITING_MODE=1
  export WEBKIT_DISABLE_DMABUF_RENDERER=1
  export WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1
  export LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11

  cd "$app_dir"
  local exec_log_dir="$app_dir/src-tauri/target-linux"
  mkdir -p "$exec_log_dir"
  local exec_log="$exec_log_dir/exec-app.log"
  echo "--> Application log: $exec_log"
  "$bin_path" > "$exec_log" 2>&1 &
  APP_PID=$!
  export APP_PID
  CLEANUP_APP_PID=$!

  sleep 2

  local cmd_exit=0
  set +e
  "$@"
  cmd_exit=$?
  set -e

  exit "$cmd_exit"
}

# ==============================================================================
# HOST-SIDE IMPLEMENTATION
# ==============================================================================

host_image() {
  local dockerfile="$REPO_ROOT/tools/docker/linux-desktop.Dockerfile"
  if [ ! -f "$dockerfile" ]; then
    echo "Error: Dockerfile not found at $dockerfile" >&2
    exit 1
  fi

  echo "Building container image '$IMAGE_NAME'..."
  local start_time
  start_time=$(date +%s)

  docker build -t "$IMAGE_NAME" -f "$dockerfile" "$REPO_ROOT/tools/docker"

  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - start_time))

  local image_id
  image_id=$(docker images --no-trunc --format "{{.ID}}" "$IMAGE_NAME" | head -n 1)

  echo "=================================================="
  echo "Image built successfully: $IMAGE_NAME"
  echo "Image ID: $image_id"
  echo "Duration: ${duration}s"
  echo "=================================================="
}

host_build() {
  local app_dir_arg="$1"
  validate_app_dir "$app_dir_arg"
  local abs_app_dir
  abs_app_dir="$(cd "$app_dir_arg" && pwd -P)"

  ensure_image

  echo "Launching build container for $abs_app_dir..."
  docker run --rm \
    --user 1000:1000 \
    --shm-size=512m \
    -v "$REPO_ROOT:$REPO_ROOT" \
    -v "$CARGO_VOLUME:/cargo-cache" \
    -v "$PNPM_VOLUME:/pnpm-store" \
    -e HOME=/home/builder \
    -e CARGO_HOME=/cargo-cache \
    -e PNPM_HOME=/pnpm-store \
    -e PNPM_STORE_DIR=/pnpm-store \
    -e ORBITKIT_IN_CONTAINER=1 \
    -w "$REPO_ROOT" \
    "$IMAGE_NAME" \
    "$SCRIPT_PATH" build "$abs_app_dir"
}

host_run_screenshot() {
  local app_dir_arg="$1"
  local out_png_arg="$2"
  local seconds="${3:-15}"

  validate_app_dir "$app_dir_arg"
  local abs_app_dir
  abs_app_dir="$(cd "$app_dir_arg" && pwd -P)"

  local out_dir
  out_dir="$(dirname "$out_png_arg")"
  mkdir -p "$out_dir"
  out_dir="$(cd "$out_dir" && pwd -P)"
  local abs_out_png
  abs_out_png="$out_dir/$(basename "$out_png_arg")"

  local extra_mount=()
  case "$out_dir" in
    "$REPO_ROOT" | "$REPO_ROOT"/*)
      ;;
    *)
      extra_mount=(-v "$out_dir:$out_dir")
      ;;
  esac

  ensure_image

  echo "Launching screenshot container for $abs_app_dir (output: $abs_out_png, wait: ${seconds}s)..."
  local docker_exit=0
  set +e
  docker run --rm \
    --user 1000:1000 \
    --shm-size=512m \
    -v "$REPO_ROOT:$REPO_ROOT" \
    "${extra_mount[@]}" \
    -v "$CARGO_VOLUME:/cargo-cache" \
    -v "$PNPM_VOLUME:/pnpm-store" \
    -e HOME=/home/builder \
    -e CARGO_HOME=/cargo-cache \
    -e PNPM_HOME=/pnpm-store \
    -e PNPM_STORE_DIR=/pnpm-store \
    -e ORBITKIT_IN_CONTAINER=1 \
    -w "$REPO_ROOT" \
    "$IMAGE_NAME" \
    "$SCRIPT_PATH" run-screenshot "$abs_app_dir" "$abs_out_png" "$seconds"
  docker_exit=$?
  set -e

  if [ "$docker_exit" -ne 0 ]; then
    echo "Error: Container execution failed with exit code $docker_exit." >&2
    exit "$docker_exit"
  fi

  local abs_out_base="${abs_out_png%.png}"

  # Duplicate with alternate naming convention if needed so both <out>.log and <out.png>.log exist
  if [ -f "$abs_out_base.windows.txt" ] && [ ! -f "$abs_out_png.windows.txt" ]; then
    cp -f "$abs_out_base.windows.txt" "$abs_out_png.windows.txt" 2>/dev/null || true
  elif [ -f "$abs_out_png.windows.txt" ] && [ ! -f "$abs_out_base.windows.txt" ]; then
    cp -f "$abs_out_png.windows.txt" "$abs_out_base.windows.txt" 2>/dev/null || true
  fi

  if [ -f "$abs_out_base.log" ] && [ ! -f "$abs_out_png.log" ]; then
    cp -f "$abs_out_base.log" "$abs_out_png.log" 2>/dev/null || true
  elif [ -f "$abs_out_png.log" ] && [ ! -f "$abs_out_base.log" ]; then
    cp -f "$abs_out_png.log" "$abs_out_base.log" 2>/dev/null || true
  fi

  if [ ! -f "$abs_out_png" ]; then
    echo "Error: Screenshot '$abs_out_png' does not exist on host." >&2
    exit 1
  fi

  if [ ! -s "$abs_out_png" ]; then
    echo "Error: Screenshot '$abs_out_png' is empty (0 bytes) on host." >&2
    exit 1
  fi

  if [ ! -f "$abs_out_png.windows.txt" ] && [ ! -f "$abs_out_base.windows.txt" ]; then
    echo "Error: Window list file was not created on host for '$abs_out_png'." >&2
    exit 1
  fi

  if [ ! -f "$abs_out_png.log" ] && [ ! -f "$abs_out_base.log" ]; then
    echo "Error: Application log was not created on host for '$abs_out_png'." >&2
    exit 1
  fi
}

host_exec() {
  local app_dir_arg="$1"
  shift

  if [ "$#" -lt 1 ] || [ "$1" != "--" ]; then
    echo "Error: Expected '-- <command...>' after <app-dir>" >&2
    usage
  fi
  shift

  validate_app_dir "$app_dir_arg"
  local abs_app_dir
  abs_app_dir="$(cd "$app_dir_arg" && pwd -P)"

  ensure_image

  echo "Launching exec container for $abs_app_dir..."
  docker run --rm \
    --user 1000:1000 \
    --shm-size=512m \
    -v "$REPO_ROOT:$REPO_ROOT" \
    -v "$CARGO_VOLUME:/cargo-cache" \
    -v "$PNPM_VOLUME:/pnpm-store" \
    -e HOME=/home/builder \
    -e CARGO_HOME=/cargo-cache \
    -e PNPM_HOME=/pnpm-store \
    -e PNPM_STORE_DIR=/pnpm-store \
    -e ORBITKIT_IN_CONTAINER=1 \
    -w "$REPO_ROOT" \
    "$IMAGE_NAME" \
    "$SCRIPT_PATH" exec "$abs_app_dir" -- "$@"
}

# ==============================================================================
# ENTRYPOINT DISPATCH
# ==============================================================================

if [ "$#" -lt 1 ]; then
  usage
fi

CMD="$1"
shift

if is_in_container; then
  case "$CMD" in
    build)
      if [ "$#" -lt 1 ]; then usage; fi
      container_build "$1"
      ;;
    run-screenshot)
      if [ "$#" -lt 2 ]; then usage; fi
      container_run_screenshot "$1" "$2" "${3:-15}"
      ;;
    exec)
      if [ "$#" -lt 2 ] || [ "$2" != "--" ]; then usage; fi
      app="$1"
      shift 2
      container_exec "$app" "$@"
      ;;
    *)
      echo "Unknown in-container command: $CMD" >&2
      usage
      ;;
  esac
else
  case "$CMD" in
    image)
      host_image
      ;;
    build)
      if [ "$#" -lt 1 ]; then usage; fi
      host_build "$1"
      ;;
    run-screenshot)
      if [ "$#" -lt 2 ]; then usage; fi
      host_run_screenshot "$1" "$2" "${3:-15}"
      ;;
    exec)
      if [ "$#" -lt 2 ]; then usage; fi
      host_exec "$@"
      ;;
    *)
      echo "Unknown command: $CMD" >&2
      usage
      ;;
  esac
fi
