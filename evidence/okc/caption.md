# okc2-caption — evidence

## Task

K14 caption (`.orbitkit-caption`) jumped on label change when the menu is a
horizontal arc (`arc.position: "left"`/`"right"`): `.orbitkit-caption-arc-left`
/ `-arc-right` pinned the pill **edge** to the arc origin
(`translate(calc(±100% + 16px), -50%)`), so the pill shifted by half the
label-width delta. Fix: both classes now centre on the origin
(`translate(-50%, -50%)`) — same placement as the base `.orbitkit-caption`
(dead centre). Classes kept as public styling hooks; `captionArcClass` JS and
`arc-top`/`arc-bottom` untouched.

## Environment

- Worktree: `okc2-caption` (branch `megastruktur/okc2-caption`, base `f1d8a81` = main)
- Node via pnpm 12.4.1; vitest 5.0.1; svelte 5.57.1; jsdom 30.1.0
  (`@testing-library/svelte` 5.4.2)

## Changes

- `packages/orbitkit/src/RadialMenu.svelte` — CSS block `.orbitkit-caption-arc-left`
  / `.orbitkit-caption-arc-right`: `transform: translate(-50%, -50%)`; comment
  updated (caption centred on arc origin, no jump on label change).
- `packages/orbitkit/src/RadialMenu.test.ts` — additions only (verified:
  0 removed lines in diff): new `arcLeftConfig`/`arcRightConfig` configs +
  two cases in the existing "position class follows the arc" test (now 6 cases:
  top, bottom, left, right, arc-anchor → arc-top, non-arc → center).

## Commands & results

```
$ cd packages/orbitkit && pnpm test
 RUN  v5.0.1 .../packages/orbitkit
 Test Files  17 passed (17)
      Tests  428 passed (428)
   Duration  1.76s
EXIT=0
```

## Acceptance criteria

1. ✅ Both horizontal caption classes have `transform: translate(-50%, -50%)`.
2. ✅ Position-class test covers 6 cases (top, bottom, left, right,
   arc-anchor → arc-top, non-arc → center).
3. ✅ `pnpm test` in `packages/orbitkit` fully green: 17 files / 428 tests, exit 0;
   existing test expectations unchanged (diff is additions only).
4. ✅ Commit on `megastruktur/okc2-caption`.

## SHA

- Fix + tests: `433f687e66bd3cae3bdf95c1c967d6f181877bb7`
