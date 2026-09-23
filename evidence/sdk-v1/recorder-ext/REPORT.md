# Report: sdk-v1 / recorder-ext (T10)

## Overview
- Worktree: `oks-recorder-ext`
- Base: `c2af181` (`megastruktur/oks-campaign` containing T01–T09 and R-T09-1 JNI hardening)
- Goal: Move mic recorder (`OrbitkitRecorderService`, `OrbitkitStatePersistence`, tests, Rust recorder commands, `mic-recorder` feature) out of starter/core into optional crate `crates/tauri-plugin-orbitkit-recorder` (plugin name `orbitkit-recorder`), consumed by starter only behind Cargo feature `recorder`.

## Architecture, Core Cleanup & Capability Gating
1. **New Crate**: `crates/tauri-plugin-orbitkit-recorder`
   - Cargo package name: `tauri-plugin-orbitkit-recorder`
   - Tauri plugin name: `orbitkit-recorder`
   - Android library namespace: `dev.orbitkit.recorder`
   - Kotlin plugin class: `dev.orbitkit.recorder.OrbitkitRecorderPlugin`
   - Kotlin service & persistence package: kept as `dev.orbitkit.native` (`OrbitkitRecorderService` and `OrbitkitStatePersistence`) to preserve existing intent actions, notification channel IDs, and atomic state file persistence contracts without breaking storage compatibility.
2. **Commands & Manifest (K5)**:
   - Snake_case commands: `start_foreground`, `pause`, `resume`, `stop`, `state`, `post_standby_notification`, `get_persisted_state`, `recover_state`.
   - Plugin `AndroidManifest.xml` declares `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `POST_NOTIFICATIONS` and `<service android:name="dev.orbitkit.native.OrbitkitRecorderService" android:exported="false" android:foregroundServiceType="microphone" />`.
3. **Core Plugin Cleanup (BRIEF line 51 & Note line 77)**:
   - Removed all 8 recorder `@Command` methods (`recorderStartForeground`, `recorderPause`, `recorderResume`, `recorderStop`, `recorderState`, `recorderPostStandbyNotification`, `recorderGetPersistedState`, `recorderRecoverState`) from `crates/tauri-plugin-orbitkit/android/src/main/java/dev/orbitkit/native/OrbitkitNativePlugin.kt`.
   - Removed `RECORDER_SERVICE_CLASS`, `PERSISTENCE_CLASS`, and `ACTION_*` recorder constants from `OrbitkitNativePlugin.kt`.
   - Removed recorder persistence hook `recordAction` from `handleAction` in `OrbitkitNativePlugin.kt`.
   - Removed `testC2RecorderCommandsPresentAndAnnotated` from `crates/tauri-plugin-orbitkit/android/src/test/java/dev/orbitkit/native/OrbitkitNativePluginTest.kt` (core native plugin test count: 10 -> 9).
   - Added `testRecorderPluginCommandsPresentAndAnnotated` to `crates/tauri-plugin-orbitkit-recorder/android/src/test/java/dev/orbitkit/native/OrbitkitRecorderPersistenceTest.kt` (recorder module test count: 12 -> 13).
   - Maintained baseline test parity: 13 (recorder) + 9 (core native plugin) = 22 tests.
4. **Starter App Cleanliness & Dynamic Capability Gating**:
   - Removed `OrbitkitRecorderService.kt`, `OrbitkitStatePersistence.kt`, and `recorder.rs` from `examples/starter`.
   - Removed mic/FGS permissions and service from starter `AndroidManifest.xml`.
   - Feature `mic-recorder` in starter `Cargo.toml` replaced with `recorder = ["dep:tauri-plugin-orbitkit-recorder"]`.
   - Implemented capability gating in `examples/starter/src-tauri/build.rs`: when `CARGO_FEATURE_RECORDER` is set, `build.rs` generates `capabilities/recorder.json` granting `orbitkit-recorder:default` permissions to window `main` (ignored via `capabilities/.gitignore`). When feature is unset, `capabilities/recorder.json` is cleaned up so core builds compile without missing-permission errors.
   - In `App.svelte`, all recorder invokes renamed to `plugin:orbitkit-recorder|<command>`. Recorder UI controls are conditionally rendered only when the recorder plugin is present (`hasRecorderPlugin`).

## Test & Verification Matrix

| # | Scenario | Command | Expected | Observed | Exit Code |
|---|---|---|---|---|---|
| 1 | APK Core (no recorder) | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` + `aapt dump badging` | No mic/FGS perms, no recorder service | Merged APK manifest has only `INTERNET` and `SYSTEM_ALERT_WINDOW`. No `RECORD_AUDIO`, no `FOREGROUND_SERVICE*`, no `POST_NOTIFICATIONS`, no `OrbitkitRecorderService`. | 0 |
| 2 | APK Recorder (`--features recorder`) | `pnpm --filter starter tauri android build --debug --target aarch64 --apk --features recorder` + `aapt dump badging` | Mic/FGS perms and service present | Merged APK manifest contains `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `POST_NOTIFICATIONS` and `OrbitkitRecorderService`. DEX contains `OrbitkitRecorderPlugin`, `OrbitkitRecorderService`, `OrbitkitStatePersistence`. | 0 |
| 3 | JUnit Unit Tests | `cd examples/starter/src-tauri/gen/android && ./gradlew test --rerun-tasks` | All unit tests pass green | 53/53 tests passed, 0 failures, 0 errors, 0 skipped. `OrbitkitRecorderPersistenceTest` (13 tests) + `OrbitkitNativePluginTest` (9 tests) = 22 tests (matching spike 22/22 baseline). | 0 |
| 4 | Device Runtime | `adb devices -l` + S1 test | S1 start via activity -> notification visible | Probed `adb devices -l`: no device connected. Scenarios S1-S5 marked DEFERRED. Runbook provided below. | 0 |
| 5 | Cargo Check (Desktop & Android) | `cargo check -p starter` (both ways), `--target aarch64-linux-android` (both ways), `cargo check --workspace` | Clean compilation both ways | All 5 permutations compiled with 0 errors and 0 warnings. | 0 |
| 6 | Container Desktop Build | `./scripts/linux-desktop.sh build examples/starter` | Linux desktop ELF binary built in container | Successfully built starter desktop binary at `examples/starter/src-tauri/target-linux/debug/starter`. | 0 |
| 7 | Starter Frontend Build | `pnpm --filter starter build` | Vite build succeeds | Svelte 5 frontend compiled in 300ms without errors. | 0 |
| 8 | Mutation Testing | Mutate `recoveryCount` increment in `OrbitkitStatePersistence.kt` | Tests fail | 4 unit tests in `OrbitkitRecorderPersistenceTest` failed with `AssertionError`; build failed with exit code 1. | 1 |

## Raw Evidence Artifacts
All logs stored under `evidence/sdk-v1/recorder-ext/raw/` with trailing `EXIT_CODE=<n>`:
- `01-apk-core-build.txt`: Core APK build log (`EXIT_CODE=0`)
- `01-apk-core-badging.txt`: Core APK badging dump showing absence of mic/FGS perms (`EXIT_CODE=0`)
- `01-apk-core-manifest-xmltree.txt`: Core APK manifest xmltree showing absence of recorder service (`EXIT_CODE=0`)
- `02-apk-recorder-build.txt`: Recorder APK build log with `--features recorder` (`EXIT_CODE=0`)
- `02-apk-recorder-badging.txt`: Recorder APK badging dump showing all 4 mic/FGS perms (`EXIT_CODE=0`)
- `02-apk-recorder-manifest-xmltree.txt`: Recorder APK manifest xmltree showing `OrbitkitRecorderService` (`EXIT_CODE=0`)
- `02-apk-recorder-dex-symbols.txt`: DEX inspection confirming `OrbitkitRecorderPlugin`, `OrbitkitRecorderService`, `OrbitkitStatePersistence` (`EXIT_CODE=0`)
- `03-gradlew-unit-tests.txt`: Full Gradle unit test execution across all modules (`EXIT_CODE=0`)
- `03-junit-test-results-summary.txt`: Parsed JUnit XML counts (53 passed, 0 failures, 0 errors; 13 recorder + 9 native plugin = 22 baseline parity) (`EXIT_CODE=0`)
- `04-adb-devices.txt`: `adb devices -l` probe log (`EXIT_CODE=0`)
- `05-cargo-check-starter-core.txt`: Desktop cargo check starter without features (`EXIT_CODE=0`)
- `05-cargo-check-starter-recorder.txt`: Desktop cargo check starter with `--features recorder` (`EXIT_CODE=0`)
- `05-cargo-check-android-core.txt`: Android aarch64 cargo check without features (`EXIT_CODE=0`)
- `05-cargo-check-android-recorder.txt`: Android aarch64 cargo check with `--features recorder` (`EXIT_CODE=0`)
- `05-cargo-check-workspace.txt`: Full workspace cargo check (`EXIT_CODE=0`)
- `06-desktop-container-build.txt`: Containerized desktop build log (`EXIT_CODE=0`)
- `07-pnpm-starter-build.txt`: Starter frontend build log (`EXIT_CODE=0`)
- `08-mutation-test-failure.txt`: Mutant test failure proof (`EXIT_CODE=1`)

## On-Device Runbook (Deferred Scenario 4)
When a physical Android device (e.g. Z Flip 7) is connected:
1. Verify device connection: `adb devices -l`
2. Install recorder APK: `adb install -r examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
3. Launch app: `adb shell am start -n dev.orbitkit.app/.MainActivity`
4. Tap "Request SAW" and grant overlay permission in Android system settings.
5. Tap "overlayShow" to verify floating mascot bubble appears over launcher.
6. Tap "S1: Start FGS": verify recording starts, notification channel `orbitkit_recorder` displays foreground notification with "STOP" action, and spool file `recorder_spool.pcm` accumulates PCM bytes.
7. Background app: verify recording and notification persist while app is backgrounded.
8. Tap "S2: Stop": verify foreground service stops and notification is dismissed.

## Deviations
1. `examples/starter/src-tauri/build.rs` edited to gate the generated `capabilities/recorder.json` on `CARGO_FEATURE_RECORDER` (rationale: static capability files cannot be feature-gated in Tauri v2; required to satisfy AC4 both ways while granting `orbitkit-recorder:default` in feature-on builds; `capabilities/.gitignore` itself is inside `capabilities/**` so allowlisted).

## Out-of-Scope Findings
None.

## Contract Questions
None.
READY FOR REVIEW at a5a3a3d43c32374457a215d03e60eaccb40482c2
