# Task Report: P3b and-mascot (Android Overlay Mascot Config Rendering)

Worktree: `oks-and-mascot` (`/home/megastruktur/orca/workspaces/orbitkit/oks-and-mascot`)
Base Commit: `3887628` (main after P3a `and-svgfill`)

---

## 1. Summary of Changes

### A. Rust Payload Builder & Unit Test (`crates/tauri-plugin-orbitkit/src/mobile.rs`)
- Added pure payload builder `build_overlay_payload(menu_config, mascot_args, base_mascot_config)` to serialize `mascotConfig`:
  - `kind`: lowercase ("svg", "image", "sprite")
  - `src`: SVG markup or image URL
  - `size`: default or overridden by `ShowOverlayMascotArgs.size` (converted via `.round() as u32`)
  - `initialState`: initial state string ("idle")
  - `states`: map of state name to `{ "src": "..." }` or sprite definition
- Retained the existing `mascot: { size }` key in the payload for full backward compatibility.
- Gated `run_mobile_plugin` calls through `self.run_mobile_plugin` with `#[cfg(target_os = "android")]` guard to enable host/container unit test compilation.
- Added Rust unit test `test_build_overlay_payload_mascot_config_camel_case_and_states` verifying that:
  - `mascotConfig` is present and serialized camelCase
  - `states.busy.src` and `states.idle.src` are present
  - `size` is overridden when TS passes mascot size args
  - legacy `mascot` key is retained.

### B. P3a LOW Findings Resolved (`SvgIcon.kt` & `SvgDrawable.kt`)
1. **Trailing & Leading Garbage Rejection in `parseTransform`**:
   - `parseTransform` now strictly validates that matches cover from index 0 to `trimmed.length - 1`, and that separators between transform functions contain only valid whitespace or commas. Semicolons, trailing numbers, extra parentheses, or trailing text are rejected (`null`).
2. **Rejection of Non-Finite Floats (NaN / Infinity)**:
   - Added `toFiniteFloatOrNull` utility in `SvgParser`.
   - All transform arguments and shape attributes (`viewBox`, `cx`, `cy`, `r`, `rx`, `ry`, `x1`, `y1`, `x2`, `y2`, `x`, `y`, `width`, `height`, `stroke-width`) now reject `NaN`, `Infinity`, and `-Infinity`, returning `null` / `false` instead of producing corrupted paths or crashes.
3. **Stroke Width Scaling with Matrix Determinant**:
   - Added `Element.matrixDeterminant()` ($m_{00} m_{11} - m_{01} m_{10}$) and `Element.strokeScale()` ($\sqrt{|\det(M)|}$).
   - `SvgDrawable` now scales element stroke width by `paintSpec.strokeWidth * currentScale * element.strokeScale()`.

### C. Kotlin MascotSpec & Native Overlay Rendering (`MascotSpec.kt`, `MenuConfigParser.kt`, `OrbitkitNativePlugin.kt`)
- Added `MascotSpec` pure helper class:
  - `MascotSpec.parse(JSONObject?) -> MascotSpec?`: parses from `mascotConfig`, `mascot`, or direct mascot config objects.
  - `srcFor(state: String): String`: resolves state-specific src (`states[state].src`) falling back to top-level `src`.
  - `kind`: `MascotKind.SVG`, `MascotKind.IMAGE`, `MascotKind.SPRITE`.
  - `isFallback`: true for `SPRITE` or empty `src`.
- Updated `MenuConfigParser.kt` `OverlayConfig` to include parsed `MascotSpec?`.
- Updated `OrbitkitNativePlugin.kt`:
  - `createMascotView`: renders vector SVG via `ImageView` with `SvgDrawable(icon, fraction = 1.0f)` on a transparent background with no oval tinted background or white ring.
  - Optional image path: renders bitmap via `IconDecoder` for `MascotKind.IMAGE`.
  - Retains elevation and `contentDescription = "OrbitKit Mascot"`.
  - `setMascotState(state)`: dynamically swaps the drawable to `spec.srcFor(state)`, displaying the amber planet (`#f59e0b`) from config when busy and blue planet (`#4f7cff`) when idle.
  - Fallback: when config is missing, undecodable, or kind is sprite, logs a warning once and falls back to the tinted oval with 🪐.
  - Geometry invariant R-DEV-1 preserved: window size is `mascotSizePx x mascotSizePx`, never resized or moved on menu toggle. Drag and spawn animations are completely unchanged.

---

## 2. Test Suite Additions

### A. `SvgIconTest.kt` (+4 unit tests)
1. `testParseTransformRejectsTrailingGarbage`: verifies rejection of trailing garbage, trailing semicolons, extra closing parentheses, trailing numbers, leading garbage, and invalid separators between transform functions.
2. `testRejectNonFiniteFloatsInTransformsAndShapeAttributes`: verifies rejection of `NaN`, `Infinity`, and `-Infinity` across transforms and `<circle>`, `<ellipse>`, `<rect>`, `<line>`, and `stroke-width`.
3. `testStrokeWidthScalesWithSqrtAbsDetMatrix`: verifies that `Element.strokeScale()` accurately computes $\sqrt{|\det(M)|}$ for identity (1.0), uniform scale (2.0), non-uniform scale (6.0), rotation (1.0), and reflection (2.0).
4. `testParseViewBoxRejectsZeroAndNegativeRootDimensions`: verifies rejection of zero and negative width and height attributes in root fallback and in viewBox attribute (F1 fix).

### B. `MascotSpecTest.kt` (+10 unit tests)
1. `testMascotSpecParseFromRealStarterConfig`: parses the real starter config JSON loaded from `examples/starter/src/orbitkit.config.json`, asserting SVG kind, size 96, initialState "idle", not fallback, and 2 states.
2. `testSrcForIdleShowsBlueBody`: verifies `srcFor("idle")` contains `#4f7cff` (blue body) and decodes to SVG.
3. `testSrcForBusyShowsAmberBody`: verifies `srcFor("busy")` contains `#f59e0b` (amber body) and decodes to SVG.
4. `testSrcForUnknownStateReturnsTopLevelSrc`: verifies unmapped states fall back to the top-level src.
5. `testMissingConfigReturnsNull`: verifies `null`, empty `{}`, and mascot-less JSON return `null`.
6. `testSpriteKindSetsFallbackFlag`: verifies `kind == "sprite"` sets `isFallback == true`.
7. `testImageKindDecodesBitmap`: verifies `kind == "image"` with data URL parses and is not fallback.
8. `testMascotConfigPayloadWrapperParsing`: verifies parsing from `mascotConfig` wrapper matches the Rust overlay payload structure.
9. `testOverlayConfigMascotSizeOverride`: verifies `MenuConfigParser.parse` preserves both `mascot.size` override and `mascotConfig.size`.
10. `testMascotSpecCustomInitialStateAppliedToSrcFor`: verifies custom `initialState` parses and `srcFor(spec.initialState)` resolves the initial state's asset (F3 fix).

**Total native plugin unit tests:** 136 tests across 9 test suites per variant (272 total across debug and release), all passing (up from 122 baseline).
---

## 3. Verification Matrix

| # | Step | Command | Expected | Observed | Exit Code | Raw Log |
|---|---|---|---|---|---|---|
| 1 | Full Gradle Unit Tests (All Modules) | `cd examples/starter/src-tauri/gen/android && ./gradlew test --rerun-tasks` | All unit tests green across all 328 tasks | BUILD SUCCESSFUL in 8s (328 tasks executed) | 0 | `evidence/sdk-v1/and-mascot/raw/01-gradlew-all-tests.txt` |
| 2 | JUnit Test Results Summary | Python XML aggregator | 136/136 plugin unit tests green across 9 test suites per variant (272 total) | PASS: 272 tests, 0 failures, 0 errors | 0 | `evidence/sdk-v1/and-mascot/raw/02-junit-test-results-summary.txt` |
| 3 | Container Cargo Test | `docker run --rm -u 1000 -e HOME=/tmp -v $PWD:$PWD -v orbitkit-cargo-cache:/usr/local/cargo/registry -w $PWD orbitkit-linux-desktop:1 cargo test -p tauri-plugin-orbitkit -- --nocapture` | All lib and integration tests pass, including `mobile::tests::test_build_overlay_payload_mascot_config_camel_case_and_states` | 22 lib tests + 12 integration tests = 34 passed, 0 failed | 0 | `evidence/sdk-v1/and-mascot/raw/03-container-cargo-test.txt` |
| 4 | Cargo Clippy (Container & Host & Android) | Container: `cargo clippy -p tauri-plugin-orbitkit -p tauri-plugin-orbitkit-recorder --all-targets -- -D warnings`<br>Host: `cargo clippy -p tauri-plugin-orbitkit --all-targets -- -D warnings`<br>Android: `cargo clippy -p tauri-plugin-orbitkit --target aarch64-linux-android -- -D warnings` | Zero warnings on all targets | Clean build, 0 warnings | 0 | `evidence/sdk-v1/and-mascot/raw/04-cargo-clippy.txt` |
| 5 | Starter Debug APK Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | APK built successfully | Built `app-universal-debug.apk` in 4.6s | 0 | `evidence/sdk-v1/and-mascot/raw/05-tauri-android-build.txt` |
| 6 | ADB Device Probe | `adb devices -l` | Probed device environment | 0 attached devices (sandbox environment; coordinator checks physical Z Flip 7) | 0 | `evidence/sdk-v1/and-mascot/raw/06-adb-devices.txt` |
| 7 | DEX Symbol Verification | Python zipfile DEX inspection of `app-universal-debug.apk` | `MascotSpec`, `MascotKind`, `createMascotView`, `updateMascotDisplay`, `srcFor`, `SvgDrawable`, `SvgIcon`, `SvgParser`, `initialState` present in DEX | All symbols FOUND | 0 | `evidence/sdk-v1/and-mascot/raw/07-apk-dex-symbols.txt` |
---

## 4. Out-of-Scope Findings

1. **`crates/tauri-plugin-orbitkit/src/lib.rs` Compilation Gate**:
   - In `lib.rs:14`, `#[cfg(mobile)] mod mobile;` prevented the pure Rust unit test `test_build_overlay_payload_mascot_config_camel_case_and_states` mandated by BRIEF from ever compiling or executing under `cargo test` in desktop/container environments.
   - Changed line 14 to `#[cfg(any(mobile, test))] mod mobile;` and guarded target-specific `run_mobile_plugin` invocations in `mobile.rs` behind `#[cfg(target_os = "android")]`.
   - This allowed the brief-mandated unit test to execute and pass under `cargo test -p tauri-plugin-orbitkit` while preserving full Android cross-compilation purity.


## 5. Review Round 1 Findings & Resolutions

- **F1 (MEDIUM):** Restored `if (width <= 0f || height <= 0f) return null` in `SvgIcon.kt` `parseViewBox` fallback, and added `testParseViewBoxRejectsZeroAndNegativeRootDimensions` in `SvgIconTest.kt` asserting `assertNull` for zero and negative root width/height.
- **F2 (LOW):** Replaced `#![allow(dead_code)]` in `mobile.rs` with `#[cfg_attr(not(target_os = "android"), allow(dead_code))]`. All targets clean under `clippy -D warnings`.
- **F3 (LOW):** In `OrbitkitNativePlugin.kt` `overlayShow`, applied `parsedOverlayConfig.mascotSpec?.initialState` to `currentMascotState` when set, ensuring initial display uses the configured initial state. Added unit test `testMascotSpecCustomInitialStateAppliedToSrcFor` to `MascotSpecTest.kt`.
---

READY FOR REVIEW at bdd70926d8df03f9b860836a6428a8a062cc834c
