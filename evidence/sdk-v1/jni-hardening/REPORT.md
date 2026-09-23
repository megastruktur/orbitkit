# Task Report: `oks_jni-hardening` (Remediation R-T09-1)

## Executive Summary

This report documents the implementation and verification of remediation R-T09-1 for `tauri-plugin-orbitkit` (`crates/tauri-plugin-orbitkit/src/jni_bridge.rs`) resolving all findings identified in the T09 gate review:

1. **F-A1 MINOR (Panic Unwind Protection Across JNI FFI):**
   - Wrapped `extern "system"` JNI exports (`Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction`, `Java_dev_orbitkit_native_OrbitkitJniBridge_00024Companion_onNativeAction`, `Java_dev_orbitkit_native_OrbitkitJniBridge_getActionCount`, `Java_dev_orbitkit_native_OrbitkitJniBridge_getActionLogJson`) in `std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| ...))`.
   - Extracted the core dispatch logic into host-testable `pub fn guarded<F: FnOnce() -> String>(f: F) -> String`.
   - On panic, logs the panic details via `log_android_info("OrbitkitJni", ...)` and returns the established JNI error JSON shape matching `OrbitkitJniBridge.kt:86`: `{"status":"ERROR","error":msg}`. Extraneous invoke fields (`code`/`message`) were dropped to preserve the native status convention without inventing hybrid shapes.
   - Added host unit tests:
     - `test_guarded_handles_handler_panic_without_abort`: proves a panicking `register_menu_action_handler` user callback does not abort the process across FFI and returns `{"status":"ERROR","error":...}`.
     - `test_guarded_handles_emitter_panic_without_abort`: proves a panicking event emitter does not abort the process and returns `{"status":"ERROR","error":...}`.

2. **F-A2 NIT (Lock-Free Emitter Invocation & Reentrancy Safety):**
   - Changed `EVENT_EMITTER` callback storage to `Arc<dyn Fn(&str, &serde_json::Value) + Send + Sync + 'static>`.
   - In `emit_overlay_menu_action`, the registered emitter `Arc` is cloned out of `EVENT_EMITTER` while locked, and the lock is dropped before invoking the callback (mirroring `notify_menu_action`).
   - Added unit test `test_event_emitter_reentrancy_no_deadlock` proving that an emitter calling `clear_event_emitter()` inside itself completes without deadlocking.

3. **F-A3 NIT (Poison-Free Test Mutex Locks & Handler Cleanup):**
   - Updated all tests acquiring `TEST_MUTEX` from `.lock().unwrap()` to `.lock().unwrap_or_else(|e| e.into_inner())` to prevent poison cascade across tests.
   - Added `pub fn clear_menu_action_handlers()` to mirror `clear_event_emitter()` and `clear_jni_action_log()`, ensuring strict per-test state isolation.

---

## Scope Allowlist Verification

- **Allowed Paths:** `crates/tauri-plugin-orbitkit/src/jni_bridge.rs` and `evidence/sdk-v1/jni-hardening/**`.
- **Observed Diff:** Only `crates/tauri-plugin-orbitkit/src/jni_bridge.rs` and evidence artifacts modified/created.
- **Contract & API Invariants:**
  - Happy path behavior and payload format are unchanged.
  - JNI export symbols unchanged:
    - `Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction`
    - `Java_dev_orbitkit_native_OrbitkitJniBridge_00024Companion_onNativeAction`
    - `Java_dev_orbitkit_native_OrbitkitJniBridge_getActionCount`
    - `Java_dev_orbitkit_native_OrbitkitJniBridge_getActionLogJson`

---

## Acceptance Criteria Verification Matrix

| # | Scenario | Command | Expected | Observed | Exit Code | Raw Log |
|---|---|---|---|---|---|---|
| 1 | Container Cargo Test | `docker run --rm -u 1000 -e HOME=/tmp -v $PWD:$PWD -v orbitkit-cargo-cache:/usr/local/cargo/registry -w $PWD orbitkit-linux-desktop:1 cargo test -p tauri-plugin-orbitkit` | All green (14 unit + 12 integration tests) | 26 passed, 0 failed (all 3 new tests pass) | 0 | `evidence/sdk-v1/jni-hardening/raw/01-docker-cargo-test.txt` |
| 2 | Mutation Testing (Scratch Copy) | Extract via `git archive HEAD \| tar -x -C <scratch>`, remove `catch_unwind` from `guarded`, run container cargo test | Panic tests fail with simulated panics | 11 passed, 3 failed (`test_guarded_handles_handler_panic_without_abort`, `test_guarded_handles_emitter_panic_without_abort`, etc.) | 101 | `evidence/sdk-v1/jni-hardening/raw/02-mutation-test-failure.txt` |
| 3a | Android Rust Target Check | `cargo check -p tauri-plugin-orbitkit --target aarch64-linux-android` | Compilation success | Checked cleanly in 0.62s | 0 | `evidence/sdk-v1/jni-hardening/raw/03-cargo-check-android.txt` |
| 3b | Host Clippy Strict Gate | `cargo clippy -p tauri-plugin-orbitkit --all-targets -- -D warnings` | Zero warnings | Checked cleanly in 0.51s | 0 | `evidence/sdk-v1/jni-hardening/raw/04-cargo-clippy-host.txt` |
| 4a | Starter Android APK Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | APK build successful | Built APK at `examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk` | 0 | `evidence/sdk-v1/jni-hardening/raw/05-starter-tauri-android-build.txt` |
| 4b | JNI Native Symbol Export Verification | `$LLVM_NM -D target/aarch64-linux-android/debug/liborbitkit_lib.so \| grep Java_dev_orbitkit_native_OrbitkitJniBridge` | All JNI symbols present | Exported all 4 symbols (`onNativeAction`, `00024Companion_onNativeAction`, `getActionCount`, `getActionLogJson`) | 0 | `evidence/sdk-v1/jni-hardening/raw/06-llvm-nm-export-symbols.txt` |

---

## Contract Questions & Out-of-Scope Findings

1. **Referenced Verdict File `oks_reviews/T09-gate2.verdict.md`:**
   - The file `oks_reviews/T09-gate2.verdict.md` mentioned in `BRIEF.md` does not exist on disk in the worktree or repository root.
   - All findings (F-A1, F-A2, F-A3) were fully embedded in `BRIEF.md` with explicit line references and requirements, allowing complete and unblocked execution.

---

READY FOR REVIEW at e15781cd07b3a81dd328c421d256818abfdc4ff6
