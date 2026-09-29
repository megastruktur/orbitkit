# okc-starter-defaults — mascot movement optional + fix bottom clipping

Campaign: orbitkit-cutecare-v02 · Branch: `megastruktur/okc-starter-defaults` · Base: `178199b`

## Complaint 1 — example roam movement must not be default

**Root cause:** the LIBRARY already treats `windows.mascotWindow.roam` as fully optional
(`roam?: MascotRoamConfig` in `packages/orbitkit/src/config.ts`, `Option<MascotRoamConfig`> in Rust,
config test asserts `roam.is_none()` when absent). Only the STARTER opted in:
`examples/starter/src/orbitkit.config.json` had `"roam": { "width": 960, …, "speed": 24 }`.

**Fix:** removed the `"roam"` block from the starter config. `"fitContent": true` kept.
The mascot is now static by default (draggable, not self-moving); roam stays an allowed
optional key for anyone who wants it. Verified: `node -e require(config)` → `roam present: false`,
`fitContent: true`. No library/Rust changes (frozen for this card). `MascotView.svelte` already
guards all roam wiring with `if (roamCfg)` (park boot falls back to a no-op roam controller),
so no view change was needed.

**Required test cutover (consequence of the config change):** `tests/demo-b2.test.mjs` pinned the
roam block as default config. Per cutover rules the roam-presence test was replaced with a
roam-ABSENCE test (fails if roam is re-added to the default config) and the "roam zone exceeds
the fixed window" test (only asserted values of the now-removed block) was deleted, along with its
now-unused `demoWindowFit` import.

## Complaint 2 — mascot bottom cut off (~bottom third of the visible sprite)

**Root cause (measured on the CI recording, coordinator-verified):** the starter's boot fit
(`demoWindowFit` in `examples/starter/src/lib/windowFit.ts`, applied in `MascotView.svelte`)
sizes the window to the open-menu content union and clamps it into the WORK area, compensating
the clamp delta 1:1 with a content `shift`. The Rust side places the initial window using FULL
monitor bounds, so on the 1024×768 runner (taskbar 48 → work area 1024×720) the ideal y=456
clamped to 432 (delta 24) and `shift.y = 24` pushed the bottom-pinned mascot 24 px PAST the
window's bottom edge: ~11 px of the sprite visibly cut (the sprite's visible body is only ~16 px
of its 32 px frame after its own padding → "bottom third" impression). The CSS confirms the model:
`.fit-shift` sits at the window bottom and `.mascot-center-anchor` grows up from it, so
`translate(0, 24)` moves the mascot 24 px below the window bottom.

**Fix rule (Design B preserved):** cap the downward y compensation at the mascot's bottom edge —

```ts
y: Math.min(ideal.y - cy, height - m - gNew.y),
```

so `mascotLocal.y + m <= height` ALWAYS holds (the cap `height - m - gNew.y` is the padding slack
below the mascot's bottom; ≥ 0 because `maxYp >= m`). When the cap binds, the mascot moves UP with
the window — near work-area edges it yields to the taskbar like any OS window instead of being cut.
`mascotLocal` and `anchor` are both derived from the same capped `shift` (unchanged code path), so
the arc anchor stays glued to the mascot and menu discs still spawn around it. Window size stays
boot-constant; no setSize/setPosition on menu toggle; `clampFixedWindow` (post-drag re-clamp,
window-only move) untouched — it already implements "moves with the window". In the CI case the
whole 24 px delta is absorbed by the mascot (cap = 0: no padding below the mascot), so
`shift = (0,0)`, mascot bottom == window bottom exactly, screen y 648 → 624.

## Files changed (⊆ allowlist)

- `examples/starter/src/orbitkit.config.json` — roam block removed.
- `examples/starter/src/lib/windowFit.ts` — y-shift cap + doc comments.
- `examples/starter/tests/windowFit.test.mjs` — +3 tests (below).
- `examples/starter/tests/demo-b2.test.mjs` — roam cutover (see above).

`git diff --name-only 178199b..HEAD` = exactly these + `evidence/okc/starter-defaults/`.

## Tests (raw/)

New in `tests/windowFit.test.mjs`:
- **CI boot case** (window 404×404 @ (596,340), work area 1024×720, mascot 96, headGap 12,
  radius 150, itemSize 44, menuPad 8): window = (618,432,360,288); `shift.y ≤ 24` (capped to 0);
  `mascotLocal.y + 96 == height` (not clipped); mascot yields 24 px (screen y 648→624);
  `anchor.y == mascotLocal.y`; re-fit idempotent.
- **No-clamp case:** `shift == (0,0)`, mascot bottom == window bottom (unchanged behaviour).
- **Sweep property:** 8 work-area heights × 7 window y-offsets × 3 mascot sizes; whenever the
  y-clamp binds (69 clamped cases), `mascotLocal.y + m <= height` and `shift.y <= clamp delta`.

**Mutation sensitivity** (`raw/mutation-prefail.txt`): with ONLY the windowFit.ts change stashed
(pre-fix formula, new tests present): windowFit suite 10 pass / **2 fail** (CI case + sweep) —
the new tests detect the pre-change behaviour. With the fix: 12/12.

## Gates (raw/gates-full.log, raw/starter-test.txt)

- `pnpm -r build && pnpm -r test && pnpm -r check` → EXIT=0; vitest **379/379** (17 files,
  baseline preserved), starter node --test **32/32**.
- `pnpm --filter starter test` → 32/32, EXIT=0.

## Out-of-scope findings (NOT fixed here)

1. **Rust full-monitor boot placement:** `calculate_overlay_position`
   (crates/tauri-plugin-orbitkit/src/desktop.rs) uses `get_primary_monitor_geometry` (FULL monitor,
   not work area) → the initial overlay can start under the taskbar; the starter-side clamp then
   moves it. Library frozen for this card; with the cap the mascot now degrades gracefully
   (moves up 24 px) instead of being clipped.
2. **Horizontal analogue:** `demoWindowFit`'s 1:1 x-compensation can push the mascot/menu union
   past the window's side edge when the horizontal clamp delta exceeds the side padding (e.g. the
   existing 1100-px-wide work-area test case). Not part of the measured complaint (CI run had
   `shift.x = 0`); the existing test pins the 1:1 x behaviour. Flagging for a future card if
   side-clamped screens report clipping.

## Round 2 (review PASS, 2 Minor — doc drift)

- `examples/starter/README.md`: line 37 unpark clause and line 40 "always on: the mascot roams"
  rewritten — static by default (draggable, not self-moving); roaming is an optional library
  feature enabled via `windows.mascotWindow.roam` in the consumer's own config; the starter no
  longer enables it.
- `examples/starter/tests/demo-b2.test.mjs:62`: "faces its walking direction" reworded —
  faceByVelocity is kept for roam-enabled consumers (velocity stays 0 while static).
- `pnpm --filter starter test` re-run after the edits (`raw/starter-test-round2.txt`): 32/32,
  EXIT=0.
- Advisory check ("mutation capture invalid"): the FIRST capture attempt did fail (pathspec
  error, nothing stashed) but its green output was overwritten by the successful repo-root redo
  (`git stash push -- examples/starter/src/lib/windowFit.ts` → STASHED → capture → POPPED).
  `raw/mutation-prefail.txt` as committed shows `not ok 10` (CI boot case), `not ok 12` (sweep),
  `# fail 2` — the evidence is valid; no redo needed.

READY FOR REVIEW at 6c956528503a28f95f8be518583f4da712b6336a
