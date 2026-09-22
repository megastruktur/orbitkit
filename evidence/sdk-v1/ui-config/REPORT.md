# Task Report: `oks_ui-config` (T04)

## Summary
- Established `@orbitkit/ui` package foundation with K2 typed config schema, K3 barrel, and compiling stubs.
- Implemented `defineConfig`, `validateConfig`, `withDefaults`, and full TypeScript types in `packages/orbitkit/src/config.ts`.
- Config validation checks path-based error formatting for all fields:
  - Mascot `kind` ('svg' | 'image' | 'sprite'), non-empty `src`, positive `size`, and sprite `frameWidth`/`frameHeight` requirements.
  - Menu `items` (1..12 count), unique item IDs matching `^[a-z0-9][a-z0-9_-]{0,31}$`, non-empty `label`, positive `radius`, numeric start/end angles, positive `itemSize`, and `trigger` ('click' | 'hover').
  - Windows `popups` unique IDs, valid URL/title/dimensions, and optional `mascotWindow` settings.
- Config defaults: `mascot.size = 96`, `mascot.initialState = "idle"`, `menu.radius = 96`, `menu.startAngle = -90`, `menu.endAngle = 270`, `menu.itemSize = 44`, `menu.trigger = "click"`, `windows.popups = []`.
- Configured Vitest + JSDOM test setup with `@testing-library/svelte` support; 21/21 comprehensive unit tests pass green.
- Created compiling stubs for `Mascot.svelte`, `RadialMenu.svelte`, `geometry.ts`, and `bridge.ts` clearly marked with task ownership.
- Added consumer config smoke in `examples/starter/src/orbitkit.config.ts`, verified via `pnpm --filter starter check`.
- Verified package packaging via `pnpm --filter @orbitkit/ui pack` and consumer build in Vite + Svelte temp project.
- Verified monorepo full build `pnpm -r build` and full typecheck `pnpm -r check`.

## Scenario Results

| # | Scenario | Command | Expected | Actual / Evidence | Exit Code |
|---|---|---|---|---|---|
| 1 | tests | `pnpm --filter @orbitkit/ui test` | ≥ 15 pass counts | 21/21 tests passed green (`evidence/sdk-v1/ui-config/raw/01-ui-test.txt`) | 0 |
| 2 | package build | `pnpm --filter @orbitkit/ui build && ls dist` | files | Emitted `dist/index.js`, `dist/index.d.ts`, and component/stub artifacts (`evidence/sdk-v1/ui-config/raw/02-ui-build.txt`) | 0 |
| 3 | pack consumer | `pnpm --filter @orbitkit/ui pack` → install into temp dir with svelte+vite, vite build | exit 0 | Built 1-file consumer app importing bundle, executed in node with exit 0 (`evidence/sdk-v1/ui-config/raw/03-pack-consumer.txt`) | 0 |
| - | consumer typecheck | `pnpm --filter starter check` | exit 0 | Clean typecheck with starter importing `@orbitkit/ui` (`evidence/sdk-v1/ui-config/raw/04-starter-check.txt`) | 0 |
| - | monorepo build | `pnpm -r build` | exit 0 | All workspace packages build cleanly (`evidence/sdk-v1/ui-config/raw/05-pnpm-r-build.txt`) | 0 |
| - | monorepo check | `pnpm -r check` | exit 0 | Full typecheck clean across workspace (`evidence/sdk-v1/ui-config/raw/06-pnpm-r-check.txt`) | 0 |

## Deviations
- None.

## Out-of-Scope Findings
- None.

## Contract Questions
- None.

READY FOR REVIEW at 1c3f309b56b1df2887bb6f849d750986925652ba
