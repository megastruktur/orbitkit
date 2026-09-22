# oks common task rules (apply to EVERY oks task brief)

- You are the ONLY writer in your worktree. Read `CONTRACTS.md` (repo root, = plans/sdk-v1/oks_CONTRACTS.md) first; consume K1–K6 as-is. Contract gap/conflict → stop, write it under "Contract questions" in your REPORT, set status in-review; do not redesign.
- Shell env (K6): `export HOME=/home/megastruktur; export PATH=$HOME/.npm-global/bin:$HOME/.local/bin:$HOME/.cargo/bin:$PATH; source evidence/env-probe/env.sh; export NDK_HOME=$ANDROID_HOME/ndk/27.3.13750724`. Probe every command before trusting it; never invent output.
- Scope: only paths in your allowlist. Out-of-scope problems → "Out-of-scope findings" in REPORT. No autofix formatters on files you do not own.
- Tests: add/keep unit tests for your module; a green unit suite never replaces the Real runtime testing table.
- Host `cargo build`/`tauri build` of the desktop app cannot link (webkit2gtk invisible). Use `scripts/linux-desktop.sh` once T01 is on your base; otherwise `cargo check` + declare the limit.
- Never run `tauri dev` / bind port 1420.
- Evidence: `evidence/sdk-v1/<task>/REPORT.md` + `raw/` (command outputs with exit codes). REPORT: per-scenario command/result, final commit SHA, out-of-scope findings, explicit line `READY FOR REVIEW at <sha>`.
- Commit everything (small logical commits OK); tree clean; then `orca-ide worktree set --worktree name:<your-worktree> --status in-review --comment "<summary>"` (probe exact CLI shape with `orca-ide worktree --help`). Do not merge, push, delete.
- Budget: ~35 min per attempt. If stuck > 20 min on one error, write findings to REPORT and hand off rather than loop.

## Stage checklist (coordinator-owned mirror in oks_TODO.md)
develop → runtime test-loop → independent review-loop → squash integration → post-merge smoke → evidence + cleanup
