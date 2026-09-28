# REPORT — okc-anim-sheets

Branch `megastruktur/okc-anim-sheets`, base `df298a9d1063042ba06b73096cc0bd3231820ec7`.
Code commit: **`a721dabf33da6b518ff078b8796942efe2eaed79`** (this report + `raw/` are committed on top).

## Result: ALL CRITERIA PASS

| # | Criterion | Result | Evidence (named mutation-sensitive test) |
|---|---|---|---|
| 1 | Pure `frameAt(sheet, elapsedMs)` + `sheetGeometry(sheet, scale, anchor)`, wrap when loop, clamp at last frame when loop=false | PASS | `sheets.test.ts`: `frameAt wraps modulo frames when loop is enabled` (would fail pre-change: helpers did not exist / sprite-kind CSS steps had no pure wrap semantics); `frameAt clamps at the last frame when loop is disabled` |
| 2 | Props `sheet` (name), `velocityX?`; shows named sheet; unknown sheet → console.error + first sheet | PASS | `Mascot.test.ts`: `falls back to the first sheet with console.error for an unknown sheet name` (asserts both the `console.error` payload `unknown sheet "does-not-exist"` and the rendered fallback `url("small.png")`); plus `renders the named sheet with scaled frame geometry` |
| 3 | 12px-high → 18px-high sheet swap keeps rendered bottom edge constant (anchor) | PASS | `Mascot.test.ts`: `keeps the bottom edge constant when swapping between sheets of different heights` (height 24px→36px @ scale 2, `style.bottom` stays `0px`; fails if anchor default or placement regresses to center) |
| 4 | Mirror only when `faceByVelocity && velocityX < 0`; last facing retained at `velocityX == 0` | PASS | `Mascot.test.ts`: `mirrors only while faceByVelocity and vx < 0, retaining facing at vx == 0` (sequence vx=1 → -1 → 0 → 1; fails if facing resets at vx=0); plus `never mirrors when faceByVelocity is off` |
| 5 | `reducedMotion` freezes on frame 0 | PASS | `Mascot.test.ts`: `freezes on frame 0 under reduced motion even as time passes` (fake timers advance 2000ms > one period, then `tick()`; `background-position-x` stays `0px`; fails if the animation timer still runs) |
| 6 | Existing Mascot tests pass; build/test/check green | PASS | 15 pre-existing Mascot tests green unchanged; `pnpm -r build/test/check` exit 0 (raw/build.log, test.log, check.log) |

## Implementation summary

- `packages/orbitkit/src/mascot/sheets.ts` (new): pure `frameAt` (1000/fps ms per frame, modulo wrap, clamp when `loop === false`, fps≤0→1fps / frames≤0→1 guards), `sheetGeometry` (integer-floored scale ≥1; bottom-center pins `bottom: 0px; left: 50%; translateX(-50%)`, center uses `top/left: 50%; translate(-50%, -50%)`), `sheetFrameStyle` (background-size/position hard frame swap, `image-rendering: pixelated`, optional `scaleX(-1)` mirror composed after the anchor transform).
- `packages/orbitkit/src/Mascot.svelte`: `sheet?: string` and `velocityX?: number` props; `kind:"sheets"` branch rendering `.orbitkit-mascot-sheet` with inline style from the helpers; unknown-sheet `console.error` + first-sheet fallback (`Object.keys` order); `setInterval` driven by `frameAt` (cleared on sheet/def/reduced-motion change), frame frozen at 0 under reduced motion; facing memory: mirror on vx<0, unmirror on vx>0, retain at vx==0/undefined. No CSS keyframe animation for sheets — hard swaps only. Existing svg/image/sprite paths untouched.
- `packages/orbitkit/src/index.ts`: appended only `export { frameAt, sheetFrameStyle, sheetGeometry }` + `export type { SheetGeometry }` from `./mascot/sheets.js`.

## Gates

- `pnpm install --frozen-lockfile` — ok
- `pnpm -r build` — exit 0
- `pnpm -r test` — exit 0, **187 passed (9 files)** = 168 baseline + 19 new (12 pure sheets + 7 component sheets)
- `pnpm -r check` — exit 0
- `$OKC_RUST_GATE` — exit 0, `OKC_RUST_GATE_OK`, **26 passed** (baseline 26; no Rust changes made)

## Scope deviations

- `packages/orbitkit/src/Mascot.svelte` (allowlisted): the existing public `state` prop is now destructured as `state: stateProp`. Required: a scoped binding named `state` makes the Svelte 5 compiler treat `$state(...)` as a store auto-subscription of that variable (runtime `store_invalid_shape` / `$state is not a function` in every Mascot test). Public prop API and behaviour unchanged; all 15 pre-existing Mascot tests pass without modification.
- No other files outside the allowlist were touched. `packages/orbitkit/src/mascot/index.ts` was intentionally NOT modified (not allowlisted); sheets helpers are exported from `src/index.ts` directly.

## Out-of-scope findings

- `docs/configuration.md` / `docs/api.md` do not yet document `mascot.kind:"sheets"` fields — not in this task's allowlist.
- `packages/orbitkit/.vitest/` (vitest JSON reporter output) is generated but not gitignored; removed from the working tree before handoff rather than adding a .gitignore entry (out of allowlist).

READY FOR REVIEW at a721dabf33da6b518ff078b8796942efe2eaed79
