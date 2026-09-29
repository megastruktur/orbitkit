# REPORT okc-roam-drag (campaign orbitkit-cutecare-v02, attempt 1, round 3)

Branch `megastruktur/okc-roam-drag`, base `2f73d78` (campaign tip + integ-fix1).
Implementation tip: `4f2b4f5` (evidence commit follows as the branch tip).
Round 1 (`0a54502`) reviewed FAIL (`roam-drag_r1.md`): B1 window-size
containment, B2 snap-back after drag release. Round 2 fixed both; r2 review
PASS. Round 3 (this round): campaign merge + r2 minors.

## Round-3 changes

- **Campaign merge**: `megastruktur/okc-campaign` @ `67b77ef` (popups-dynamic,
  bubble-badge, integ-fix2, …) merged as `1576901`; the single conflict was the
  additive one in `packages/orbitkit/src/index.ts` — BOTH sides' export lines
  kept, no existing line reordered.
- **F1 — `windowSize` is now a live source**: `RoamWindowSizeSource =
  RoamWindowSize | (() => RoamWindowSize)`; resolved at creation and on every
  drag re-base via `windowExtent`, but NOT per step (documented in
  `createRoam`'s JSDoc: a mid-run size change takes effect at the next
  re-base, or when the caller recreates the handle).
  Mutation-sensitive: `createRoam honours a live windowSize getter for the
  initial AND re-based zones` — asserts both the initial zone (904, 1904) and
  the re-based zone (500, 1500) after the getter returns a grown size;
  with `windowSize` dropped to `undefined` both zones would be (1000, 2000)
  and the test fails.
- **F2 — `resume(at)` clamps the point into the current zone** before
  re-aiming, so a drop outside the zone (half off-screen) starts from a valid
  position.
  Mutation-sensitive: `resume(at) clamps an out-of-zone drop before stepping`
  — drop (-500, 4200) must produce its first step ≤ 10 px from the clamped
  corner (0, 4000); unclamped, the first step sits ~540 px away and the test
  fails.

## Round-2 review fixes

- **B1 (AC1) — window stays inside the work area.** `roamBounds` /
  `rebaseRoamBounds` take an optional `windowSize` (physical px,
  e.g. `outerSize()`); the zone is computed for the window's TOP-LEFT with
  CuteCare's limit `hi = max(lo, inner.right − winW)` (`travelLimits`),
  so at every corner the window's right/bottom edge stays ≤ work area; an
  oversized window pins at the safe origin. `createRoam` accepts `windowSize`
  and threads it through the initial zone and every re-base. Chosen at the
  ZONE level instead of threading size through `startRoam`/`stepRoam`: the
  zone already encodes the point's valid travel set, so `stepRoam` stays
  point-based with one clamping authority; invariant and formula are the
  review's (`travelLimits`).
- **B2 (AC3) — no snap-back after a drag.** `RoamController.resume(at?)`
  adopts the given position and re-aims the velocity into the current zone;
  `createRoamDrag` now calls `resume(dropPoint)` after `onRebase`, so the
  first step after release starts at the drop point (a failed drop-point read
  still resumes without a point — nothing to adopt).
- **M1** — criterion 1/3 claims corrected below; round-1 tests indeed passed
  with both blockers present (they verified point-in-zone and late-step
  containment only).

Round-2 mutation evidence (`raw/mutation-r2.txt`): with `05a176f`'s
`roam.ts` in place, the new tests FAIL — `roamBounds shrinks the zone by the
window size so the window stays visible`, `roamBounds pins an oversized
window at the safe-area origin`, `roamBounds keeps the window inside the work
area at every corner over 400 steps`, `rebaseRoamBounds clamps the rebased
zone by the window size near the edges`, `startRoam resume(at) adopts the
given position instead of snapping back`, `createRoam re-bases the zone
around the drop point (clamped) on drag release` (39 pass / 6 fail);
fixed `roam.ts` restored, 45/45 green.

## Deliverable

- `packages/orbitkit/src/roam.ts` (new): K7 roam zone math + loop + K10 drag glue.
  - Pure: `roamBounds(workArea, scale, roamCfg)`, `rebaseRoamBounds(dropPoint, …)`,
    `stepRoam(state, dtMs, bounds)` with `MAX_STEP_MS = 250` dt cap,
    `aimRoamVelocity(from, bounds, speed)`.
  - Runtime: `startRoam({ getWindow, bounds, onVelocity, speed, intervalMs })` →
    `{ pause, resume, stop, paused, stopped }`; `setPosition` at ≤30 Hz
    (`MIN_ROAM_INTERVAL_MS = 1000/30` clamp); velocity emitted per step for
    `faceByVelocity`; `pause` never leaks its gap into the next dt.
  - `createRoamDrag({ roam, getDropPoint, onRebase, onToggle, onDragStart, … })` →
    `{ handlers, isDragging }`: composes the ONE sdk-v1 drag model
    (`createDragGesture`, 4 px threshold, 400 ms dragged-flag clear) with roam
    pause/resume and drop-point re-basing; `isDragging` feeds K10
    `startPassthrough`.
  - `createRoam({ getWindow, monitor, roam, … })` convenience composition
    (corner zone → loop → re-base-on-release), speed scaled to physical px/s.
- `packages/orbitkit/src/roam.test.ts` (new): 40 cases.
- `packages/orbitkit/src/index.ts`: own export lines appended only (values +
  types), no existing line touched or reordered.
- `packages/orbitkit/src/dragGesture.ts`: allowlisted, intentionally UNCHANGED —
  criteria 3/4 are met by composing the existing gesture; the single drag model
  needed no edits.

## Acceptance criteria

1. **Pure `roamBounds` + `stepRoam`, dt capped (250 ms) — DONE.**
   Corner anchoring with logical→physical scale + margin inset, **shrunk by
   the window's physical size so the whole window stays inside the work area
   at every corner** (round-2 B1 fix; round 1 wrongly claimed DONE — its tests
   treated the window as a point). Oversize clamped; step flips and reflects
   overshoot at all four edges; degenerate axes pin instead of NaN; dt clamp
   and negative-dt tested.
   Mutation-sensitive: `roamBounds keeps the window inside the work area at
   every corner over 400 steps` (window edges asserted ≤ work area at all 4
   corners through multiple bounces; fails on `05a176f` where the top-left
   could reach 1904,1023 on a 1920×1040 area), `roamBounds shrinks the zone
   by the window size so the window stays visible`, `stepRoam caps dt at
   MAX_STEP_MS so a stalled tab cannot teleport` (uncapped dt would move 10×
   and fail), `stepRoam flips and reflects at the left/right/top/bottom edge`.
2. **`startRoam` ≤30 Hz, pause/resume, velocity events — DONE.**
   `setInterval` argument asserted ≥ `MIN_ROAM_INTERVAL_MS`; 3 s window yields
   ≤90 `setPosition` calls with default and with `intervalMs: 1`; pause freezes
   with zero ticks; a 10 s stall while paused produces a ~3.4 px first tick
   after resume (a leaked dt would jump 25 px); `onVelocity` fires exactly once
   per step, aimed at the zone centre.
   Mutation-sensitive: `startRoam steps at most 30 times per second (default
   and clamped intervals)`, `pause freezes stepping; resume continues without a
   dt jump`.
3. **Drag: >threshold pauses roam + passthrough `isDragging`; release re-bases
   around drop point (clamped) and resumes FROM the drop point; ≤threshold is a
   click only — DONE.**
   `pause()` strictly precedes the native-drag attempt; release (pointerup /
   pointercancel / suppressed trailing click) reads the drop point, calls
   `onRebase(dropPoint)`, then `resume(dropPoint)` adopts it and re-aims the
   velocity (round-2 B2 fix; round 1 kept the stale pre-drag position and
   snapped back — its tests never checked the first step). A drag racing the
   rebase is never resumed by a stale release (generation guard); clicks never
   pause, never re-base.
   Mutation-sensitive: `crossing the threshold pauses roam before native drag
   starts`, `release rebases around the drop point, then resumes roam`,
   `createRoam re-bases the zone around the drop point (clamped) on drag
   release` — now ALSO asserts the first `setPosition` after release is within
   one step (~6.7 px) of the drop point, which fails on `05a176f` (180 px
   snap) — `startRoam resume(at) adopts the given position instead of snapping
   back`, `click below threshold only toggles the menu; nothing moves`.
4. **Lost pointerup never leaves dragging stuck — DONE.**
   Window focus change during drag releases it (rebase + resume); a swallowed
   trailing click leaves `isDragging` false and roam resumed immediately at
   pointerup, the 400 ms auto-clear restores click toggling; a failed drop-point
   read still resumes (logged once per streak).
   Mutation-sensitive: `a window focus change during drag releases it (lost
   pointerup)`, `a swallowed trailing click still leaves roam running; next
   click toggles`.
5. **build/test/check green — DONE.**
   Merged tree: `pnpm install --frozen-lockfile` exit 0; `pnpm -r build` exit 0;
   `pnpm -r test` **350/350 passed (16 files; 276 baseline + 45 roam + 29 from
   merged campaign tasks)**; `pnpm -r check` exit 0; `$OKC_RUST_GATE` exit 0,
   `OKC_RUST_GATE_OK` (cargo test + clippy -D warnings; no Rust authored here).

Mutation evidence: `raw/mutation-base.txt` — `roam.ts` does not exist at base
`2f73d78`, so every new test fails at base; `raw/gates.txt`, `raw/rust_gate.txt`.

## Scope deviations

- `.gitignore`: +1 line (`packages/orbitkit/.vitest/`, commented). The RTK
  vitest JSON writer creates that directory on every test run; the brief forbids
  committing it and it is not ignored at base, so `git status --porcelain` could
  never be clean without it. No functional code affected.
- No other allowlist deviations. `dragGesture.ts` untouched (see Deliverable).

## Out-of-scope findings

- `createDragGesture`'s click-fallback on failed native drag depends on the
  `onDragStart` callback **returning** the promise; a wrapper that swallows it
  silently keeps `dragged` true and swallows the trailing click. My first glue
  draft had exactly this bug (`roam.ts` now propagates the result and rethrows
  sync errors). Worth documenting for demo-b2: never wrap `onDragStart` without
  returning its result.
- `Mascot.svelte` wires neither `dragGesture` nor `passthrough` yet (expected;
  demo-b2 owns it). Composition for the demo:
  `const handle = createRoam({ getWindow, monitor: mascotMonitor-wrapper, roam: cfg.roam })`,
  attach `handle.drag.handlers` to the mascot element, pass
  `isDragging: handle.drag.isDragging` into `startPassthrough`.
- Pre-existing (at base, unrelated): build logs `[INEFFECTIVE_DYNAMIC_IMPORT]`
  for `@tauri-apps/api/window.js` (passthrough dynamic vs bridge static import).
  Warning only, build exits 0. Already noted by integ-fix1.

## Contract questions

None. K7 `mascotWindow.roam` config, K9 physical-px/mascot_monitor, and K10
`isDragging` were sufficient as specified.

READY FOR REVIEW at 4f2b4f5
