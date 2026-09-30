# okv_demo-and-video — REPORT

- Branch: `megastruktur/okv-demo-and-video`; base `73f3d27` (task 2 integration tip)
- Functional commits: `10a84dd` (canvas demo wiring + record-macos.sh 0.2.0 port + workflow job),
  `d33da11` (**coordinator directive**: roam must NOT be default; showcase video = Windows worker),
  `a7912b4` (macOS click-settle fix + evidence artifacts)
- Scope touched: `examples/starter/**`, `scripts/ci/**`, `evidence/okv/demo-and-video/**`,
  plus `.github/workflows/desktop-video.yml` (re-add `video-macos` job — **user-approved scope
  expansion**, required because dark-desire screen capture is TCC-blocked over SSH and the job
  had been removed in r3).

## Per-criterion results (task spec, as amended by coordinator directive mid-task)

| # | Criterion | Result |
|---|---|---|
| 1 | `examples/starter` runs and showcases the **canvas-rendered** mascot | PASS — `renderer: "canvas"` shipped in `src/orbitkit.config.json`; runtime proof: boot telemetry `renderer=canvas kind=sheets` in the GH recording (`app-err-windows.log`) and on dark-desire (`raw/dark-desire-proof-d33da11.txt`); visual proof in `03-menu-open.png` / video frames (pixel-art sheets mascot + 9-disc arc menu) |
| 2 | Verified on macOS peer `dark-desire` (Aqua WindowServer session) | PASS — built (`BUILD_OK`) and launched in the GUI session on `d33da11`; 12 Hz window sampling: 360x288 mascot window **frozen** at (4714,1128) for 12 s (static default), boot line `renderer=canvas kind=sheets roamAxis=off roamSpeed=0`; see `raw/dark-desire-proof-d33da11.txt` |
| 3 | Showcase video recorded via screen capture on macOS… **AMENDED**: coordinator directive (user interjection): "record the video inside Github workers (windows)" + "while recording disable the roaming; roaming MUST NOT be the default" | PASS as amended — showcase artifact is the **Windows worker** recording (`video-windows.mp4`, GH run 36733228980 job `video-windows` SUCCESS, head `d33da11`); roaming disabled: starter ships without a `roam` block (static-by-default pin restored in `tests/demo-b2.test.mjs`), and the recording shows a constant window rect (618,432) 360x288 until the scripted drag |
| 4 | Video artifact committed to `evidence/` | PASS — `evidence/okv/demo-and-video/video-windows.mp4` (1.8 MB, 1024x768@30, 1110 frames / 40.27 s, sha256 `024de98252913716ed41268234a8b7c4b8efe85fe710b84f1fa790002ba11b27`) + `timeline-windows.txt` + 4 stills + `app-err-windows.log` |
| 5 | Inquisitor review | PENDING — this report is the review input |

## What the showcase video contains (verified frame-by-frame via extracted frames, `raw/vw_*.png`)

- t≈6 s: overlay auto-shows; mascot window reaches the derived fixed 360x288 (Design-B fit).
- t≈10 s: radial menu open — 9 discs, centre-first stagger, canvas-rendered sheets mascot.
- Menu close (title-bar blur), `app.alert`, `app.notes` x2 (window count 1 -> 2; Rust spawns
  `orbitkit-popup-notes-note-N`), `app.badge` x2 (red "1" badge visible at t=38 s), drag
  ~(798,672)->(663,525) with size held 360x288, `app.quit` -> **app exit code 0**.
- `app-err-windows.log`: all menu actions fired (`app.alert`, `app.notes` x2, `app.badge`,
  `app.quit`); every scripted click achieved **0 px** post-move offset (velocity-predicted aims).
- Static proof inside the recording: window rect constant (618,432) 360x288 from boot until the
  scripted drag — **no roaming** (`timeline-windows.txt`).

## Coordinator-directive deviation from the written brief

The brief said to set `axis: "horizontal"` in the starter's roam config. Mid-task the
coordinator directed: video on the GH **Windows** worker, roaming disabled while recording,
roaming MUST NOT be the default. Implemented:

1. Starter default: NO `roam` block (static, draggable mascot) — `tests/demo-b2.test.mjs`
   re-pins static-by-default; a separate test pins `renderer: "canvas"`.
2. Roaming stays exercised as the **opt-in library feature** it is:
   - library tests (`roam.test.ts`, 402/402 suite green);
   - live peer proof on the pre-directive build (commit `10a84dd` shipped a temporary roam
     config): mascot x advanced 4089 -> 4465 (+376 px / 11 s ≈ speed 32) with **y frozen at
     928** across 12 samples — `axis: "horizontal"` lock holding live on macOS
     (`raw/dark-desire-proof-10a84dd-roam.md`).

## Gates (local, at a7912b4 tree; logs in `raw/gate-*.log`)

- `pnpm install --frozen-lockfile` OK
- `pnpm -r build` — exit 0
- `pnpm -r test` — vitest 17 files **402/402**; starter node tests **32/32** (incl. the new
  canvas-renderer contract test and the restored static-by-default test)
- `pnpm -r check` — exit 0

## GH Actions runs

| Run | Head | video-windows | video-macos | Note |
|---|---|---|---|---|
| 36732463908 | 10a84dd | cancelled | cancelled | recorded the roaming config; cancelled after directive |
| 36733228980 | d33da11 | **SUCCESS** (showcase artifact) | FAIL | mac: clicks #2+ fell through (see below) |
| 36734942689 | a7912b4 | rerun | rerun | verifies the click-settle fix |

## video-macos failure analysis and fix (a7912b4)

Run 36733228980 `video-macos` failed "first Notes popup not found" after a flawless start
(geometry derived 360x288, pre-fit 404x404 observed, static watch 11 samples / 0 movements,
first menu click 0 px offset, menu visually open in frame t=18 s). App telemetry
(`app-err.log` in the uploaded artifact) shows exactly ONE `pointerdown` — clicks #2+ never
reached the DOM. Root cause: K10 passthrough toggles `ignore_cursor_events` by **polling** the
OS cursor every 150 ms (`DEFAULT_PASSTHROUGH_INTERVAL_MS`); a click that lands within one poll
cycle of the move can arrive while the window still ignores cursor events. Fix: settle 400 ms
(≥ 2 poll cycles) between the move and the click / drag pointer-down in `record-macos.sh`.
The Windows driver is unaffected (proven SUCCESS run) and was not modified.

## Out-of-scope findings

- macOS synthetic Quartz drags do not drive AppKit's native window move (known from sdk-v1);
  `record-macos.sh` logs the drag outcome and continues (0.1.0 precedent).
- Both Notes popups stack anchored to the mascot; the second hides fully behind the first in
  the video (window count + event log prove both). Pre-existing demo layout nuance.
- `scripts/demo/desktop-demo.sh` (Linux Xvfb) hard-codes 1280x800 coordinates — stale for
  Design-B; unused here (out of scope).
- dark-desire TCC: screen capture over SSH remains blocked ("could not create image from
  display"); macOS recording therefore runs on the GH worker (user-approved).

READY FOR REVIEW at a7912b4
