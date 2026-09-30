# okv_demo-and-video — REPORT

- Branch: `megastruktur/okv-demo-and-video`; base `73f3d27` (task 2 integration tip)
- Functional commits: `10a84dd` (canvas demo wiring + record-macos.sh 0.2.0 port + workflow job),
  `d33da11` (**coordinator directive**: roam must NOT be default; showcase video = Windows worker),
  `a7912b4` (macOS click-settle fix + evidence artifacts), `cfb57f9` (never-blur flow: toggle-closes,
  mascot-centre drag, converging pair retries), `f870e16` (ps1 toggle-closes + pair retries)
- Scope touched: `examples/starter/**`, `scripts/ci/**`, `evidence/okv/demo-and-video/**`,
  plus `.github/workflows/desktop-video.yml` (re-add `video-macos` job — **user-approved scope
  expansion**, required because dark-desire screen capture is TCC-blocked over SSH and the job
  had been removed in r3).

## Per-criterion results (task spec, as amended by coordinator directive mid-task)

| # | Criterion | Result |
|---|---|---|
| 1 | `examples/starter` runs and showcases the **canvas-rendered** mascot | PASS — `renderer: "canvas"` shipped in `src/orbitkit.config.json`; runtime wiring proof: boot telemetry `renderer=canvas kind=sheets` on dark-desire (`raw/dark-desire-proof-d33da11.txt`); visual proof in the GH recording (`03-menu-open.png`, video frames: pixel-art sheets mascot + 9-disc arc menu). Note: the run-2 windows build did NOT bake `VITE_ORBITKIT_DEBUG` (fixed in the workflow afterwards), so `app-err-windows.log` carries the Rust `Menu action:` lines but no boot line |
| 2 | Verified on macOS peer `dark-desire` (Aqua WindowServer session) | PASS — built (`BUILD_OK`) and launched in the GUI session on `d33da11`; 1 Hz window sampling over 12 s (12 samples): 360x288 mascot window **frozen** at (4714,1128) (static default), boot line `renderer=canvas kind=sheets roamAxis=off roamSpeed=0`; see `raw/dark-desire-proof-d33da11.txt` |
| 3 | Showcase video recorded via screen capture on macOS… **AMENDED**: coordinator directive (user interjection): "record the video inside Github workers (windows)" + "while recording disable the roaming; roaming MUST NOT be the default" | PASS as amended — showcase artifact is the **Windows worker** recording (`video-windows.mp4`, GH run 36733228980 job `video-windows` SUCCESS, head `d33da11`; re-confirmed SUCCESS on run 36738526701 with the hardened driver); roaming disabled: starter ships without a `roam` block (static-by-default pin restored in `tests/demo-b2.test.mjs`), and the recording shows a constant window rect (618,432) 360x288 until the scripted drag |
| 4 | Video artifact committed to `evidence/` | PASS — `evidence/okv/demo-and-video/video-windows.mp4` (1.8 MB, 1024x768@30, 1110 frames / 40.27 s, sha256 `024de98252913716ed41268234a8b7c4b8efe85fe710b84f1fa790002ba11b27`) + `timeline-windows.txt` + 4 stills + `app-err-windows.log` |
| 5 | Inquisitor review | Round 1: FIX (4 documentation/config corrections — debug-bake contract, evidence attribution, numeric mismatches, transcript provenance) → all applied (`953bd5e`). Round 2: **PASS** (0.9) — fixes verified file:line, telemetry chain re-verified end-to-end. Post-PASS, a menu-state PARITY defect surfaced (`handleSelect` already closes the menu on item clicks; the drivers' post-item toggle-closes RE-OPENED it, silently dropping actions — run-5 Windows had lost alert+badge) → fixed in `dc19469` and all REPORT action counts corrected against the artifacts. Round 3: **PASS** (0.95) — delta verified against independently re-downloaded GH artifacts (run-2/4/5 logs match every quoted count; only Step-3 toggles remain; parity source-verified at MascotView.svelte:258-259) |

## What the showcase video contains (verified frame-by-frame via extracted frames, `raw/vw_*.png`)

- t≈6 s: overlay auto-shows; mascot window reaches the derived fixed 360x288 (Design-B fit).
- t≈10 s: radial menu open — 9 discs, centre-first stagger, canvas-rendered sheets mascot.
- Menu close (run-2 driver used the title-bar blur close; the shipped driver
  now mascot-toggles — see Failure analysis), `app.alert`, `app.notes` x2
  (window count 1 -> 2; Rust spawns `orbitkit-popup-notes-note-N`),
  `app.badge` — TWO clicks, ONE registered action + the red "1" badge visible
  at t=38 s (second click eaten; see Failure analysis) — drag
  ~(798,672)->(663,525) with size held 360x288, `app.quit` -> **app exit code 0**.
- `app-err-windows.log`: alert, notes x2, badge (one), quit; every scripted
  click achieved **0 px** post-move offset (velocity-predicted aims).
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

## Gates (local; logs in `raw/gate-*.log`, taken at the d33da11 test tree — later commits touch scripts/evidence only, test-tree-equivalent)

- `pnpm install --frozen-lockfile` OK
- `pnpm -r build` — exit 0
- `pnpm -r test` — vitest 17 files **402/402**; starter node tests **33/33**
  (incl. the new canvas-renderer contract test and the restored
  static-by-default test)
- `pnpm -r check` — exit 0

## GH Actions runs

| Run | Head | video-windows | video-macos | Note |
|---|---|---|---|---|
| 36732463908 | 10a84dd | cancelled | cancelled | recorded the roaming config; cancelled after directive |
| 36733228980 | d33da11 | **SUCCESS** (showcase artifact) | FAIL | mac: clicks lost after the title-bar close |
| 36734942689 | a7912b4 | FAIL (Notes #1) | FAIL (Notes #1) | same close-then-click loss; the 400 ms settle was not the mechanism |
| 36737264388 | cfb57f9 | FAIL (Notes #2) | FAIL (Notes x6) | mac drag started at the window corner — a passthrough region |
| 36738526701 | f870e16 | SUCCESS — but only `app.notes` x2 + `app.quit` fired (alert/badge clicks lost to the toggle-parity + eaten-click class; artifact inspected) | FAIL (Notes #2) | mac reached Notes #1; #2 blocked by the product issue below |

**Final disposition:** the showcase artifact is the **run-2 Windows recording**
(36733228980, stored + frame-verified here): it is the only artifact whose app-side log
shows the full action set (alert, notes x2, badge, quit). Run 5 re-proved the driver green
(exit 0, notes x2, quit) but its video misses the alert/badge beats — its flow still contained
the post-item toggle parity defect removed in the review-fix commit (see Failure analysis,
fix 3'). The `video-macos` job is removed again (r3 parity): the port is correct and
kept in `scripts/ci/record-macos.sh`, but the remaining macOS blocker is product-level
(see Failure analysis) and `crates/**` is outside this task's scope allowlist.

## Failure analysis (runs 2–5) — final root cause

Unified mechanism, proven by app-side telemetry (`MascotView` DOM logs + Rust
`[starter] Menu action:` lines in `app-err.log`):

> **After any focus change away from the overlay, the next click ON the overlay
> is consumed as the window-activation click; the webview never delivers it as
> a DOM event.** macOS does this deterministically; Windows does it flakily.

Evidence trail:
- run 2 (mac): exactly one `pointerdown` in the whole session; the alert click
  after the title-bar close never reached the DOM.
- run 3 (a7912b4): a 400 ms move→click settle did NOT change anything → the
  150 ms passthrough poll race was NOT the mechanism.
- run 4 (cfb57f9): with toggle-closes the overlay kept key status and Alert
  plus ONE Badge action delivered (`Menu action: app.alert`,
  `Menu action: app.badge` — one line — in `app-err.log`) — but the
  post-item "toggle-close" clicks RE-OPEN the menu (`handleSelect` already
  closes it on every item click, MascotView.svelte), so each following pair
  entered mismatched and badge #2 was silently lost; the scripted drag then
  started at the window's top-left
  corner (618,420), a K10 **passthrough region**; that click-through to the
  desktop took key status again and all six Notes attempts were eaten.
- run 4 (windows): Notes #1 opened, #2 lost — same semantics, flaky; run 2
  with the identical build/script had passed, so Windows tolerance varies.

Fixes shipped in f870e16 (both scripts, `scripts/ci/**` in scope):
1. **Never take focus from the overlay**: menus are toggle-closed by clicking
   the mascot again (`onToggle -> toggleMenu`, verified in MascotView.svelte);
   the ps1's `Close-Menu-By-Clicking-Away` is removed.
2. **Drag from the mascot centre** (a hit region), never the window corner —
   the bash port had used the raw window top-left where the ps1 uses
   `Get-Mascot-Point`.
3. **Converging (Open-Menu, Click-Item) pair retries** for Notes (feedback:
   visible-window count) and Quit (feedback: app exit) — from either menu
   state a pair either hits or flips the state, so two pairs always suffice;
   retries also absorb an activation-eaten click.
3'. **No post-item toggle-closes** (review-fix commit): `handleSelect` already
   closes the menu on every item click (MascotView.svelte), so a "toggle"
   after an item RE-OPENS it — proven by run-4 mac telemetry (`menuOpenBefore:
   false -> menuOpenAfter: true` right after `app.alert`) — and the next pair
   enters mismatched, silently dropping actions (run 5 Windows: alert/badge
   lost; run-4 mac: badge #2 lost). Every (open, item) pair now enters with
   the menu closed: open -> item fires + closes, deterministic. Only Step 3
   (a plain open/close showcase, no item clicked) toggles.

Result (run 5, f870e16): driver SUCCESS — but the artifact shows only
`app.notes` x2 + `app.quit` fired (alert and both badge clicks lost to the
then-present parity defect + eaten-click class; artifact inspected), so its
video is NOT used as the showcase. macOS got
further than ever — Alert, ONE Badge action and Notes #1 all delivered
(`Menu action: app.alert`, `Menu action: app.badge` — one line —
`Menu action: app.notes (instance note-1)`) — but the second popup
interaction still fails with a NEW signature: after note-1 opens, overlay
clicks produce only `window:blur`/`window:focus` pairs and ZERO DOM events
(6 pairs attempted), and the note-1 popup that was visible at t=46 s is gone
from view at t=50 s (behind the opaque main window — CGWindowList still
counts it). That is popup/window z-order + focus lifecycle behaviour inside
the plugin (notes popups are created by `crates/tauri-plugin-orbitkit`
`open_popup`, non-alwaysOnTop) and/or WKWebView on the current macOS runner —
NOT script-reachable: every reachable script lever (toggle-closes, hit-region
drags, pair retries with observable feedback) is in place and working.
Handoff for a follow-up task with `crates/**` scope:
`scripts/ci/record-macos.sh` is ready and drives the flow to Notes #1;
investigate popup z-order/focus on macOS (popup #1 hidden behind the main
window after the first overlay click; overlay clicks undelivered while a
popup exists).

## Out-of-scope findings

- macOS synthetic Quartz drags do not drive AppKit's native window move (known from sdk-v1);
  `record-macos.sh` logs the drag outcome and continues (0.1.0 precedent).
- Both Notes popups stack anchored to the mascot; the second hides fully behind the first in
  the video (window count + event log prove both). Pre-existing demo layout nuance.
- `scripts/demo/desktop-demo.sh` (Linux Xvfb) hard-codes 1280x800 coordinates — stale for
  Design-B; unused here (out of scope).
- dark-desire TCC: screen capture over SSH remains blocked ("could not create image from
  display"); macOS recording therefore runs on the GH worker (user-approved). Three TCC-hung
  avfoundation ffmpeg probes survived their `timeout` wrappers and were `pkill`ed; peer
  housekeeping also removed the stale okc FINAL smoke starter (PID 546, up since Tue) when
  `pkill -x starter` ran — intentional cleanup of this repo's own leftover, disclosed here.
  The peer went offline (SSH timeouts) near the end of the session; run-5 frame extraction
  was done locally with pyav instead.

READY FOR REVIEW at dc19469 (953bd5e + round-2-post parity fix; verdict history in criterion 5)
