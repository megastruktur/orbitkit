# Task Report: P3a and-svgfill Android SVG renderer config MASCOT (filled shapes)

Worktree: `oks-and-svgfill` (`/home/megastruktur/orca/workspaces/orbitkit/oks-and-svgfill`)
Base Commit: `457255a feat(android-overlay): render menu icons (minimal SVG + data-URL decoder) (R-DSN-2)`

---

## 1. Summary of Changes

### A. Per-Element Paint, Transform & Matrix Layer (`SvgIcon.kt`)
- Added `Paint` data class representing element-level styling:
  - `fill: Int?`: fill color ARGB or `null` when `fill="none"` or no fill
  - `stroke: Int?`: stroke color ARGB or `null` when `stroke="none"` or no stroke
  - `strokeWidth: Float`: stroke thickness (default 1f)
  - `cap: String?`: stroke-linecap (`"round"`, `"butt"`, `"square"`)
  - `join: String?`: stroke-linejoin (`"round"`, `"bevel"`, `"miter"`)
  - Convenience properties: `hasFill`, `hasStroke`, `fillHex`, `strokeHex`
- Added `Element` data class:
  - `commands: List<PathCommand>`
  - `paint: Paint`
  - `matrix: FloatArray`: 3x3 row-major transformation matrix compatible with `android.graphics.Matrix`
  - `toPath(): android.graphics.Path`
- Extended `SvgIcon`:
  - Added `elements: List<Element> = emptyList()` while retaining `viewBox`, `strokeColor`, `strokeWidth`, `commands`, and `toPath()` for full backward compatibility.
- Implemented pure JVM matrix engine and transform parser:
  - `IDENTITY_MATRIX`: standard 9-element float array identity matrix.
  - `multiplyMatrices(a, b)`: pure 3x3 matrix multiplication $A \times B$.
  - `parseTransform(transformStr: String): FloatArray?`: parses chained SVG transform functions:
    - `translate(tx, [ty])`: $ty$ defaults to 0.
    - `scale(sx, [sy])`: $sy$ defaults to $sx$.
    - `rotate(a, [cx, cy])`: angle in degrees; rotates about $(cx, cy)$ when center is provided, or origin $(0, 0)$ when omitted.
    - `matrix(a, b, c, d, e, f)`: standard affine transform mapped directly to Android Matrix row-major slots.
    - Safely returns `null` on malformed or unsupported transform strings.
- Implemented pure JVM color parser `parseColor(colorStr: String?, rootStroke: Int? = null): Int?`:
  - `none` -> `null` (no fill / stroke)
  - `currentColor` -> resolves to root stroke ARGB if present, else `#E6F6FF`
  - Named colors: `white` (`0xFFFFFFFF`), `black` (`0xFF000000`)
  - Hex colors: `#rgb` (expanded to 24-bit), `#rrggbb`, `#aarrggbb`
- DOM Hierarchy & `<g>` Grouping:
  - Recursive `parseElementChildren` handles `<g>` elements, correctly accumulating parent transforms and cascading paint attributes (`fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`).
  - Supports shapes: `<path>`, `<circle>`, `<ellipse>`, `<line>`, `<rect>`, `<polyline>`, `<polygon>`.
  - Fallback rule: any unsupported element (e.g. `<text>`, `<image>`, `<filter>`) immediately returns `null`.

### B. Element-Order Renderer (`SvgDrawable.kt`)
- Added `fraction: Float = 0.55f` constructor parameter:
  - Menu item icons default to `0.55f` (preserving existing circular menu item icon sizing).
  - Mascot rendering passes `1.0f` to scale the viewBox to the full bounds.
- Document-order drawing:
  - Iterates through `icon.elements` in document order.
  - For each element, combines the viewbox matrix with the element's local matrix via `Matrix.preConcat`.
  - Draws fill first with `fillPaint` (`Style.FILL`), then stroke second with `strokePaint` (`Style.STROKE`), each with its own Paint instance.
  - Respects per-element `strokeCap`, `strokeJoin`, `strokeWidth`, and colors.
  - Retains fallback to single path drawing if `icon.elements` is empty.

### C. Raw SVG String Decoding (`IconDecoder.kt`)
- In `IconDecoder.decode(raw: String?)`:
  - If trimmed string starts with `<svg` (case-insensitive), passes directly to `SvgParser.parse(trimmed)`.
  - Returns `DecodedIcon.Svg(icon)` if valid.
  - Returns `null` (never throws, never displays raw SVG markup as text) if parsing fails or contains unsupported elements.

---

## 2. Test Suite Additions

### A. `SvgIconTest.kt` (+7 unit tests, total 31 tests)
1. `testIdleMascotFromConfigParsesCorrectElementsAndPaint`:
   - Loads straight from `examples/starter/src/orbitkit.config.json` (fails test if file missing).
   - Verifies 6 elements:
     - Body circle with fill `#4f7cff` and no stroke.
     - Orbit ring ellipse with fill `none`, stroke `#9db4ff`, stroke-width 4, and rotation `-20` degrees about `(80, 80)`.
     - Eye outer circles with fill `#ffffff`.
     - Eye pupils with fill `#10141a`.
2. `testBusyMascotFromConfigGivesAmberBody`:
   - Loads straight from `examples/starter/src/orbitkit.config.json`.
   - Verifies 6 elements, body circle fill `#f59e0b` and orbit ring stroke `#fcd34d`.
3. `testTransformCompositionNumericallyChecked`:
   - Numerically asserts composite matrix for `translate(10, 20) scale(2, 3)` matches `[2, 0, 10, 0, 3, 20, 0, 0, 1]`.
   - Verifies nested `<g>` and child element transform composition.
4. `testFillNoneMeansNoFill`:
   - Verifies `fill="none"` sets `paint.fill == null` and `hasFill == false`.
5. `testInheritanceRootStrokeAppliesToChildren`:
   - Verifies root `<svg stroke="#123456" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">` attributes cascade to children.
6. `testCurrentColorResolvesToRootStroke`:
   - Verifies `currentColor` resolves to root stroke color.
7. `testGroupPaintInheritanceAndOverride`:
   - Verifies `<g>` group paint inheritance and child overrides.

### B. `IconDecoderTest.kt` (+2 unit tests, total 16 tests)
1. `testRawSvgStringDecodes`:
   - Verifies raw `<svg ...>` string decodes to `DecodedIcon.Svg` with elements and paint preserved.
2. `testUnsupportedInputReturnsNullAndNeverThrows`:
   - Verifies raw SVG with unsupported tags (`<text>`, `<image>`, `<filter>`), malformed XML, and non-finite numbers return `null` and never throw.

**Total native plugin unit tests:** 122 tests across 8 test suites, all passing (up from 113 baseline).

---

## 3. Verification Matrix

| Step | Action | Command | Result | Evidence File | Exit Code |
|---|---|---|---|---|---|
| 1 | Full Gradle Unit Tests (All Modules) | `cd examples/starter/src-tauri/gen/android && ./gradlew test --rerun-tasks` | PASS (328 tasks executed, all unit tests green) | `raw/01-gradlew-all-tests.txt` | 0 |
| 2 | JUnit Test Results Summary | Python XML aggregator | PASS (122/122 plugin tests green across 8 test suites) | `raw/02-junit-test-results-summary.txt` | 0 |
| 3 | Starter Debug APK Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | PASS (`app-universal-debug.apk` built successfully) | `raw/03-tauri-android-build.txt` | 0 |
| 4 | ADB Device Probe | `adb devices -l` | PROBED (0 attached devices in sandbox; coordinator runs on-device check) | `raw/04-adb-devices.txt` | 0 |
| 5 | DEX Class & Method Symbols | Python zipfile DEX inspection | PASS (`SvgIcon`, `SvgDrawable`, `SvgParser`, `IconDecoder`, `parseColor`, `parseTransform` present in DEX) | `raw/05-apk-dex-symbols.txt` | 0 |

---

## 4. Out-of-Scope Findings
None. All edits strictly in:
- `crates/tauri-plugin-orbitkit/android/src/main/java/dev/orbitkit/native/{SvgIcon,SvgDrawable,IconDecoder}.kt`
- `crates/tauri-plugin-orbitkit/android/src/test/java/dev/orbitkit/native/{SvgIconTest,IconDecoderTest}.kt`
- `evidence/sdk-v1/and-svgfill/**`

READY FOR REVIEW at 54fd5cadb2eb984cb9a01210d195f66715912405
