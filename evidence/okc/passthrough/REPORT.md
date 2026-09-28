# REPORT okc-passthrough (campaign orbitkit-cutecare-v02, attempt 1)

Task: `plans/orbitkit-cutecare-v02/okc_passthrough.md` — K10 opt-in click-through for the
transparent mascot window. Contracts: K10 in `okc_CONTRACTS.md` (consumed as-is; config type
`mascotWindow.passthrough?: boolean` already landed by okc-contracts in
`packages/orbitkit/src/config.ts:148`).

## Implementation

- `packages/orbitkit/src/passthrough.ts` (new): `startPassthrough(options)` →
  `PassthroughController { registerHitRegion, setPaused, stop }`. Poll loop (default 150 ms,
  clamped to ≥ `MIN_PASSTHROUGH_INTERVAL_MS` = 100 for K10's ≤10 Hz budget) reads
  `outerPosition()`, `scaleFactor()`, injected `cursorPosition()`; converts to logical window
  coordinates via exported pure helper `toLogical(cursorPhysical, windowPosPhysical,
  scaleFactor)`; hit-tests regions with exported `rectContains` (edge-inclusive). Interactive =
  inside any region OR `isDragging()`. `setIgnoreCursorEvents` fires only on state change
  (`lastApplied` cache, `null` = unknown → first sample always applies). `setPaused(true)`
  disarms the timer and forces non-interactive (`apply(false)`); stale in-flight polls abort
  after `await` if `stopped || paused`. Poll errors logged once per failure streak
  (`errorLogged` reset on next success). Tauri API injected via `getWindow` /
  `cursorPosition` options; the default `cursorPosition` resolves through a lazy dynamic
  `import("@tauri-apps/api/window")` inside the call path — nothing from `@tauri-apps` loads
  at module load.
- `packages/orbitkit/src/passthrough.test.ts` (new): 18 vitest tests, jsdom + fake timers +
  injected fake window (no Tauri runtime). Includes a mutation-sensitive source-text guard:
  `passthrough module load imports no @tauri-apps API at module load` reads this module's
  source (Vite `?raw` import) and fails on any top-level `import`/`export` line referencing
  `@tauri-apps` — the jsdom fakes cannot distinguish static from injected API usage.
- `packages/orbitkit/src/raw.d.ts` (new, 8 lines): ambient `declare module "*?raw"` typing for
  that `?raw` import (must live in a `.d.ts`; in a module file it would be an augmentation).
- `packages/orbitkit/src/index.ts`: one added line `export * from "./passthrough.js";`.

## Acceptance criteria

| # | Criterion | Result | Named test(s) |
|---|---|---|---|
| 1 | `startPassthrough({intervalMs=150, getWindow, isDragging})` → `{registerHitRegion, stop, setPaused}`; `registerHitRegion` returns unregister | PASS | `returns a controller whose registerHitRegion returns an unregister fn` |
| 2 | Logical hit test `(cursorPhysical - windowPosPhysical) / scaleFactor`; scales 1, 1.25, 2 | PASS | `toLogical converts physical cursor to logical window coords at scale 1, 1.25 and 2`, `hit-tests in logical coords: physical (450,250) inside only at scale 2`, `hit-tests at fractional scale 1.25` |
| 3 | Interactive iff inside any region OR `isDragging()`; `setIgnoreCursorEvents` only on change | PASS | `calls setIgnoreCursorEvents only when the state changes` (call count 1 → 2 → stays 2 across repeat polls), `keeps the window interactive while dragging even outside regions` |
| 4 | `setPaused(true)` stops polling, leaves window `interactive=false` | PASS | `setPaused(true) stops polling and forces passthrough` (API flips to `true`, `cursorPosition` calls frozen over 1000 ms fake time) |
| 5 | Poll errors logged once, polling continues | PASS | `logs poll errors once and keeps polling` (4+ failing polls → exactly 1 log; recovery re-arms logging → second streak logs once more) |
| 6 | Tauri API injected, no module-load import; tests in node/jsdom with fakes | PASS | `imports no @tauri-apps API at module load` (source-text guard; the rest of the suite runs in jsdom with pure fakes; `supports element regions via getBoundingClientRect` covers the `el` region branch) |
| 7 | build/test/check green | PASS | see Evidence; 186/186 tests, tsc clean, Rust gate `OKC_RUST_GATE_OK` |

Mutation sensitivity: criterion 2's scale-2 test fails if `/ scaleFactor` is dropped (same
physical point is outside at scale 1, inside at scale 2); criterion 3's count test fails if
`setIgnoreCursorEvents` fires every poll; criterion 4's test fails if pause does not force
non-interactive; criterion 5's test fails if errors log per-poll or the streak flag never
resets. For criterion 6 the jsdom fakes cannot catch a reintroduced static
`import … from "@tauri-apps/api/window"` (both load fine in jsdom), so the source-text guard
`imports no @tauri-apps API at module load` fails on that mutation — proven in
`raw/mutation-check.log`: with a static import injected at `passthrough.ts:1` the suite fails
(1 failed / 18, exit 1); after reverting, 18/18 pass. Additional regression coverage: stale
in-flight poll after `setPaused` cannot flip
state back (`a stale in-flight poll does not override a pause issued mid-poll`), unregister
takes effect next poll, `stop()` halts polling, interval clamp (K10 ≤10 Hz,
`clamps intervalMs to the K10 ≤10 Hz budget and samples immediately at start`).

## Verification commands (from worktree root)

```
export HOME=/home/megastruktur; export PATH=$HOME/.npm-global/bin:$HOME/.local/bin:$HOME/.cargo/bin:$PATH
pnpm install --frozen-lockfile      # ok
pnpm -r build                       # exit 0
pnpm -r test                        # exit 0 — Test Files 9 passed (9), Tests 185 passed (185)
pnpm -r check                       # exit 0
export OKC_RUST_GATE="bash plans/orbitkit-cutecare-v02/okc_tools/rust_gate.sh"
$OKC_RUST_GATE                      # exit 0 — OKC_RUST_GATE_OK (26 baseline tests, clippy -D warnings)
```

Raw outputs with exit codes: `raw/build.log`, `raw/test.log`, `raw/check.log`,
`raw/rust_gate.log`, `raw/passthrough-tests.log` (18/18), `raw/mutation-check.log`
(criterion-6 guard mutation proof).

## Scope deviations

- `packages/orbitkit/src/raw.d.ts` (8 lines, outside the strict allowlist): ambient
  `declare module "*?raw"` typing so the criterion-6 source guard can import module text via
  Vite `?raw` — `@types/node` is not installed (lockfiles frozen), so `node:fs` typings are
  unavailable. Must live in a `.d.ts`: inside a module file, `declare module` is an
  augmentation (TS2664).

## Out-of-scope findings

- None blocking. Note: `pnpm vitest run` executed via the local orca harness writes a JSON
  report to `packages/orbitkit/.vitest/`; that directory is not gitignored. Kept out of
  commits; plain `pnpm -r test` does not produce it.

## Contract questions

None.

## Notes

- Drag-always-interactive follows the CuteCare `cursorPoll()` production lesson: switching to
  click-through mid-drag swallows the terminating pointerup and strands the drag.
- Polling while `park` is sleeping (K10 sentence) is the mascot feature's integration concern;
  this controller exposes `setPaused` for exactly that. Not wired here (no mascot window
  wiring in this task's allowlist).
- Initial state: first sample is taken immediately at `startPassthrough` (not after a full
  interval) so the window reaches a defined click-through state within one tick.

Commits: code `be9323a`; evidence/report commits on top (see git log).
Final commit SHA: 6862c52

## Round 2 (review feedback @ b94c499 = PASS)

- **A (required)**: merged `megastruktur/okc-campaign` (743239f, anim-sheets) via
  `git merge --no-edit`; resolved `packages/orbitkit/src/index.ts` by keeping BOTH export
  blocks (`export * from "./passthrough.js"` + their `mascot/sheets.js` exports). Merge
  commit `9fc68f7`. No other file touched in the resolution.
- **B (required)**: `READY FOR REVIEW` line updated from stale `be9323a` to the round-2
  final SHA (this commit's parent; see git log + the line below).
- **C (minor)**: `apply()` in `passthrough.ts` recorded `lastApplied` before
  `setIgnoreCursorEvents` resolved, so a rejected call was never retried. Now the `.catch`
  resets `lastApplied = null` (guarded by `lastApplied === interactive` so a concurrent
  state change is not clobbered) and the next poll retries the same transition. New test
  `retries setIgnoreCursorEvents on the next poll after a rejected call` — verified
  failing-before: with the reset line removed the test fails (exit 1, only that test);
  restored, 19/19 pass.
- **Gates on merged tree** (exit codes in `raw/`): `pnpm install --frozen-lockfile` 0 ·
  `pnpm -r build` 0 · `pnpm -r test` **206/206** (10 files; 168 campaign baseline + 28
  anim-sheets + 19 passthrough) · `pnpm -r check` 0 · `$OKC_RUST_GATE` `OKC_RUST_GATE_OK`
  (gate covers the merged crate).

Final commit SHA: b0fa82bc64021aad47aae1230c70174034394e2e

READY FOR REVIEW at b0fa82bc64021aad47aae1230c70174034394e2e

## Round 3 (re-review @ 3333777 = FAIL on one item)

- **F1 (major)**: under persistent `setIgnoreCursorEvents` rejection (e.g. missing
  `core:window:allow-set-ignore-cursor-events` capability), the r2 retry logged
  `console.error` on EVERY poll. Now `apply()` keeps an `applyErrorLogged` streak flag: the
  `.catch` logs only when the flag is clear (then sets it), and `.then` on a resolved call
  clears it — one line per failure streak, re-armed by the next success. Retry semantics
  and the `lastApplied === interactive` guard untouched.
  Test `logs apply errors once per streak while still retrying every poll`: always-reject
  mock over 10 intervals → 11 calls (retry intact) but exactly 1 log; one success re-arms;
  next rejection streak (drag state change) → exactly a 2nd log. Verified failing-before:
  with the guard removed (r2 behaviour) the test fails (exit 1); restored, 20/20.
- **F2 (minor)**: removed the false claim that anim-sheets added Rust-side tests (Rust
  baseline unchanged at 26; gate covers the merged crate).
- **Gates on r3 tree** (exit codes in `raw/`): `pnpm -r build` 0 · `pnpm -r test`
  **207/207** (19 r2 + 1 new; passthrough 20/20 in `raw/passthrough-tests.log`) ·
  `pnpm -r check` 0 · `$OKC_RUST_GATE` `OKC_RUST_GATE_OK` (run post-merge).

Final commit SHA (round 3): c828a02

READY FOR REVIEW at c828a02


