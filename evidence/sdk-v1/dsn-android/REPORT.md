# Task Report: R-DSN-2 Android overlay renders icons

Worktree: `oks-dsn-android` (`/home/megastruktur/orca/workspaces/orbitkit/oks-dsn-android`)  
Base Commit: `4b205e6 feat(starter): planetary restyle + icon radial menu (R-DSN-1)`

---

## 1. Summary of Changes

### A. Pure Geometry & SVG Parser (`SvgIcon.kt`)
- Created pure geometry layer `dev.orbitkit.native.SvgIcon`:
  - `PathCommand`: sealed class representing drawing operations:
    - `MoveTo(x, y)`
    - `LineTo(x, y)`
    - `CubicTo(x1, y1, x2, y2, x, y)`
    - `Close`
  - `SvgViewBox(minX, minY, width, height)`
  - `SvgIcon(viewBox, strokeColor, strokeWidth, commands)`:
    - Provides `toPath(): android.graphics.Path` constructed from pure `PathCommand` list when running on Android.
- `PathTokenizer`:
  - High-performance, zero-allocation character-level tokenizer for SVG path strings.
  - Handles whitespace, comma separation, sign-separated numbers (e.g. `10-20`), consecutive decimals (e.g. `12.34.56`), scientific notation (`e`/`E`), and concatenated arc flags (e.g. `a2 2 0 0 1-2-2`).
  - Rejects non-finite numbers (e.g. `1e999` overflow, `-1e999`, `NaN`) in `nextFloat()` (F3).
- `PathParser`:
  - Implements all SVG path commands:
    - `M`, `m` (absolute and relative moveto, subsequent coords treated as implicit lineto)
    - `L`, `l` (absolute and relative lineto)
    - `H`, `h` (absolute and relative horizontal lineto)
    - `V`, `v` (absolute and relative vertical lineto)
    - `C`, `c` (absolute and relative cubic bézier)
    - `S`, `s` (smooth cubic bézier with reflection of prior control point)
    - `Q`, `q` (quadratic bézier converted to cubic bézier via degree elevation)
    - `T`, `t` (smooth quadratic bézier converted to cubic bézier)
    - `A`, `a` (elliptical arc converted to cubic béziers via standard W3C endpoint→center parameterization)
    - `Z`, `z` (closepath)
  - Rejects paths whose first command is not `M` or `m` (F2).
- `SvgParser`:
  - Parses XML with safe DocumentBuilderFactory (external entity and DTD processing disabled).
  - Supported child elements:
    - `<path d="...">`
    - `<circle cx="..." cy="..." r="...">` (emits 4 cubic béziers with magic constant $\kappa \approx 0.55228475$)
    - `<ellipse cx="..." cy="..." rx="..." ry="...">` (emits 4 cubic béziers)
    - `<line x1="..." y1="..." x2="..." y2="...">` (emits MoveTo + LineTo)
    - `<rect x="..." y="..." width="..." height="..." rx="..." ry="...">` (emits lines + rounded cubic corners when rx/ry > 0)
    - `<polyline points="...">` (emits MoveTo + LineTos)
    - `<polygon points="...">` (emits MoveTo + LineTos + Close)
    - Transparent `<g>` containers without transforms
  - Fallback rule: any unsupported element (e.g. `<text>`, `<image>`, `<filter>`) or malformed input immediately returns `null`.

### B. Icon Decoder (`IconDecoder.kt`)
- Implemented `dev.orbitkit.native.IconDecoder`:
  - Self-contained pure-Kotlin Base64 decoder `decodeBase64(input: String): ByteArray?` (works across all JVM and Android versions without Android SDK stub dependencies).
  - Handles `data:image/svg+xml;base64,...` -> decodes base64 payload to UTF-8 and parses with `SvgParser` -> `DecodedIcon.Svg`.
  - Handles `data:image/svg+xml,...`, `data:image/svg+xml;utf8,...`, `data:image/svg+xml;charset=utf-8,...` -> URL-decodes and parses with `SvgParser` -> `DecodedIcon.Svg`.
  - Handles `data:image/(png|jpeg|jpg|webp);base64,...` -> decodes base64 and passes to `BitmapDecoder` (default `BitmapFactory.decodeByteArray`) -> `DecodedIcon.Bitmap`.
  - Otherwise (emoji / short text) -> `DecodedIcon.Text`.
  - Fallback and security guarantee: any string starting with `"data:"` that fails decoding returns `null` and is NEVER returned as `DecodedIcon.Text`.
  - Pure helper `resolveItemIcon(icon: String?, label: String?, ...)`: decodes `icon` first; if `icon` is null or fails decoding (e.g. malformed data URL or unsupported SVG element), falls back to decoding `label` as text/emoji so the menu item disc is never blank (F1).
### C. Overlay Item View & Styling (`SvgDrawable.kt` & `OrbitkitNativePlugin.kt`)
- `SvgDrawable`:
  - Android `Drawable` that scales the parsed `Path` to ~55% of the item disc bounds.
  - Scales stroke width proportionally from the viewBox.
  - Sets `Paint.Cap.ROUND`, `Paint.Join.ROUND`, `Paint.Style.STROKE`, `isAntiAlias = true`.
  - Uses stroke color from SVG (default `#E6F6FF`).
- `TextDrawable`:
  - Android `Drawable` for rendering fallback text/emoji centered within bounds.
- `OrbitkitNativePlugin.kt`:
  - Replaced item `TextView` with `ImageView` (`scaleType = FIT_CENTER`).
  - Sets `contentDescription = item.label`.
  - Decodes item via pure helper `IconDecoder.resolveItemIcon(item.icon, item.label)`:
    - SVG -> `itemView.setImageDrawable(SvgDrawable(decoded.icon))`
    - Bitmap -> `itemView.setImageBitmap(decoded.bitmap)`
    - Text -> `itemView.setImageDrawable(TextDrawable(decoded.text))`
  - Desktop-matching disc styling:
    - Enabled: glass disc `#0E1433 @ 85%` (`Color.argb(217, 14, 20, 51)`) + cyan `#38BDF8 1.5dp` ring (`setStroke(dpToPx(ctx, 1.5f), Color.parseColor("#38BDF8"))`).
    - Disabled: grey background `#4B5563`, `alpha = 0.5f`.
  - Spawn animations (R-DEV-2) and radial arc layout (R-DEV-3b) completely unchanged.

---

## 2. Test Suite Additions

1. `SvgIconTest.kt` (24 unit tests):
   - `testMoveToAbsoluteAndRelative`: verifies `M` and `m` commands.
   - `testLineToAbsoluteAndRelative`: verifies `L` and `l` commands.
   - `testHorizontalAndVerticalLineTo`: verifies `H`, `h`, `V`, `v` commands.
   - `testCubicBezierAbsoluteAndRelative`: verifies `C` and `c` commands.
   - `testSmoothCubicBezierWithAndWithoutPriorCubic`: verifies `S` reflection and fallback.
   - `testQuadraticBezierAbsoluteAndRelative`: verifies `Q` and `q` conversion to cubic béziers.
   - `testSmoothQuadraticBezier`: verifies `T` reflection and conversion.
   - `testEllipticalArcAbsoluteAndRelative`: verifies `A` and `a` conversion to cubic béziers.
   - `testClosePath`: verifies `Z` / `z`.
   - `testImplicitRepeatsForMoveAndLine`: verifies implicit `L` following `M`.
   - `testImplicitRepeatsForRelativeMoveAndLine`: verifies implicit `l` following `m`.
   - `testNumberSeparatorsAndSigns`: verifies signs, leading dots, and concatenated arc flags (`M12 8h.01`, `a2 2 0 0 1-2-2`).
   - `testCircleGeometry`: verifies `<circle>` emits 4 cubic béziers and Close.
   - `testEllipseGeometry`: verifies `<ellipse>` emits 4 cubic béziers and Close.
   - `testLineGeometry`: verifies `<line>` emits MoveTo and LineTo.
   - `testRectGeometryWithoutAndWithRoundedCorners`: verifies sharp rect (5 commands) and rounded rect with rx/ry (10 commands).
   - `testPolylineAndPolygon`: verifies `<polyline>` and `<polygon>`.
   - `testRealIconAboutSvg`: loads `examples/starter/public/icons/about.svg` from disk, verifies 24x24 viewBox, stroke `#E6F6FF`, stroke-width 2, commands present.
   - `testRealIconNotesSvg`: loads `examples/starter/public/icons/notes.svg`, verifies 24x24 viewBox and commands.
   - `testRealIconQuitSvg`: loads `examples/starter/public/icons/quit.svg`, verifies 24x24 viewBox and commands.
   - `testRealIconSettingsSvg`: loads `examples/starter/public/icons/settings.svg`, verifies 24x24 viewBox and commands.
   - `testRealIconTimerSvg`: loads `examples/starter/public/icons/timer.svg`, verifies 24x24 viewBox and commands.
   - `testPathMustStartWithMoveTo`: verifies paths whose first command is not M/m (e.g. L, C, Z) are rejected, and valid M/m paths are accepted (F2).
   - `testRejectNonFiniteNumbers`: verifies non-finite numbers (e.g. `1e999`, `-1e999`) in path data are rejected (F3).

2. `IconDecoderTest.kt` (14 unit tests):
   - `testDecodeBase64SvgDataUrl`: verifies `data:image/svg+xml;base64,...` decodes to `DecodedIcon.Svg`.
   - `testDecodeUrlEncodedSvgDataUrl`: verifies `data:image/svg+xml,...` decodes to `DecodedIcon.Svg`.
   - `testDecodeUtf8PrefixedSvgDataUrl`: verifies `data:image/svg+xml;utf8,...` decodes to `DecodedIcon.Svg`.
   - `testDecodePlainTextAndEmoji`: verifies emoji and plain strings decode to `DecodedIcon.Text`.
   - `testFallbackRulesUnsupportedTagsReturnNull`: verifies `<text>`, `<image>`, `<filter>` return `null`.
   - `testFallbackRulesMalformedXmlReturnsNull`: verifies malformed XML returns `null`.
   - `testDataUrlNeverDisplayedAsText`: verifies corrupt/unsupported data URLs return `null` and NEVER `DecodedIcon.Text`.
   - `testNullAndEmptyReturnNull`: verifies `null`, `""`, and whitespace return `null`.
   - `testBitmapDataUrlWithCustomDecoder`: verifies bitmap data URLs extract payload and pass to decoder.
   - `testStarterConfigIconsDecodeCleanly`: reads `examples/starter/src/orbitkit.config.json` and verifies all 5 item icons decode to valid `DecodedIcon.Svg`.
   - `testResolveItemIconFallbackWhenMalformedDataUrl`: malformed data URL + label "Quit" -> `DecodedIcon.Text("Quit")` (F1).
   - `testResolveItemIconFallbackWhenUnsupportedSvgElement`: unsupported SVG element (`<text>`) inside data URL + label "Quit" -> `DecodedIcon.Text("Quit")` (F1).
   - `testResolveItemIconFallbackWhenNullIcon`: null icon + label "Quit" -> `DecodedIcon.Text("Quit")` (F1).
   - `testResolveItemIconReturnsSvgWhenValid`: valid SVG data URL + label "Quit" -> `DecodedIcon.Svg` (F1).

Total plugin unit tests: 113 tests across 8 test suites, all passing (up from 75 tests baseline; +38 tests).

---

## 3. Verification Matrix

| Step | Action | Command | Result | Evidence File | Exit Code |
|---|---|---|---|---|---|
| 1 | Full Gradle Tests (All Modules) | `cd examples/starter/src-tauri/gen/android && ./gradlew test` | PASS (328 tasks, all unit tests green) | `raw/01-gradlew-all-tests.txt` | 0 |
| 2 | JUnit Test Results Summary | `python3 summarize_junit.py` | PASS (113/113 tests pass across 8 test suites) | `raw/02-junit-test-results-summary.txt` | 0 |
| 3 | Android Starter Debug APK Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | PASS (`app-universal-debug.apk` built successfully) | `raw/03-tauri-android-build.txt` | 0 |
| 4 | ADB Device Probe | `adb devices -l` | PROBED (0 attached devices in sandbox; coordinator on-device run) | `raw/04-adb-devices.txt` | 0 |
| 5 | DEX Class Symbols Inspection | `dexdump -f app-universal-debug.apk` | PASS (all SvgIcon and IconDecoder classes present in APK) | `raw/05-apk-dex-symbols.txt` | 0 |

---

## 4. Out-of-Scope Findings
None. All changes remained strictly within `crates/tauri-plugin-orbitkit/android/**` and `evidence/sdk-v1/dsn-android/**`.

READY FOR REVIEW at fbedb043d5e20cc003aca72ef72d8a8151044a13
