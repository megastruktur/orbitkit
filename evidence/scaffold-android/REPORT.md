# okf scaffold-android — REPORT

- Worktree: `okf-scaffold-android` (repo `orbitkit`, lineage `okf-campaign`)
- Date: 2026-09-22
- Agent: OMP coding agent (only writer in this worktree)
- Base: `2659eea` (`okf squash(T02 scaffold-desktop): Tauri v2 + Svelte 5 desktop skeleton (C1)`)
- Commit: `96ddf35` (final tip SHA published in worktree status)

## Verdict

Code-complete and build-verified.
- **Scenario 1 (Android init): PASS.** `pnpm tauri android init --ci` completed with `applicationId` = `dev.orbitkit.app` (C1 contract). Generated Android project committed under `src-tauri/gen/android/` (40 project template files, raw capture `raw/02-tauri-android-init.txt`).
- **Scenario 2 (Debug build): PASS.** `pnpm tauri android build --debug --apk` and `pnpm tauri android build --debug --apk --split-per-abi` succeeded. Produced both the universal APK (`app-universal-debug.apk`, 465 MB with all 4 ABIs: `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`) and architecture-split APKs including the Samsung Galaxy Z Flip 7 target (`app-arm64-debug.apk`, 127 MB). Both verified via `aapt dump badging` (`raw/04`, `raw/07`, `raw/09`) and ZIP asset verification (`assets/tauri.conf.json` and compiled native library `lib/arm64-v8a/liborbitkit_lib.so`).
- **Scenario 3 (Install & Launch): DEFERRED (device disconnected).** `adb devices -l` was probed and confirmed the physical Samsung Galaxy Z Flip 7 (`SM-F766B`, `b7s`, Android 16) is currently disconnected from host USB (`raw/10-adb-devices.txt`, `raw/11-adb-install-attempt.txt`). Per task contract §6, the debug APK build was completed, APK artifacts verified, raw build and gradle logs captured, and the exact physical reconnection prerequisite and verification commands are documented below.

## Pinned & Executed Versions (Criterion 4)

| Component | Exact Version (Executed Output) | Source / File |
|---|---|---|
| Application ID | `dev.orbitkit.app` | `src-tauri/gen/android/app/build.gradle.kts` (C1 contract) |
| Version Code | `1000` | `aapt dump badging` |
| Version Name | `0.1.0` | `src-tauri/tauri.conf.json` |
| Gradle | `8.14.3` | `src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties` (`raw/gradle-version.txt`) |
| AGP (Android Gradle Plugin) | `8.11.0` | `src-tauri/gen/android/build.gradle.kts` |
| Kotlin (buildscript) | `1.9.25` | `src-tauri/gen/android/build.gradle.kts` |
| Kotlin (compiler runtime) | `2.0.21` | `gradle --version` |
| Android NDK | `27.3.13750724` (`r27d`) | Installed via sdkmanager `ndk;27.3.13750724` (`raw/01-ndk-verify.txt`, `raw/ndk-version.txt`) |
| Compile SDK | `36` (Android 16) | `src-tauri/gen/android/app/build.gradle.kts` |
| Target SDK | `36` (Android 16) | `src-tauri/gen/android/app/build.gradle.kts` |
| Min SDK | `24` (Android 7.0) | `src-tauri/gen/android/app/build.gradle.kts` |
| Build-Tools | `35.0.0` | Auto-installed by sdkmanager/AGP at `/home/megastruktur/Android/Sdk/build-tools/35.0.0` |
| JDK | `17.0.20.1+1` (Temurin) | `evidence/env-probe/env.sh` (`JAVA_HOME`) |
| Rust toolchain | `rustc 1.98.0`, `cargo 1.98.0` | Host toolchain |
| Rust targets installed | `aarch64-linux-android`, `armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android` | `rustup target list --installed` |
| Tauri Core / Build | `tauri =2.11.6`, `tauri-build =2.6.3` | `src-tauri/Cargo.toml` |
| Tauri CLI / API | `@tauri-apps/cli 2.11.5`, `@tauri-apps/api 2.11.1` | `package.json` |
| Frontend | Svelte `5.57.1`, Vite `8.3.0`, TypeScript `7.0.2` | `package.json` |
| Device Target (C5) | Samsung Galaxy Z Flip 7 (`SM-F766B` / `b7s`), Android 16 (SDK 36), Build `BP2A.250605.031.A3.F766BXXS2AYGD` | Probed in T01 `evidence/env-probe/raw/device.txt` |

## C1 & C5 Contract Compliance

1. **Application Identifier:** `dev.orbitkit.app` strictly preserved across `src-tauri/tauri.conf.json`, `src-tauri/gen/android/app/build.gradle.kts`, `AndroidManifest.xml`, and the final packaged APK badging.
2. **Generated Project Structure:** `src-tauri/gen/android/` generated and committed with 40 tracked files (Gradle build scripts, wrapper, Kotlin MainActivity, Android resources).
3. **Debug Signing:** Debug keystore used via Tauri default debug configuration. No release keystores generated or committed.
4. **Scope Allowlist:** Only `src-tauri/gen/android/**`, `BRIEF.md`, and `evidence/scaffold-android/**` touched/committed. No out-of-scope files modified.

## Runtime Testing per Scenario

| # | Scenario | Command | Result | Raw Output |
|---|---|---|---|---|
| 1 | Android init | `pnpm tauri android init --ci` with `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME` | EXIT=0; Android Studio project generated under `src-tauri/gen/android/` with package `dev.orbitkit.app` | `raw/02-tauri-android-init.txt` |
| 2a | Debug build (aarch64) | `pnpm tauri android build --debug --apk --target aarch64` | EXIT=0; Built in 55.5s; APK generated at `gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk` | `raw/03-tauri-android-build.txt` |
| 2b | Debug build (all targets universal) | `pnpm tauri android build --debug --apk` | EXIT=0; Built in 40.2s; universal APK contains all 4 ABIs (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`) | `raw/06-tauri-android-build-all.txt`, `raw/07-apk-native-code.txt` |
| 2c | Debug build (split per ABI) | `pnpm tauri android build --debug --apk --split-per-abi` | EXIT=0; Built in 14.5s; produced `app-arm64-debug.apk` (127M), `app-arm-debug.apk` (114M), `app-x86-debug.apk` (118M), `app-x86_64-debug.apk` (127M) | `raw/08-tauri-android-build-split.txt`, `raw/13-apk-list.txt` |
| 2d | APK verification | `aapt dump badging <apk>` + Python zip verification | EXIT=0; Package `dev.orbitkit.app`, version `0.1.0` (1000), targetSdk `36`, Activity `dev.orbitkit.app.MainActivity`, native lib `liborbitkit_lib.so` + `assets/tauri.conf.json` present | `raw/04-apk-badging.txt`, `raw/09-arm64-apk-badging.txt` |
| 3 | Install & launch | `adb devices -l`; `adb install -r <apk>` | Device disconnected; `adb devices -l` returns empty; `adb install` returns `adb: no devices/emulators found`. Reconnection prerequisite recorded below. | `raw/10-adb-devices.txt`, `raw/11-adb-install-attempt.txt` |
| — | Frontend typecheck | `pnpm exec tsc --noEmit` | EXIT=0; "TypeScript: No errors found" | Executed clean |
| — | Native compile check | `cargo check` in `src-tauri` | EXIT=0; dev profile in 0.36s | Executed clean |

## Device Connection Prerequisite & Verification Procedure

In task T01 (`okf-env-probe`), the physical device was attached and authorized:
- Serial: `R5CY70FPFSM`
- Connection: `usb:3-1`
- Model: `SM-F766B` (Samsung Galaxy Z Flip 7, codename `b7s`)
- OS: Android 16 (SDK 36), Build `BP2A.250605.031.A3.F766BXXS2AYGD`

During T03 execution, the device was disconnected (`lsusb` shows no USB nodes; `adb devices -l` shows no attached devices).
When the Galaxy Z Flip 7 is reconnected via USB, the coordinator or subsequent agent runs the following exact commands to complete the on-device launch smoke:

```bash
# 1. Source environment
source evidence/env-probe/env.sh

# 2. Confirm device is visible and authorized
adb devices -l
# Expected: R5CY70FPFSM    device usb:... product:b7sxxx model:SM_F766B device:b7s

# 3. Sideload the arm64 debug APK (or universal APK)
adb install -r src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk

# 4. Launch the app on device
adb shell monkey -p dev.orbitkit.app -c android.intent.category.LAUNCHER 1
# Or: adb shell am start -n dev.orbitkit.app/.MainActivity

# 5. Capture logcat launch evidence
adb logcat -d -s ActivityTaskManager:I dev.orbitkit.app:*

# 6. Capture on-device screenshot showing the rendered window
adb exec-out screencap -p > evidence/scaffold-android/device-window.png
```

## Out-of-Scope Findings & Technical Insights

1. **Root `.gitignore` and `src-tauri/gen/`:** In T02 (`okf-scaffold-desktop`), `src-tauri/gen/` was added to `.gitignore` to ignore the desktop schema. In T03, the scope allowlist explicitly excludes `.gitignore` while requiring `src-tauri/gen/android/**` to be committed. Staging the generated Android project files with `git add -f` forces git to track them permanently without modifying `.gitignore`, preserving exact scope boundaries. Subsequent edits to tracked files in `src-tauri/gen/android/` are tracked natively by git.
2. **Tauri v2 Android IPC Architecture:** Direct invocation of `./gradlew assembleArm64Debug` fails with `failed to build WebSocket client ... Connection refused` because Tauri's Gradle plugin (`BuildTask.kt`) runs `pnpm tauri android android-studio-script`, which expects a local IPC WebSocket server initiated by `pnpm tauri android build` or `dev`. Builds must be invoked via `pnpm tauri android build ...`.
3. **NDK Version Decision:** Installed `ndk;27.3.13750724` (`r27d`, latest stable 27.x available in `sdkmanager --list`). Tauri CLI auto-detected it at `/home/megastruktur/Android/Sdk/ndk/27.3.13750724`.
4. **Android SDK Build-Tools 35:** AGP 8.11.0 automatically prompted for and installed `build-tools;35.0.0` during the first build pass, resolving `aapt2` and packaging tools.

## Evidence Index (`evidence/scaffold-android/raw/`, Committed)

| File | Content |
|---|---|
| `01-ndk-install.txt` | NDK installation run output |
| `01-ndk-verify.txt` | `sdkmanager --list_installed` showing `ndk;27.3.13750724` |
| `02-tauri-android-init.txt` | `pnpm tauri android init --ci` project generation output |
| `03-tauri-android-build.txt` | Initial `pnpm tauri android build --debug --apk --target aarch64` output |
| `04-apk-badging.txt` | `aapt dump badging` of the initial debug APK |
| `05-gradlew-assemble.txt` | Direct `./gradlew assembleArm64Debug` run showing Tauri WebSocket IPC requirement |
| `06-tauri-android-build-all.txt` | `pnpm tauri android build --debug --apk` full 4-ABI universal compilation log |
| `07-apk-native-code.txt` | `aapt dump badging` excerpt showing native-code for all 4 ABIs |
| `08-tauri-android-build-split.txt` | `pnpm tauri android build --debug --apk --split-per-abi` compilation log |
| `09-arm64-apk-badging.txt` | `aapt dump badging` for `app-arm64-debug.apk` |
| `10-adb-devices.txt` | `adb devices -l` probe showing device disconnected |
| `11-adb-install-attempt.txt` | `adb install -r` attempt capturing "no devices/emulators found" |
| `12-rebuild-universal.txt` | Rebuild log of universal APK from clean state |
| `13-apk-list.txt` | Output of `ls -lh` for all 5 generated APK artifacts |
| `gradle-version.txt` | `./gradlew --version` output showing Gradle 8.14.3 and JDK 17 |
| `ndk-version.txt` | Content of NDK `source.properties` confirming 27.3.13750724 (r27d) |
| `versions-summary.txt` | Comprehensive inventory of all toolchain, SDK, and build versions |

## Ready Handoff

**Ready.** The Android project skeleton is initialized and committed per C1, NDK 27.3.13750724 is installed and verified, debug APKs for both universal and Z Flip 7 arm64 targets are compiled and validated, all raw logs and reports are committed, and the working tree is clean. Ready for independent review and downstream tasks (T04 overlay / Kotlin plugin).
