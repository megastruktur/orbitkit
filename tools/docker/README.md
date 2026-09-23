# OrbitKit Containerized Linux Desktop Build & Test Environment

## 1. Overview & Purpose

The host sandbox environment has a stubbed `/usr` directory with a containerized `pkg-config` shim. While `cargo check` can pass on the host, `cargo build` and `tauri build` cannot dynamically link against `webkit2gtk-4.1` or system GTK libraries because the linker cannot see the host libraries.

This directory provides the container specification (`linux-desktop.Dockerfile`) and companion automation script (`scripts/linux-desktop.sh`) to:
1. Provide a self-contained Debian Bookworm build environment with full `webkit2gtk-4.1-dev` and GTK3 libraries.
2. Build the Linux desktop Tauri application (`dev.orbitkit.app`) and produce real ELF x86_64 binaries.
3. Execute and verify the desktop app headlessly via Xvfb, capturing live screenshots and window hierarchies.
4. Support interactive automation scenarios (e.g. `xdotool`) via container command execution.

---

## 2. Architecture & Image Specification

- **Base Image:** `rust:1-bookworm`
- **Target Tag:** `orbitkit-linux-desktop:1`
- **Key System Packages:**
  - `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `libssl-dev`, `libxdo-dev`
  - `build-essential`, `curl`, `wget`, `file`, `ca-certificates`, `gnupg`
  - `xvfb`, `xdotool`, `x11-utils`, `wmctrl`, `imagemagick`, `shellcheck`, `fonts-dejavu-core`, `dbus-x11`
- **Runtimes:**
  - Node.js 22.x (via NodeSource)
  - pnpm 12.4.1 (matching repository `packageManager` specification)
  - Rust 1.x stable (via `rust:1-bookworm`)
- **Permissions & User:**
  - Runs as user `builder` (`uid:gid 1000:1000`) matching the host repository ownership.
- **Named Volumes for Caches:**
  - `orbitkit-cargo-cache` mounted at `/cargo-cache` (`CARGO_HOME=/cargo-cache`)
  - `orbitkit-pnpm-store` mounted at `/pnpm-store` (`PNPM_HOME=/pnpm-store`)
- **Target Output Directory:**
  - `CARGO_TARGET_DIR` is set to `<app-dir>/src-tauri/target-linux` so container builds do not conflict with or pollute host `target/` directories.

---

## 3. CLI Commands & Usage (`scripts/linux-desktop.sh`)

All operations are driven via `scripts/linux-desktop.sh` from the repository root:

### 3.1 Build or Refresh the Container Image
```bash
scripts/linux-desktop.sh image
```
Builds `orbitkit-linux-desktop:1` from `tools/docker/linux-desktop.Dockerfile`. Reports total build duration and the resulting image SHA.

### 3.2 Build the Desktop Tauri Application
```bash
scripts/linux-desktop.sh build <app-dir>
```
Example:
```bash
scripts/linux-desktop.sh build .
# or for relocated app directories:
scripts/linux-desktop.sh build examples/starter
```
Runs inside container: mounts repository root at the identical absolute path, executes `pnpm install --frozen-lockfile` at the repository root, then `pnpm tauri build --debug --no-bundle` inside `<app-dir>`. Outputs the compiled ELF binary path (e.g., `<app-dir>/src-tauri/target-linux/debug/orbitkit`).

**Constraint:** `<app-dir>` must reside within the repository tree (`$REPO_ROOT`). If an application directory outside the repository root is passed, the host script rejects it immediately with a descriptive error message and exits non-zero.

### 3.3 Headless Execution & Screenshot Capture
```bash
scripts/linux-desktop.sh run-screenshot <app-dir> <out.png> [seconds=15]
```
Example:
```bash
scripts/linux-desktop.sh run-screenshot . evidence/sdk-v1/desktop-build/raw/spike.png 15
# or to any host destination (e.g. /tmp):
scripts/linux-desktop.sh run-screenshot . /tmp/oks-t01-r2.png 15
```
Behavior:
1. Validates `<app-dir>` resides within the repository root.
2. Automatically resolves `<out.png>` on the host. If `<out.png>` is located outside `$REPO_ROOT` (such as `/tmp`), the host script `mkdir -p` creates its parent directory and bind-mounts it into the container at the identical absolute path (`-v "$out_dir:$out_dir"`).
3. Inside the container, installs a `trap cleanup EXIT` handler to ensure all background processes (`orbitkit`, minimal window manager `openbox`, `Xvfb`, and D-Bus) are reliably terminated upon exit or on error (even if `import` fails under `set -e`).
4. Starts Xvfb virtual display `:77` at resolution `1280x800x24`.
5. Sets WebKit headless environment variables (`WEBKIT_DISABLE_COMPOSITING_MODE=1`, `WEBKIT_DISABLE_DMABUF_RENDERER=1`, `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`, `LIBGL_ALWAYS_SOFTWARE=1`, `GDK_BACKEND=x11`).
6. Launches the compiled Tauri desktop binary in background, redirecting stdout/stderr to `<out>.log`.
7. Waits for the specified delay (default 15 seconds) for window creation and webview rendering.
8. Verifies the application process is still alive.
9. Takes a full-screen screenshot via ImageMagick `import` to `<out.png>`.
10. Dumps active window metadata via `wmctrl -l` to `<out>.windows.txt`.
11. Exits `0` if and only if the application remained alive at capture time.
12. Upon container return, the host side strictly verifies that `<out.png>` (non-empty), `<out>.windows.txt`, and `<out>.log` exist on the host filesystem and exits non-zero otherwise.

### 3.4 Arbitrary Command Execution under Live Window Display
```bash
scripts/linux-desktop.sh exec <app-dir> -- <cmd...>
```
Example:
```bash
scripts/linux-desktop.sh exec . -- xdotool search --name orbitkit
```
Starts Xvfb `:77`, runs the desktop app, exports `$APP_PID`, and executes the provided command (useful for UI interaction probes and xdotool clicks in later milestones).

Application stdout and stderr are written directly to `<app-dir>/src-tauri/target-linux/exec-app.log` (which is git-ignored and lives on the host) rather than container-ephemeral `/tmp`, and the log file path is printed to stdout. Background processes are managed by `trap cleanup EXIT` so all processes are terminated cleanly when the command finishes or fails. Propagates the command's exit code.
---

## 4. Headless & WebKit Compatibility Flags

Inside the container, WebKit2GTK is configured for headless virtual framebuffers:
- `WEBKIT_DISABLE_COMPOSITING_MODE=1`: Forces software rendering to avoid crashes or black screens on Mesa llvmpipe under Xvfb.
- `WEBKIT_DISABLE_DMABUF_RENDERER=1`: Disables DMA-BUF renderer path under software GL.
- `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`: Disables WebKit's internal unprivileged bwrap sandbox, which is blocked by default Docker container namespaces.
- `LIBGL_ALWAYS_SOFTWARE=1`: Ensures software rasterizer is selected for Mesa.
