# okf_scaffold-android

> Task brief for the OMP coding agent. Worktree display name: `okf-scaffold-android`.
> You are the only writer in this worktree. Record honest facts; probe before you
> trust any command; never invent command output.

## Goal

Take the integrated campaign skeleton (C1 layout, T02 chassis) to a real device: run
`tauri android init`, produce a debug APK, sideload it onto the Samsung Galaxy Z Flip 7,
and prove it launches. This task produces the campaign's first on-device runtime proof.

## Scope allowlist (explicit)

- `src-tauri/gen/android/**` (generated Android project — commit it; it is the modification surface for T04+)
- `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` (minimal android-related additions)
- `src-tauri/capabilities/*.json` if mobile capabilities require changes
- `BRIEF.md` (this brief, overwrite in worktree root)
- `evidence/scaffold-android/REPORT.md` + raw outputs (committed)

Anything not listed is out of scope. No formatters with autofix.

## Non-goals

- No overlay, no Kotlin plugin, no manifest permission additions (T04+)
- No release signing, no keystores, no Play assets
- No emulator; no wireless adb unless USB proves unusable (then record why)

## Dependencies

- Requires T01 AND T02 completed (reviewed + squash-integrated + post-merge smoke)
- Exclusive resources: `src-tauri/gen/android/**`, gradle wrapper files
- Environment: consume T01's committed `evidence/env-probe/env.sh` (JAVA_HOME,
  ANDROID_HOME, PATH); if the NDK was left uninstalled per T01 criterion 5, install
  `ndk;27.<latest>` via the recorded sdkmanager path and record the exact version
  (C5: version decision lands here)

## Shared contracts (consume as-is; do not redesign)

- C1 layout and identifier `dev.orbitkit.app` (do not change the appId)
- C5 device: Z Flip 7 via adb; every device interaction must show in evidence with
  timestamped logcat excerpts bound to commit SHA
- Debug signing only (Tauri default debug keystore) — NEVER generate or commit keystores

## Acceptance criteria

1. `pnpm tauri android init` (or the verified equivalent) completed; generated
   `src-tauri/gen/android/` committed; `applicationId` = `dev.orbitkit.app`
2. Debug APK built (verified gradle/bundle output excerpt recorded)
3. APK installed on Z Flip 7 (`adb install -r` VERIFIED) and the app LAUNCHES on device:
   logcat excerpt showing the app process starting + `adb shell dumpsys window` or
   screencap showing the OrbitKit window rendered (mascot placeholder visible)
4. Report records: device model + Android build number (C5), exact versions
   (gradle, AGP, NDK, target SDK), commit SHA; all raw outputs under `evidence/scaffold-android/raw/`
5. Everything committed; tree clean; worktree status `in-review` with comment

## Real runtime testing (actionable)

| # | Scenario | Exact command / interaction | Expected observable outcome |
|---|---|---|---|
| 1 | Android init | verified tauri android init command | gen/android project created, builds |
| 2 | Debug build | verified gradle/tauri build command | APK artifact path recorded |
| 3 | Install + launch | `adb install -r <apk>`; `adb shell monkey -p dev.orbitkit.app 1` or tap icon; `adb logcat` filtered | app process starts; window rendered on device (screencap) |

Runtime environment: real device via adb (production path, no mocks). Record build/source identity (commit SHA) with each result.

## Reporting and evidence

- Evidence slot: `evidence/scaffold-android/` (in-repo, COMMITTED — not under plans/; plans/ is gitignored by design)
- Report must include: commands/results per scenario, commit SHA, out-of-scope findings, explicit ready handoff statement when done
- When committed and tree clean: set worktree status `in-review` with a comment. Do not merge, push, or delete anything.

## Stage checklist (mirrored in campaign TODO)

- [ ] develop
- [ ] runtime test-loop
- [ ] independent review-loop
- [ ] squash integration / conflict handling
- [ ] post-merge runtime smoke (coordinator: reinstall APK from the campaign tip and launch)
- [ ] evidence preserved + cleanup verified
