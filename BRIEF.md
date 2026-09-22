# okf_mic-fgs-gates

> Task brief for the OMP coding agent. Worktree display name: `okf-mic-fgs-gates`.
> You are the only writer in this worktree. Record honest facts; probe before you
> trust any command; never invent command output. THIS TASK IS THE CAMPAIGN'S CRITICAL
> SPIKE (RESEARCH.md §11 spikes 1–2): expect the possibility that documented
> expectations FAIL on the device — that is a VALID campaign result, record it honestly.

## Goal

Implement a minimal feature-gated mic recorder on top of T04's overlay and execute the
RESEARCH.md §3.1 scenario matrix on the Z Flip 7: S1 (start from visible Activity),
S2 (pause/resume/stop from overlay on an ALREADY-RUNNING FGS), S3 (cold mic-FGS start
from overlay tap — documented expectation: REJECTED by while-in-use gate B), S3b
(cold start from a live notification action — documented candidate for allowed).
Deliver per-scenario verdicts with logcat proof. You are proving facts, not shipping
a recorder product.

## Scope allowlist (explicit)

- `src-tauri/gen/android/**` (recorder service Kotlin, manifest additions, notification channel)
- `src-tauri/src/**` Rust: recorder command surface behind a cargo feature (e.g. `mic-recorder`)
- `src-tauri/Cargo.toml` (feature gate), `src-tauri/capabilities/*.json` if needed
- `src/**` minimal: debug buttons for S1 start / permission request (placeholder UI)
- `BRIEF.md` (this brief, overwrite in worktree root)
- `evidence/mic-fgs-gates/REPORT.md` + `scenarios/*.md` + raw logcat (committed)

Anything not listed is out of scope. No formatters with autofix.

## Non-goals

- No survival/process-death/START_STICKY work (T06)
- No JNI-under-suspended-WebView proof (T06; your overlay actuation may run with app foreground)
- No audio quality/encoding work: capture to raw PCM spool file is enough (no codec)
- No radial menu, no mascot, no UI polish; notification may be bare-bones
- No Play-distribution thinking (FGS declarations for Play are OUT of campaign scope)

## Dependencies

- Requires T04 completed (reviewed + squash-integrated + post-merge smoke)
- Exclusive resources: recorder service Kotlin files, manifest mic entries, notification channel id `orbitkit_recorder`

## Shared contracts (consume as-is; do not redesign)

- C2 plugin contract unchanged; you ADD commands (do not redesign T04's): `recorderStartForeground`,
  `recorderPause`, `recorderResume`, `recorderStop`, `recorderState`
- C3 scenario labels exactly S1/S2/S3/S3b (definitions RESEARCH.md §3.1 rows 1/2/3/3b);
  graceful fallback per row 4: RECORD_AUDIO not granted → typed error, no crash
- C5: Z Flip 7 via adb; runtime permissions (RECORD_AUDIO) granted via
  `adb shell pm grant dev.orbitkit.app android.permission.RECORD_AUDIO` before S-scenarios; record exact grant state in every scenario header

## Acceptance criteria

1. Feature-gated build: without the `mic-recorder` feature the app builds and runs with recorder code compiled out (prove by building both variants — output excerpts)
2. S1 VERIFIED on device: mic-FGS starts from visible Activity; foreground notification visible; audio captured to spool file (file size grows — evidence excerpt)
3. S2 VERIFIED on device: with FGS live and app backgrounded, overlay taps pause/resume/stop the service — no new FGS start involved; logcat excerpts; PAUSE is internal (AudioRecord-level, no stopForeground churn — RESEARCH §3 NB)
4. S3 executed on device with honest verdict: expected REJECT (SecurityException / ForegroundServiceStartNotAllowedException per RESEARCH §3.1 row 3 [D-по-умолчанию]); if it unexpectedly SUCCEEDS on this Android 16 build — that is an undocumented-behavior finding: record with full logcat, do not celebrate, do not rely on it in later tasks
5. S3b executed on device with honest verdict: notification action cold start (documented candidate); record outcome with full logcat either way
6. REPORT includes the scenario matrix table (per RESEARCH §3.1) filled with device results + OS build + commit SHA; every claim bound to logcat evidence
7. Everything committed; tree clean; worktree status `in-review` with comment

## Real runtime testing (actionable)

| # | Scenario | Exact command / interaction | Expected observable outcome |
|---|---|---|---|
| 1 | S1 | launch app, tap start, `adb shell dumpsys activity services <pkg>` | FGS listed as foreground, mic type |
| 2 | S2 | background app, tap overlay buttons, watch logcat + recorderState | state transitions pause/resume/stop without FGS restart |
| 3 | S3 | background app, tap overlay START (cold), watch logcat | exception per gate B expectation OR undocumented success (both valid results) |
| 4 | S3b | background app, tap notification action START, watch logcat | FGS starts (documented candidate) OR reject (evidence for owner) |

Runtime environment: real device via adb, real mic (ambient sound is fine). Record commit SHA with each result. A green build proves nothing here — scenario evidence is the deliverable.

## Reporting and evidence

- Evidence slot: `evidence/mic-fgs-gates/` (in-repo, COMMITTED — not under plans/; plans/ is gitignored by design)
- Report must include: per-scenario commands/results, commit SHA, device OS build, out-of-scope findings, explicit ready handoff statement when done
- When committed and tree clean: set worktree status `in-review` with a comment. Do not merge, push, or delete anything.

## Stage checklist (mirrored in campaign TODO)

- [x] develop
- [x] runtime test-loop
- [ ] independent review-loop
- [ ] squash integration / conflict handling
- [ ] post-merge runtime smoke (coordinator: S1 quick re-run from campaign tip)
- [ ] evidence preserved + cleanup verified
