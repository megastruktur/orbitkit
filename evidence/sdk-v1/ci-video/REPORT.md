# CI-VID Report: Desktop Video Recording on Windows and macOS Runners

## Overview
Automated desktop recording and synthetic input driving for OrbitKit starter app across GitHub-hosted Windows (`windows-latest`) and macOS (`macos-latest`) runners.

Windows achieved 10/10 flow steps fully executed including window repositioning, and macOS achieved 9/10 flow steps (drag gesture performed synthetically, with AppKit native window drag requiring native session drag events, so window coordinates remained at the original position for steps 9–10). Both platforms produced clean MP4 video recordings, captured all 4 milestone PNG stills, recorded step-by-step execution timelines, and completed with exit code 0.

## Workflow & Driver Architecture
- Workflow: `.github/workflows/desktop-video.yml`
  - Triggers: `workflow_dispatch` and `push` on branch `oks/ci-video` only.
  - Jobs: `video-windows` (`windows-latest`) and `video-macos` (`macos-latest`).
  - Timeout: 25 minutes per job.
  - Artifact uploads: `actions/upload-artifact@v4`, `if: always()`, retention: 14 days.
- Driver scripts (`scripts/ci/`):
  - `record-windows.ps1`: PowerShell driver using Win32 native APIs (`user32.dll`) for window enumeration (`EnumWindows`, `GetWindowText`, `GetWindowRect`), window management (`ShowWindow`, `BringWindowToTop`, `SetForegroundWindow`), smooth cursor interpolation, synthetic clicks/drags (`mouse_event`), `.NET` screen bitmap capture, and background `ffmpeg` (`-f gdigrab`) with clean standard-input `"q"` flushing inside a `finally` block.
  - `record-macos.sh`: Bash driver using precompiled Swift helper (`get_window.swift` compiled with `swiftc -O`) querying CoreGraphics (`CGWindowListCopyWindowInfo`), `cliclick` for synthetic input and dragging, `screencapture -x` for still screenshots, and background `ffmpeg` (`-f avfoundation`) with cursor capture and clean FIFO pipe flushing.
  - `get_window.swift`: Swift CoreGraphics helper returning `x y w h` for target window titles or starter app components without external dependencies.
  - `probe-windows.ps1` & `probe-macos.sh`: Initial capability and permission probe scripts.

## Run URLs
- **Probe Run**: https://github.com/megastruktur/orbitkit/actions/runs/36031433300 (Completed: both probe jobs succeeded)
- **Iteration 1**: https://github.com/megastruktur/orbitkit/actions/runs/36034138533 (macOS passed in 2m1s; Windows identified debug console occlusion)
- **Final Full-Flow Run**: https://github.com/megastruktur/orbitkit/actions/runs/36035495949 (Status: **SUCCESS** on both Windows and macOS)
  - `video-macos` job: https://github.com/megastruktur/orbitkit/actions/runs/36035495949/job/107754434351 (Duration: 3m04s)
  - `video-windows` job: https://github.com/megastruktur/orbitkit/actions/runs/36035495949/job/107754434435 (Duration: 4m55s)

## Results per OS

### Windows (`windows-latest`)
- **Screen capture**: OK.
  - Tool: `ffmpeg` 9.0.2 installed via Chocolatey (`choco install ffmpeg -y`).
  - Command: `ffmpeg -y -f gdigrab -framerate 30 -i desktop -c:v libx264 -preset ultrafast -pix_fmt yuv420p -movflags +faststart video-windows.mp4`.
  - Clean shutdown: standard input `"q"` cleanly flushes the MP4 moov atom (exit code 0).
- **Synthetic input**: OK.
  - Win32 `SetCursorPos` and `mouse_event` (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MOVE).
- **Window detection**: OK.
  - Win32 `EnumWindows` and `GetWindowRect`.
  - Console occlusion mitigation: starter launched with `-WindowStyle Hidden` and `ShowWindow(hWnd, SW_HIDE)`, with the Tauri GUI window `'orbitkit'` restored to top (`SW_RESTORE` + `BringWindowToTop`).
- **Video metrics**:
  - Resolution: 1024x768
  - Framerate: 30 fps
  - Frames: 674 frames
  - Duration: 24.80 s
  - Size: 1,266,171 bytes (~1.2 MB, well below the 10 MB limit)
  - Bitrate: 408.4 kbps
- **Observed Flow Steps in Video**:
  - **Step 1 (t=4s, `01-main.png`)**: Main window `'orbitkit'` (size 816x639 with frame, 800x600 client) visible and focused at `(78, 78)`. Hero section with planet mascot, orbit rings, and Overlay Controls card rendered cleanly.
  - **Step 2 (t=6s)**: Cursor smoothly moves to Show Overlay button at `(381, 321)` and clicks.
  - **Step 3 (t=10s, `02-overlay.png`)**: Floating mascot overlay window `'orbitkit-mascot'` (296x296) appears at bottom-right `(704, 448)`. Mascot center at `(852, 596)` displays the blue planet SVG `#4f7cff`. The surrounding window background is completely transparent — **no black box**.
  - **Step 4–5 (t=12s, `03-menu-open.png`)**: Mascot clicked at center `(852, 596)`. Radial menu spawn animation completes. 5 circular glass discs expand smoothly from the mascot. Notes item at `(852, 500)` shows bright white/cyan Lucide Notes icon (`#e6f6ff`).
  - **Step 6 (t=14s)**: Mascot clicked at `(852, 596)`. Menu items collapse back into the mascot cleanly.
  - **Step 7 (t=18s, `04-notes-popup.png`)**: Mascot clicked to reopen radial menu, Notes disc clicked at `(852, 500)`. Notes popup window `'Notes'` (320x420 client area) appears at `(26, 26)` with dark glass styling and notes textarea.
  - **Step 8 (t=20s)**: Mascot dragged by `(-200, -80)` from `(852, 596)` to `(665, 521)`. Window moves smoothly across the desktop without ghost trails.
  - **Step 9 (t=22s)**: Mascot clicked at new position `(665, 521)`. Radial menu reopens smoothly around the new mascot center.
  - **Step 10 (t=24s)**: Quit item clicked at `(574, 491)`. The application exits cleanly with code 0. Screen recorder flushes and stops.

### macOS (`macos-latest`)
- **Screen capture**: OK.
  - Tool: `ffmpeg` 9.0.1 installed via Homebrew (`brew install ffmpeg`).
  - Command: `ffmpeg -y -f avfoundation -capture_cursor 1 -framerate 30 -i "0:none" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -movflags +faststart video-macos.mp4`.
  - Clean shutdown: writing `"q"` to FIFO input pipe cleanly flushes and finalizes the MP4 trailer.
- **Synthetic input**: OK.
  - `cliclick` 5.1 installed via Homebrew (`brew install cliclick` in ~2s).
  - No macOS Accessibility or Screen Recording TCC permissions blocked in GitHub Actions runner environment.
- **Window detection**: OK.
  - Precompiled Swift binary `get_window` using `CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)` returning exact window frame bounds in milliseconds.
- **Video metrics**:
  - Resolution: 1024x768
  - Framerate: 30 fps
  - Frames: 405 frames
  - Duration: 22.07 s
  - Size: 605,359 bytes (~605 KB, well below the 10 MB limit)
  - Bitrate: 219.5 kbps
- **Observed Flow Steps in Video**:
  - **Step 1 (t=3s, `01-main.png`)**: Main window `'orbitkit'` centered at `(112, 50)`, size 800x600. Svelte 5 planetary UI rendered cleanly with dark space background and glass cards.
  - **Step 2 (t=4s)**: Cursor moves to Show Overlay button at `(407, 294)` (accounting for macOS 32px titlebar) and clicks.
  - **Step 3 (t=6s, `02-overlay.png`)**: Mascot overlay window `'orbitkit-mascot'` (296x296) appears at bottom-right `(704, 448)`. Circular blue mascot planet RGB (72, 106, 245) rendered with transparent window background — **no black box**.
  - **Step 4–5 (t=8s, `03-menu-open.png`)**: Mascot clicked at center `(852, 596)`. Radial menu discs spawn smoothly outward from the mascot. Notes item at `(852, 500)` renders with white Lucide Notes icon.
  - **Step 6 (t=10s)**: Mascot clicked at `(852, 596)`. Radial menu collapses cleanly back into the mascot.
  - **Step 7 (t=12s, `04-notes-popup.png`)**: Mascot clicked, Notes disc clicked. Notes popup window `'Notes'` (320x420) opens at `(352, 96)` with full planetary glass styling.
  - **Step 8 (t=16s)**: Mascot drag gesture performed synthetically via `cliclick dd` / interpolated step movements / `cliclick du`. On macOS, synthetic Quartz events do not trigger Tauri/AppKit native window drag (`start_dragging` on NSWindow), so runtime re-query confirmed the mascot window center remained at `(852, 596)`. The driver automatically adapted and proceeded with subsequent steps at the verified position.
  - **Step 9 (t=18s)**: Mascot clicked at verified center `(852, 596)`. Radial menu reopens cleanly.
  - **Step 10 (t=20s)**: Quit menu item clicked at `(761, 566)`. Starter app exits cleanly with exit code 0. Screen recorder flushes and stops.

## Committed Artifacts (`evidence/sdk-v1/ci-video/run-36035495949/`)
Both video files are well under 10 MB, so all artifacts are committed locally:
- `video-windows/`:
  - `video-windows.mp4` (1.2 MB)
  - `01-main.png`, `02-overlay.png`, `03-menu-open.png`, `04-notes-popup.png` (plus `main.png`, `overlay.png`, `menu-open.png`, `notes-popup.png`)
  - `timeline.txt` (timestamped per step)
  - `app.log`, `app-err.log`
- `video-macos/`:
  - `video-macos.mp4` (605 KB)
  - `01-main.png`, `02-overlay.png`, `03-menu-open.png`, `04-notes-popup.png` (plus aliases)
  - `timeline.txt` (timestamped per step)
  - `app.log`

## Raw Evidence Files (`evidence/sdk-v1/ci-video/raw/`)
- `01-git-status-branch.txt` (initial branch verification)
- `02-probe-summary.txt` (probe summary outputs)
- `03-windows-probe-log.txt` (verbatim log of probe job 107740884675)
- `04-macos-probe-log.txt` (verbatim log of probe job 107740884244)
- `05-video-ffprobe-analysis.txt` (initial probe video analysis)
- `06-run-36035495949-summary.txt` (gh run view summary for green run 36035495949)
- `07-windows-run-log.txt` (verbatim log of green Windows job 107754434435)
- `08-macos-run-log.txt` (verbatim log of green macOS job 107754434351)
- `09-windows-timeline.txt` (verbatim Windows timeline)
- `10-macos-timeline.txt` (verbatim macOS timeline)
- `11-final-video-analysis.txt` (ffprobe analysis and frame verification for both MP4s)

## Out-of-Scope Findings
1. **Windows Debug Console Window Occlusion**: In Tauri debug builds (`tauri build --debug --no-bundle`), a Windows console subsystem window (`starter.exe`) is opened alongside the GUI window (`main.rs` configures `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` only for release builds). In automated environments, this console window can spawn in front of the GUI window and intercept mouse clicks. Mitigated in driver by launching with `Start-Process -WindowStyle Hidden` and hiding any detected `starter.exe` console windows via `ShowWindow(hWnd, SW_HIDE)`.
2. **PowerShell `$pid` Reserved Variable**: In PowerShell, `$pid` is an automatic read-only variable for the current PowerShell process ID. Using `[ref]$pid` in P/Invoke calls (`GetWindowThreadProcessId`) triggers an error; drivers must use `$winPid` instead.
3. **macOS Window Frame Bounds vs Client Area**: `CGWindowListCopyWindowInfo` returns outer window frame bounds including the macOS titlebar (~32px). Clicks targeted at DOM content must add the titlebar offset to `bounds.Y`.
4. **macOS Synthetic Drag vs AppKit `start_dragging`**: Tauri's `start_dragging` API on macOS relies on native AppKit event loop window dragging. Synthetic mouse drags dispatched via `cliclick` or `CGEventPost` generate mouse-dragged events but do not initiate AppKit's native window frame move loop, so the window geometry remains at its initial position. The driver handles this gracefully by re-querying the runtime window rect after drag and continuing at the verified coordinates.
## Runner Minutes & Resource Usage
- Run 36031433300 (Probe): 7m 46s runner minutes
- Run 36034138533 (Iteration 1): 8m 40s runner minutes
- Run 36035495949 (Final successful full-flow run): 7m 59s runner minutes
- Total runner minutes consumed: ~24.5 minutes across standard free GitHub-hosted runners.
- Total wall-clock development time: ~48 minutes.

READY FOR REVIEW at 164bb24820ca2f38a6b94051dc311e79b6f12d1a
