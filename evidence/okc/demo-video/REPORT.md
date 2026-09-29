# REPORT okc-demo-video (campaign orbitkit-cutecare-v02) — README demo recording 0.2.0

Task: adapt `scripts/ci/record-windows.ps1` to the 0.2.0 starter so the coordinator can
trigger the "Desktop Video" workflow (`.github/workflows/desktop-video.yml`) and convert
`video-windows.mp4` into `docs/media/demo-desktop.gif` (recipe commit `552f7fe`).

## Per-criterion results

1. **Show-overlay click removed (auto-show verified in source).**
   `examples/starter/src/views/MainView.svelte` `onMount` → non-Android → `void handleShowOverlay()`
   (comment: "demo-b1: show the overlay immediately on desktop…"). The new script only waits for the
   `^orbitkit-mascot$` window (15 s) and hard-fails if it never appears. RESULT: done.

2. **Geometry derived from real config, not hardcoded.**
   The script reads `examples/starter/src/orbitkit.config.json` via `ConvertFrom-Json` and recomputes:
   - mascot rendered box `m = frameWidth * scale = 32 * 3 = 96` (`mascot.size` asserted by the
     derivation script; `anchor: bottom-center`);
   - fixed Design-B window from `demoWindowFit` content union with `MENU_PAD = 8`
     (MascotView.svelte constant): **window 360×288**;
   - mascot pin inside the window: `((W−m)/2, H−m) = (132, 192)` — NOT the window centre;
   - K7 arc-anchor origin: `(132+48, 192−12) = (180, 180)`;
   - disc centres: angle `−180° + i·(span/(n−1))` with span 180, radius 150
     (`resolveMenuAngles` for `arc-anchor` → centre −90; `layoutItems`; `RadialMenu` centres each
     disc on its position via `translate(-50%,-50%)`).
   Before every click the script re-reads the live window rect via `GetWindowRect`
   (roam speed 24 px/s ⇒ never cache). RESULT: done (script `raw/derive-geometry.mjs`, output `raw/geometry-derivation.json`).

   Derivation output (disc centres in window coords, plus screen coords at the sample window rect
   `(12, 548)` — roam-zone corner origin on a 1920×1080 runner, work area 1920×1040):

   | i | id | label | angle | window (x,y) | screen sample (x,y) |
   |---|---|---|---|---|---|
   | 0 | app.notes | Notes | −180 | (30, 180) | (42, 728) |
   | 1 | app.timer | Timer | −157.5 | (41.42, 122.6) | (53.42, 670.6) |
   | 2 | app.bubble | Bubble | −135 | (73.93, 73.93) | (85.93, 621.93) |
   | 3 | app.alert | Alert | −112.5 | (122.6, 41.42) | (134.6, 589.42) |
   | 4 | app.badge | Badge +1 | −90 | (180, 30) | (192, 578) |
   | 5 | app.settings | Settings | −67.5 | (237.4, 41.42) | (249.4, 589.42) |
   | 6 | app.about | About | −45 | (268.07, 73.93) | (280.07, 621.93) |
   | 7 | app.park | Park | −22.5 | (318.58, 122.6) | (330.58, 670.6) |
   | 8 | app.quit | Quit | 0 | (330, 180) | (342, 728) |
   | — | mascot centre | — | — | (180, 240) | (192, 788) |

   All disc boxes (44 px) stay inside the 360×288 fixed window (x range 8…352, top y 8).

3. **B1 (planet must not blink or move on menu toggle).**
   Verified in source: the window is sized once at boot (`demoWindowFit`) and open/close is
   content-only inside the fixed surface (windowFit.ts header; MascotView: "the window never moves
   or resizes"). The script logs the window rect immediately before opening, while open, and after
   click-away close (`Log-Mascot-Rect`) so the reviewer sees size stays 360×288 and there is no
   toggle-induced jump (any drift is the expected roam ~24 px/s). RESULT: done (script evidence).

4. **Flow implemented (brief steps 1–8).**
   1. idle ~2 s → `01-main.png`; 2. click planet → menu open (centre-first stagger), hold ~1.5 s →
   `03-menu-open.png`; 3. click away (desktop point right/above the main window; the K10 passthrough
   lets it through, blur closes the menu); 4. menu → `app.alert` → hold 3.5 s (alert pool,
   `ttlMs` 8000 self-reverts); 5. menu → `app.notes` ×2, waits for window count `^Notes$` ≥ 1 then ≥ 2
   (Rust starter spawns `orbitkit-popup-notes-note-N`, one new window per click) → `04-notes-popup.png`;
   6. menu → `app.badge` ×2 → badge shows 2; 7. drag mascot centre by (+200, −80) (rightward so the
   drop stays inside the work area and no re-clamp jump muddies the demo), hold 1.5 s, rects logged
   before/after; 8. menu → `app.quit` → `WaitForExit(6000)`; script exits 1 unless exit code is 0
   (Rust: `app.exit(0)`). RESULT: done.

5. **Stills keep names 01…04; upload list matches.**
   `01-main.png`, `02-overlay.png`, `03-menu-open.png`, `04-notes-popup.png` unchanged. The Windows
   upload list in `.github/workflows/desktop-video.yml` now contains exactly: `video-windows.mp4`,
   the four numbered stills, `app.log`, `app-err.log`, `timeline.txt` (the old unnumbered copies
   `main.png`/`overlay.png`/`menu-open.png`/`notes-popup.png` are no longer produced; the script's
   Copy-Item block was dropped). macOS job untouched (out of scope; its script already emits the
   numbered stills). RESULT: done.

## Coordinator notes (GIF conversion, unchanged from 552f7fe)

Video name/format identical to 0.1.0 (gdigrab, 30 fps, libx264 yuv420p, `+faststart`, 800×600):
`ffmpeg -ss <start> -t <dur> -i video-windows.mp4 -vf "fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" docs/media/demo-desktop.gif`.
Timeline (`timeline.txt`) marks each step with timestamps; the verified-clean segments for
transparency/ghost checks are before the first menu open and after the click-away close.

## Assumptions (stated in script + derivation output)

- Runner at 100 % DPI ⇒ logical == physical px (same assumption the 0.1.0 script relied on).
- Boot-fit clamp shift — **superseded in Round 2**: round 1 assumed (0,0); the pre-fit window is actually the
  plugin's 404×404 bottom-right placement, whose ideal position does NOT fit the work area, giving
  `contentShift = (0, +16)` (40 px taskbar). The script now derives/observes the shift (see Round 2 section).
- Click-away closes the menu via window blur (MascotView documents this as the passthrough-mode
  close signal); round 1 clicked a bare-desktop point — Round 2 hardened it to the main window's
  title bar centre (deterministic focus change).

## Proof / verification

- No Windows runner here and no PowerShell on the megaserver (verified: `command -v pwsh` absent).
  Syntax check = manual review; the script intentionally uses only 0.1.0-proven constructs
  (identical Add-Type, EnumWindows delegate, click/drag/ffmpeg plumbing from the run that produced
  GIF run 36035495949). Geometry constants cross-checked by executing
  `raw/derive-geometry.mjs` against the real config (exit 0, output in `raw/geometry-derivation.json`
  and `raw/checks.txt`).
- The workflow run itself is coordinator-owned proof.

## Out-of-scope findings

- `scripts/ci/record-macos.sh` still duplicates numbered stills under unnumbered names
  (lines 282–285) and its upload list still references them — stale but functional; macOS is
  explicitly out of scope for this task. Since r3 the `video-macos` workflow job is removed, so
  `record-macos.sh` is unreferenced in-repo until the port is scheduled.
- The round-3/4 review file `okc_evidence/reviews/demo-video_r3.md` is absent from the worktree's plans
  copy (same pattern as the r2 brief); round-4 execution proceeded on the brief's inline findings summary.

## Round 2 — Major fixed: startup contentShift ignored by click geometry

**Confirmed in source (not just accepted from the directive).** `crates/tauri-plugin-orbitkit/src/desktop.rs`
creates the mascot window **small and square** — `calculate_overlay_size = max(mascot.size, 2·(radius+itemSize)) + 16
= 404×404` — at the **primary-monitor bottom-right** (`calculate_overlay_position` default, margin 24; config
`x`/`y` would override). `MascotView`'s `demoWindowFit` then sizes the window to the 360×288 content union,
keeps the mascot's screen position, clamps the ideal position into the monitor **work area**, and compensates the
content by the clamp delta (`contentShift`). The mascot's window-local position is `gNew + shift`, not the raw
pin. On a 1920×1080 runner with a 40 px taskbar (work area 1920×1040): mascot boot screen pos (1646, 960),
ideal window pos (1514, 768) → clamped (1514, 752) → **`contentShift = (0, +16)`** (48 px taskbar → (0, +24)).
Round 1 assumed shift = (0,0) — wrong; every click point sat `shift.y` px too high (16–24 px vs 22 px disc
radius: marginal, possibly surviving, possibly missing).

**Fix (script-only, in allowlist):**
- `record-windows.ps1` now derives the shift exactly like `windowFit.ts` + `desktop.rs`: pre-fit size/position
  from the plugin's documented formula + margin (config `x`/`y` honoured), work area from the **live**
  `PrimaryScreen.WorkingArea` (no taskbar-height guessing), `shift = ideal − clamped`; all click points use the
  effective pin `(132+shift.x, 192+shift.y)` and origin `(180+shift.x, 180+shift.y)`.
- **Observed-shift override**: the mascot wait loop now polls at 25 ms and, when it catches the pre-fit rect
  (> 360 px wide) before the fit lands, recomputes the shift from the **observed** rect and overrides the model
  (logged loudly if they disagree). The shift is boot-constant (roam placement and post-drag re-clamps move the
  window only), so it stays valid for the whole session.
- **Loud size assert** (review advisory adopted): the mascot window must reach exactly the derived 360×288 or
  the script exits 1 — a mismatch also catches any DPI ≠ 100 % before a full CI cycle is wasted.
- **Click-away hardened** (review advisory adopted): the menu-close click now targets the main window's title
  bar centre (deterministic focus change → overlay `onblur` → close) instead of a bare-desktop point.

`raw/derive-geometry.mjs` + `raw/geometry-derivation.json` updated: pre-fit window, ideal/clamped position,
shift, and all shift-corrected disc points (sample rect (12,548)): Notes (42, 744), Alert (134.6, 605.4),
Badge (192, 594), Quit (342, 744), mascot centre (192, 804).

## Contract questions

- The round-2 directive cites `plans/orbitkit-cutecare-v02/okc_briefs/demo-video-r2.md` and "BRIEF Goal items
  1-3"; neither exists — `okc_briefs/` contains only `demo-video.md` (no R2 appendix; its Goal is a single
  paragraph with no numbered items), and no campaign doc (HANDOFF/REPORT/MANIFEST) records the Major-finding
  text. Proceeded on the directive's inline substance — "click geometry ignores startup contentShift" — which
  source investigation confirmed (above). Fix kept strictly in the round-1 allowlist; if the missing r2 brief
  prescribes different acceptance criteria, coordinator to supply it.

## Round 3 (SUPERSEDED) → Round 4 (verified diagnosis, revert, instrumentation)

Round 3 shipped a roam work-area clamp as the "root-cause fix" for run 36546923402. **That diagnosis was
wrong and is retracted**: the review (r3 verdict FAIL) plus the coordinator's independent artifact
verification showed:

- The badge click point was **EXACT**: product formula origin = mascot rect centre-x, top − headGap (12) →
  (615, 486); disc at −90° → (615, 336); the script clicked (615, 336). Drift ≈ 8 px over the ~350 ms click
  latency vs a 22 px disc radius — the click was not the miss.
- The pre-existing `roamBounds` **already** shrunk the zone to fit (`travelLimits` + `min()` on width/height);
  the r3 "zone never shrunk" claim was false. The r2 geometry also held: the disc was clear of the popups.
- What the artifacts DO show: `app.alert`, `app.notes` (note-1, note-2) emitted, **no `app.badge` line**, and
  the mascot window **DESTROYED** (title gone from `EnumWindows`) ~2 s after the badge click, with **no
  app-side error line**. Root cause unknown. The next run's instrumentation (per-click aim/offset logs, miss
  diagnostics incl. `app-err.log` tail) is designed to decide it — we do not guess-fix.

**Round 4 changes:**
1. **Reverted** `packages/orbitkit/src/roam.ts` + `roam.test.ts` to the r2 state (`8d6f836`): the clamp change
   was out of scope (no located product bug) and its premise was disproven.
   `git diff 8d6f836..HEAD -- packages/orbitkit/src/roam.ts packages/orbitkit/src/roam.test.ts` is empty.
2. **Kept + completed the script determinism work** (`record-windows.ps1`, finding 2):
   - The fresh-rect wait is now a real **velocity prediction**: two rect reads 60 ms apart → per-tick
     velocity; button-down lead time = measured 350 ms (12×15 ms move + 80 + 80); the click aims at
     `predicted = current + v·latency`. After the move the rect is re-checked once: if the settled
     cursor-to-anchor offset error is > 6 px, it re-aims with a fresh prediction (up to 3 attempts), then
     proceeds anyway — and logs the achieved offset for **every** click (`<label> attempt N: aim (x, y),
     post-move offset E px (v=(vx, vy) px/s)`). The r3 "≤ 2 px" claim was false and is dropped.
   - The bounded not-found retry (5 s) stays and is now the **primary diagnostic instrument**: each miss logs
     (a) app process alive, (b) all visible window titles containing `orbitkit`, (c) the last 30 lines of
     `app-err.log`.
3. **Workflow**: stays at the r3 state — `video-macos` job removed, `video-windows` unchanged.

**Gates (r4)**: `git diff 8d6f836..HEAD -- <roam files>` empty; `pnpm -r test` 379/379 (roam suite back to the
r2 set); `pnpm -r check` clean; Rust gate `OKC_RUST_GATE_OK` (67); `derive-geometry.mjs` exit 0; pwsh 7.4.6
scriptblock parse → `PS-OK`. Evidence in `raw/checks.txt`.

## Round 5 (2026-09-29) — drag/Quit failure (run 36554786409 @ 1237f3e)

**Verified facts (from the r4 run evidence):** Alert, Notes x2, Badge x2 fired. Only Step 7/8 failed. The drag
ended (1015, 589), 9 px from the right screen edge. Mascot window before the drag: (629,405) 360x288; after:
(594,383) **512x360** = exactly half the 1024x720 work area per axis (the Aero-Snap quarter size). The mascot
window is built without `.resizable(false)`. Step 8 aimed with startup-derived local (330,204) at a 512x360 window
-> no `Menu action: app.quit` in app-err.log -> forced kill.

**Hypothesis status: UNPROVEN until the next run** (OS edge snap resized the window). No Windows runtime here.

**Changes (`scripts/ci/record-windows.ps1` only):**
1. Drag end point derived from `$WorkArea`, always >= 150 px inside every edge: preferred (+200,-80); if that
   violates the inset, drag ~200 px toward the work-area centre; then clamp into the inset rectangle. Logs start,
   end, margins L/R/T/B.
2. Rect watch: polled ~every 100 ms from the drag start through 2 s after drop; logs `Rect watch: t+Nms (L,T) WxH`
   whenever position OR size changes.
3. Hard assertion after settling: window must be `${WinW}x${WinH}`; otherwise logs work area, drag, full change
   history and `app-err.log` state, kills the app, `Write-Error`, exit 1.
4. Quit: still a real menu click. Before it: fresh rect + derived local/screen point logged, and a second size
   guard refuses to aim if the size differs. After it: existing `WaitForExit(6000)` + exit-code-0 requirement kept;
   forced kill stays as failure cleanup with `App did not quit from menu!`, exit 1. Logs whether
   `Menu action: app.quit` is in `app-err.log` (opened `FileShare.ReadWrite`, non-destructive).

**Worked geometry check** (work area (0,0) 1024x720, margin 150 => end X in [150,874], Y in [150,570]).
Start = (815,669) (mascot centre in the failed run). Preferred end (1015,589): X > 874 -> violates -> centre mode.
Vector to centre (512,360) = (-303,-309), |v| = 433; end = (815,669) + 200*(-0.700,-0.714) = **(675,526)**
(travel 200.1 px). Margins: L=675, R=349, T=526, B=194, all >= 150. Reproduced by running the same arithmetic
in pwsh 7.4.2. Quit local point: Origin/radius formula is unchanged (`Click-Item`); the failed run's local point
for a 360x288 window was (330,204), so with the window at (629,405) the screen target is (959,609). What matters
is that the rect is re-read fresh and asserted 360x288 before aiming.

**What the next run logs to decide the hypothesis:** the `Step 7: drag geometry` line (margins), `Rect watch:`
lines through the drop + 2 s. If a size change to 512x360 still appears with >= 150 px margins, snap by edge
proximity is disproved (look for a different resize cause, e.g. drag-to-top maximize/tiling, DPI); if size stays
360x288 and Quit works, the edge-proximity snap is supported. If it fails, the Step 7 FAIL line has the history.

**Out-of-scope findings:** the mascot window builder in `crates/tauri-plugin-orbitkit/src/desktop.rs` lacks
`.resizable(false)`; if the next run proves OS snap, adding it (or snap prevention) is a product change and
was NOT made here. Also: a fresh worktree needs `pnpm -r build` before `pnpm -r check` (`@orbitkit/ui` dist).

**Gates (r5):** pwsh 7.4.2 scriptblock parse -> `PS-OK`; `pnpm install --frozen-lockfile`, `pnpm -r test`
379/379, `pnpm -r build && pnpm -r check` clean. Runtime behaviour on Windows NOT verified.

READY FOR REVIEW at dc7ac2139b55a395cd4e9f9aeaef1e2493ad1622 (functional commit; the head commit adds only this sha line)

---

## GIF + README (okc-gif-readme)

**Source:** GitHub Actions "Desktop Video" run 36558460621, `windows-latest`, head `8dcd1fa8eb2c595eb569633803cedd0ba1fd93ee`, conclusion success.
Flow (timeline): Alert, Notes x2, Badge x2, drag (28 rect changes, window size stayed 360x288), Quit -> app exit code 0.
Source video `video-windows.mp4` sha256 `81a1c994e4639f850d12ad597e2d96d6b8a7f28756a6d9bb51be1c15e85bb8af` (re-checked here, matches).

**Conversion (done before this card, not re-run; ffmpeg ran in container `transcripter-worker-1`):**
`ffmpeg -ss 5.0 -t 39.4 -i video-windows.mp4 -vf "setpts=PTS/1.5,fps=12,scale=800:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=64"`
then `paletteuse=dither=none:diff_mode=rectangle`. 12 fps, 800x600 (source 1024x768, 4:3 kept), 1.5x speed-up, no re-encode in this card.
Previous recipe: commit 552f7fe.

**Committed `docs/media/demo-desktop.gif`:** sha256 `92421b4733160d78b26df57bfba529c2ca9b283617c1ad384c95935e2cb8484f` (== expected, checked before and after copy),
2 599 682 bytes (was 1 201 021), ffprobe: 800x600, r_frame_rate 12/1, 311 frames (counted), duration 25.91 s.

**README:** only the alt text and `<sub>` provenance line of the hero block changed (`git diff README.md`: 2 lines).

**Verification**
- sha256/dims/fps: as above.
- Frames: 9 evenly spaced frames (every 38th, n=0..304) extracted in the container and viewed as a 3x3 montage, plus a zoom on frames 258-281. I can view images; observed:
  - n=0: window `orbitkit` is entirely **white** (webview not yet painted) - first frame only.
  - n=38..76: dark app window with "OrbitKit Starter", mascot on the desktop, radial menu discs around the mascot (visible ring of icons), "Overlay displayed".
  - n=114: mascot near "Set Sleep", event log shows `app.alert`.
  - n=152..: first Notes popup ("Quick Notes") at top right, then second Notes popup on left; log shows `app.notes` x2.
  - n=190..304: red badge counter ("1", then "2") on the mascot; radial menu reopened at bottom right; mascot moves toward bottom right (drag) in later frames.
  - Background is the Windows Server desktop/taskbar and a terminal (runner), not transparent-over-clean-desktop; the mascot window itself has no black square.
  - **Defect:** in the frame at about n=264 a **white-outlined rectangle** (~340x290 px in the 800x600 frame, the size of the mascot window) is drawn over the app for a single sampled frame (neighbours at stride 3 are clean). It looks like a transient capture/window-frame artifact from the drag; I cannot tell whether it is a real product glitch or a gdigrab artifact.
  - **No visible Quit/clean-finish frame** in my sampled set: the last sampled frame (n=304) still shows the app running with the mascot bottom right; the ~7 frames after it were not inspected. I do not claim a clean finish.
  - Only 9 + 8 frames inspected; ghost trails between them are not ruled out. Independent reviewer must check the full GIF.
- Gates: `pnpm install --frozen-lockfile` ok; `pnpm -r test` 379/379 (17 files); `pnpm -r build && pnpm -r check` exit 0.
- Scope: `git diff --name-only main..HEAD` = README.md, docs/media/demo-desktop.gif, evidence/okc/demo-video/REPORT.md.

**Honest limits / out-of-scope findings**
- The white first frame and the single white-rectangle frame are baked into the byte-identical GIF (no re-encode allowed here). Fix would be `-ss` a bit later and dropping the artifact frame(s) - needs a new card.
- Windows runtime behaviour beyond what the recording shows is not verified.
- Sha line convention: like the previous section, the READY sha is the functional commit; the head commit only adds that line.

### Round 2 (supersedes the r1 GIF above)

r1 GIF (sha `92421b47...484f`) is **superseded**: it began with an unpainted white frame (source t < 5.3 s) and contained a white-outlined 360x288 rectangle (drag-capture artifact, source ~37.73-38.30 s).
An intermediate v5 GIF (sha `bf35853e...6448`, 270 frames) was **rejected** by me: frame n=229 still showed the outline (its cut window was on the wrong clock and its frame count was ~33 short). It was never committed.

**Committed GIF (v6, coordinator-encoded, byte-identical):** `docs/media/demo-desktop.gif`, sha256 `5c0dda31586d50fadf75243d00fed77c72eed0d1154965857658fcdcf1a67d40` (checked before and after copy), 2 500 724 bytes, ffprobe 800x600, 12 fps, 303 frames (counted), 25.25 s.
Source: run 36558460621 / head 8dcd1fa8eb2c595eb569633803cedd0ba1fd93ee, `video-windows.mp4` sha256 81a1c994e4639f850d12ad597e2d96d6b8a7f28756a6d9bb51be1c15e85bb8af, start at 5.4 s, 1.5x speed-up, 12 fps, 800px lanczos, palettegen stats_mode=diff max_colors=64 + paletteuse dither=none diff_mode=rectangle, ffmpeg in `transcripter-worker-1`.
Cut: trim/concat removing input-relative 32.30-32.95 s (absolute source 37.70-38.35 s, 0.65 s) to drop the capture artifact. Exact ffmpeg command line was supplied by the coordinator and is not reproduced here; I did not run the encode.
README `<sub>` line now also says "one 0.65 s drag-capture artifact cut"; alt text unchanged.

**Visual verification (I viewed the images; contact sheets of the committed GIF):**
- n=0: app window painted, "Overlay displayed" - no white first frame.
- n=131..133: radial menu discs open around the mascot; n=134: the first Notes popup at top right is solid **white/unpainted** (title bar + controls visible), n=135..137: same popup painted ("Quick Notes"). This is real webview paint latency, ~1 frame, kept deliberately.
- Sweep of every 6th frame n=150..300 (26 frames): second Notes popup also shows one unpainted white frame when it opens (same real behaviour); then two Notes popups, red badge 1 -> 2, radial menu reopening while the mascot is dragged toward bottom right.
- Junction n=254..262: both Notes popups, badge, mascot mid-drag; the mascot position steps (expected, 0.65 s removed); **no white outline rectangle** in any inspected frame.
- Last frames: n=298 menu open on the Quit path, n=299 app window shown with Notes closed (event log `app.badge`), n~300..302 only the terminal/desktop remains = app exited, clean finish.
- Limits: not every one of the 303 frames was inspected individually (coordinator's full scan found 0 artifact frames; mine covered n=0, 131-137, 150-300 stride 6, 254-262, 298-302). Ghost trails between sampled frames not ruled out.

**Gates:** docs-only change; `pnpm -r test` re-run below. `git diff --name-only main..HEAD` = README.md, docs/media/demo-desktop.gif, evidence/okc/demo-video/REPORT.md.

READY FOR REVIEW at b2b96eb22b3ce8096211e1828fb920100f65130b


## GIF v8

Supersedes the v7 GIF of this branch (review r1: FAIL). v7 ended with the Notes popup still open (final frame mid-close), and my v7 section wrongly claimed "app and Notes gone" for that frame. v8 extends the source end so the whole quit sequence is shown.

**Source:** Desktop Video run 36577656122, commit c33ea3f (windows-latest; app exit 0, all 6 menu actions fired, drag OK, size 360x288 held). `video-windows.mp4` sha256 `43a8fd42b6281d8bea9d766b5678d5a0dbdd0684141e83ac1ff84c9992e2b7fa`, 1024x768@30, 39.73 s.

**Committed GIF (coordinator-encoded, byte-identical):** `docs/media/demo-desktop.gif`, sha256 `e1fb960d3bc2cdf4cc1d8742fb8cd7dd5cf20c48d95c9f25812ee1213a5152b6` (checked on the candidate before copy and on the destination after copy), 1 117 035 bytes, 800x600, 12 fps, 251 frames (counted by frame extraction, n=0..250), 20.91 s. I did not re-encode.

**Recipe (coordinator, in `transcripter-worker-1`; I did not run the encode):** source 7.6..39.6 s (v7: ..39.0; Notes closes ~39.1 s, app exits ~39.4 s, source ends 39.73 s); drag-capture artifact span cut, absolute source 33.60-34.20 s (0.6 s), i.e. input-relative trim 0..26.0 + 26.6..(end; 31.4 in v7, exact v8 end supplied by the coordinator) via trim+concat (not select) - same drag-capture artifact class as the previous run; 1.5x speed-up; fps=12; scale 800x600 (4:3); palettegen stats_mode=diff max_colors=64 + paletteuse dither=none diff_mode=rectangle.

**Coordinator checks on v8:** junction clean, no outline; last frames' top-right white is a 1 px column only (Notes gone); first frame painted.

**My visual verification (frames extracted in the container; I viewed each image described here):**
- n=0: OrbitKit Starter window fully painted, log "Overlay displayed", mascot at bottom right; no white flash.
- n=244: main window, Notes popup (top right) and badge present, radial menu open with the power (Quit) disc at the bottom of the arc.
- n=245: main window and mascot gone; the Notes popup ("Quick Notes") is still on screen over the terminal.
- n=246..250 (viewed 247, 248, 249, 250; 246 seen in the sheet): only the terminal window and the Windows desktop/taskbar; no OrbitKit window, no Notes popup, no mascot. So the GIF ends on 4+ clean frames after quit (n=245 is the last frame with any app window).
- Cut junction n=205..216 (all 12 viewed): mascot is at the lower right of the app window in n=205, 206, 207 and steps up and slightly left at n=208 (expected drag-continuity step from the cut); stable at that position n=209..216. Notes popup and badge are continuous. No thin white 360x288 outline in any of these frames.
- Mascot bottom (v7 pre-drag check, frames 20/70/120/150 at 1.5x zoom, before the v8 swap; the first 208 frames are the same recipe range): full round body with ring and eyes above the taskbar, not flat-cut. I did not repeat the zoom crops on v8 pixels.
- Contact sheet of every 27th frame was viewed on v7 only; not repeated for v8.

**Known source behavior (not an encode artifact, not hidden):** each of two Notes popups opens unpainted for one frame each. In v8, n=102 and n=130 are a solid white "Notes" popup (about 250x340, top right) followed by the painted "Quick Notes" popup on the next frame; n=101 additionally shows a faint thin rectangle outline near the popup position just before the first white frame (popup window being created). These frames come from the source recording (real webview paint latency) and are kept. They are NOT the 360x288 drag-capture outline. Earlier wording "no ghost frames seen" and "0 white-outline artifact frames" refers only to the 360x288 outline class.

**README:** `<sub>` line cites run 36577656122, commit `c33ea3f`, 1.5x speed-up, 12 fps (still correct for v8; the artifact cut is documented here). Alt text unchanged from v7 (still matches the flow).

**Gates:** docs+binary diff. `pnpm -r test` was run in round 1 on this tree (vitest 379/379, node:test 32/32); not re-run in rounds 2-3 since no code changed. build/check not run.

Scope: `git diff --name-only c33ea3f..HEAD` = README.md, docs/media/demo-desktop.gif, evidence/okc/demo-video/REPORT.md. Round 2 accidentally committed a copy of the reviewer file `REVIEW_r1.md` at the repo root (outside the allowlist); round 3 removed it with `git rm`.

READY FOR REVIEW at 4eaad7cb96ec28b162c4dd47201f3da1b96e732f
