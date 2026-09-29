# REPORT okc-integ-fix4

Campaign: orbitkit-cutecare-v02 · Base: `641086315ae9cbdfaa9016c79a06292e0d363f8c` · Branch `megastruktur/okc-integ-fix4`

## What / why

`startRoam`'s tick loop handed the fractional internal roam state straight to
`RoamWindow.setPosition` (`{x: 12.8, y: 20.4}` style). Tauri's `set_position`
takes an integer `PhysicalPosition`; a real consumer passes the payload through
unchanged (demo-b2 observed every roam step rejected → mascot never moves).
Fix belongs in the library so no consumer can hit it.

## Change

`packages/orbitkit/src/roam.ts`:

- `tick()` rounds the stepped state and calls `setPosition({x, y})` with
  integers only; internal `state` stays fractional so slow speeds still
  accumulate motion across steps (rounding internal state would stall <0.5 px/step speeds).
- New `lastSent` guard skips the native call when the rounded position is
  unchanged from the last one sent (no redundant native calls; also bounds
  send rate at slow speeds).
- `lastSent` baselined at init (rounded initial `outerPosition`) and at
  `resume(at)` (rounded adopted/clamped drop point), so the first tick after
  init/drag-release only sends when the rounded position actually changed.
- Docs: `RoamWindow.setPosition` JSDoc now states coordinates MUST be integer
  physical px (Tauri `PhysicalPosition`); `startRoam` JSDoc states the
  rounding + skip-unchanged behavior.

`docs/api.md`: has no roam section (only radial-menu `ItemPosition` docs) —
per brief ("if it describes it") no change required.

## Tests (`packages/orbitkit/src/roam.test.ts`, describe `startRoam`)

1. `hands setPosition only integer coordinates over a fractional-step run` —
   speed 250 px/s (~8.33 px/step), asserts `Number.isInteger` on every
   coordinate of every `setPosition` call. Mutation-sensitive: FAILS on base.
2. `slow speed still accumulates movement (rounding must not stall)` — speed
   5 px/s (~0.17 px/step), asserts ≥15 px total displacement over 4 s
   (expected 20 px). Kills the "round internal state" mutation (verified:
   with `state = rounded(stepRoam(...))` this test fails).
3. `skips setPosition while the rounded position is unchanged` — speed 3 px/s
   (~0.1 px/step): ~60 ticks must produce <20 sends and no duplicate
   consecutive rounded points. FAILS on base (60 sends).

## Red → green evidence (raw/)

- `base-red-vitest.txt` — at base `6410863`: `Tests 2 failed | 48 passed (50)`
  (tests 1 and 3 red; test 2 green as designed — it guards the post-fix
  invariant against the stall mutation).
- `after-fix-vitest.txt` — after fix: `Tests 50 passed (50)`.
- `mutation-stall.txt` — with internal state rounded (the forbidden mutation):
  `Tests 2 failed | 48 passed (50)`, failing tests = slow-speed + skip tests
  (integer test still green under it, proving the two tests are complementary).
  NOTE: this check was run via a temporary in-place edit reverted with
  `git checkout` — which also reverted the uncommitted fix; the fix was then
  re-applied identically and re-verified green before any commit.

## Gate results

| Gate | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm -r build` | exit 0 (`raw/build.txt`) |
| `pnpm -r test` | exit 0 — `Test Files 17 passed (17)`, `Tests 376 passed (376)` (baseline 373 + 3 new) (`raw/test.txt`) |
| `pnpm -r check` | exit 0 (`raw/check.txt`) |
| `okc_tools/rust_gate.sh` | exit 0 — `67 passed; 0 failed`, `OKC_RUST_GATE_OK` (`raw/rust_gate.txt`) |
| `okc_tools/starter_gate.sh` | exit 0 — `OKC_STARTER_GATE_OK` (`raw/starter_gate.txt`) |

## Pre-existing test adjustment (in-scope file)

`createRoam > starts in the config corner with speed scaled to physical px/s`
pinned the old behavior: `toBeCloseTo(6.667, 0)` on the first hop magnitude.
With integer handoff the step is (−6, −4) for a (−5.61, −3.60) fractional
step → hop 7.211, diff 0.544 > 0.5 precision. The speed-scaling fact it guards
is unchanged (internal velocity is still 200 physical px/s); the assertion now
accepts the documented ≤0.5 px/axis rounding error (±0.71 px on the hypot)
while still failing on a wrong scale/speed (mutation-sensitive).

## Out-of-scope findings

- None in the codebase. (Environment note only: this worktree's shell wraps
  `pnpm`/`vitest` output through an "RTK" filter that compacts/summarizes
  output; gates were verified via exit codes + saved raw logs.)

READY FOR REVIEW at 27264cb49ee21d7ed9c19fe1da99329ca7ca84cd
