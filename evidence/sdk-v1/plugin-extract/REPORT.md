# Task Report: `oks_plugin-extract` (T03)

## Summary
- Extracted inline `orbitkit-native` plugin from `examples/starter` into standalone crate `crates/tauri-plugin-orbitkit`.
- Created official Tauri v2 plugin crate layout:
  - Root workspace configured in root `Cargo.toml` with members `["crates/*", "examples/starter/src-tauri"]`.
  - `crates/tauri-plugin-orbitkit/Cargo.toml` with `links = "tauri-plugin-orbitkit"`.
  - `crates/tauri-plugin-orbitkit/build.rs` configuring K4 commands and `.android_path("android")`.
  - `crates/tauri-plugin-orbitkit/permissions/` defining default capability `orbitkit:default` covering all 8 K4 commands.
  - Rust sources: `lib.rs`, `commands.rs`, `config.rs`, `desktop.rs`, `mobile.rs`, `error.rs`, `jni_bridge.rs`.
  - K2 config schema mirror in `config.rs` with unit tests for serde roundtrip, defaults, and regex menu-item ID validation.
  - K4 error serialization tested: `{ code: "permission_denied" | "unsupported" | "not_found" | "invalid_config", message }`.
  - Android library Gradle module in `crates/tauri-plugin-orbitkit/android/` with Kotlin classes `OrbitkitNativePlugin` and `OrbitkitJniBridge`.
  - Plugin Android manifest requests `SYSTEM_ALERT_WINDOW` only (K5 compliance).
- Starter application rewired:
  - `examples/starter/src-tauri/Cargo.toml` package renamed to `starter` (lib remains `orbitkit_lib`), depending on path `crates/tauri-plugin-orbitkit`.
  - Inline plugin build removed from `examples/starter/src-tauri/build.rs`.
  - `capabilities/default.json` updated to use `orbitkit:default`.
  - Obsolete `orbitkit_native.rs` and `jni_bridge.rs` removed from starter.
  - Svelte UI (`examples/starter/src/App.svelte`) updated to invoke `plugin:orbitkit|<snake>`.
- Verification:
  - `docker run --rm -u 1000 -v $PWD:$PWD -w $PWD orbitkit-linux-desktop:1 cargo test -p tauri-plugin-orbitkit` passed (8/8 tests, exit 0).
  - `cargo check -p starter` passed (exit 0).
  - `cargo check -p starter --features mic-recorder` passed (exit 0).
  - `cargo check --target aarch64-linux-android -p tauri-plugin-orbitkit` passed (exit 0).
  - Android debug APK built successfully: `app-universal-debug.apk` (exit 0).
  - Gradle unit tests (`--rerun-tasks`): 8/8 in `:tauri-plugin-orbitkit:testDebugUnitTest` + 14/14 in `:app:testUniversalDebugUnitTest` = 22/22 tests green (JUnit XML confirmed).
  - DEX inspection confirmed `dev.orbitkit.native.OrbitkitNativePlugin` in APK DEX.
  - Native shared library `liborbitkit_lib.so` in APK exports `Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction`.
  - Manifest merger report confirms plugin contributes `SYSTEM_ALERT_WINDOW` only.
  - No duplicate camelCase commands in Rust; Kotlin `@Command` mappings documented.

## Scenario Results

| # | Scenario | Command | Expected | Actual / Evidence | Exit Code |
|---|---|---|---|---|---|
| 1 | Rust tests | `docker run --rm -u 1000 -v $PWD:$PWD -w $PWD orbitkit-linux-desktop:1 cargo test -p tauri-plugin-orbitkit` | pass | 8/8 tests passed cleanly (config roundtrip, minimal config defaults, menu ID validation, error serialization, error reject mapping, log_fmt static CStr & safe CString, JNI bridge logic, recorder actions) (`raw/01-cargo-test-plugin.txt`) | 0 |
| 1b | Rust check (android target) | `cargo check --target aarch64-linux-android -p tauri-plugin-orbitkit` | pass | Checked android target cleanly (`raw/01b-cargo-check-android-plugin.txt`) | 0 |
| 2 | Rust check (starter) | `cargo check -p starter` | pass | Checked dev target cleanly (`raw/02-cargo-check-starter.txt`) | 0 |
| 2 | Rust check (mic-recorder) | `cargo check -p starter --features mic-recorder` | pass | Checked with mic-recorder feature cleanly (`raw/03-cargo-check-starter-mic-recorder.txt`) | 0 |
| 3 | Android APK build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | APK | Universal debug APK built at `examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk` (`raw/04-tauri-android-build.txt`) | 0 |
| 3 | Gradle unit tests (plugin) | `./gradlew :tauri-plugin-orbitkit:testDebugUnitTest --rerun-tasks` | pass (8 tests) | 8/8 tests green in `OrbitkitNativePluginTest` (JUnit XML verified: `TEST-dev.orbitkit.native.OrbitkitNativePluginTest.xml`) (`raw/05-gradlew-plugin-unit-tests.txt`) | 0 |
| 3 | Gradle unit tests (starter) | `./gradlew :app:testUniversalDebugUnitTest --rerun-tasks` | pass (14 tests) | 14/14 tests green in `OrbitkitSurvivalJniTest` (JUnit XML verified: `TEST-dev.orbitkit.native.OrbitkitSurvivalJniTest.xml`) (`raw/06-gradlew-starter-unit-tests.txt`) | 0 |
| 4 | DEX & JNI symbols | `apkanalyzer dex packages` + `llvm-nm -D` | symbols present | `dev.orbitkit.native.OrbitkitNativePlugin` in DEX; `Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction` exported in `liborbitkit_lib.so` (`raw/07-apk-inspection-dex-symbols.txt`) | 0 |
| 5 | Merged manifest | `aapt dump xmltree` + manifest report | SAW only from plugin | `SYSTEM_ALERT_WINDOW` merged from `:tauri-plugin-orbitkit`; plugin `AndroidManifest.xml` contains SAW only (`raw/08-apk-inspection-manifest.txt`) | 0 |
| 6 | Command cleanliness | `grep -rnI --exclude-dir=build --exclude-dir=dist 'overlayShow' crates examples` | empty except Kotlin @Command | No camelCase duplicate Rust commands; only Kotlin `@Command` and mobile invocation mapping (`raw/09-grep-commands-check.txt`) | 0 |
| 7 | Desktop run | `scripts/linux-desktop.sh run-screenshot …` | screenshot or declared limit | Declared limit: `scripts/linux-desktop.sh` not on base (T01 not integrated; cargo check only per COMMON.md rule 7) | N/A |
| 8 | Device run | `adb devices -l` | logcat receipt or DEFERRED | DEFERRED: 0 devices attached (`raw/10-adb-devices.txt`). On-device runbook documented below. | 0 |

## Remediation Round 2 Findings Resolution

### F1 MAJOR — K4 error mapping (`error.rs`) — *(SUPERSEDED by Round 3 F6 and Round 4 F8–F10)*
> **Superseded Notice:** The introduction of `ErrorCode::Unknown` / 5 error codes described in this Round 2 section was superseded by coordinator decision in Round 3 (F6) and verified in Round 4 (F8–F10). CONTRACTS.md K4 strictly defines 4 error variants (`permission_denied`, `unsupported`, `not_found`, `invalid_config`). `ErrorCode::Unknown` has been removed, unrecognized Kotlin reject codes map to `unsupported`, and an exhaustive match with no wildcard arm ensures that any 5th error variant causes a compile error.

- Resolved indiscriminate mapping of `PluginInvokeError` to `unsupported`.
- Added `ErrorCode::Unknown` (`"unknown"`) to `ErrorCode` enum representing the generic fallback code for unrecognized errors and platform failures. *(Superseded: removed in Round 3 F6)*
- Implemented `Error::from_reject_code(code: Option<&str>, message: Option<String>, fallback: impl Into<String>) -> Self`:
  - Case-insensitively maps `PERMISSION_DENIED` / `permission_denied` -> `ErrorCode::PermissionDenied`.
  - Maps `UNSUPPORTED` / `unsupported` -> `ErrorCode::Unsupported`.
  - Maps `NOT_FOUND` / `not_found` -> `ErrorCode::NotFound`.
  - Maps `INVALID_CONFIG` / `invalid_config` -> `ErrorCode::InvalidConfig`.
  - Maps unknown reject codes (e.g. `OVERLAY_SHOW_FAILED`, `SETTINGS_FAILED`, etc.) or `None` -> `ErrorCode::Unknown`. *(Superseded: mapped to `ErrorCode::Unsupported` in Round 3 F6)*
- Updated mobile `From<PluginInvokeError>` implementation:
  - `InvokeRejected(resp)` maps via `from_reject_code` using `resp.code`, `resp.message`, and `resp.to_string()`.
  - Transport and runtime errors (`UnreachableWebview`, `Jni`, `CannotDeserializeResponse`, `CannotSerializePayload`) map to `ErrorCode::Unknown` with descriptive messages. *(Superseded: mapped to `ErrorCode::Unsupported` in Round 3 F6)*
- Added comprehensive unit tests in `error.rs`:
  - `test_error_serialization`: verifies serialization of all 5 error codes including `"unknown"`. *(Superseded: strictly 4 variants in Round 3; exhaustive match in Round 4 F9)*
  - `test_reject_code_mapping`: tests known codes (`PERMISSION_DENIED`, `UNSUPPORTED`, `NOT_FOUND`, `INVALID_CONFIG`), unknown codes (`OVERLAY_SHOW_FAILED`, `SETTINGS_FAILED`), and `None`.
  - `test_plugin_invoke_error_mobile_conversion`: tests mobile conversion under `#[cfg(mobile)]`.
### F2 MAJOR — Format-string bug (`jni_bridge.rs`)
- Restored exact spike invocation in `log_android_info`:
  ```rust
  if let (Ok(c_tag), Ok(c_fmt)) = (CString::new(tag), CString::new("%s\0")) {
      if let Ok(c_msg) = CString::new(message) {
          unsafe {
              __android_log_print(4 /* ANDROID_LOG_INFO */, c_tag.as_ptr(), c_fmt.as_ptr(), c_msg.as_ptr());
          }
      }
  }
  ```
- Eliminates format string vulnerability where message content could be interpreted as printf format specifiers.

### F3 MAJOR — K2 config defaults and mutation-proof test (`config.rs`)
- Implemented K2 deserialization defaults with `#[serde(default = ...)]`:
  - `item_size: f64` defaults to `44.0` (`default_item_size`).
  - `trigger: MenuTrigger` defaults to `MenuTrigger::Click` (`default_menu_trigger`).
  - `radius: f64` defaults to `96.0`, `start_angle: f64` defaults to `-90.0`, `end_angle: f64` defaults to `270.0`.
  - `size: u32` defaults to `96`, `initial_state: String` defaults to `"idle"`.
- Updated `test_k2_config_serde_roundtrip` with NON-default sample values:
  - `initialState`: `"waving"` (default is `"idle"`)
  - `startAngle`: `45.0` (default is `-90.0`)
  - `endAngle`: `315.0` (default is `270.0`)
  - `itemSize`: `56.0` (default is `44.0`)
  - `trigger`: `"hover"` (`MenuTrigger::Hover`, default is `click`)
  - `frameWidth`: `32`, `frameHeight`: `48`
  - `alwaysOnTop`: `true` on both `mascotWindow` and `popups`
  - `mascotWindow`: `x = 150.0`, `y = 250.0`
- Asserted EVERY parsed field across mascot, menu, states, and windows.
- Asserted that serialized JSON contains camelCase keys (`"initialState"`, `"frameWidth"`, `"frameHeight"`, `"startAngle"`, `"endAngle"`, `"itemSize"`, `"alwaysOnTop"`, `"mascotWindow"`).
- Added `test_k2_minimal_config_defaults`: asserts that minimal config JSON lacking optional fields deserializes to exact K2 defaults.
- Mutation proof executed and verified:
  - Stripped all `#[serde(rename_all = "camelCase")]` attributes in a scratch test.
  - Test immediately panicked with assertion failure (`left: None, right: Some(32)` on `frame_width`, followed by `initial_state` and `start_angle`).
  - Raw failure log recorded at `evidence/sdk-v1/plugin-extract/raw/mutation-k2-test-failure.txt`.

### F4 Minor — Evidence & verification protocol
- Re-captured gradle test execution with `--rerun-tasks`:
  - `:tauri-plugin-orbitkit:testDebugUnitTest` -> 8 passed, 0 failed (`raw/05-gradlew-plugin-unit-tests.txt`).
  - `:app:testUniversalDebugUnitTest` -> 14 passed, 0 failed (`raw/06-gradlew-starter-unit-tests.txt`).
  - Total JUnit XML test count = 8 + 14 = 22 tests green.
- Updated Scenario 6 grep command to exclude `dist/`: `grep -rn --exclude-dir=dist 'overlayShow' crates examples` (`raw/09-grep-commands-check.txt`).
- Updated READY line at the end of this report to cite the final implementation commit SHA.

### F5 Minor — Parity with spike logcat tag and JniActionRecord
- Restored `[RUST-JNI-RECEIPT]` logcat tag:
  `[RUST-JNI-RECEIPT] receiptId=... action="..." timestamp=... webviewSuspended=true (Direct native dispatch, no WebView JS)`
- Restored `JniActionRecord` struct fields matching spike:
  - `receipt_id: u64`
  - `action: String`
  - `timestamp_millis: u64`
  - `rust_tag: String` (set to `"Rust_JNI_Bridge"`)
  - `webview_suspended: bool` (set to `true`)
- Updated and expanded JNI bridge tests in `jni_bridge.rs`:
  - `test_process_native_action_records_and_returns_json`
  - `test_recorder_actions_through_jni`


## Remediation Round 3 Findings Resolution

### F2' MAJOR — Android logcat static CStr format string and infallible CString (`jni_bridge.rs`)
- Resolved latent bug where `CString::new("%s\0")` returned `Err(NulError)` due to the interior NUL byte, which caused `if let` to fail silently and prevented `__android_log_print` from ever being called.
- Replaced dynamic CString format with compile-time static C string literal `c"%s"` (Rust 1.77+ syntax).
- Extracted `pub fn log_fmt() -> &'static CStr { c"%s" }` and verified via host unit test `test_log_fmt_and_safe_cstring`:
  - `assert_eq!(log_fmt().to_bytes(), b"%s");`
  - `assert_eq!(log_fmt().to_bytes_with_nul(), b"%s\0");`
- Implemented `pub fn to_safe_cstring(s: &str) -> CString` to sanitize any interior null bytes:
  - Tag and message CString conversions are completely infallible.
  - Tested in unit suite (`test_log_fmt_and_safe_cstring`).
- Updated `log_android_info`: passes `c_fmt.as_ptr()` as the format string and `c_msg.as_ptr()` as the vararg to `__android_log_print(4, c_tag.as_ptr(), c_fmt.as_ptr(), c_msg.as_ptr())`.
- Verified clean compilation on `aarch64-linux-android` target and verified `liborbitkit_lib.so` links `liblog.so`.

### F6 — Strict K4 4-error union (`error.rs`)
- Removed `ErrorCode::Unknown` and `Error::unknown` per coordinator decision. K4's error union is strictly `{ code: "permission_denied" | "unsupported" | "not_found" | "invalid_config", message }`.
- Mapped unrecognized Kotlin reject codes (e.g. `OVERLAY_SHOW_FAILED`, `SETTINGS_FAILED`, `START_FAILED`, etc.) and IPC/transport errors (`UnreachableWebview`, `Jni`, deserialization) to `ErrorCode::Unsupported`.
- Mapped `PERMISSION_DENIED` -> `ErrorCode::PermissionDenied`, `NOT_FOUND` -> `ErrorCode::NotFound`, and `INVALID_CONFIG` / `INVALID_ARGUMENT` -> `ErrorCode::InvalidConfig`.
- Updated all unit tests in `error.rs`:
  - `test_error_serialization` asserts the 4 K4 error variants.
  - `test_reject_code_mapping` tests known K4 codes, `INVALID_ARGUMENT`, unrecognized codes (`OVERLAY_SHOW_FAILED`, `SETTINGS_FAILED`), and `None` fallback to `unsupported`.
  - `test_plugin_invoke_error_mobile_conversion` tests mobile invoke error conversion.
- Dropped Deviation #4.

### F7 — Clean raw/09 grep command
- Updated Scenario 6 command to `grep -rnI --exclude-dir=build --exclude-dir=dist 'overlayShow' crates examples`.
- Avoids scanning binary build/dist artifacts; raw evidence file `raw/09-grep-commands-check.txt` is pure UTF-8 text.


## Remediation Round 4 Findings Resolution (Test-Only)

### F8 — Restored `assert_eq!(err5.code, ErrorCode::InvalidConfig)` in `test_reject_code_mapping`
- Restored `assert_eq!(err5.code, ErrorCode::InvalidConfig);` in `crates/tauri-plugin-orbitkit/src/error.rs` under the `INVALID_CONFIG` test case in `test_reject_code_mapping`.
- Ensures that mapping from `Some("INVALID_CONFIG")` verifies both the resulting `code` enum variant (`ErrorCode::InvalidConfig`) and the `message` string.

### F9 — Exhaustive match over `ErrorCode` in `test_error_serialization`
- Added an exhaustive `match` over all `ErrorCode` variants without any wildcard (`_`) arm in `test_error_serialization`.
- If a 5th variant is ever introduced into `ErrorCode`, Rust compilation fails (`E0004: non-exhaustive patterns: ... not covered`), strictly enforcing K4's 4-error contract (`permission_denied | unsupported | not_found | invalid_config`).

### F10 — Round 2 Report Section Superseded
- Explicitly marked the Round 2 F1 section regarding `ErrorCode::Unknown` and 5 error codes as superseded by Round 3 F6 and Round 4 F8–F10.

### Mutation Proof Verification
1. **Clean Test Pass**:
   - Command: `docker run --rm -u 1000 -v $PWD:$PWD -w $PWD orbitkit-linux-desktop:1 cargo test -p tauri-plugin-orbitkit`
   - Result: 8/8 tests passed (exit 0). Recorded in `evidence/sdk-v1/plugin-extract/raw/01-cargo-test-plugin.txt`.
2. **Mutant Test Failure (F8 Verification)**:
   - Mutation: Removed `Some("invalid_config") |` from `crates/tauri-plugin-orbitkit/src/error.rs` in `from_reject_code`.
   - Command: `docker run --rm -u 1000 -v $PWD:$PWD -w $PWD orbitkit-linux-desktop:1 cargo test -p tauri-plugin-orbitkit`
   - Result: Test failed at `assert_eq!(err5.code, ErrorCode::InvalidConfig)` with `left: Unsupported, right: InvalidConfig` (exit 101). Recorded in `evidence/sdk-v1/plugin-extract/raw/mutation-error-test-failure.txt`.
## On-Device Runbook (Scenario 8 Deferred Verification)
When a physical test device (Z Flip 7 or similar Android 14+ device) is attached:
1. Verify device connection:
   ```bash
   adb devices -l
   ```
2. Install the built universal debug APK:
   ```bash
   adb install -r examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
   ```
3. Grant `SYSTEM_ALERT_WINDOW` permission via ADB (or grant in Settings when prompted by app):
   ```bash
   adb shell appops set dev.orbitkit.app SYSTEM_ALERT_WINDOW allow
   ```
4. Launch the application:
   ```bash
   adb shell am start -n dev.orbitkit.app/.MainActivity
   ```
5. In UI, tap `Check SAW` (observing `Overlay permission: GRANTED` on UI), then tap `overlayShow` (`plugin:orbitkit|show_overlay`) to display the native floating overlay bubble.
6. Tap overlay action button `ACT_A` (or `ACT_B` / `ACT_C`).
7. Observe JNI receipt in logcat:
   ```bash
   adb logcat -s OrbitkitJni:I OrbitkitJniBridge:I OrbitkitNative:I *:S
   ```
   Expected receipt lines:
   ```text
   [OrbitkitNative] Overlay action tapped: ACT_A
   [OrbitkitJniBridge] [JNI-DISPATCH] action='ACT_A' -> Rust result: {"receiptId":1,"action":"ACT_A","timestampMillis":...,"rustTag":"Rust_JNI_Bridge","webviewSuspended":true}
   [OrbitkitJni] [RUST-JNI-RECEIPT] receiptId=1 action="ACT_A" timestamp=... webviewSuspended=true (Direct native dispatch, no WebView JS)
   ```

## Command Mapping Documentation
- K4 commands exposed on Rust Tauri plugin surface (snake_case only):
  - `overlay_permission` -> Mobile: `isOverlayPermissionGranted` (returns `{ granted: bool }`)
  - `request_overlay_permission` -> Mobile: `requestOverlayPermission`
  - `show_overlay` -> Mobile: `overlayShow`
  - `hide_overlay` -> Mobile: `overlayHide`
  - `open_popup` -> Desktop stub (T08), Android returns `unsupported`
  - `close_popup` -> Desktop stub (T08), Android returns `unsupported`
  - `set_mascot_state` -> Emits `orbitkit://mascot-state`
  - `emit_menu_action` -> Emits `orbitkit://menu-action`, calls registered `OrbitkitExt::on_menu_action` handlers
- Kotlin `@Command` methods in `OrbitkitNativePlugin.kt`:
  - `isOverlayPermissionGranted(invoke: Invoke)`
  - `requestOverlayPermission(invoke: Invoke)`
  - `overlayShow(invoke: Invoke)`
  - `overlayHide(invoke: Invoke)`
  - Recorder methods (`recorderStartForeground`, `recorderPause`, `recorderResume`, `recorderStop`, `recorderState`, `recorderPostStandbyNotification`, `recorderGetPersistedState`, `recorderRecoverState`) decoupled via reflection / runtime Intents to `dev.orbitkit.native.OrbitkitRecorderService` and `OrbitkitStatePersistence`.

## Deviations
1. **Gradle Namespace**: In `crates/tauri-plugin-orbitkit/android/build.gradle.kts`, `namespace` is set to `"dev.orbitkit.plugin"` because AGP 8 forbids Java reserved keywords (such as `native`) in the namespace property used to generate the `R` class. Kotlin source classes remain under `package dev.orbitkit.native` matching K1.
2. **Unit Test Suite Composition**: In the spike baseline, `OrbitkitNativePluginTest` (8 tests) included 2 tests (`testRecorderServiceHierarchyAndConstants` and `testRecorderStateEnum`) that coupled to `OrbitkitRecorderService`. Because recorder services remain in the starter `app` module rather than the core plugin library, those 2 tests were not moved to the standalone plugin. In their place, `testJniBridgeClassAndMethodsReflection` and `testJniBridgeDispatchFallbackDoesNotCrash` were added to `:tauri-plugin-orbitkit`'s test suite to verify the JNI bridge contracts directly within the plugin module (yielding 8 tests in `:tauri-plugin-orbitkit:testDebugUnitTest`). The remaining 14 tests in `OrbitkitSurvivalJniTest` run in `:app:testUniversalDebugUnitTest`, yielding 22 tests total.
3. **Optional show_overlay Arguments**: In Rust `commands.rs`, `show_overlay` takes `menu: Option<MenuConfig>, mascot: Option<ShowOverlayMascotArgs>` rather than requiring a mandatory `{menu: MenuConfig}` argument. This permits the existing no-argument UI button call in `examples/starter/src/App.svelte` (`await invoke("plugin:orbitkit|show_overlay")`) to function without deserialization errors until T09 implements the full dynamic radial menu configuration.

## Out-of-Scope Findings
- In `examples/starter/src-tauri/tauri.conf.json`, line 5 specifies `"identifier": "dev.orbitkit.app"`, whereas K1 states `examples/starter/ # consumer app: ... identifier dev.orbitkit.starter`. Since `tauri.conf.json` is not listed in this task's Scope allowlist (which covers `examples/starter/src-tauri/{Cargo.toml,build.rs,src/**,capabilities/**,gen/android/**}`), it was left unchanged to adhere strictly to the allowlist boundaries.

## Contract Questions
- None. All contracts K1, K2, K4, K5, K6 consumed as-is and verified.

READY FOR REVIEW at 6c7689fb3bdaeffeb0d58d6752a1d5fe1b93428f
