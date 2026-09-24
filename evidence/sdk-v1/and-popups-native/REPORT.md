# Task Report: `oks-and-popups-native` (Card P4a)

## Executive Summary

This report documents the implementation and verification of card P4a (`and-popups-native`): native Android and Rust implementation for `open_popup` and `close_popup` lifecycle handling, enabling in-app popups rendered as sheets by the main webview (card P4b).

### Key Deliverables & Changes

1. **Shared Popup Lookup & Event Payload Builder (Rust):**
   - Moved `lookup_popup` from `crates/tauri-plugin-orbitkit/src/desktop.rs` into shared `crates/tauri-plugin-orbitkit/src/lib.rs`, keeping identical desktop behavior and returning `ErrorCode::NotFound` for unknown popup IDs.
   - Implemented pure function `popup_open_payload(popup: &PopupConfig) -> serde_json::Value` in `lib.rs` constructing the exact contract payload `{ "id": string, "title": string, "url": string, "width": number, "height": number }`.
   - Added host-compilable unit tests in `lib.rs` (`test_popup_open_payload_builder` and `test_lookup_popup_found_and_not_found`), asserting payload structure and not_found behavior.

2. **Android Popup Lifecycle & Plugin FFI (Rust `mobile.rs`):**
   - Implemented `open_popup(id: String) -> Result<()>`:
     1. Looks up popup configuration in `self.config.windows.popups` via `lookup_popup`; returns `not_found` error if unknown.
     2. Calls native Android `@Command fun bringToFront` via `self.run_mobile_plugin::<()>("bringToFront", ())`.
     3. Emits `orbitkit://popup-open` with `payload` to the app webview.
     4. Returns `Ok(())`.
   - Implemented `close_popup(id: String) -> Result<()>`:
     1. Emits `orbitkit://popup-close` with payload `{"id": id}` to the app webview.
     2. Does not move the app to background; returns `Ok(())`.
   - Maintained desktop isolation: desktop continues managing native `WebviewWindow`s and emits no popup events.

3. **Native Activity Foregrounding & Overlay Collapse (Kotlin `OrbitkitNativePlugin.kt`):**
   - Implemented `@Command fun bringToFront(invoke: Invoke)`:
     - Constructs `Intent(activity, activity.javaClass)` with flags `FLAG_ACTIVITY_REORDER_TO_FRONT or FLAG_ACTIVITY_NEW_TASK or FLAG_ACTIVITY_SINGLE_TOP` and invokes `activity.startActivity(intent)` on the UI thread.
     - Reuses the existing instant collapse pathway (`collapseMenu(animate = false)`) leaving the overlay window `INVISIBLE` and `FLAG_NOT_TOUCHABLE`.
     - Defensive fallback ensures menu container layout is hidden and touchable flags cleared even if animators were not initialized.
     - Resolves without throwing; rejects with error code on failure.

4. **Background-Activity-Start Restrictions (Android):**
   - The OrbitKit application holds `android.permission.SYSTEM_ALERT_WINDOW` with an active floating overlay. Under Android background-activity-start restrictions, having a visible overlay view attached via `WindowManager` (`TYPE_APPLICATION_OVERLAY`) provides the necessary exemption to start/bring the activity to the foreground.
   - On-device verification from another application will be validated by the coordinator.

5. **Contract & Documentation Alignment:**
   - Updated `docs/architecture/contracts.md` K4 table rows for `open_popup` and `close_popup`, documenting Android sheet event dispatches.
   - Documented `orbitkit://popup-open` and `orbitkit://popup-close` events in K4/K5.
   - Added entries to `CHANGELOG.md` under `[Unreleased]`.

---

## Scope Allowlist Verification

- **Allowed Paths:**
  - `crates/tauri-plugin-orbitkit/src/{mobile.rs,desktop.rs,lib.rs}`
  - `crates/tauri-plugin-orbitkit/android/src/main/java/dev/orbitkit/native/OrbitkitNativePlugin.kt`
  - `docs/architecture/contracts.md`
  - `CHANGELOG.md`
  - `evidence/sdk-v1/and-popups-native/**`
- **Observed Changes:** Exactly the allowed paths were modified or added; `BRIEF.md` remains untracked and uncommitted.

---

## Acceptance Criteria Verification Matrix

| # | Scenario | Command | Expected | Observed | Exit Code | Raw Log |
|---|---|---|---|---|---|---|
| 1 | Container Cargo Test | `docker run --rm -u 1000 -e HOME=/tmp -e RUSTUP_HOME=/tmp/rustup -v "$PWD:$PWD" -v orbitkit-cargo-cache:/usr/local/cargo/registry -w "$PWD" orbitkit-linux-desktop:1 sh -c 'cp -r /usr/local/rustup /tmp/rustup 2>/dev/null; cargo test -p tauri-plugin-orbitkit'` | All tests pass (unit + integration) | 21 unit tests + 12 integration tests pass (33 passed, 0 failed, including new payload and lookup tests) | 0 | `evidence/sdk-v1/and-popups-native/raw/01-docker-cargo-test.txt` |
| 2 | Container Cargo Clippy | `docker run --rm -u 1000 -e HOME=/tmp -e RUSTUP_HOME=/tmp/rustup -v "$PWD:$PWD" -v orbitkit-cargo-cache:/usr/local/cargo/registry -w "$PWD" orbitkit-linux-desktop:1 sh -c 'cp -r /usr/local/rustup /tmp/rustup 2>/dev/null; rustup component add clippy >/dev/null 2>&1; cargo clippy -p tauri-plugin-orbitkit -p tauri-plugin-orbitkit-recorder --all-targets -- -D warnings'` | Clean clippy with 0 warnings | Clean check in 3.01s, 0 warnings | 0 | `evidence/sdk-v1/and-popups-native/raw/02-docker-cargo-clippy.txt` |
| 3 | Starter Android APK Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | Successful aarch64 APK build | Finished 1 APK at `examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk` | 0 | `evidence/sdk-v1/and-popups-native/raw/03-starter-android-build.txt` |
| 4 | Gradle Unit Tests | `cd examples/starter/src-tauri/gen/android && ./gradlew test` | All Gradle test tasks pass across modules | BUILD SUCCESSFUL (all app and tauri-plugin-orbitkit unit tests pass) | 0 | `evidence/sdk-v1/and-popups-native/raw/04-gradlew-test.txt` |
| 5 | Host Cargo Check Tests | `cargo check -p tauri-plugin-orbitkit --tests` | Host compilation of tests succeeds | Finished dev profile cleanly on host | 0 | `evidence/sdk-v1/and-popups-native/raw/05-cargo-check-host.txt` |

---

## Out-of-Scope Findings

None. All changes remained strictly within native Android, Rust plugin, contracts, changelog, and evidence.

---

READY FOR REVIEW at 449df5800f07f1a34ead113092aa7fbc85c5446c
