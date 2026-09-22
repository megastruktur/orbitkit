# okf_env-probe

> Task brief for the OMP coding agent. Worktree display name: `okf-env-probe`.
> You are the only writer in this worktree. Record honest facts; probe before you
> trust any command; never invent command output.

## Goal

Produce the campaign's VERIFIED command inventory (build/runtime toolchain facts) and
prepare user-local Android tooling so T03+ can build and drive the device. This task
proves or disproves every "environment works" assumption; it writes no app code.

## Scope allowlist (explicit)

- `evidence/env-probe/` — your report and captured probe outputs (committed)
- `~/Android/`, `~/gradle/` — user-local SDK/tooling installs OUTSIDE the repo (do not commit)
- Environment variable exports persisted in `evidence/env-probe/env.sh` (committed, no secrets — paths only)
- A copy of this brief into the worktree root as `BRIEF.md` (overwrite whatever is there)

Anything not listed is out of scope. No formatters with autofix.

## Non-goals

- No app scaffold, no pnpm/cargo project files, no Tauri init (T02/T03 own those)
- No system-wide installs, no root, no package-manager changes outside user-local prefixes
- No emulator creation (physical device is the campaign target); AVD only if owner later asks
- No gateway/LiteLLM config changes, no credential handling beyond key-presence checks that never print values

## Dependencies

- Requires: bootstrap commit `okf-c1` on `main` (integration lineage `okf-campaign`)
- Exclusive resources: none shared with T02 (parallel-safe)

## Shared contracts (consume as-is; do not redesign)

- C1 (plan §Shared contracts): pnpm is the package manager for later tasks — your probe determines how to provide it (corepack vs standalone), you do not choose a different manager
- C5: device is Samsung Galaxy Z Flip 7 over adb; report its exact model/OS build
- Report format: `evidence/env-probe/REPORT.md` — table of command → version/path → verification method (executed output excerpt); plus raw outputs under `evidence/env-probe/raw/`

## Acceptance criteria

1. `evidence/env-probe/REPORT.md` exists with a complete verified inventory:
   `rustc`, `cargo`, `rustup`, `node`, `npm`/`pnpm` (or corepack enablement), `java` (JDK 17+), `adb`,
   `sdkmanager`, webkit2gtk-4.1 presence, pkg-config — each marked VERIFIED (real executed
   output) or MISSING-AFTER-ATTEMPT (with the attempted install path and the failure).
2. If JDK/Android SDK/adb were missing: they exist user-local after this task
   (`~/Android/Sdk`, cmdline-tools, platform-tools, JDK via non-root install) and
   `sdkmanager --version`, `adb version`, `java -version` are VERIFIED.
3. `adb devices -l` shows the Samsung Galaxy Z Flip 7 (state unauthorized if so — that is a user action, record it, do not loop).
4. `evidence/env-probe/env.sh` exports: JAVA_HOME, ANDROID_HOME, NDK_HOME (if installed),
   PATH additions — sourced by later task briefs; contains NO secrets.
5. NDK: report presence + exact version if present; if absent, record the exact
   `sdkmanager` command that would install it and STOP (do not install — T03 decides with
   the version contract).
6. Everything above committed to the worktree branch; tree clean; worktree status set to `in-review` with a comment.

## Real runtime testing (actionable)

| # | Scenario | Exact command / interaction | Expected observable outcome |
|---|---|---|---|
| 1 | Probe existing toolchain | `command -v <c> && <c> --version` for each inventory item | version strings recorded, not assumed |
| 2 | Install user-local JDK/SDK if needed | official cmdline-tools zip → `~/Android/Sdk/cmdline-tools/latest`, `sdkmanager "platform-tools" "platforms;android-36"` | `sdkmanager --version` prints a version |
| 3 | Device visibility | `adb devices -l` | Z Flip 7 listed (device or unauthorized) |

Runtime environment: real host shell as the executor runs it (repo host, Debian 12;
sandbox context differs — re-probe in YOUR actual context and record what YOU see).
Record build/source identity (commit SHA) with each result.

## Reporting and evidence

- Evidence slot: `evidence/env-probe/` (in-repo, COMMITTED — not under plans/; plans/ is gitignored by design; coordinator archives to `okf_evidence/` at campaign end)
- Report must include: commands/actions/results per scenario, commit SHA of final state, out-of-scope findings, explicit ready handoff statement when done.
- When your work is committed and the tree is clean: set worktree status `in-review` with a comment summarizing what was verified. Do not merge, push, or delete anything.

## Stage checklist (mirrored in campaign TODO)

- [ ] develop (probes + installs)
- [ ] runtime test-loop (inventory re-verified end-to-end)
- [ ] independent review-loop
- [ ] squash integration / conflict handling
- [ ] post-merge runtime smoke (coordinator: fresh-shell source env.sh + `adb devices`)
- [ ] evidence preserved + cleanup verified
