# okf_survival-jni

> Task brief for the OMP coding agent. Worktree display name: `okf-survival-jni`.
> You are the only writer in this worktree. Record honest facts; probe before you
> trust any command; never invent command output.

## Goal

Close the campaign: (a) prove the native action path overlay → Kotlin → JNI → Rust
works while the main WebView is SUSPENDED (RESEARCH §7: JNI is the documented channel;
background_throttling unsupported on Android — logic must not live in JS), and (b)
characterize survival: screen lock, confirmed process death (force-stop / am kill),
swipe-from-Recents (NOT proof of death — check actual process state), state
persistence across each, and the realistic idle-launcher-without-mic lifecycle
(RESEARCH §3.2: overlay lifecycle separate from mic-FGS; specialUse-approvability is
OUT of scope — Play not targeted).

## Scope allowlist (explicit)

- `src-tauri/gen/android/**` (JNI bridge Kotlin, service/overlay lifecycle tweaks, persistence)
- `src-tauri/src/**` Rust (extern command surface for JNI path, state persistence)
- `src-tauri/Cargo.toml` (only if the bridge needs a feature/crate addition)
- `src/**` minimal (debug affordances only)
- `BRIEF.md` (this brief, overwrite in worktree root)
- `evidence/survival-jni/REPORT.md` + raw outputs (committed)

Anything not listed is out of scope. No formatters with autofix.

## Non-goals

- No new recorder features (T05 surface is frozen; consume as-is)
- No START_STICKY redesign beyond recording OBSERVED behavior on this device (OEM kill policy characterization is limited to the Z Flip 7 — RESEARCH §11 spike 3 asked for ≥2 OEMs; one device is the campaign's declared limit, noted in REPORT)
- No specialUse-FGS implementation (idle-launcher question is answered as: does the overlay live in-process without any FGS, and what happens on process death — documented facts only)
- No lockscreen overlay work beyond recording whether the overlay remains visible when locked

## Dependencies

- Requires T05 completed (reviewed + squash-integrated + post-merge smoke)
- Exclusive resources: JNI bridge files, persistence module, lifecycle-related manifest/service tweaks

## Shared contracts (consume as-is; do not redesign)

- C2 plugin contract frozen; JNI path = Kotlin side calls Rust via JNI (documented Tauri channel for suspended WebView) — extend, don't reshape, T04/T05 command surface
- C4 persistence contract (defining task — YOU implement): recorder/spool state file written on every state transition; on process restart, last known state is recoverable; evidence includes before/after file contents
- C5: Z Flip 7 via adb; death is only ever claimed when CONFIRMED: `adb shell am force-stop` or `adb shell am kill` + observed process gone; swipe-from-Recents reports MUST include a process-liveness check (`pidof dev.orbitkit.app`) — no death claims from swipes

## Acceptance criteria

1. JNI path proven with WebView suspended: trigger an overlay action while the main activity is backgrounded long enough for the WebView to suspend (or force the suspended state per Tauri docs); action reaches Rust (log receipt in Rust-side log) — logcat + Rust log excerpts bound to commit SHA
2. Lock screen: with recorder active, lock device (adb or manual), unlock — recording survived; overlay visibility under lock RECORDED (either way, honest fact)
3. Force-stop: process dead (pidof empty), app relaunched — state recovered from persistence (before/after evidence); overlay gone while dead and its restoration path documented (relaunch is the obvious path — RESEARCH §10.12)
4. am kill / LMK-class death: same procedure as 3
5. Swipe-from-Recents: check `pidof` — record ACTUAL liveness; characterize overlay + FGS state in the observed outcome (process may well survive — that is the expected nuance)
6. REPORT table: scenario × observed behavior (overlay, FGS, state file, restoration path), all bound to evidence + OS build + commit SHA; explicit statement of the one-device limitation
7. Everything committed; tree clean; worktree status `in-review` with comment

## Real runtime testing (actionable)

| # | Scenario | Exact command / interaction | Expected observable outcome |
|---|---|---|---|
| 1 | JNI under suspension | background app, tap overlay action, grep Rust-side receipt log | receipt logged from Rust (no JS involvement) |
| 2 | Lock | `adb shell input keyevent KEYEVENT_POWER` style lock or manual | recording continues; overlay state recorded |
| 3 | Force-stop | `adb shell am force-stop dev.orbitkit.app`; `pidof` | process gone; relaunch recovers state |
| 4 | am kill | `adb shell am kill dev.orbitkit.app` (after backgrounding) | same as 3 |
| 5 | Swipe | UI swipe + `pidof dev.orbitkit.app` | actual liveness recorded (expect alive) |

Runtime environment: real device via adb. Record commit SHA with each result.

## Reporting and evidence

- Evidence slot: `evidence/survival-jni/` (in-repo, COMMITTED — not under plans/; plans/ is gitignored by design)
- Report must include: per-scenario commands/results, commit SHA, device OS build, out-of-scope findings, explicit ready handoff statement when done
- When committed and tree clean: set worktree status `in-review` with a comment. Do not merge, push, or delete anything.

## Stage checklist (mirrored in campaign TODO)

- [ ] develop
- [ ] runtime test-loop
- [ ] independent review-loop
- [ ] squash integration / conflict handling
- [ ] post-merge runtime smoke (coordinator)
- [ ] evidence preserved + cleanup verified

## Campaign-end inputs (coordinator, not you)

Your REPORT feeds okf_PLAN.md campaign criteria: verdict on safe UX promises
(overlay-controls-live-service OK; notification cold-start per S3b evidence; overlay
cold-start only if S3 evidence says so) and the one-device limitation note.
