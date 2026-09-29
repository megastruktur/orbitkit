# REPORT okc-b1-fix-flash (campaign orbitkit-cutecare-v02, attempt 1)

Fixes the owner's B1 macOS smoke FAIL: "clicking close radial — mascot blinks
on wrong position after radial closed." (bug class seen before by the owner —
the word "again" matters.)

## Per-requirement result (brief §Fix, Design B)

1. **No `setSize`/`setPosition` on menu open/close** — DONE.
   `MascotView.svelte`: `applyFixedWindowFit()` runs once at mount; the window
   is sized/positioned ONCE to the largest content union (open-menu arc +
   mascot + pad). `toggleMenu`/`closeMenu` are content-only (`menuOpen` flip +
   `activeMenuConfig`); the shrink machinery (`scheduleShrink`,
   `SHRINK_DELAY_MS`, timers) is deleted. Enforced by a source-guard test:
   transitive scan from `toggleMenu`/`closeMenu`/`scheduleShrink` finds zero
   `setSize|setPosition` calls, and the setters appear ONLY inside
   `applyFixedWindowFit`/`reClampWindow`
   (`tests/demo-b1.test.mjs`, red at 342df70).

2. **Radial menu renders inside the same window** — DONE. The fixed rect is
   the OPEN-union rect (252x234 logical at 1280x800/scale1), computed by the
   rewritten state-independent `demoWindowFit` (`src/lib/windowFit.ts`). The
   arc (6 discs, radius 96, itemSize 44, headGap 12, pad 8) fits with
   margin (unit-tested). The menu is DOM inside the one transparent surface —
   same design as cutecare `663f721` (FABLE-DIAGNOSIS §6).

3. **Clicks on empty transparent area reach the app underneath** — DONE,
   unchanged K10: `startPassthrough` + `registerHitRegion(mascotEl)` +
   `menuHitRegion()` (discs) are untouched; the extra idle transparent area
   behaves like the pre-fix side padding, just larger. Verified implicitly by
   the scenario: the arc discs receive pointer events (clicks land), while
   the boot geometry matches r2's overlay behaviour.

4. **Work-area edges: clamp ONCE (startup / after drag / monitor change), NOT
   per open/close** — DONE, including the carried demo-b1 r2 Major #1 (mascot
   jump at screen edge): a debounced settle (500 ms > dragClearDelay 400 ms,
   `gesture.isDragged` guard, skipped while `menuOpen`) on
   `win.onMoved` + `win.onScaleChanged` + `pointerup`/`pointercancel` runs
   `reClampWindow()`: pure `clampFixedWindow` re-enters the window into the
   work area and compensates the content 1:1 (`shift -= clamp delta`) so the
   mascot stays visually fixed. One-shot, never on menu transitions.

5. **`fitContent` (K9) stays opt-in; library helpers untouched** — DONE.
   No changes outside the allowlist (verified: `git show --stat`). Starter
   behaviour change documented in `examples/starter/README.md` (window sized
   once at boot; open/close is content-only; one-shot edge re-clamp).

## Red runs (mutation-sensitive, at 342df70)

`evidence/okc/b1-fix-flash/raw/red-node-test.log` (exit 1, 10 pass / 8 fail):

- `Design B: idle and open states share ONE fixed window rect` — FAILED
  (old per-state model: `demoWindowFit(BASE,"idle")` window 144x96-shape vs
  `"open"` 252x234; with the new input shape the idle branch even yields NaN
  because it still reads `idlePadX`). This is the brief-required red.
- `Design B: no setSize/setPosition reachable from menu open/close` — FAILED
  (`applyWindowFit must not resize/move the window`).
- `clampFixedWindow` tests failed (helper did not exist).

After the fix: 18/18 pass (`green-node-test.log`), plus `pnpm -r build`,
`pnpm -r test` (18 pass, 0 fail), `pnpm -r check` all exit 0
(`b1-ws-test.log`, `b1-ws-check.log`).

## Gates

- `rust_gate.sh` → `OKC_RUST_GATE_OK`, exit 0 (`rust-gate.log`).
  (Note: brief's inline `$OKC_RUST_GATE` string was absent from my copy of
  the brief; per okc_COMMON.md I ran the canonical
  `plans/orbitkit-cutecare-v02/okc_tools/rust_gate.sh`, which is exactly the
  gate it describes.)
- `starter_gate.sh` → `OKC_STARTER_GATE_OK`, exit 0 (`starter-gate.log`).

## Runtime proof (Linux Xvfb :77, 1280x800, scale 1)

`scenario-designb.sh` (container run; `wmctrl -lG` dumps + full-screen
screenshots):

| phase | orbitkit-mascot rect |
|---|---|
| idle (after one-time boot fit) | 252x234 @ (982,541) |
| menu open | 252x234 @ (982,541) |
| menu closed | 252x234 @ (982,541) |

`raw/out-designb.{idle,open,close}.png` + `raw/out-designb.*.windows.txt`.
At 342df70 the same flow produced 144x96 idle -> 252x234 open (r2 evidence
`evidence/okc/demo-b1/raw/out-r2-menu.*.windows.txt`) — the resize+move pair
that macOS composites as NEW size at OLD origin; with Design B the rect is
byte-identical across the cycle (the Linux repro of the blink source is gone
by construction).

Webview-side toggle state at each click (starter's `log_telemetry` channel,
debug build): `menuOpenBefore:false -> menuOpenAfter:true` (open) then
`menuOpenBefore:true -> menuOpenAfter:false` (close).

Mascot pixel-identity (pixel-diff of the screenshots, mascot box
x1060-1160 / y690-776): idle vs open = **0 changed pixels**; idle vs close =
342 px — Glim's 4-frame idle sheet blink animation (different sprite frame),
centroid within 1.1 px; same position. The mascot never moves on open/close.

## Screenshots

- `raw/out-designb.idle.png` — fixed window, Glim bottom-centre, no menu.
- `raw/out-designb.open.png` — 6-disc arc open ABOVE the unmoved mascot,
  fully inside the fixed window.
- `raw/out-designb.close.png` — menu dismissed (toggle telemetry false),
  mascot at the identical spot; only sprite-frame differences vs idle.

## Round 2 (review FAIL at 614e126 → fixed)

Independent review failed the round-1 re-clamp design (content-shift
compensation). Required design (coordinator decision, matches CuteCare
`663f721`): **clamp with `setPosition` only**. Dispositions:

- **F1 (Major)** — `reClampWindow` updated `contentShift` but never
  `anchorRect`, so after an edge clamp the arc opened centred on the old
  spot (reviewer runtime repro: 60 px off). FIXED: the re-clamp now moves
  only the window; `contentShift`/`anchorRect` are boot-constant, and
  `anchorRect` (= mascot local pin + boot shift) stays correct by
  construction. Runtime repro after the fix (below): arc-disc centroid
  x=123.0 vs mascot centroid x=127.0 at the clamped left edge.
- **F2 (Major)** — the clamp shift only accumulated (never taken back out),
  leaving the mascot off-centre even after returning to mid-screen. FIXED:
  `clampFixedWindow(window, workArea) → Rect` is stateless (no shift
  in/out); the mascot's window-local position is a pure function of the
  untouched window size and cannot drift. Regression test
  ("clamp is stateless: below-area, back-to-centre, left-edge sequence…")
  walks the exact sequence and asserts the local pin is unchanged.
- **F3 (Minor)** — contentShift-before-setPosition one-frame artefact. FIXED
  by removing the DOM write: the clamp path touches no DOM state.
- **F4 (Minor)** — REPORT named a non-tip sha. FIXED: see the final line.

New/updated guards (all red on 2e632a1,
`raw/red-r2-scratch.log`, run in a `git archive 2e632a1` scratch dir outside
the worktree):

- guard test: `reClampWindow` must not write `contentShift`/`anchorRect`,
  must clamp via `setPosition`, must never `setSize` → fails on 2e632a1
  ("reClampWindow must not write contentShift").
- `clampFixedWindow` returns a bare rect (no shift/anchor keys to desync) →
  fails on 2e632a1.
- stateless-sequence test (feet below area → centre → left edge; local pin
  constant) → fails on 2e632a1.

Round-2 gates (all exit 0): `pnpm -r build` / `pnpm -r test` (18/18) /
`pnpm -r check` (`raw/r2-build.log`), `rust_gate.sh` (`OKC_RUST_GATE_OK`,
`raw/rust-gate-r2.log`), `starter_gate.sh` (`OKC_STARTER_GATE_OK`,
`raw/starter-gate-r2.log`).

Round-2 runtime proof (`raw/scenario-r2-clamp.sh`, Xvfb :77): reviewer's F1
repro — `xdotool windowmove` the mascot window to x=-60, settle (500 ms
debounce one-shot clamp), then open the menu at the clamped spot:

| phase | orbitkit-mascot rect |
|---|---|
| idle (boot fit) | 252x234 @ (982,541) |
| after windowmove to (-60,541) + settle | **252x234 @ (0,541)** — re-clamped |
| menu open at the clamped spot | 252x234 @ (0,541) — unchanged |

`raw/r2-clamp.{idle,reclamped,menu}.png` + `raw/r2-clamp.*.windows.txt`.
Arc centred on the mascot after the clamp: disc centroid x=123.0 vs mascot
centroid x=127.0 (4 px, disc ring asymmetry at the arc ends; was 60 px off
before the fix). The clamped geometry is the accepted edge behaviour: the
whole fixed window (and the entire arc, leftmost disc box x≥8) stays inside
the work area; the mascot rides with the window.

Untouched and re-verified: menu open/close natives-free (guard), fixed-rect
identity idle/open/closed, red-then-green vs 342df70, K10 click-through.

## Owner request: planet mascot

Owner: "I enjoyed the monster, but it's outside of the OrbitKit orbital
theme." Commit `f1c1c69` swaps the sprite drawing only — geometry untouched:

- `scripts/gen-sheets.mjs`: Glim drawing replaced by an animated pixel-art
  demo planet; identity from the 0.1.0 starter SVG (`098f969`): body
  `#4f7cff`, ring `#9db4ff` tilted -20deg, white eyes, `#10141a` pupils.
  Ring drawn as a band along the rotated ellipse (behind-half under the
  body disc, front-half over it); "spin" = travelling highlight phase.
  Deterministic, dependency-free (node:zlib), same 32x32 frames x4 /
  128x32 strips, same sheet names/files (`glim-*.png`) and fps — config
  states/pools stay valid, `orbitkit.config.json` unchanged.
- Animations: idle = slow ring spin + gentle 1px bob + blink (frame 3);
  alert = 3x-faster spin + pulsing outer band + wide eyes; sleep = closed
  eyes + slowest spin + growing "z".
- Anchoring: body centre pinned at (16,18) in the frame — same visual
  footprint and bottom-centre position in the fixed window; all Design-B
  rect/geometry numbers unchanged (runtime dump below: same 252x234 @
  (982,541)).
- Renamed remaining "Glim" references (README, MascotView comment,
  src-tauri comment, test names). New config-driven test: every sheet under
  `mascot.sheets` decodes to width = frameWidth*frames, height =
  frameHeight. Suite 19/19.
- Screenshots (Xvfb :77): `raw/planet-idle.png` (planet idle at the fixed
  window), `raw/planet-menu.png` (menu open, planet unmoved),
  `raw/planet-alert.png` (alert state via the app.alert menu action: wide
  eyes + fast spin, inside the 8s TTL; window rect unchanged).
- Gates: `pnpm -r build/test/check` exit 0 (`raw/planet-build.log`),
  `OKC_RUST_GATE_OK` (`raw/rust-gate-planet.log`), `OKC_STARTER_GATE_OK`
  (`raw/starter-gate-planet.log`).

## Contract questions

None. Everything fit the allowlist; `packages/` and `crates/` untouched.

## Out-of-scope findings

1. `demo-b1` r2 Minor #4 ("one-frame flicker possible", MascotView:112-113)
   is RESOLVED by this design (no per-toggle native calls at all).
2. `@orbitkit/ui` `createDragGesture` has no `onDragEnd` callback; the
   starter approximates drag settle via debounced `onMoved` + pointerup. If a
   library-level drag-end hook is wanted later, that's an API addition in
   `packages/orbitkit/src/dragGesture.ts` (out of scope here).
3. On a mid-menu monitor/scale change the re-clamp is skipped (never native
   geometry while the menu is open); the next drag/settle re-clamps. A full
   re-fit on DPI change (physical size drift) is a possible future K9
   extension, not needed for this fix.
4. Diagnostic artefacts from the investigation (kept under `raw/` for the
   reviewer: `scenario-diag*.sh`, `diag*.png`, `/tmp` logs excluded): the
   committed tree contains NO debug instrumentation; MascotView.svelte is
   byte-identical to the fix commit.

## Commits

- `e2245ca` red Design-B tests (fixed-window rect identity + source guard)
  failing on 342df70
- `614e126` Design B — fixed-size transparent mascot window, content-only
  menu transitions
- `2e632a1` evidence — REPORT, red/green runs, gates, Linux runtime proof
  (round-1 review snapshot)
- `fa79bc3` r2: setPosition-only edge re-clamp (review F1-F3)
- `72bca8f` r2 evidence — scratch red log, r2 gates, edge-clamp runtime proof
- `6b295e3` r2 follow-up: anchor invariant nit + F4 report sha
- `f1c1c69` owner request — planet mascot replaces Glim (orbital theme)
- `a845e83` planet evidence — idle/alert/menu screenshots, gates, REPORT
  section (this file's final state; see sha note above)

READY FOR REVIEW at a845e83
