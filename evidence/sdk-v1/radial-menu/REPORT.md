# Task Report: `oks_radial-menu` (T06)

## Summary
- Implemented configurable arc/radial menu geometry and Svelte 5 component for `@orbitkit/ui`.
- **Pure Geometry (`packages/orbitkit/src/geometry.ts`)**:
  - `layoutItems(n, radius, startDeg, endDeg): ItemPosition[]`.
  - 0° = right, clockwise (screen y down).
  - Full ring (`|end - start| >= 360`) distributes $n$ points without duplicating the endpoint.
  - Partial arc includes both endpoints ($n=1$ places at midpoint).
  - Coordinates rounded to 0.01 precision with negative zero normalization.
  - Exports `layoutItems` and `ItemPosition` interface (K3-A1).
- **RadialMenu Component (`packages/orbitkit/src/RadialMenu.svelte`)**:
  - Required props: `config: MenuConfig`, `open: boolean`, `onselect: (id: string) => void`, `onclose: () => void`.
  - Items positioned absolutely around component center with circular button geometry.
  - Disabled items cannot be selected (`disabled`, `aria-disabled="true"`, click and hover ignored).
  - Escape key closes menu (`onclose`).
  - Outside click / pointerdown closes menu (`onclose`).
  - Arrow keys (ArrowDown, ArrowRight, ArrowUp, ArrowLeft, Home, End) cycle focus among enabled items.
  - WAI-ARIA roles: container `role="menu"`, items `role="menuitem"`.
  - Open CSS transition and keyframe scale/fade enter animation respecting `@media (prefers-reduced-motion: reduce)`; close is instant DOM unmount via `{#if open}` to ensure non-interactive closed state immediately in DOM.
  - Icon rendering: emoji text in `<span aria-hidden="true">` or `<img>` if URL.
  - Closed state: renders nothing interactive in DOM.
- **Unit Tests**:
  - `geometry.test.ts`: 10 tests covering full ring cardinal points, negative start angles, partial arcs, $n=1$ midpoint, radius scaling, negative angles, 12 items, boundary conditions, coordinate rounding.
  - `RadialMenu.test.ts`: 11 tests covering item rendering, closed rendering nothing, onselect callbacks, disabled item handling, Escape key, outside pointerdown dismiss, external trigger button opening without immediate close, single onclose on slow press, keyboard focus cycling, icon URL vs emoji rendering, hover trigger.
  - Full `@orbitkit/ui` vitest suite: 42/42 passing tests.
- **Build & Verification**:
  - `pnpm --filter @orbitkit/ui check` passes cleanly (0 errors).
  - `pnpm --filter @orbitkit/ui build` succeeds with svelte-package.
  - Monorepo `pnpm -r check` and `pnpm -r build` pass cleanly.
- **Visual Demo & Screenshot**:
  - Interactive demo in `packages/orbitkit/demo/menu.html` and `packages/orbitkit/demo/menu.ts`.
  - Headless Chrome capture verifying full ring (6 items) and half arc (4 items) side-by-side with dark UI styling and center markers (`evidence/sdk-v1/radial-menu/demo.png`).

## Scenario Results

| # | Scenario | Command | Expected | Observed | Exit Code |
|---|---|---|---|---|---|
| 1 | unit | `pnpm --filter @orbitkit/ui test` | pass | 42/42 tests passed across 3 test files (`evidence/sdk-v1/radial-menu/raw/01-ui-test.txt`) | 0 |
| 2 | visual | headless screenshot demo | PNG ring + arc | 1000x750 PNG captured showing full ring and half arc side-by-side (`evidence/sdk-v1/radial-menu/demo.png`, log in `evidence/sdk-v1/radial-menu/raw/04-screenshot.txt`) | 0 |
| - | ui-check | `pnpm --filter @orbitkit/ui check` | exit 0 | Typecheck clean with zero errors (`evidence/sdk-v1/radial-menu/raw/02-ui-check.txt`) | 0 |
| - | ui-build | `pnpm --filter @orbitkit/ui build` | exit 0 | svelte-package dist build clean (`evidence/sdk-v1/radial-menu/raw/03-ui-build.txt`) | 0 |
| - | monorepo-check | `pnpm -r check` | exit 0 | Full typecheck clean across workspace (`evidence/sdk-v1/radial-menu/raw/05-pnpm-r-check.txt`) | 0 |
| - | monorepo-build | `pnpm -r build` | exit 0 | All workspace packages build cleanly (`evidence/sdk-v1/radial-menu/raw/06-pnpm-r-build.txt`) | 0 |

## Deviations
- Menu close is instant DOM unmount via `{#if open}`; only opening animates with keyframes/CSS transition. This guarantees that when `open` is false, no interactive elements or buttons exist in the DOM.
- T05's screenshot approach was not present on this base (T05 was developed in a parallel worktree); per COORDINATOR NOTE, probed available tooling and used headless Chrome (`~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`) to capture Vite-served `packages/orbitkit/demo/menu.html` on port 5312.

## Out-of-Scope Findings
- None remaining. (Resolved via K3-A2: `packages/orbitkit/vitest.config.ts` was extended to include `resolve: { conditions: ["browser"] }`, which cleanly resolved Svelte 5 SSR vs client resolution under Vitest and enabled removal of the temporary shim in `RadialMenu.test.ts`).

## Remediation Round 2 (Coordinator Decision K3-A2)
- Approved change applied:
  1. Added `resolve: { conditions: ["browser"] }` to `packages/orbitkit/vitest.config.ts`.
  2. Removed `vi.mock("svelte")` shim and associated `createRequire`/`node:module`/`@ts-ignore` imports from `packages/orbitkit/src/RadialMenu.test.ts`.
- Verification re-run:
  - `pnpm --filter @orbitkit/ui test`: 41/41 tests passing across 3 test files.
  - `pnpm --filter @orbitkit/ui check`: 0 errors.
  - `pnpm --filter @orbitkit/ui build`: clean dist build.
  - `pnpm -r check`: clean workspace typecheck.
  - `pnpm -r build`: clean workspace build.
- Verification logs (01–03, 05–06) regenerated in `evidence/sdk-v1/radial-menu/raw/`.


## Remediation Round 3 (Coordinator Review FIX @ 157dcf7)
- **F1 MAJOR — Opening click closes menu (RadialMenu.svelte)**:
  - Problem: When a parent opened the menu from an external trigger's click (the Mascot→menu pattern), window-level `onclick`/`onpointerdown` handlers fired within the same bubbling/capturing event, immediately calling `onclose()`.
  - Solution: In `packages/orbitkit/src/RadialMenu.svelte`, replaced window `onclick`/`onpointerdown` handlers with outside-dismiss on one event type only (`pointerdown`, capture), armed only after the opening event completes via `$effect` with `setTimeout(..., 0)`. Included cleanup returning `clearTimeout` and `removeEventListener`. Removed 50ms timestamp debounce and window `onclick` listener.
  - Test added in `RadialMenu.test.ts`: External trigger button click opens menu, `onclose` is NOT called, items are rendered; pointerdown on an item is not "outside" (does not close); later pointerdown outside calls `onclose` exactly once.
- **F2 minor — Double onclose on slow press**:
  - Resolved by F1: Window outside-dismiss listens exclusively to `pointerdown` in capture phase; `pointerup` and `click` do not have handlers on window.
  - Test added in `RadialMenu.test.ts`: Slow outside press (`pointerdown` followed by `pointerup` and `click`) invokes `onclose` exactly once.
- **F3 minor — Evidence logs**:
  - All 6 raw evidence logs (`01-ui-test.txt`, `02-ui-check.txt`, `03-ui-build.txt`, `04-screenshot.txt`, `05-pnpm-r-check.txt`, `06-pnpm-r-build.txt`) regenerated with required shell env and verified to end with their exit code (`EXIT_CODE=0`).
  - Re-captured `evidence/sdk-v1/radial-menu/demo.png` (1000x750) via headless Chromium and verified with vision inspection confirming side-by-side full ring (6 items) and half arc (4 items) dark UI with zero error overlays.
## Contract Questions
- None.

READY FOR REVIEW at 57b7f42a940d2b7b72c1487cd0e6937b21bacc24
