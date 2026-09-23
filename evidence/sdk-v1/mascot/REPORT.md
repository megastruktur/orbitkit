# Task Report: `oks_mascot` (T05)

## Summary
- Implemented replaceable static/animated `Mascot.svelte` component per K2 (`MascotConfig`) and K3 (`Mascot.svelte` props) contracts.
- Root element rendered as accessible `<button type="button" class="orbitkit-mascot" data-state="..." aria-label="...">` with configurable size, keyboard activation (native button Enter/Space click), and accessible focus ring.
- Supported kinds:
  - `svg`: Renders inline SVG markup encoded as safe data URL (`data:image/svg+xml;charset=utf-8,` + `encodeURIComponent(markup)`) or direct URL in `<img>` element (K3-A3).
  - `image`: Renders `<img>` element; swaps `src` dynamically on state transitions (`states[state].src`).
  - `sprite`: Renders `<div class="orbitkit-mascot-sprite">` with background-image and CSS `steps(n)` animation; swaps animation CSS custom properties (`--frames`, `--fps`, `--row`, `--duration`, `--bg-y`) and `background-position-y` dynamically on state transitions.
- Reduced motion:
  - Supports `reducedMotion` prop and `@media (prefers-reduced-motion: reduce)`.
  - Disables animations (`animation: none !important`) and applies `reduced-motion` and `orbitkit-mascot--reduced-motion` CSS classes.
- Created `packages/orbitkit/assets/default-mascot.svg` porting the spike's bright blue planet design (`#4f7cff`, `#9db4ff` ring, bright white/dark eyes).
- Remediation Round 2 fixes:
  - **F1 HIGH (XSS bypass in sanitizer):** Replaced regex sanitizer with DOM-based sanitization in `packages/orbitkit/src/mascot/sanitize.ts`. Parses markup with `DOMParser` (`image/svg+xml`, falling back to `<template>`), walks all elements, removes `script`, `foreignObject`, `iframe`, `embed`, `object`, and `animate`/`set`/`animateTransform` targeting `href`/`xlink:href`/`on*`. Removes all attributes whose lowercased name starts with `on` (or localName starts with `on` or contains `:on`). For `href`, `xlink:href`, and `src`, decodes attribute value via DOM, strips characters `[\x00-\x20]`, lowercases, and permits only `#...`, `http:`, `https:`, and `data:image/...`. Added regression tests asserting on parsed DOM structure for (a) slash attribute separator (`<svg><image href="x"/onerror="...">`), (b) HTML entity encoded javascript (`href="jav&#x61;script:..."`), (c) whitespace/tab/control chars in javascript (`href="java\tscript:..."`), (d) `<svg/onload>`, and (e) SMIL injections.
  - **F2 MEDIUM (Enter fires onclick twice):** Removed redundant `handleKeyDown` function and `onkeydown={handleKeyDown}` attribute from `Mascot.svelte`. Standard `<button type="button">` handles keyboard activation (Enter/Space) natively via synthesized click. Added unit test asserting no custom keydown handler calls `onclick`, and verified in headless Chromium harness that pressing Enter on the focused Mascot button generates exactly 1 `onclick` call (`evidence/sdk-v1/mascot/raw/09-chromium-enter-test.txt`).
- Remediation Round 3 (K3-A3) fixes:
  - **K3-A3 Design Cutover (SVG-as-image, zero {@html}):** Abandoned the DOM-sanitize -> serialize -> `{@html}` re-parse pipeline following gate `t_48ecebdf` proof of mXSS exploitability (XML processing-instruction breakout, math/mglyph/style template differential, form/formaction javascript:).
  - Completely removed every `{@html}` tag from `Mascot.svelte`. For `kind: "svg"` with markup, `Mascot.svelte` constructs `src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup)` and renders `<img class="orbitkit-mascot-img orbitkit-mascot__img" src={src} alt="" draggable="false">` (same as URL case). Browsers strictly isolate SVG-as-image, preventing any script execution or external resource loading.
  - Deleted `packages/orbitkit/src/mascot/sanitize.ts` to prevent dead security code falsely implying DOM sanitization. Created clean, minimal helper in `packages/orbitkit/src/mascot/svg.ts` (`isSvgMarkup`, `toSvgDataUrl`, `resolveSvgSrc`) and exported via `packages/orbitkit/src/mascot/index.ts`.
  - Maintained all per-state behavior, size styling, data-state attributes, reduced-motion controls, and sprite/image kind rendering unchanged.
- Unit test suite in `packages/orbitkit/src/Mascot.test.ts`:
  - 17 comprehensive Vitest tests covering root button semantics, inline SVG data URL rendering, SVG URL rendering, image rendering, image state swaps, sprite rendering, sprite animation var state swaps, SVG script tag prevention, SVG event handler prevention, all gate t_48ecebdf mXSS payloads, Round 1/2 regression vectors, SVG state swaps, click handler, Enter key activation (F2 regression), pointerdown interaction, data-state attributes, reduced-motion classes, and config size styling.
  - Asserts `container.querySelectorAll('[onerror],[onload],script,form,math').length === 0` and zero `svg` elements across all payloads.
  - All 38 package tests pass green (21 config + 17 mascot).
- Visual verification:
  - Built demo bundle at `packages/orbitkit/demo/dist` via Vite.
  - Rendered in headless Chromium and captured screenshot saved to `evidence/sdk-v1/mascot/mascot.png` (and mirrored in `raw/visual.png`). Verified 3 clearly visible mascots with bright colors: Cosmic Planet (inline SVG rendered as data URL image), Emerald Pulse (animated sprite), and Solar Gold (image).
- Chromium verification harness:
  - Tested all 9 gate `t_48ecebdf` payloads + Round 1 vector suite against the real mounted Svelte 5 `Mascot` component in headless Chromium. Exactly 0 script executions, 0 alerts/dialogs, 0 DOM injections observed (`evidence/sdk-v1/mascot/raw/10-chromium-xss-gate-test.txt`).
  - Re-verified keyboard activation: pressing Enter on focused Mascot button generates exactly 1 `onclick` call (`evidence/sdk-v1/mascot/raw/09-chromium-enter-test.txt`).
- Monorepo validation:
  - `pnpm -r test` pass (exit 0)
  - `pnpm -r build` pass (exit 0)
  - `pnpm -r check` pass (exit 0)
## Scenario Results

| # | Scenario | Command | Expected | Actual / Evidence | Exit Code |
|---|---|---|---|---|---|
| 1 | unit | `pnpm --filter @orbitkit/ui test` | pass (≥ 10 tests) | 38/38 tests passed (17 in `Mascot.test.ts`, 21 in `config.test.ts`) (`evidence/sdk-v1/mascot/raw/01-ui-test.txt`) | 0 |
| 2 | visual | headless screenshot demo | PNG 3 mascots, bright colors | Captured 900x600 PNG showing Cosmic Planet (SVG), Emerald Pulse (Sprite), Solar Gold (Image) (`evidence/sdk-v1/mascot/mascot.png`, `evidence/sdk-v1/mascot/raw/08-visual-screenshot.txt`) | 0 |
| 3 | chromium-enter | CDP Enter key test on Mascot | exactly 1 onclick invocation | Measured exactly 1 click on Enter keydown/keyup on focused Mascot button (`evidence/sdk-v1/mascot/raw/09-chromium-enter-test.txt`) | 0 |
| 4 | chromium-xss-gate | Real component XSS gate harness in Chromium | 0 executions / 0 DOM injections | All 9 gate payloads + Round 1 set tested: 0 dialogs, 0 executions, 100% DOM-clean (`evidence/sdk-v1/mascot/raw/10-chromium-xss-gate-test.txt`) | 0 |
| - | package build | `pnpm --filter @orbitkit/ui build` | exit 0 | Built package distribution in `dist/` (`evidence/sdk-v1/mascot/raw/02-ui-build.txt`) | 0 |
| - | package check | `pnpm --filter @orbitkit/ui check` | exit 0 | Clean TypeScript check with 0 errors (`evidence/sdk-v1/mascot/raw/03-ui-check.txt`) | 0 |
| - | monorepo test | `pnpm -r --if-present test` | exit 0 | All monorepo tests green (`evidence/sdk-v1/mascot/raw/04-pnpm-r-test.txt`) | 0 |
| - | monorepo build | `pnpm -r build` | exit 0 | All monorepo packages build cleanly (`evidence/sdk-v1/mascot/raw/05-pnpm-r-build.txt`) | 0 |
| - | monorepo check | `pnpm -r check` | exit 0 | Workspace typecheck passes with 0 errors (`evidence/sdk-v1/mascot/raw/06-pnpm-r-check.txt`) | 0 |
| - | demo build | programmatic vite build | exit 0 | Production client bundle built in 165ms (`evidence/sdk-v1/mascot/raw/07-demo-build.txt`) | 0 |

## Deviations
- **K3-A3 (Approved Coordinator Decision):** In response to gate `t_48ecebdf` demonstrating mutation XSS (mXSS) vectors against DOM-sanitized `{@html}` markup, all inline SVG markup rendering was redesigned to render strictly as an `<img>` tag with `src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup)`. All `{@html}` blocks were removed from `Mascot.svelte`. `sanitize.ts` was deleted to avoid leaving dead security code implying DOM protection, replaced with pure URL-resolution helper `svg.ts`.
- Scope note / AC3 alignment: Acceptance Criterion 3 explicitly mandated creating "a tiny demo page `packages/orbitkit/demo/mascot.html` (not published) built with vite and screenshotted". The literal Scope allowlist in BRIEF.md listed `packages/orbitkit/src/Mascot.svelte`, `packages/orbitkit/src/mascot/**`, `packages/orbitkit/src/Mascot.test.ts`, `packages/orbitkit/assets/default-mascot.svg`, and `evidence/sdk-v1/mascot/**`, omitting `packages/orbitkit/demo/**` despite mandating it in AC3. We included `packages/orbitkit/demo/mascot.html` (and supporting `App.svelte` and `main.ts`) as mandated by AC3, and also mirrored these demo sources under `evidence/sdk-v1/mascot/demo/` for complete evidence self-containment.

## Out-of-Scope Findings
- Svelte 5 SSR export condition in Vitest JSDOM: In `packages/orbitkit/vitest.config.ts`, `environment: "jsdom"` was configured in T04, but Vite/Vitest Node resolver defaults to SSR/Node export conditions (`svelte/src/index-server.js`) rather than client conditions (`svelte/src/index-client.js`). Because `vitest.config.ts` was outside our Scope allowlist, we solved this within `Mascot.test.ts` by intercepting the Svelte entrypoint to dynamically load the client index (`index-client.js`), allowing tests to run cleanly without modifying out-of-scope config.

## Contract Questions
- None.

READY FOR REVIEW at 473077ece96e60a5a550d03f4f58fce24fc7e15d
