# T06 survival-jni — Independent Review Verdict

Status: PASS
Candidate Commit: 4f372f75550af957c83b0a797d5ec427d9486cea
Base Commit: 40759010a7402082e25494d605e59b978ef81f21
Reviewer: independent (read-only on code; only this file mutated)

## Checklist of acceptance criteria

- [x] 1. JNI Bridge: Rust JNI export `Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction` + Kotlin `OrbitkitJniBridge`; actions reach Rust with WebView suspended without JS involvement (static/bytecode/unit-verified; on-device runtime deferred per disconnected device — condition re-verified live: `adb devices -l` → 0 attached)
- [x] 2. C4 Persistence Contract: state file written on transitions, recoverable on restart, before/after evidence (`raw/16`, independently reproduced via JUnit run)
- [x] 3. Survival Matrix: S1–S5 code-complete, unit tests pass (independent run: 22/22, report says 21/21 — see findings), bytecode verified, runbooks with exact observables; physical test deferred per declared disconnected-device condition
- [x] 4. Scope adherence: all 32 changed files within allowlist; git tree clean at candidate (before this review artifact)
- [x] 5. REPORT.md scenario table + one-device limitation note documented

## Independent verification performed

| Check | Command (run by reviewer) | Result |
|---|---|---|
| Rust host compile, no feature | `cargo check --manifest-path src-tauri/Cargo.toml` | EXIT=0 |
| Rust host compile, `mic-recorder` | `cargo check --manifest-path src-tauri/Cargo.toml --features mic-recorder` | EXIT=0 |
| Rust unit tests | `cargo test ... --features mic-recorder` | BLOCKED by host env: system `webkit2gtk-4.1` absent at link stage (sandbox limitation, not code defect; agent honestly used `cargo check --tests` — `raw/05`) |
| JUnit suite | `./gradlew testUniversalDebugUnitTest --rerun-tasks` + JUnit XML parse | BUILD SUCCESSFUL; **22 tests, 0 failures, 0 errors, 0 skipped** (OrbitkitNativePluginTest=8, OrbitkitSurvivalJniTest=14) |
| `.so` JNI exports | byte-scan of `app/src/main/jniLibs/arm64-v8a/liborbitkit_lib.so` and of `lib/arm64-v8a/liborbitkit_lib.so` inside `app-arm64-debug.apk` | all 4 symbols FOUND (`onNativeAction`, `00024Companion_onNativeAction`, `getActionCount`, `getActionLogJson`) — matches `raw/13` |
| DEX native method | `dexdump -f app-arm64-debug.apk` | `onNativeAction` `(Ljava/lang/String;)Ljava/lang/String;` access `0x0119 (PUBLIC STATIC FINAL NATIVE)` — REPORT claim TRUE |
| DEX classes | `raw/11` + zipfile scan of APK dex | `OrbitkitJniBridge`, `OrbitkitStatePersistence`, service, MainActivity present |
| TypeScript | `pnpm exec tsc --noEmit` | No errors |
| Device condition | `source evidence/env-probe/env.sh && adb devices -l` | 0 devices attached — deferral condition current |
| Overlay→JNI wiring (no JS) | code read `OrbitkitNativePlugin.kt:351-380, 502, 548-590` | overlay buttons (ACT_A/B/C, REC_START/PAUSE/RESUME/STOP) → `handleAction` → `OrbitkitJniBridge.dispatchNativeAction` → JNI → Rust; Tauri `actionChannel`/`trigger` demoted to best-effort steps 3-4 |
| Scope | `git diff --name-only base..candidate` (32 files) vs allowlist | 0 violations; tree clean at candidate |
| C4 recovery | JUnit XML + `raw/16` | production `saveState/loadState/recoverState` execute real file I/O; before (RECORDING/pid1001/49152B) → after (STOPPED/pid2002/recoveryCount=1, bytes preserved) |

## Findings

### Acceptance (minor — none blocking)

1. **Evidence truncation in `raw/12-apk-dex-jni-bridge.txt`**: the committed artifact ends at the `getActionCount` header and does NOT contain the `onNativeAction` `0x0119 (PUBLIC STATIC FINAL NATIVE)` entry quoted in REPORT.md §Static Bytecode Verification and the Automated Verification Matrix. The underlying claim is TRUE — independently verified by reviewer via `dexdump`. Recommend regenerating `raw/12` with the full class dump.
2. **Test-count discrepancy**: REPORT.md and its verification matrix claim "21/21 JUnit tests passed". Actual suite is **22** tests (8 `OrbitkitNativePluginTest` + 14 `OrbitkitSurvivalJniTest`); reviewer's run: 22/22 pass. The committed `raw/06` gradle console log contains no per-test count, so "21/21" is unsupported by raw evidence as well. Substance (all pass) holds.
3. **On-device runtime scenarios S1–S5 deferred**: legitimate per the brief's disconnected-device instruction ("provide complete unit tests, static bytecode verification, and exact runbooks") and re-verified 0 adb devices. REPORT labels every scenario DEFERRED honestly; runbooks carry exact commands + expected logcat/file observables. Criterion 1's "prove actions reach Rust with WebView suspended" is therefore proven at the static/name-resolution level (dex native method ↔ .so export symbol match, JVM-reflection contract tests) but NOT yet at runtime — consistent with the declared condition, not a hidden gap.

### Correctness (minor — none blocking)

4. **`recoveryCount` inflation on service restart**: `OrbitkitRecorderService.onCreate` calls `recoverState` unconditionally, so starting the FGS within a living process (after `MainActivity.onCreate` already recovered) bumps `recoveryCount` with `RECOVERED_NORMAL`. The counter counts recoveries, not process deaths; REPORT's "recoveryCount=1" narrative survives only for the clean single-recovery path. State-machine behavior (RECORDING/PAUSED → STOPPED on death) unaffected and tested.
5. **fsync on the audio capture thread**: `RECORDING_PROGRESS` persistence (every ~32KB) runs file write + fsync on the recording thread; at 16kHz/mono/16-bit that is ~1 blocking I/O per second on the hot capture path. Acceptable for the spike; flagged for the future product path.
6. **Tautological S5 test**: `testScenarioS5_SwipeFromRecentsLivenessContract` asserts `activePid == survivingPid` where both are hardcoded 8001 — pins only the `loadState` roundtrip, not liveness. S2 test is likewise a save/load roundtrip. These are contract-documentation tests; REPORT's honest DEFERRED labeling covers the missing runtime proof.

### API (info)

7. `jni = { version = "0.21", default-features = false }` added to `Cargo.toml` (permitted by brief: "only if the bridge needs a feature/crate addition"); host-compiles clean in both feature states; `build.rs` command ACL extended with `recorderGetPersistedState`/`recorderRecoverState` camel+snake pairs, consistent with the existing pattern. Rust module `jni_bridge` is unconditionally compiled (not android-gated) — links fine on host; JNI exports resolve only on Android. The `00024Companion_onNativeAction` fallback export is dead-but-harmless for a Kotlin `object` (no companion generated).

### Scope (info)

8. All 32 changed files inside the review-mandate allowlist. Note: BRIEF.md's literal list omits `src-tauri/build.rs` and `src-tauri/Cargo.lock` (covered by the mandate's `src-tauri/**`); both edits are forced consequences of the permitted crate addition (lockfile update, command ACL) — not scope creep.

## Final verdict

**PASS** — All five acceptance criteria verified within the declared one-device limitation. Runtime deferral is legitimate, honestly documented, and the disconnect condition is currently reproducible. Two evidence-hygiene items (truncated `raw/12`, unsupported "21/21" count vs actual 22/22) and minor correctness notes are recorded above; none block acceptance. Both quoted-but-truncated claims were independently re-verified TRUE by the reviewer.
