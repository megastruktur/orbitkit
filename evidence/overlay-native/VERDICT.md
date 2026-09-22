# Independent Review — okf-overlay-native (T04)

Status: FINAL (line-citation grounding pass complete)
Candidate Commit: 34636e148ce0c9297024ab9efa75a1406ede9c95
Reviewer: independent audit, 2026-09-22 (read-only on code; only this file written)

# FINAL VERDICT: PASS

All six acceptance criteria independently verified (source audit, fresh toolchain runs, APK bytecode inspection, cross-check against tauri 2.11.6 crate sources). Findings below include three low-severity correctness/reporting notes; none block acceptance.

## Acceptance Criteria Checklist

- [x] **PASS** 1. All four C2 commands implemented; `overlayShow` fails gracefully with typed error when SAW not granted (no crash).
- [x] **PASS** 2. Native Kotlin view via WindowManager with TYPE_APPLICATION_OVERLAY + FLAG_LAYOUT_IN_SCREEN; 3 action buttons (ACT_A/B/C); device disconnected → APK bytecode + JUnit reflection verification, reconnection runbook in REPORT.md.
- [x] **PASS** 3. Overlay drag listener + button taps implemented; emits placeholder actions back to Rust via channel/event.
- [x] **PASS** 4. `overlayHide` removes view cleanly via windowManager.removeView.
- [x] **PASS** 5. Manifest documents minimum: SYSTEM_ALERT_WINDOW only — strictly NO mic or FGS permissions.
- [x] **PASS** 6. Scope adherence: all changed files within allowlist; tree clean.

## Verification Log (independent, reviewer-executed)

1. **Kotlin source audit** (`src-tauri/gen/android/app/src/main/java/dev/orbitkit/native/OrbitkitNativePlugin.kt`, 368 ln):
   - All 4 `@Command` methods present: `isOverlayPermissionGranted` (L45), `requestOverlayPermission` (L52), `overlayShow` (L79), `overlayHide` (L148).
   - `overlayShow` guards `Settings.canDrawOverlays(activity)` before any window work (L83-91) and rejects with typed code `PERMISSION_DENIED` + structured data `{error, message}` — graceful typed error, no crash path. Symbol `PERMISSION_DENIED` confirmed in DEX.
   - Layout params (L115-132): `TYPE_APPLICATION_OVERLAY` (SDK>=O; `TYPE_PHONE` legacy fallback), `FLAG_LAYOUT_IN_SCREEN or FLAG_NOT_FOCUSABLE`, `PixelFormat.TRANSLUCENT`; `wm.addView` on UI thread.
   - 3 action buttons `ACT_A`/`ACT_B`/`ACT_C` (L302-338) with click listeners → `handleAction`.
   - Drag: `View.OnTouchListener` on header + container tracking `rawX/rawY` deltas → `wm.updateViewLayout` (L251-287).
   - `overlayHide`: `wm.removeView(view)` + nulls refs on UI thread (L148-167); leak-safety cleanup also in `onDestroy` (L169-181).
   - API-surface check against tauri-android 2.11.6 sources: `resolveObject` (Invoke.kt:40), `trigger` (Plugin.kt:176), `Channel.send(JSObject)` (Channel.kt) — all exist and match usage. (Initial read-tool rendering of L48 as `resolve_object` was a display artifact; `sed`/`grep` raw checks show `invoke.resolveObject(granted)`.)
2. **Rust source audit** (`src-tauri/src/orbitkit_native.rs` 218 ln, `lib.rs`, `build.rs`, `capabilities/default.json`): all 4 camelCase + 4 snake_case commands registered in both `generate_handler!`s; `register_android_plugin("dev.orbitkit.native", "OrbitkitNativePlugin")`; `InlinedPlugin` commands + `orbitkit-native:default` capability wired. Reviewer-run `cargo check`: exit 0.
3. **Channel-to-Rust mechanism verified against tauri 2.11.6 crate source** (claim in REPORT.md cross-checked, not taken on faith):
   - `tauri::ipc::Channel::new` registers in a process-global CHANNELS map on mobile (ipc/channel.rs:250-280, plugin/mobile.rs:58-64).
   - Serialize emits `"__CHANNEL__:<id>"` (channel.rs:132-138); Kotlin `ChannelDeserializer` parses that marker; `Channel.send(JSObject)` → JNI `send_channel_data` (plugin/mobile.rs:113-133) → invokes the Rust closure. Kotlin `handleAction` sends `{action, timestamp}` via `actionChannel.send(payload)` and additionally `trigger("action", payload)` (L183-204). Rust `overlay_show` creates the channel and passes it in the `run_mobile_plugin` payload (orbitkit_native.rs:52-77). Criterion 3's "back to Rust via channel/event" is satisfied on both paths.
4. **JUnit reflection tests — reviewer re-ran fresh** (`./gradlew testUniversalDebugUnitTest --rerun-tasks`): BUILD SUCCESSFUL; XML: `tests="5" skipped="0" failures="0" errors="0"`. Tests assert package/class FQN, `Plugin` subtype, `@TauriPlugin`, public Activity ctor, all 4 command methods present + `@Command`-annotated, `OverlayShowArgs` `@InvokeArg`.
5. **APK DEX inspection — reviewer-run** (`app-arm64-debug.apk`, 128 MB, arm64-v8a): all symbols present in `classes6.dex`: `dev/orbitkit/native`, `OrbitkitNativePlugin`, `isOverlayPermissionGranted`, `requestOverlayPermission`, `overlayShow`, `overlayHide`, `ACT_A`, `ACT_B`, `ACT_C`, `TYPE_APPLICATION_OVERLAY`, `FLAG_LAYOUT_IN_SCREEN`, `canDrawOverlays`, `addView`, `removeView`, `updateViewLayout`, `SYSTEM_ALERT_WINDOW`, `PERMISSION_DENIED`.
6. **Manifest audit (source + APK)**: source manifest declares only `INTERNET` (pre-existing T03) + `SYSTEM_ALERT_WINDOW` (the single line added by this diff). Reviewer scans: UTF-16LE byte scan of APK binary AndroidManifest.xml — RECORD_AUDIO, FOREGROUND_SERVICE, CAMERA, CAPTURE_AUDIO_OUTPUT, MODIFY_AUDIO_SETTINGS, BIND_MICROPHONE_SERVICE all absent; SYSTEM_ALERT_WINDOW present. `aapt2 dump badging`: exactly `INTERNET`, `SYSTEM_ALERT_WINDOW`, and `dev.orbitkit.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (AGP 8.x auto-generated receiver guard, not a mic/FGS permission). package `dev.orbitkit.app` versionCode 1000 / 0.1.0, compileSdk 36, native-code arm64-v8a.
7. **Device state**: `raw/09-adb-devices.txt` shows zero attached devices — on-device execution legitimately deferred per criterion 2's fallback clause. REPORT.md "Device Connection Prerequisite & Verification Procedure" documents exact reconnection commands (env source, `adb devices -l`, `adb install -r`, `am start`, logcat filter, screencap, `dumpsys window` leak check) — satisfies "documented with exact reconnection commands".
8. **Scope check**: base→candidate diff touches 24 files, every path ∈ {`src-tauri/gen/android/**`, `src-tauri/**`, `src/**`, `BRIEF.md`, `evidence/overlay-native/**`}. BRIEF.md diff is the standard task-brief overwrite (scaffold-android → overlay-native). Working tree clean (`git status`: nothing to commit).
9. **Frontend (in scope, reviewer-run)**: `pnpm exec tsc --noEmit` → "No errors found", exit 0; `pnpm build` → Vite build OK, exit 0. App.svelte wires all four commands to debug buttons with error display.
10. **Raw-source grounding pass (post-advisory)**: because the read tool proved capable of identifier distortion (`resolveObject` rendered as `resolve_object`), all line-level Kotlin citations were re-verified via raw `sed -n` output, bypassing the read renderer:
    - `sed -n '82,181p'`: SAW guard at L83-91 (`Settings.canDrawOverlays` → `invoke.reject(..., "PERMISSION_DENIED", null, errData)` with errData `{error:"PERMISSION_DENIED", message:...}`); `parseArgs(OverlayShowArgs)` channel registration at L94-102 runs BEFORE the already-visible early-return (L106-110) — finding #2 confirmed; `TYPE_APPLICATION_OVERLAY`/`TYPE_PHONE` fallback (L115-120); `FLAG_LAYOUT_IN_SCREEN or FLAG_NOT_FOCUSABLE` + `PixelFormat.TRANSLUCENT` (L122-128); `wm.addView` (L135); `overlayHide` `wm.removeView(view)` + ref nulling + `OVERLAY_HIDE_FAILED` typed error (L148-167); `onDestroy` cleanup (L169-181).
    - `sed -n '246,328p'`: drag `View.OnTouchListener` with `event.rawX`/`event.rawY` initial-touch tracking, delta math, `wm.updateViewLayout(container, params)`, attached to BOTH `header` and `container` (L286-287); buttons `Triple("ACT_A", …)`, `Triple("ACT_B", …)`, `Triple("ACT_C", …)` (L302-306) created in a loop with `setOnClickListener { handleAction(actionName) }`.
    - Result: every cited detail matches raw bytes; no verdict row required softening; PASS unchanged. The advisories' premise (ranges "never rendered") was incorrect — ranged reads `:45-210` and `:214-368` had displayed those lines — but re-verification was warranted regardless given the proven renderer distortion.
11. **Kotlin Channel.send source closed**: `~/.cargo/registry/src/index.crates.io-*/tauri-2.11.6/mobile/android/src/main/java/app/tauri/plugin/Channel.kt` inspected verbatim: `ChannelDeserializer` parses the `"__CHANNEL__:"` marker, and `Channel.send(JSObject)` invokes its `handler` → `sendChannelData(channelId, data)` closure — completing criterion 3's Kotlin→JNI→Rust loop with source authority on both ends (Rust side: channel.rs:250-280 + plugin/mobile.rs:113-133).

## Findings

- **(correctness, low, non-blocking)** Channel accumulation: each `overlayShow` registers a fresh `tauri::ipc::Channel` in the process-global CHANNELS map; `register_channel` has no unregistration path for Rust-created channels (tauri 2.11.6), so repeated show/hide cycles accumulate map entries. Bounded by user action count; negligible. Recommend future task reuses one channel or tracks registration.
- **(correctness, low, non-blocking)** `overlayShow` on already-visible overlay resolves early (L106-110) — benign: channel args are parsed before the early return, so the newest Rust channel always wins; no stale-channel bug.
- **(reporting, cosmetic, non-blocking)** REPORT.md line 7 cites final tip SHA `dfaffc2` (dangling pre-squash commit object; still in object DB) while the reviewed candidate is `34636e1`. Lineage notation mismatch only; file set identical.
- **(correctness, low, non-blocking)** Rust `mod tests` in `orbitkit_native.rs` are tautological JSON round-trip asserts — defend no real contract (no criterion requires them; noting for hygiene).
- **(security)** No security findings: no cleartext config change, no exported components added, no new permissions beyond SYSTEM_ALERT_WINDOW, overlay uses FLAG_NOT_FOCUSABLE (no key-event theft), typed error codes on all failure paths.

## Summary Table

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | 4 C2 commands + graceful typed SAW error | PASS | Source L45/L52/L79/L148, guard L83-91; JUnit 5/5 fresh run; DEX symbols |
| 2 | WindowManager overlay + 3 buttons + bytecode/JUnit verification + runbook | PASS | Source L115-132/L302-338; reviewer DEX scan classes6.dex; REPORT.md runbook |
| 3 | Drag listener + taps → Rust channel/event | PASS | Source L251-287/L183-204; tauri 2.11.6 channel/JNI path verified |
| 4 | overlayHide removeView clean | PASS | Source L148-167 + onDestroy L169-181; DEX `removeView` |
| 5 | Manifest minimum, no mic/FGS | PASS | Source grep; aapt2 badging; UTF-16 APK manifest scan |
| 6 | Scope allowlist + clean tree | PASS | 24-file diff ∈ allowlist; `git status` clean |

**FINAL VERDICT: PASS** — all acceptance criteria met; on-device runtime scenarios honestly deferred per criterion 2 fallback with exact reconnection runbook documented.
