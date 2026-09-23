# Task Report: R-DEV-3b Android Menu Layout Arc Option (`arc-android`)

Worktree: `oks-arc-android` (`/home/megastruktur/orca/workspaces/orbitkit/oks-arc-android`)
Base Commit: `03ac9af feat(ui): menu.layout "orbit" | "arc" (top/bottom/left/right, span) and menu.animation "spawn" | "none" (R-DEV-3a)`

---

## 1. Summary of Changes

### A. Configuration Parsing (`MenuConfigParser.kt`)
- Added `NativeArcConfig` data class:
  - `position: String = "top"`
  - `span: Double = 180.0`
  - Constants: `DEFAULT_POSITION = "top"`, `DEFAULT_SPAN = 180.0`, `MIN_SPAN = 30.0`, `MAX_SPAN = 300.0`
  - Valid positions: `top`, `bottom`, `left`, `right`
- Extended `NativeMenuConfig`:
  - `layout: String = "orbit"` (allowed `"orbit"`, `"arc"`)
  - `arc: NativeArcConfig? = null`
- Implemented robust parsing in `MenuConfigParser.parseMenu`:
  - `layout`: reads string, normalizes case; valid values accepted; unknown/invalid values log a warning via `android.util.Log.w` and fall back to `"orbit"`.
  - `arc`: if present as a JSONObject:
    - `position`: normalizes case; if recognized (`top|bottom|left|right`), kept; else logs warning and falls back to `"top"`.
    - `span`: parsed as double; validated between `30.0` and `300.0`; invalid or out-of-bounds values log warning and fall back to `180.0`.
  - Never throws or crashes on invalid layout or arc values.
  - Omitted or null fields cleanly default per Contract Amendment K2-A1.

### B. Pure Geometry & Canonical Angle Resolution (`RadialLayout.kt`)
- Added `data class ResolvedMenuAngles(val startAngle: Double, val endAngle: Double)`.
- Implemented `RadialLayout.resolveMenuAngles(layout, position, span, startAngle, endAngle)` mirroring TypeScript `resolveMenuAngles` from `@orbitkit/ui` (`packages/orbitkit/src/geometry.ts`) exactly:
  - K3 geometry: 0° = right, clockwise, screen y down.
  - Centre angles: `top` = -90°, `right` = 0°, `bottom` = 90°, `left` = 180°.
  - For `layout == "arc"`:
    - `startAngle = round2(centre - span / 2.0)`
    - `endAngle = round2(centre + span / 2.0)`
    - Default centre = -90° (`top`), default span = 180.0°.
  - For `layout == "orbit"` (or any other layout):
    - `startAngle = startAngle ?: -90.0`
    - `endAngle = endAngle ?: 270.0`
- Added overloaded helper `RadialLayout.resolveMenuAngles(menu: NativeMenuConfig)` for direct config resolution.

### C. Native Overlay Item Placement & Animations (`OrbitkitNativePlugin.kt`)
- Updated `buildOverlayView`: resolves start and end angles using `RadialLayout.resolveMenuAngles(menuConfig)` before computing item layout coordinates via `RadialLayout.positions`.
- Arc items spawn and collapse through `SpawnAnimation` seamlessly:
  - Translation start offset computed from mascot centroid to target screen position.
  - Edge clamping via `OverlayGeometry.itemScreenPosition` continues to apply to arc items near screen boundaries.

---

## 2. Test Suite Additions

### A. MenuConfigParserTest (`MenuConfigParserTest.kt`)
Added 6 unit tests (total test count increased from 11 to 17):
1. `testParseValidArcLayoutAndConfig`: parses valid `layout: "arc"`, position `"bottom"`, span `120.0`.
2. `testParseArcWithDefaultPositionAndSpan`: verifies empty `arc: {}` defaults to position `"top"` and span `180.0`; verifies `layout: "arc"` with missing `arc` leaves `menu.arc == null`.
3. `testParseUnknownLayoutFallsBackToOrbit`: tests `"spiral"`, `"unknown"`, `"circle"`, `"ARC_TOP"`, `""` falling back to `"orbit"` without crashing.
4. `testParseInvalidArcPositionFallsBackToTop`: tests invalid positions (`"diagonal"`, `"north"`, `"center"`, `"invalid"`, `""`) falling back to `"top"`.
5. `testParseInvalidArcSpanFallsBackTo180`: tests span `< 30.0` (e.g. `20.0`) and span `> 300.0` (e.g. `350.0`) falling back to `180.0`.
6. `testParseOrbitWithArcAllowed`: confirms `layout: "orbit"` retains parsed `arc` for inspection while angle resolution ignores it.

### B. RadialLayoutTest (`RadialLayoutTest.kt`)
Added 5 unit tests (total test count increased from 11 to 16):
1. `testResolveMenuAnglesAndPositionsFromCanonicalArcVectors`:
   - Dynamically loads canonical vectors from `packages/orbitkit/src/arc-vectors.json` directly from the repo path (no copies).
   - Verifies all 8 vectors:
     - `startAngle` matches expected within 0.01°.
     - `endAngle` matches expected within 0.01°.
     - For every item in `positions`, computes `RadialLayout.positions(n, 96.0, startAngle, endAngle)` and verifies `x`, `y`, and `angle` match expected within 0.01.
2. `testResolveMenuAnglesFourPositionsDefaultSpan`: asserts cardinal angles (`top` -180..0, `right` -90..90, `bottom` 0..180, `left` 90..270).
3. `testResolveMenuAnglesCustomSpans`: tests spans 120°, 90°, 60°.
4. `testResolveMenuAnglesOrbitDefaultsAndOverrides`: tests default orbit (-90..270), custom start/end angles, and verifies `arc` field is ignored when `layout == "orbit"`.
5. `testResolveMenuAnglesNativeMenuConfigOverload`: tests resolution via `NativeMenuConfig` object.

---

## 3. Verification Matrix

| Step | Action | Command | Result | Evidence File | Exit Code |
|---|---|---|---|---|---|
| 1 | Full Gradle Tests (All Modules) | `cd examples/starter/src-tauri/gen/android && ./gradlew test --rerun-tasks` | PASS (328 tasks executed, all unit tests green) | `raw/01-gradlew-all-tests.txt` | 0 |
| 2 | JUnit Test Results Summary | Python XML parser across plugin & starter | PASS (75/75 plugin tests, 4/4 starter tests, 79/79 total green) | `raw/02-junit-test-results-summary.txt` | 0 |
| 3 | Android Starter Debug APK Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | PASS (`app-universal-debug.apk` built successfully) | `raw/03-tauri-android-build.txt` | 0 |
| 4 | ADB Device Probe | `adb devices -l` | PROBED (0 attached devices in sandbox; coordinator on-device run) | `raw/04-adb-devices.txt` | 0 |
| 5 | Cargo Check (Android Target) | `cargo check --target aarch64-linux-android -p tauri-plugin-orbitkit` | PASS (Clean compilation in 0.11s) | `raw/05-cargo-check-android.txt` | 0 |
| 6 | APK DEX Symbol Inspection | Python `zipfile` DEX scan | PASS (`NativeArcConfig`, `ResolvedMenuAngles`, `resolveMenuAngles`, `MenuConfigParser`, `RadialLayout` verified in `classes4.dex`) | `raw/06-apk-dex-symbols.txt` | 0 |

---

## 4. Out-of-Scope Findings
None. All changes strictly confined to `crates/tauri-plugin-orbitkit/android/**` and `evidence/sdk-v1/arc-android/**`.

READY FOR REVIEW at 425c7ca8d20fb14b436da571765c92c8702aa367
