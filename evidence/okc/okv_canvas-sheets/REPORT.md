# REPORT — okv-canvas-sheets

Branch `okmegastruktur/okv-canvas-sheets`, base `5218fa9c3bf8664c9e953d757c18761fdc7dec5` (campaign base).
Commits: `4d7178e` red canvas tests → `1bd872b` implementation → `e623387` report → `56a71d3` red dpr-flip test → `12b7df4` dpr reactivity fix → `62f9643` round-1 record → this report (verdict record + `raw/` committed on top).

## Result: ALL CRITERIA PASS — inquisitor round 2 verdict PASS (round 1 FIX resolved in `12b7df4`)

| # | Criterion | Result | Evidence (named mutation-sensitive test) |
|---|---|---|---|
| 1 | `pnpm test` passes in `packages/orbitkit` | PASS | exit 0, **17 files / 394 tests** (`raw/green-test-all.log`, refreshed after the dpr-flip regression test landed) |
| 2 | `tsc --noEmit` 0 errors | PASS | exit 0 (`raw/green-tsc.log`) |
| 3 | Unit test asserts `<canvas>` rendered with proper dimensions when `config.renderer === "canvas"` | PASS | `Mascot.test.ts` › `Mascot kind=sheets renderer=canvas` › `renders a positioned aria-hidden canvas with the active frame geometry` — canvas present with `orbitkit-mascot-sheet orbitkit-mascot-canvas`, `aria-hidden="true"`, logical CSS `32×36` (16×2 × 18×2 @ scale 2), `position: absolute` / `bottom: 0px` placement, and NO `div.orbitkit-mascot-sheet`. Red run at base `5218fa9`: this test failed `expected null to be truthy` (`raw/red-mascot-canvas.log`, 2 failed \| 30 passed); fails if the canvas branch or geometry wiring is removed |
| 3b | dpr scaling + back-compat (extra mutation-sensitive guards) | PASS | `scales the canvas backing store by devicePixelRatio` — `vi.stubGlobal("devicePixelRatio", 2)` → bitmap `width=64 height=72` while CSS stays `32px/36px` (fails if bitmap is logical-sized or CSS becomes physical); `keeps the CSS div renderer by default and for renderer=css` — no canvas, background div with `url("tall.png")` for default and explicit `"css"` (fails if the default flips to canvas) |
| 4 | Inquisitor review returns PASS | PASS (round 2) | Round 1 verdict **FIX** (one blocking finding, all other hunted classes clean): `sheetCanvasPixel` read `window.devicePixelRatio` non-reactively — after a runtime dpr flip the next frame blit scaled fresh-dpr geometry into the stale backing store (frame clipped to its top-left quadrant until a geometry change). Fixed in `12b7df4`: `dpr` is `$state` kept fresh by a self-re-arming `(resolution: Ndppx)` media-query listener; the blit reads the same reactive source (registered in the effect body, not inside the async `onload`). Regression test `re-scales the bitmap when devicePixelRatio changes at runtime` is red on the pre-fix component (`raw/red-dpr-flip.log`) and green after. Round 2 (inquisitor `InquisitorCanvasSheetsR2`, 2026-09-30): **PASS** — fix verified structurally (dpr `$state` + body-registered `ratio` dependency + self-re-arming query with effect cleanup, no churn), red log confirmed against the pre-fix tree at `1bd872b`, gates re-run first-hand at `62f9643` (17 files / 394 tests exit 0, tsc 0 errors), scope/numstat clean (zero deletions; only allowlisted files + evidence), REPORT criterion-4 row held PENDING before this verdict |

## Implementation summary

- `packages/orbitkit/src/config.ts`: `MascotConfig.renderer?: "canvas" | "css"` (default `"css"`).
- `packages/orbitkit/src/Mascot.svelte`:
  - Template: `sheets` branch gained a `renderer === "canvas"` arm **before** the CSS div arm: `<canvas bind:this={sheetCanvasEl} class="orbitkit-mascot-sheet orbitkit-mascot-canvas" aria-hidden="true" width={sheetCanvasPixel.w} height={sheetCanvasPixel.h} style={sheetGeo?.style}>`. Placement reuses `sheetGeometry().style`, so anchor/box semantics (bottom-center baseline, center) are identical to the CSS renderer.
  - `dpr` `$state` (initial `window.devicePixelRatio || 1`, 0 on SSR) kept fresh by a self-re-arming `(resolution: Ndppx)` `matchMedia` listener: when dpr changes the query stops matching, the change handler re-reads the fresh value, and the effect re-runs to arm the new query (guarded when `matchMedia` is unavailable, e.g. jsdom).
  - `sheetCanvasPixel` `$derived`: physical bitmap = logical frame × scale × reactive `dpr`, rounded, min 1; `!dpr` (SSR) → `null` → falls through to the CSS div.
  - Blit `$effect` (deps: renderer/kind, bound element, `sheetDef`, `sheetGeo`, `sheetCanvasPixel`, reactive `dpr` read in the effect body, `sheetFrame`, `sheetMirrored`): loads `sheetDef.src` via `new Image()`; on `onload` → `getContext("2d")` → `ctx.setTransform(1,0,0,1,0,0)` (a no-op size prop set across frames keeps the previous transform, so every draw normalizes) → `ctx.scale(dpr, dpr)` → `ctx.imageSmoothingEnabled = false` → `clearRect` (transparent PNG frames must not ghost) → `faceByVelocity` mirror via `ctx.translate(geo.width, 0); ctx.scale(-1, 1);` → `ctx.drawImage(img, frame * frameWidth, 0, frameWidth, frameHeight, 0, 0, geo.width, geo.height)`; `disposed` flag cancels stale loads after sheet/frame/config changes.
  - `renderer !== "canvas"`: the existing `sheetFrameStyle` div path is byte-for-byte unchanged (all pre-existing sheets tests pass unmodified).
- `CHANGELOG.md`: Unreleased → Added entry.

## Gates (in `packages/orbitkit`, final state after dpr fix)

- `pnpm test` — exit 0, **17 test files, 394 tests** (baseline 390 + 4 new; `raw/green-test-all.log`)
- `tsc --noEmit` — exit 0 (`raw/green-tsc.log`)
- `pnpm build` (svelte-package) — exit 0, `dist/Mascot.svelte.d.ts` + assets emitted (`raw/green-build.log`)
- Red-first: `raw/red-mascot-canvas.log` (2 canvas tests failing at base SHA, committed separately as `4d7178e`) and `raw/red-dpr-flip.log` (runtime-flip test failing on the pre-fix component, committed separately before the reactive-dpr fix).

## Scope deviations

- None. Only allowlisted files (`config.ts`, `Mascot.svelte`, `Mascot.test.ts`, `CHANGELOG.md`) + `evidence/` were touched. No new dependencies; `index.ts` unchanged (no new exports needed).

## Out-of-scope findings

- `crates/tauri-plugin-orbitkit/src/config.rs` (`MascotConfig`) has no `renderer` mirror. Rust serde (no `deny_unknown_fields`) silently ignores the new key, so existing Rust-side parsing stays green; the serde mirror (+ docs) should land with the contracts owner (outside this task's allowlist).
- jsdom provides no 2D context (`getContext` → null) and never fires `Image.onload`, so the ctx/drawImage path is browser-only; unit tests pin the DOM shape, dpr sizing math, branch selection, and CSS fallback. Runtime proof against a real canvas is covered by the campaign smoke/demo task (`okv_demo-and-video`).
- Per-frame `new Image()` for the same `src` relies on the browser memory cache (hard-swap semantics match the CSS renderer); a module-level image cache would be the optimization lever if a future smoke run shows decode jank at high fps.

READY FOR REVIEW at 12b7df4
