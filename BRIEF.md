# okf_overlay-native

> Task brief for the OMP coding agent. Worktree display name: `okf-overlay-native`.
> You are the only writer in this worktree. Record honest facts; probe before you
> trust any command; never invent command output.

## Goal

The campaign's core native layer: a Kotlin Tauri plugin `orbitkit-native` that (a)
walks the user through SYSTEM_ALERT_WINDOW permission (special app access), (b) shows
a small native draggable overlay window (TYPE_APPLICATION_OVERLAY) with action
buttons, visible ABOVE other apps. NO microphone work here (T05). This task ends with
the overlay visibly floating over a foreign app on the Z Flip 7.

## Scope allowlist (explicit)

- `src-tauri/gen/android/**` (Kotlin sources, AndroidManifest.xml, generated plugin scaffolding)
- `src-tauri/**` Rust side: plugin registration (`src-tauri/src/**`), `Cargo.toml`
- `src/**` minimal frontend: one debug button to trigger `requestOverlayPermission` and `overlayShow` (may be removed by later tasks)
- `BRIEF.md` (this brief, overwrite in worktree root)
- `evidence/overlay-native/REPORT.md` + raw outputs (committed)

Anything not listed is out of scope. No formatters with autofix.

## Non-goals

- No microphone, no FGS, no RECORD_AUDIO, no notification actions (T05)
- No JNI-under-suspension proof (T06 — here the path only needs to exist and actuate while app is foreground)
- No radial menu geometry, no mascot animation, no detached popups
- No Play-distribution assets, no signing changes

## Dependencies

- Requires T03 completed (reviewed + squash-integrated + post-merge smoke)
- Exclusive resources: `src-tauri/gen/android/**` Kotlin/manifest surface, plugin registration files

## Shared contracts (consume as-is; do not redesign)

- C2 (defining task — YOU implement this contract, later tasks consume it):
  - Plugin name `orbitkit-native`, Kotlin package `dev.orbitkit.native`
  - Commands: `overlayShow`, `overlayHide`, `requestOverlayPermission`, `isOverlayPermissionGranted`
  - Overlay = native Kotlin view added via WindowManager with
    `TYPE_APPLICATION_OVERLAY` + `FLAG_LAYOUT_IN_SCREEN`; draggable; contains 3 action buttons
    (for now they emit placeholder actions `ACT_A`/`ACT_B`/`ACT_C`)
  - Actions travel overlay-view → plugin → Rust via plugin event/IPC channel (no JS involvement in the overlay path)
- C5: Z Flip 7 via adb; SAW is granted by user through Settings (special app access screen) —
  the task may open `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` but the actual grant tap is a USER action; if permission is not granted, record and stop gracefully (do not loop, do not use adb to click through Settings on the owner's behalf more than once)

## Acceptance criteria

1. Plugin implements all four C2 commands; `overlayShow` fails gracefully with a typed error when SAW is not granted (no crash)
2. On device: after user grants SAW once, `overlayShow` renders the overlay; evidence = device screenshot showing the overlay ON TOP of a foreign app (open e.g. Settings or a browser under it) + logcat excerpt; bound to commit SHA
3. Overlay drag works; buttons tap (placeholder action visible in logcat/Rust-side log)
4. `overlayHide` removes it cleanly; no window leak (verify via `adb shell dumpsys window` excerpt)
5. Manifest documents the minimum: `SYSTEM_ALERT_WINDOW` only — no mic/FGS permissions sneak in (review criterion)
6. Everything committed; tree clean; worktree status `in-review` with comment

## Real runtime testing (actionable)

| # | Scenario | Exact command / interaction | Expected observable outcome |
|---|---|---|---|
| 1 | Permission flow | tap in-app button → Settings opens → (user grants) → `isOverlayPermissionGranted` → true | no crash; state flips to granted |
| 2 | Overlay over foreign app | `overlayShow`, then bring another app to front | screenshot: overlay floats above foreign app; drag + button taps log |
| 3 | Hide | `overlayHide` + dumpsys | overlay gone, no leaked windows |

Runtime environment: real device via adb (production path). Record commit SHA with each result.

## Reporting and evidence

- Evidence slot: `evidence/overlay-native/` (in-repo, COMMITTED — not under plans/; plans/ is gitignored by design)
- Report must include: commands/results per scenario, commit SHA, out-of-scope findings, explicit ready handoff statement when done
- When committed and tree clean: set worktree status `in-review` with a comment. Do not merge, push, or delete anything.

## Stage checklist (mirrored in campaign TODO)

- [x] develop
- [x] runtime test-loop
- [ ] independent review-loop
- [ ] squash integration / conflict handling
- [ ] post-merge runtime smoke (coordinator: rebuild from campaign tip, overlay smoke)
- [ ] evidence preserved + cleanup verified
