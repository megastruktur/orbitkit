# oks desktop-build (T01) — Verification Report

- **Task:** `desktop-build` (T01)
- **Worktree:** `oks-desktop-build` (`/home/megastruktur/orca/workspaces/orbitkit/oks-desktop-build`)
- **Coordinator:** planner (Magos Logis)
- **Date:** 2026-09-22
- **Agent:** OMP coding agent (sole writer in worktree)
- **Base Commit:** `72fccbc chore(sdk-v1): campaign scaffolding — CONTRACTS.md, COMMON.md; drop stale okf BRIEF.md`
- **Implementation Commit: `24af05d80f815cec1ba04ee63164ec8f87b73649`

---

## 1. Executive Summary

Task T01 (`desktop-build`) is complete.

The host sandbox environment has a stubbed `/usr` and containerized `pkg-config` shim, making linking against system `webkit2gtk-4.1` impossible on the bare host. This task delivers a complete, reproducible, and cached containerized build and test toolchain for Linux desktop Tauri applications via `tools/docker/linux-desktop.Dockerfile` (image `orbitkit-linux-desktop:1`) and `scripts/linux-desktop.sh`.

All 4 required scenarios in the Real Runtime Testing table pass with exit code 0:
1. Container image builds and packages are verified.
2. The Tauri desktop spike links and produces a real x86_64 ELF binary.
3. The binary runs headlessly under Xvfb display `:77`, renders the spike UI (mascot + debug panel), dumps active windows via `wmctrl -l`, and captures a verified non-blank screenshot (`identify -verbose` mean != uniform).
4. Invalid/nonexistent directories fail fast with descriptive error messages.

Additionally, `scripts/linux-desktop.sh exec <app-dir> -- <cmd...>` was tested and verified for downstream xdotool test scenarios, and `scripts/linux-desktop.sh` was verified 100% clean under `shellcheck`.

---

## 2. Real Runtime Testing (Mandatory Scenarios)

| # | Scenario | Command | Expected Result | Actual Result | Exit Code | Raw Log |
|---|---|---|---|---|---|---|
| 1 | `image` | `scripts/linux-desktop.sh image` | Exit 0 | Image `orbitkit-linux-desktop:1` built in 61s; Image ID `sha256:f2122c42e7e57a912fe36e7b7aeb604f7c06bf585340cf515b6989b318b692cf` | 0 | `evidence/sdk-v1/desktop-build/raw/01-image-build.log` |
| 2 | `link` | `scripts/linux-desktop.sh build .` | Exit 0, binary exists | Compiled binary created at `src-tauri/target-linux/debug/orbitkit`; verified `ELF 64-bit LSB pie executable, x86-64, dynamically linked` | 0 | `evidence/sdk-v1/desktop-build/raw/02-build-spike.log` |
| 3 | `run` | `scripts/linux-desktop.sh run-screenshot . evidence/sdk-v1/desktop-build/raw/spike.png 15` | Exit 0, non-blank PNG (`identify -verbose` mean != uniform) | App was alive at screenshot time; window dumped to `spike.windows.txt` (`0x00400003  0 3c3b3ef1e397 orbitkit`); screenshot verified non-blank (mean: 24.7533, stddev: 51.2302) | 0 | `evidence/sdk-v1/desktop-build/raw/03-run-screenshot.log`, `evidence/sdk-v1/desktop-build/raw/06-identify-spike.log`, `evidence/sdk-v1/desktop-build/raw/spike.png` |
| 4 | `failure path` | `scripts/linux-desktop.sh build /nonexistent` | Non-zero, clear message | `Error: Directory '/nonexistent' does not exist.` | 1 | `evidence/sdk-v1/desktop-build/raw/04-failure-path.log` |

---

## 3. Acceptance Criteria Mapping

| Criterion | Requirement | Verification / Evidence | Status |
|---|---|---|---|
| **1. Image Build** | `image` builds; duration + image ID recorded | Duration: 61s; Image ID: `sha256:f2122c42e7e57a912fe36e7b7aeb604f7c06bf585340cf515b6989b318b692cf` recorded in `raw/01-image-build.log` | **PASS** |
| **2. Link & Compile** | `build .` succeeds on current spike layout; ELF binary path recorded | Binary created at `/home/megastruktur/orca/workspaces/orbitkit/oks-desktop-build/src-tauri/target-linux/debug/orbitkit`; `file` output recorded in `raw/02-build-spike.log` | **PASS** |
| **3. Headless Run & Screenshot** | `run-screenshot . .../spike.png 15` produces non-blank PNG showing spike window; `windows.txt` lists "orbitkit" | `raw/spike.windows.txt` contains `0x00400003  0 3c3b3ef1e397 orbitkit`; `raw/06-identify-spike.log` verifies mean: 24.7533 != uniform; vision inspection confirms blue mascot + debug panel buttons | **PASS** |
| **4. Script Quality** | Idempotent, `set -euo pipefail`, `shellcheck`-clean | `shellcheck -f gcc /work/scripts/linux-desktop.sh` run inside container with exit code 0 and 0 warnings (`raw/05-shellcheck.log`); incremental build succeeds in 4.0s using named cache volumes (`raw/08-idempotent-rebuild.log`) | **PASS** |
| **5. Documentation** | `tools/docker/README.md`: 1-page usage | Comprehensive 1-page guide covering architecture, volumes, command reference, and headless WebKit flags created at `tools/docker/README.md` | **PASS** |

---

## 4. Supplementary Scenario Probes

- **Arbitrary Command Execution (`exec`):**
  - Command: `scripts/linux-desktop.sh exec . -- bash -c 'echo "App PID is $APP_PID"; xdotool search --name orbitkit; wmctrl -l'`
  - Result: Exit 0; successfully exported `$APP_PID` (44), located window ID via `xdotool` (4194305), and listed `0x00400003  0 8cfdcdda3025 orbitkit`.
  - Evidence: `evidence/sdk-v1/desktop-build/raw/07-exec-test.log`.

---

## 5. Deviations & Architecture Notes

1. **Window Manager under Headless Xvfb:**
   - Raw `Xvfb` does not maintain EWMH properties (`_NET_CLIENT_LIST`). To allow `wmctrl -l` to reliably enumerate windows and list "orbitkit", `openbox` was added to `tools/docker/linux-desktop.Dockerfile` and launched in the background after Xvfb starts.
2. **Container Detection:**
   - The host Orca sandbox container contains an empty `/.dockerenv` file. To prevent host-side invocations from misidentifying themselves as running inside the build container, `is_in_container` checks solely for `ORBITKIT_IN_CONTAINER=1` (exported explicitly by `docker run` invocations).
3. **WebKit Software Rendering:**
   - In containerized headless environments, WebKit2GTK requires:
     - `WEBKIT_DISABLE_COMPOSITING_MODE=1`
     - `WEBKIT_DISABLE_DMABUF_RENDERER=1`
     - `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`
     - `LIBGL_ALWAYS_SOFTWARE=1`
     - `GDK_BACKEND=x11`
   - These environment variables are exported in `tools/docker/linux-desktop.Dockerfile` and `scripts/linux-desktop.sh`.
4. **pnpm Store in Named Volume:**
   - Contract K6 specifies "cargo/pnpm caches in named volumes". In pnpm v12, `pnpm install` requires `--store-dir /pnpm-store` to direct package store caching to the mounted `orbitkit-pnpm-store` volume. Since Linux prevents hard links across distinct filesystem boundaries (EXDEV), pnpm populates the content-addressable store in the volume and copies packages into the workspace, ensuring cached packages persist across container runs without cross-filesystem linking errors.
---

## 6. Out-of-Scope Findings

1. **Host Sandbox System Library Isolation:**
   - The agent workspace cannot link system GTK/WebKit libraries on the bare host because `/usr` is a stub and `pkg-config` is a docker shim. The delivered `scripts/linux-desktop.sh` completely solves this for all desktop tasks by building within `orbitkit-linux-desktop:1`.
2. **`tauri.conf.json` Identifier Extension Warning:**
   - `pnpm tauri build` logs a warning: `The bundle identifier "dev.orbitkit.app" set in "tauri.conf.json" identifier ends with ".app". This is not recommended because it conflicts with the application bundle extension on macOS.`
   - Left untouched per non-goal boundaries (no app/source changes).

---

## 7. Contract Questions

None. Contracts K1–K6 consumed as specified without gaps or conflicts.

---

## 8. Evidence Inventory (`evidence/sdk-v1/desktop-build/raw/`)

| File | Description |
|---|---|
| `01-image-build.log` | Full build log of `orbitkit-linux-desktop:1` including duration (61s) and image SHA |
| `02-build-spike.log` | Full build log of `scripts/linux-desktop.sh build .` and binary `file` inspection |
| `03-run-screenshot.log` | Full log of `scripts/linux-desktop.sh run-screenshot . .../spike.png 15` |
| `04-failure-path.log` | Log of failure path `scripts/linux-desktop.sh build /nonexistent` with exit code 1 |
| `05-shellcheck.log` | Containerized `shellcheck` execution log on `scripts/linux-desktop.sh` (0 warnings) |
| `06-identify-spike.log` | ImageMagick `identify -verbose` statistical analysis of `spike.png` |
| `08-idempotent-rebuild.log` | Incremental rebuild timing proving 4s duration and cache reuse |
| `07-exec-test.log` | Test execution log of `scripts/linux-desktop.sh exec` with `xdotool` and `wmctrl` |
| `spike.png` | Screen capture of running Tauri desktop spike window (1280x800) |
| `spike.windows.txt` | Dump of `wmctrl -l` verifying `orbitkit` window presence |
| `spike.log` | Captured stdout/stderr of application during test run |

---

## 9. Remediation Round 2 (Gate t_8ae32564 / FIX @ 9088e87)

### 9.1 Summary of Fixes

- **F1 MAJOR (Resolved):**
  - `host_run_screenshot` now resolves the absolute output directory on the host (`pwd -P`), creates it (`mkdir -p`), and bind-mounts it into the container at the identical absolute path (`-v "$out_dir:$out_dir"`) when `$out_dir` is outside `$REPO_ROOT`.
  - After container execution, the host side strictly verifies that `<out.png>` exists and is non-empty (`[ -s "$abs_out_png" ]`), and that `<out>.windows.txt` and `<out>.log` exist on the host filesystem. If any check fails, the host script exits non-zero, eliminating false-success scenarios.
- **F2 Minor (Resolved):**
  - `validate_app_dir` now verifies that the resolved `<app-dir>` resides within `$REPO_ROOT`. Invocations attempting to target an external directory (e.g. `scripts/linux-desktop.sh build /tmp`) fail fast on the host with a clear error message (`Error: Application directory '$abs_target' is outside repository root '$REPO_ROOT'.`) and exit code 1. Documented in `tools/docker/README.md`.
- **F3 Minor (Resolved):**
  - Replaced inline process kills in `container_run_screenshot` and `container_exec` with `trap cleanup EXIT`. The cleanup handler terminates `CLEANUP_APP_PID`, `CLEANUP_WM_PID` (openbox), `CLEANUP_XVFB_PID` (Xvfb), and `CLEANUP_DBUS_PID` on any shell exit, signal, or command failure under `set -e` (e.g. if `import` fails).
- **F4 Minor (Resolved):**
  - In `container_exec`, the desktop application stdout/stderr is written directly to `<app-dir>/src-tauri/target-linux/exec-app.log` (which is git-ignored and persistent on the host) rather than container-ephemeral `/tmp`. The exact log path is printed to stdout (`--> Application log: ...`), and the command exit code is propagated. Documented in `tools/docker/README.md`.

### 9.2 Round 2 Real Runtime Testing

| # | Scenario | Command | Expected | Actual Result | Exit Code | Evidence Log |
|---|---|---|---|---|:---:|---|
| R2-1 | `shellcheck` | `docker run ... shellcheck scripts/linux-desktop.sh` | Exit 0, 0 warnings | Clean, 0 warnings | 0 | `raw/r2-01-shellcheck.log` |
| R2-2 | Outside repo rejection (F2) | `scripts/linux-desktop.sh build /tmp` | Non-zero, clear error message | `Error: Application directory '/tmp' is outside repository root...` | 1 | `raw/r2-02-outside-repo.log` |
| R2-3 | Negative control: early exit (F3) | `scripts/linux-desktop.sh run-screenshot .../fixtures/early-exit ... 3` | Non-zero exit, app crash detected | `Error: App (PID 50) crashed or exited prematurely!` | 1 | `raw/r2-03-negative-control-early-exit.log` |
| R2-4 | Outside repo out path (F1) | `scripts/linux-desktop.sh run-screenshot . /home/megastruktur/tmp/oks-t01-r2-home.png 15` | Exit 0, `-v "$out_dir:$out_dir"` host files exist | Exit 0, all 3 files verified on host | 0 | `raw/r2-06-run-screenshot-outside-repo-home.log` |
| R2-5 | In-repo out path (F1 regression check) | `scripts/linux-desktop.sh run-screenshot . evidence/sdk-v1/desktop-build/raw/spike-r2.png 15` | Exit 0, in-repo files exist | Exit 0, all 3 files verified on host | 0 | `raw/r2-07-run-screenshot-in-repo.log` |
| R2-6 | Exec app log to target-linux (F4) | `scripts/linux-desktop.sh exec . -- xdotool search --name orbitkit` | Exit 0, log written under `target-linux/` & path printed | Output contains `--> Application log: .../target-linux/exec-app.log`, file exists on host | 0 | `raw/r2-08-exec-app-log.log` |
| R2-7 | Host verification & sandbox /tmp isolation (F1) | `scripts/linux-desktop.sh run-screenshot . /tmp/oks-t01-r2.png 15` | Host verification catches missing files on overlay, exits 1; labeled retrieval proves host VM artifacts | Host script exits 1 as expected; artifacts retrieved from host VM /tmp and verified non-blank (`identify` mean: 24.75) | 1 (run) / 0 (retrieval) | `raw/r2-04-run-screenshot-tmp.log`, `raw/r2-05-identify-tmp-png.log` |

### 9.3 Sandbox Architecture Findings: Orca `/tmp` Overlay vs Host VM `/tmp`

The agent workspace operates inside an Orca container where:
1. `/home/megastruktur` is a btrfs bind-mount shared between the sandbox container and the host VM (`megaserver`).
2. The Docker daemon runs on the host VM (`/var/run/docker.sock`).
3. The sandbox's `/tmp` is a container-private overlayfs layer.

When Docker executes `-v "$out_dir:$out_dir"`, Docker daemon mounts `$out_dir` from the *host VM*.
- For paths under `/home/megastruktur` (such as `$REPO_ROOT` or `/home/megastruktur/tmp`), both the sandbox and the Docker host share the exact same filesystem, so container writes are immediately visible to the host script and pass verification with exit code 0 (`raw/r2-06-run-screenshot-outside-repo-home.log` and `raw/r2-07-run-screenshot-in-repo.log`).
- For `/tmp`, container writes land in the host VM's `/tmp`. The host-side verification in `scripts/linux-desktop.sh` accurately catches that the files are not on the active sandbox surface, prints an error, and exits 1 (`raw/r2-04-run-screenshot-tmp.log`). This guarantees no false success. A labeled artifact retrieval step confirmed that the container successfully generated and wrote all files (`oks-t01-r2.png`, `oks-t01-r2.png.windows.txt`, `oks-t01-r2.png.log`) to `/tmp` on the host VM, with `identify -verbose` verifying a valid non-blank rendering (`raw/r2-05-identify-tmp-png.log`).

### 9.4 Round 2 Evidence Inventory (`evidence/sdk-v1/desktop-build/raw/`)

| File | Description |
|---|---|
| `r2-01-shellcheck.log` | Shellcheck output inside `orbitkit-linux-desktop:1` showing 0 warnings (exit 0) |
| `r2-02-outside-repo.log` | Log verifying fast-path rejection of app directories outside `$REPO_ROOT` (exit 1) |
| `r2-03-negative-control-early-exit.log` | Negative control run with crashing app fixture showing premature exit detection & non-zero exit |
| `r2-04-run-screenshot-tmp.log` | Host-side verification and labeled retrieval log for `/tmp/oks-t01-r2.png` |
| `r2-05-identify-tmp-png.log` | ImageMagick `identify -verbose` statistical analysis of `/tmp/oks-t01-r2.png` |
| `r2-06-run-screenshot-outside-repo-home.log` | End-to-end verification of `-v "$out_dir:$out_dir"` under `$HOME` with exit 0 |
| `r2-07-run-screenshot-in-repo.log` | In-repo screenshot regression verification with exit 0 (`spike-r2.png`) |
| `r2-08-exec-app-log.log` | Verification of `exec` writing application log to `<app-dir>/src-tauri/target-linux/exec-app.log` |
| `spike-r2.png` | Fresh screenshot capture of Tauri spike window |
| `spike-r2.windows.txt` | Dump of `wmctrl -l` verifying `orbitkit` window presence |
| `spike-r2.log` | Application stdout/stderr during in-repo screenshot run |

---

READY FOR REVIEW at a3a8bd25996b56d0c2caaa324bed96c6e1b09dd8
