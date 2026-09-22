# Independent Review Verdict — okf-scaffold-android (T03)

Status: PASS
Candidate Commit: 5d901d8d7348b5ba3059d157f5547664ff73a518
Base Commit: 2659eeabaadc5e2d28e07b470d190168172f5e37
Review Date: 2026-09-22
Reviewer: independent read-only audit (this file is the only mutation, per mandate)

## Checklist of acceptance criteria

- [x] 1. `pnpm tauri android init` completed; `src-tauri/gen/android/` committed; `applicationId` = `dev.orbitkit.app`
- [x] 2. Debug APK built (gradle/bundle output excerpt recorded, APK artifact present and valid)
- [x] 3. Runtime smoke — disconnected-device fallback satisfied (valid APK, `adb devices -l` tested, reconnection instructions + verification commands in REPORT.md)
- [x] 4. Pinned versions recorded: device target (C5), gradle, AGP, NDK, target SDK, commit SHA; raw outputs under `evidence/scaffold-android/raw/`
- [x] 5. Scope adherence: allowlist respected, no keystores committed, git tree clean at audit start

## Verified evidence

### C1 — Android init & applicationId (PASS)

- `raw/02-tauri-android-init.txt`: successful `tauri android init --ci` ("Project generated successfully!") — the pnpm-invoked CLI form (`pnpm tauri android init --ci` as recorded in REPORT scenario table; pnpm strips its own prefix in the echoed command).
- `src-tauri/gen/android/**` committed: exactly **40 tracked files** (verified via `git ls-files`), matching REPORT's claim. Includes gradle wrapper, buildSrc (BuildTask.kt/RustPlugin.kt), MainActivity.kt, resources.
- `app/build.gradle.kts` line 21: `applicationId = "dev.orbitkit.app"`; line 18 namespace same; `tauri.conf.json` identifier `dev.orbitkit.app` (C1 contract preserved across config → gradle → APK badging).
- `MainActivity.kt` and `AndroidManifest.xml` are stock Tauri templates — no T04+ scope creep (no added permissions; INTERNET is template default).

### C2 — Debug APK built & valid (PASS)

- `raw/03` (`--target aarch64`), `raw/06` (universal, all 4 ABIs), `raw/08` (`--split-per-abi`), `raw/12` (clean rebuild): all cargo+gradle logs end with `Finished N APK at: …` (Gradle 8.14.3).
- `raw/04`/`raw/09`/`raw/07` (`aapt dump badging`): `package: name='dev.orbitkit.app'` versionCode 1000 versionName 0.1.0, targetSdk 36, `application-debuggable`, `launchable-activity: dev.orbitkit.app.MainActivity`, native-code arm64-v8a (universal: all 4 ABIs).
- **Independent artifact validation (reviewer-executed):** `app-universal-debug.apk` (465 MB, on disk at `src-tauri/gen/android/app/build/outputs/apk/universal/debug/`) — Python zipfile `testzip()` integrity OK, 928 entries, `AndroidManifest.xml` present, `classes.dex` ×5, `lib/{arm64-v8a,armeabi-v7a,x86,x86_64}/liborbitkit_lib.so` present. All 5 split/universal APKs exist on disk (`raw/13-apk-list.txt` matches `ls`).

### C3 — Runtime smoke fallback (PASS)

Physical device disconnected at execution time; fallback branch of the criterion satisfied:
- Valid APK: yes (independently validated above).
- `adb devices -l` tested: `raw/10-adb-devices.txt` shows empty device list; `raw/11-adb-install-attempt.txt` records `adb: no devices/emulators found`. Declared limit in REPORT §Verdict ("DEFERRED (device disconnected)") with environmental condition.
- Reconnection runbook in REPORT.md §"Device Connection Prerequisite & Verification Procedure": complete — device identity from T01 (`R5CY70FPFSM`, usb:3-1, SM-F766B/b7s), and 6 exact commands with expected output: source env.sh → `adb devices -l` (expected serial line) → `adb install -r` (exact arm64 APK path) → launch (`monkey` / `am start -n dev.orbitkit.app/.MainActivity`) → logcat capture → screencap to evidence path. `evidence/env-probe/env.sh` exists and is committed.
- Cross-check: T01 `evidence/env-probe/raw/device.txt` confirms the C5 device was attached and authorized in T01 (same serial/model/build) — the disconnection claim is environmental, consistent, and evidenced.

### C4 — Pinned versions (PASS, one minor finding)

All cross-verified by reviewer against primary sources, not just REPORT claims:
- Device target (C5): Samsung Galaxy Z Flip 7 SM-F766B/b7s, Android 16 (SDK 36), build BP2A.250605.031.A3.F766BXXS2AYGD — matches T01 `device.txt`.
- Gradle **8.14.3** (`gradle/wrapper/gradle-wrapper.properties` distributionUrl + `raw/gradle-version.txt` + build logs).
- AGP **8.11.0** (`gen/android/build.gradle.kts` line 7); Kotlin buildscript 1.9.25 (line 8).
- NDK **27.3.13750724 (r27d)** (`raw/ndk-version.txt` source.properties; `raw/01-ndk-verify.txt` sdkmanager listing; all build logs).
- Target SDK **36** / minSdk 24 / compileSdk 36 (`app/build.gradle.kts` + badging).
- Tauri `=2.11.6` / tauri-build `=2.6.3` (`Cargo.toml`); CLI 2.11.5, API 2.11.1, Svelte 5.57.1, Vite 8.3.0, rustc/cargo 1.98.0 (`raw/versions-summary.txt`, consistent with Cargo.toml/package.json).
- Commit SHA: recorded in REPORT.md — see Finding F1.
- Raw outputs: 17 files under `evidence/scaffold-android/raw/` (all committed).

### C5 — Scope adherence (PASS)

- Diff base→candidate touches exactly: `BRIEF.md` (M, per-worktree brief overwrite — allowlisted), `evidence/scaffold-android/**` (17 raw + REPORT), `src-tauri/gen/android/**` (40 files). `tauri.conf.json`, `Cargo.toml`, `capabilities/*.json` unmodified — permitted (allowlist is permission, not obligation; T02 already set the `cdylib`/`staticlib` crate-types).
- No keystores: `git ls-files` has no `*.keystore|*.jks|*.p12|*.pem|signing`; root `.gitignore` guards `*.keystore`, `*.jks`, `keystore.properties`, `secrets/`; `gen/android/.gitignore` guards `key.properties`/`keystore.properties`. Build products (jniLibs symlinks, `generated/`, APKs) correctly untracked via `gen/android` gitignores — tracked set is exactly the 40 template files.
- Git tree clean at audit start (`git status` clean; only artifact now is this reviewer-mandated VERDICT.md).
- Security sweep of generated sources: only documentation URLs in comments; no secrets/tokens; cleartext traffic enabled only in debug buildType (Tauri template default for debug).

## Findings

1. **F1 (acceptance, minor): stale commit SHA in REPORT.md.** REPORT.md line 7 records `96ddf35` as "final tip SHA published in worktree status", but the audited tip is `5d901d8`. Reflog: `c13e1b9` → amend → `96ddf35` → amend → `5d901d8`; the diff `96ddf35..5d901d8` is exactly one line — the REPORT.md SHA line itself (c13e1b9→96ddf35 update). A commit cannot contain its own hash; the recorded SHA is one amend behind and its "final tip" claim is false at review time. Material impact: none — lineage is fully reconstructible (reflog + base recorded), all other pins verified accurate. Fix suggestion: record the SHA post-commit (worktree status comment / follow-up note) rather than inside the amendable commit.
2. **F2 (acceptance, minor): empty raw evidence file mislabeled in index.** `raw/01-ndk-install.txt` is 1 byte (single newline), but the REPORT evidence index describes it as "NDK installation run output". NDK installation is independently corroborated (`01-ndk-verify.txt` sdkmanager listing, `ndk-version.txt`, all build logs using NDK 27.3.13750724), so this is an index-accuracy defect only.

No API findings (no API surface changed). No correctness findings (badging/zip/manifest/version cross-checks all consistent). No security findings (no secrets, no keystores, debug-only cleartext).

## Final verdict

**PASS** — all five acceptance criteria independently verified, with two minor documentation-accuracy findings (F1, F2) that do not invalidate any criterion. Scenario 3 satisfied via the explicitly permitted disconnected-device fallback; on-device launch smoke remains a documented post-reconnection step with exact commands (REPORT.md §Device Connection Prerequisite & Verification Procedure).
