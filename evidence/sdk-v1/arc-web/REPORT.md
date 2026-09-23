# Task Report: `arc-web` (R-DEV-3a + COORDINATOR ADDENDUM)

## Summary
- Implemented menu layout options (`layout: "orbit" | "arc"`) and switchable animation (`animation: "spawn" | "none"`) per Contract Amendment K2-A1 across frontend `@orbitkit/ui` and plugin `tauri-plugin-orbitkit`.
- **Pure Geometry & Canonical Vectors (`packages/orbitkit/src/geometry.ts`, `arc-vectors.json`)**:
  - `resolveMenuAngles(menu) -> { startAngle, endAngle }`: Pure angle resolution helper exported from `@orbitkit/ui` barrel (`./geometry.js`).
  - Screen coordinates: 0° = right, 90° = bottom (screen y down). Centre angles: top = -90°, right = 0°, bottom = 90°, left = 180°.
  - For `layout: "arc"`: `startAngle = centre - span/2`, `endAngle = centre + span/2` (defaults: `position: "top"`, `span: 180`).
  - For `layout: "orbit"` (or default): preserves configured `startAngle` and `endAngle` (default `-90..270`).
  - Codified canonical test vectors in `packages/orbitkit/src/arc-vectors.json` (all 4 cardinal positions, default span 180, custom spans 120 and 90, orbit layout, with item positions verified by `layoutItems`).
- **Configuration & Validation (`packages/orbitkit/src/config.ts`)**:
  - Extended `MenuConfig` with `layout?: "orbit" | "arc"`, `arc?: { position?: "top" | "bottom" | "left" | "right", span?: number }`, and `animation?: "spawn" | "none"`.
  - `withDefaults`: Populates `layout: "orbit"`, resolves `startAngle` and `endAngle` when `layout: "arc"`, defaults `arc` to `{ position: "top", span: 180 }`, and defaults `animation: "spawn"`.
  - `validateConfig`: Validates `menu.layout` (`'orbit' or 'arc'`), `menu.arc.position` (`'top', 'bottom', 'left', or 'right'`), `menu.arc.span` (number between 30 and 300), and `menu.animation` (`'one of spawn, none'`). `arc` without `layout: "arc"` is allowed and ignored in angle resolution.
- **Component Runtime (`packages/orbitkit/src/RadialMenu.svelte`)**:
  - Automatically resolves start and end angles using `resolveMenuAngles(config)` before passing to `layoutItems`.
  - When `config.animation === "none"`, applies `.no-animation` class and disables open/close CSS keyframe animations and transitions.
- **Rust Plugin Mirror (`crates/tauri-plugin-orbitkit/src/config.rs`)**:
  - Mirrored `layout: Option<String>`, `arc: Option<MenuArcConfig>`, and `animation: Option<String>` in `MenuConfig` with `camelCase` serde serialization.
  - Implemented `resolve_menu_angles` producing identical start and end angles as TypeScript.
  - Implemented `validate()` on `MenuConfig` and `OrbitKitConfig` enforcing layout, position, span (30..300), and animation constraints.
  - Included unit tests validating against `packages/orbitkit/src/arc-vectors.json` via `include_str!`.
- **Documentation & Examples**:
  - `docs/architecture/contracts.md`: Appended Amendment K2-A1 documenting `layout`, `arc`, `animation`, and `resolveMenuAngles` export.
  - `docs/configuration.md`: Documented new fields in Section 2.2 table and updated Example 3 to showcase `layout: "arc"`.
  - `examples/starter/src/orbitkit.config.ts`: Added commented examples for `layout: "arc"` and `animation: "none"`.
  - `CHANGELOG.md`: Added `[Unreleased]` entry describing all additions.
- **Visual Evidence**:
  - Re-captured `arc-top.png` (900x700, 190,023 bytes) on clean committed tree: displays dark `#0d1117` background, title "OrbitKit Arc Menu — Top Arc", centered OrbitKit planet mascot (blue planet with orbital ring and eyes), and 5 radial menu items (Cut, Copy, Paste, Delete, Share) in a 180° arc strictly above the mascot ($y \le 0$, Paste at 12 o'clock). Pixel analysis confirms 0 error-overlay red pixels and mean RGB (16.53, 21.28, 28.57).
  - Re-captured `arc-left.png` (900x700, 193,871 bytes) on clean committed tree: displays dark `#0d1117` background, title "OrbitKit Arc Menu — Left Arc", centered OrbitKit planet mascot, and 5 radial menu items in a 180° arc strictly to the left of the mascot ($x \le 0$, Paste at 9 o'clock). Pixel analysis confirms 0 error-overlay red pixels and mean RGB (16.54, 21.30, 28.59).

## Verification Results

| # | Command / Check | Expected | Observed | Exit Code | Raw Log |
|---|---|---|---|---|---|
| 1 | `pnpm -r build` | Build succeeds | All 3 packages build cleanly (Svelte 5 package dist + Vite client build) | 0 | `evidence/sdk-v1/arc-web/raw/01-pnpm-r-build.txt` |
| 2 | `pnpm -r check` | Typecheck succeeds | TypeScript checks pass cleanly across all workspace projects | 0 | `evidence/sdk-v1/arc-web/raw/02-pnpm-r-check.txt` |
| 3 | `pnpm -r test` | Vitest succeeds | 103/103 tests pass across 5 test suites | 0 | `evidence/sdk-v1/arc-web/raw/03-pnpm-r-test.txt` |
| 4 | Container `cargo test -p tauri-plugin-orbitkit` | Cargo tests pass | 19/19 plugin tests (incl. new `test_menu_layout_arc_serde_roundtrip`) and 12/12 desktop tests pass in container | 0 | `evidence/sdk-v1/arc-web/raw/04-docker-cargo-test.txt` |
| 5 | Visual Screenshot Capture | PNGs captured & verified | `arc-top.png` (190,023 B) and `arc-left.png` (193,871 B) captured; pixel data verified error-overlay free; visual confirmation verified items sit above / left of mascot | 0 | `evidence/sdk-v1/arc-web/raw/05-visual-screenshot.txt` |

## Remediation Round 2 (Coordinator Review FIX @ fbe6a08)
- **M1 (Major — Visual evidence re-capture)**: Re-captured `arc-top.png` and `arc-left.png` on the committed tree. Built static HTML harness rendering OrbitKit Mascot and RadialMenu with `layout: "arc"` for positions "top" and "left". Verified pixel data with Python scanline decoder: 0 pixels match Vite error-overlay red (R>180, G<70, B<70); mean RGB verified (~16.5, ~21.3, ~28.6). Vision inspection confirms items arch above mascot in `arc-top.png` and to the left of mascot in `arc-left.png`.
- **m1 (Minor — Advisory validation contract)**: Documented in K2-A1 amendment (`docs/architecture/contracts.md`) that Rust `validate()` is advisory; enforcement happens in TS `validateConfig`; Android card R-DEV-3b calls `validate()` in `show_overlay`.
- **m2 (Minor — Rust serde round-trip test)**: Added `test_menu_layout_arc_serde_roundtrip` to `crates/tauri-plugin-orbitkit/src/config.rs` round-tripping `{"items":[],"layout":"arc","arc":{"position":"left","span":120},"animation":"none"}` and asserting camelCase serialization (`"layout":"arc"`, `"arc":{"position":"left","span":120.0}`, `"animation":"none"`). 19/19 plugin tests pass in container.
- **m3 (Minor — Test vector verification scope)**: Documented in K2-A1 amendment text that `positions` in `arc-vectors.json` are checked by TS (and by Kotlin in 3b); Rust checks start/end angles only.
- **n1 (Nit — Starter example syntax)**: Fixed commented `arcConfig` example in `examples/starter/src/orbitkit.config.ts` so uncommenting lines 9-16 parses as valid TypeScript object syntax.
- **n2 (Nit — Ready SHA)**: Updated REPORT final line to cite evidence commit `8b71c83` resolving round 1 review tip `fbe6a08`.

## Deviations
- None. All requirements of R-DEV-3a, COORDINATOR ADDENDUM, and ROUND 2 remediation implemented exactly as specified.

## Out-of-Scope Findings
- None.

READY FOR REVIEW at 8b71c83d5a4944da605f4268e0e64c391ad982b6
