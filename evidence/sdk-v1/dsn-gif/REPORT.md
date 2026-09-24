# OrbitKit Follow-up Report: `dsn-gif` (R-DSN-3a)

**Worktree**: `oks-dsn-gif`  
**Base Commit**: `457255a`  
**Implementation Commit**: `2a480c8b6d6b9a493cea2876ec0b288651e57fa3`  
**Scope**: R-DSN-3a only (desktop GIF demo, recording tooling, demo scenario, and review fixes F1/F2)

---

## 1. Executive Summary

Implemented **R-DSN-3a** end-to-end adhering strictly to the requirements in `BRIEF.md`:
1. **Docker Container Environment Updated with FFmpeg**:
   - Added `ffmpeg` (apt) to `tools/docker/linux-desktop.Dockerfile`.
   - Rebuilt container image `orbitkit-linux-desktop:1` via `./scripts/linux-desktop.sh image`.
   - Recorded build output in `evidence/sdk-v1/dsn-gif/raw/image-build.txt` (EXIT_CODE=0).
2. **`scripts/linux-desktop.sh record` Subcommand Implemented**:
   - Added `record <app-dir> <script> <out.gif>` subcommand reusing `run-scenario` container plumbing.
   - Backgrounds `ffmpeg -f x11grab -framerate 15 -video_size 1280x800 -i :77` to an in-container temporary MP4 while running the scenario script.
   - Captures mouse parking and scenario execution, then cleanly finalizes recording by sending `SIGINT` to the ffmpeg PID.
   - Performs two-pass palette generation:
     - Pass 1: `fps=12,scale=800:-1:flags=lanczos,palettegen=stats_mode=diff`
     - Pass 2: `fps=12,scale=800:-1:flags=lanczos` with `paletteuse=dither=bayer:bayer_scale=4`
   - Validates that the resulting GIF exists, is non-empty, and does not exceed 8 MB (8,388,608 bytes), failing loudly with a non-zero exit code if validation fails.
   - Updated `usage()` to document `record`.
3. **Pacing-Tuned Scenario Script `scripts/demo/desktop-demo.sh`**:
   - Created based on `evidence/sdk-v1/dsn-starter/run-desktop-flow.sh` with coordinates verified at Xvfb 1280x800.
   - Added `move_smooth` interpolation helper using `xdotool mousemove` steps to provide visible cursor motion for viewers.
   - Pointer initially parked at (20, 20) before the first active frame.
   - Pacing tuned:
     - Main window visible: ~2.0 s
     - Smooth move + click Show Overlay: ~2.0 s
     - Smooth move + click Mascot to open radial menu: ~2.5 s
     - Smooth move + click Notes: ~3.0 s (Notes popup displayed)
     - Reopen menu + Quit: ~1.5 s
     - Total duration: 14.33 s (within 10–15 s requirement).
4. **Desktop Demo GIF Generated & Committed**:
   - Committed `docs/media/demo-desktop.gif`.
   - Dimensions: 800x500 (800 px wide).
   - Duration: 14.33 s (between 10 s and 15 s).
   - File size: 846,466 bytes (~827 KB, well under 8 MB).

---

## 2. Checks and Verification

| Check | Command / Probe | Result | Evidence File | Exit Code |
|---|---|---|---|---|
| **1. Container Image Build** | `./scripts/linux-desktop.sh image` | Image `orbitkit-linux-desktop:1` built with `ffmpeg` installed | `raw/image-build.txt` | 0 |
| **2. Demo Recording Execution** | `./scripts/linux-desktop.sh record examples/starter scripts/demo/desktop-demo.sh docs/media/demo-desktop.gif` | Generated valid GIF: 800x500, 846,466 bytes | `raw/record-run.txt` | 0 |
| **3. GIF ffprobe Inspection** | `ffprobe -hide_banner docs/media/demo-desktop.gif` | Width: 800, Height: 500, Duration: 00:00:14.33, Framerate: 12 fps | `raw/ffprobe-gif.txt` | 0 |
| **4. Frame Extractions** | `ffmpeg -ss <t> -i docs/media/demo-desktop.gif -frames:v 1 evidence/sdk-v1/dsn-gif/frames/<name>.png` | 4 PNG frames extracted and visually verified | `raw/extract-frames.txt` | 0 |
| **5. run-scenario Regression** | `./scripts/linux-desktop.sh run-scenario examples/starter evidence/sdk-v1/dsn-starter/run-desktop-flow.sh` | Scenario passed completely; app exited 0 on quit | `raw/run-scenario-regression.txt` | 0 |
| **6. Shell Syntax Check** | `bash -n scripts/linux-desktop.sh` | Syntax clean, no errors | `raw/bash-n-check.txt` | 0 |
| **7. External GIF Recording (F1)** | `./scripts/linux-desktop.sh record examples/starter scripts/demo/desktop-demo.sh /home/megastruktur/.hermes/profiles/planner/cache/scratch/dsn-gif-out/out.gif` | Generated valid GIF: 800x500, 865,865 bytes, exit 0 | `raw/record-external-run.txt` | 0 |
| **8. Starter Build Proof without UI Dist (F2)** | `pnpm --filter starter build` (with `dist/` removed) | Build fails with Rolldown import resolution error for `@orbitkit/ui` | `raw/f2-dist-proof.txt` | 1 |
---

## 3. Extracted Frames Analysis

Extracted 4 frames to `evidence/sdk-v1/dsn-gif/frames/` using `ffmpeg -ss <t> -frames:v 1`:

1. **`01-main-window.png` (t = 1.5 s)**:
   - Shows the OrbitKit Starter main dashboard in deep space styling with planetary mascot, orbit rings, overlay controls ("Show Overlay"), mascot state, live event log, and system status.
   - No Vite error overlay; no blank window.
2. **`02-mascot-overlay.png` (t = 4.0 s)**:
   - Shows the mascot overlay active at the bottom-right of the screen with circular planetary mascot and thin orbital ring. Main window indicates `System: Overlay displayed`.
   - No Vite error overlay; no blank window.
3. **`03-radial-menu.png` (t = 7.0 s)**:
   - Shows the expanded radial menu around the mascot.
   - **Verification**: Circular discs contain bright line icons (file/notes, timer, settings, info, power); discs do **not** contain text labels.
   - No Vite error overlay; no blank window.
4. **`04-notes-popup.png` (t = 10.0 s)**:
   - Shows the "Quick Notes" planetary glass popup on the left side, with status badge `LOADED`, placeholder text, and `Clear` button. Main window event log displays `notes (webview)`.
   - No Vite error overlay; no blank window.

---

## 4. Raw Evidence Artifacts

All command outputs in `evidence/sdk-v1/dsn-gif/raw/` end with `EXIT_CODE=<n>` per BRIEF rule 9:
- `raw/image-build.txt`: Docker image build output with ffmpeg (EXIT_CODE=0)
- `raw/record-run.txt`: `scripts/linux-desktop.sh record` run output (EXIT_CODE=0)
- `raw/ffprobe-gif.txt`: `ffprobe` stream and format metadata on `docs/media/demo-desktop.gif` (EXIT_CODE=0)
- `raw/extract-frames.txt`: Frame extraction commands and file listings (EXIT_CODE=0)
- `raw/run-scenario-regression.txt`: Full `run-scenario` regression test output (EXIT_CODE=0)
- `raw/bash-n-check.txt`: Syntax validation of `scripts/linux-desktop.sh` (EXIT_CODE=0)
- `raw/record-external-run.txt`: `scripts/linux-desktop.sh record` test with external output GIF path (EXIT_CODE=0)
- `raw/f2-dist-proof.txt`: Proof showing starter build failure when `@orbitkit/ui` dist is missing (EXIT_CODE=1)

---

## 5. Out-of-Scope Findings

1. `README.md` is out of scope for R-DSN-3a (scheduled for R-DSN-3b per coordinator note).
2. Starter source, plugins, and Android code were untouched.
3. `evidence/sdk-v1/dsn-starter/**` was preserved untouched (any temporary files produced during regression test execution were reverted).
4. The committed desktop GIF `docs/media/demo-desktop.gif` was preserved untouched (no re-recording).

---

## 6. Review Round 1 Remediation (Findings F1 & F2)

### Finding F1 (Medium): Record Subcommand with Output Outside `$REPO_ROOT`
- **Issue**: In `scripts/linux-desktop.sh host_record`, the Docker run invocation previously mounted only `-v "$REPO_ROOT:$REPO_ROOT"`. When an output GIF path outside the repository root was specified (such as `/home/megastruktur/.hermes/profiles/planner/cache/scratch/dsn-gif-out/out.gif`), the container running as `--user 1000:1000` could not create or write to the destination directory inside the container, failing with permission denied (rc=1).
- **Fix**: Updated `host_record` in `scripts/linux-desktop.sh` to resolve `abs_out_gif="$(realpath -m "$out_gif_arg")"` and `out_gif_dir="$(dirname "$abs_out_gif")"`. When `abs_out_gif` is outside `$REPO_ROOT`, `-v "$out_gif_dir:$out_gif_dir"` is dynamically added to the Docker bind-mount arguments.
- **Verification**:
  - Executed: `./scripts/linux-desktop.sh record examples/starter scripts/demo/desktop-demo.sh /home/megastruktur/.hermes/profiles/planner/cache/scratch/dsn-gif-out/out.gif`.
  - Result: Exit code 0. Generated valid 800x500 GIF (865,865 bytes, 14.76 s duration, 177 frames, 12 fps).
  - Output logged in `evidence/sdk-v1/dsn-gif/raw/record-external-run.txt` (EXIT_CODE=0).

### Finding F2 (Low): Justification and Proof for `pnpm --filter @orbitkit/ui build` in `container_build`
- **Reviewer Question**: `container_build` runs `pnpm --filter @orbitkit/ui build`. Justify if the starter needs the packaged dist with a build failure proof, or revert it.
- **Justification**:
  1. `examples/starter/package.json` depends on `@orbitkit/ui: workspace:*`.
  2. `@orbitkit/ui` (`packages/orbitkit/package.json`) defines exports pointing to `./dist/index.js` and `./dist/index.d.ts`, compiled via `svelte-package -i src -o dist`.
  3. The `dist/` directories are strictly gitignored (`**/dist/` in `.gitignore`).
  4. When building the starter in a clean container or fresh worktree without pre-existing `dist/`, Tauri's `beforeBuildCommand` (`pnpm build` which runs `vite build`) fails during bundler analysis because `@orbitkit/ui` distribution files do not exist:
     ```
     Error: [vite]: Rolldown failed to resolve import "@orbitkit/ui" from "/home/megastruktur/orca/workspaces/orbitkit/oks-dsn-gif/examples/starter/src/views/MascotView.svelte".
     ...
     beforeBuildCommand `pnpm build` failed with exit code 1
     ```
- **Proof**:
  - Verified build failure when `packages/orbitkit/dist` is removed: `pnpm --filter starter build` failed with exit code 1 (`Error: [vite]: Rolldown failed to resolve import "@orbitkit/ui"`).
  - Recorded in `evidence/sdk-v1/dsn-gif/raw/f2-dist-proof.txt` (EXIT_CODE=1).
  - Therefore, running `pnpm --filter @orbitkit/ui build` prior to `tauri build` in `container_build` is strictly necessary to satisfy the workspace dependency. The step is retained.

READY FOR REVIEW at 2a480c8b6d6b9a493cea2876ec0b288651e57fa3
