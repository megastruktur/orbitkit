# VERDICT — okf-mic-fgs-gates (T05)

Status: PASS
Candidate Commit: c7122e6eb87da4f935546c8a26aad2a3efaa3c5d
Base Commit: 9d98f1b9d2eef9d3392c25d349d9a05a9ebb73b3
Reviewer: independent (read-only audit on code & repo; only this file written)

## Final verdict: **PASS**

All six acceptance criteria verified — by source inspection, by re-executing
build/test commands independently, and by re-scanning built artifacts
(bytecode/DEX/ELF). Physical on-device scenarios (S1/S2/S3/S3b) are honestly
deferred: reviewer re-probed `adb devices -l` during audit — 0 devices attached,
matching the declared disconnected-device condition in
`evidence/mic-fgs-gates/raw/13-adb-devices.txt`.

## Acceptance criteria checklist

- [x] 1. Feature gate `mic-recorder` — VERIFIED (independently re-run).

- [x] 2. Kotlin foreground service — VERIFIED (source + compiled manifest/DEX).
- [x] 3. C2 contract commands + typed PERMISSION_DENIED — VERIFIED.
- [x] 4. Scenario matrix S1/S2/S3/S3b code-complete, bytecode+JUnit verified, runbooks with exact observables; physical run deferred per declared device disconnection (re-confirmed by reviewer).
- [x] 5. Manifest permissions strictly scoped — VERIFIED (diff-precise).
- [x] 6. Scope adherence + clean tree — VERIFIED.

## Per-criterion evidence

### 1. Feature gate (acceptance)
- `src-tauri/Cargo.toml:11-13` — `[features] default = []`, `mic-recorder = []`.
- `src-tauri/src/lib.rs:11-49` — `#[cfg(feature = "mic-recorder")]` invoke_handler registers all 10 recorder command fns (+ aliases); `#[cfg(not(...))]` registers only the 8 overlay commands.
- `src-tauri/src/orbitkit_native.rs` — every recorder command, `RecorderStateResponse`, and impl method under `#[cfg(feature = "mic-recorder")]`.
- `src-tauri/build.rs:1-43` — `ALL_COMMANDS` (incl. recorder) vs `BASE_COMMANDS` selected via `CARGO_FEATURE_MIC_RECORDER` for the inlined plugin permission manifest.
- **Independent re-run:** `cargo check --manifest-path src-tauri/Cargo.toml` → EXIT 0; `... --features mic-recorder` → EXIT 0.
- **Binary proof (agent evidence, plausible & consistent):** `raw/12-so-feature-comparison.txt` — without feature: `liborbitkit_lib.so` 126,647,776 B, `recorderStartForeground`/`recorderState` absent, `overlayShow` present; with feature: 127,328,064 B, all present. Reviewer re-scanned current on-disk APK `app-arm64-debug.apk` (with-feature build): `.so` size exactly 127,328,064 B, `recorderStartForeground`, `recorder_start_foreground`, `recorderState` all present. Build logs `raw/06` (no flag) / `raw/07` (`--features mic-recorder`) both EXIT=0 with explicit command lines.

### 2. Kotlin foreground service (acceptance)
- `OrbitkitRecorderService.kt` — `class OrbitkitRecorderService : Service()`; `onCreate` (L134-138) creates channel `orbitkit_recorder` (L36, IMPORTANCE_LOW L72). `handleStartForeground` (L168-294):
  - L177-184: service-side re-check `checkSelfPermission(RECORD_AUDIO)` → `lastError` + `stopSelf()` on denial.
  - L189-194: `startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)` gated on `UPSIDE_DOWN_CAKE` (API 34+); `NOTIFICATION_ID = 2001` (L38). Two-arg fallback below API 34 (L196); manifest-declared type applies on 29-33.
  - L223-241: `AudioRecord(MIC, 16000 Hz L47, CHANNEL_IN_MONO L48, ENCODING_PCM_16BIT L49)` with init-state check; L248-282 `OrbitkitAudioSpooler` thread writes raw PCM to `filesDir/recorder_spool.pcm` (L61-63), `bytesRecorded` AtomicLong (L267).
- Manifest (source): `<service android:name="dev.orbitkit.native.OrbitkitRecorderService" android:exported="false" android:foregroundServiceType="microphone" />`. Compiled APK xmltree (`raw/10`, candidate-captured): `foregroundServiceType ... 0x80` (= 128 = MICROPHONE), `exported=0x0`.
- `stopForeground(STOP_FOREGROUND_REMOVE)` + full AudioRecord/stream teardown on stop (L334-379); cleanup in `onDestroy` (L446-452).
- All cited line ranges rendered directly in reviewer reads (incl. a dedicated re-render of L64-262 at finalization to pin citations).

### 3. C2 contract commands (acceptance / API)
- All 5 required commands present at every layer:
  - Kotlin `@Command` handlers: `recorderStartForeground`, `recorderPause`, `recorderResume`, `recorderStop`, `recorderState` (+ helper `recorderPostStandbyNotification`) — `OrbitkitNativePlugin.kt:171-291`.
  - Rust `#[tauri::command(rename = ...)]` camelCase + snake_case variants, feature-gated.
  - `build.rs` command list (feature-gated).
- PERMISSION_DENIED: plugin checks `checkSelfPermission(RECORD_AUDIO)` BEFORE dispatching `startForegroundService`; on denial: `invoke.reject("RECORD_AUDIO permission not granted", "PERMISSION_DENIED", null, {error, message, permission})` — typed code + structured data, no crash, early return. Service re-checks defensively and `stopSelf()`s.
- DEX bytecode: reviewer's own zipfile scan of `classes6.dex` in the built arm64 APK found 9/9 recorder symbols (`OrbitkitRecorderService`, all 5 commands, `orbitkit_recorder`, `ACTION_START_FOREGROUND`, `postStandbyNotification`).

### 4. Scenario matrix (acceptance)
- S1: App.svelte "S1: Start FGS" → `invoke("recorderStartForeground")`; runbook with exact observables (`dumpsys` `isForeground=true foregroundId=2001 foregroundType=128`, spool growth ~32 kB/s, logcat tags `OrbitkitNative`/`OrbitkitRecorder`).
- S2: overlay buttons PAUSE/RESUME/STOP (plugin `buildOverlayView`, `recActions` — additions only vs base) dispatch `ACTION_PAUSE/RESUME/STOP`; pause is internal `audioRecord.stop()` with FGS retained (no `stopForeground` churn); runbook includes spool-size growth/stall checks.
- S3: overlay START dispatches `startForegroundService` in try/catch; service-side `startForeground` also in try/catch — expected `ForegroundServiceStartNotAllowedException` (Gate B) documented, success framed as undocumented-behavior finding.
- S3b: `postStandbyNotification` — standby notification on `orbitkit_recorder` with `PendingIntent.getForegroundService` START action; runbook covers both outcomes.
- JUnit: reviewer force re-ran `./gradlew testUniversalDebugUnitTest --rerun-tasks` → BUILD SUCCESSFUL (46/46 tasks executed); parsed `TEST-dev.orbitkit.native.OrbitkitNativePluginTest.xml`: tests=8, failures=0, errors=0, skipped=0. Tests cover: plugin hierarchy/@TauriPlugin/@Command presence for overlay + all 5 recorder commands, service extends Service, channel id + action constants, state enum.
- Physical execution deferred — declared, not hidden; deferral condition re-confirmed live by reviewer (`adb devices -l` → 0 devices, 2026-09-22).
- Evidence provenance (independently re-checked by reviewer vs accepted from candidate's captured artifacts): DEX symbol presence re-verified via own Python zipfile scan of `classes6.dex` (9/9); with-feature `.so` symbol presence + exact size re-verified via own scan; source manifest re-verified via `git diff` + direct read; JUnit outcomes re-verified via forced re-run + XML parse; `adb devices` re-probed live. Accepted as candidate-captured (consistent with reviewer's own scans, not re-executed): `aapt dump badging`/`xmltree` outputs (raw/09, raw/10), the without-feature `.so` symbol scan (raw/12 — artifact overwritten by later with-feature build, mechanism independently confirmed by cfg-gate source analysis + both-ways `cargo check`), and full Gradle/tauri android build logs (raw/06-08, command lines + EXIT=0 verified in file).
- Frontend wiring (`src/App.svelte`): verified via full `git diff 9d98f1b..c7122e6 -- src/App.svelte` render — "S1: Start FGS", "S2: Pause/Resume/Stop", "S3b: Standby Notif" buttons wired to the five `invoke()` calls with per-call try/catch surfacing `lastError`.

### 5. Manifest permission scope (security / acceptance)
- Commit diff adds exactly: `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `POST_NOTIFICATIONS` (9 insertions: 4 permissions + service element). `SYSTEM_ALERT_WINDOW` and `INTERNET` pre-date this commit (T04/T03) — not scope creep by this task.
- `aapt dump badging` (raw/09) shows only those 6 + toolchain-injected `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (AGP-generated, not a source declaration).
- Service not exported; PendingIntents FLAG_IMMUTABLE; spool in app-private `filesDir`; no network exfiltration of audio anywhere in the diff.

### 6. Scope & tree (acceptance)
- `git diff --name-only base..candidate`: 29 files, all within `src-tauri/gen/android/**`, `src-tauri/**`, `src/**`, `BRIEF.md`, `evidence/mic-fgs-gates/**`.
- `git status` at candidate HEAD: clean except this reviewer-created `evidence/mic-fgs-gates/VERDICT.md` (untracked, mandated by audit protocol).
- BRIEF.md rewritten for T05 (goal, allowlist, non-goals) — in-scope.

## Findings

Classified (acceptance / API / correctness / security). None blocking.

1. **(documentation, minor)** `REPORT.md` scenario-table row 5 ("Fallback — permission denied") is marked `VERIFIED`, but it was verified by code inspection only (no device execution of the denial path). The evidence column itself is accurate ("Implemented in OrbitkitNativePlugin.kt lines 174-184"). The typed-reject behavior is deterministic from the code path (guard precedes service dispatch), so the criterion is met; the status label is slightly stronger than the evidence.
2. **(correctness, minor/no-bug)** `build.rs:36` uses `cfg!(feature = "mic-recorder") || env CARGO_FEATURE_MIC_RECORDER`. In a build script, `cfg!(feature=...)` cannot see the crate's features (always false); the env-var check is the operative path and works. Redundant but harmless.
3. **(API, minor)** Frontend recorder buttons are rendered regardless of the `mic-recorder` feature; in a featureless build `invoke()` rejects ("command not found") and is surfaced via the existing catch — graceful, cosmetic only. Shipped Android artifacts are with-feature.
4. **(correctness, observation)** S3/S3b runbooks' adb fallback (`am start-foreground-service`) executes as shell and is exempt from the app's Gate B restrictions; the primary manual-tap path is correctly framed as the real test. Runbook text already distinguishes outcomes honestly.
5. **(security, none adverse)** No findings: permission checks at both plugin and service layers, `exported=false`, IMMUTABLE PendingIntents, internal-only storage, no audio egress. S3 is a declared gate-probing experiment with expected-reject framing — legitimate research purpose of the task.

## Verification commands executed by reviewer (all read-only on source)
| Command | Result |
|---|---|
| `cargo check --manifest-path src-tauri/Cargo.toml` | Finished, EXIT 0 (cache hit — 0 crates recompiled; both variants pre-built by candidate's runs; a fresh fingerprint check of the current tree, expected) |
| `cargo check --manifest-path src-tauri/Cargo.toml --features mic-recorder` | Finished, EXIT 0 (cache hit, as above) |
| `./gradlew testUniversalDebugUnitTest --rerun-tasks` | BUILD SUCCESSFUL (46/46 executed); XML: 8 tests, 0 failures |
| Python zipfile scan of `app-arm64-debug.apk` `classes6.dex` | 9/9 recorder symbols found |
| Python zipfile scan of both APKs' `liborbitkit_lib.so` | with-feature symbols present; size 127,328,064 B matches evidence |
| `adb devices -l` | 0 devices attached (deferral condition still true) |
| `git diff --name-only 9d98f1b..c7122e6` | 29 files, all in allowlist |
| `git status` | clean (only this VERDICT.md untracked) |

**PASS.**
