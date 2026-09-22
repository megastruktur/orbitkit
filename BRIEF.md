# okf_scaffold-desktop

> Task brief for the OMP coding agent. Worktree display name: `okf-scaffold-desktop`.
> You are the only writer in this worktree. Record honest facts; probe before you
> trust any command; never invent command output.

## Goal

Minimal runnable OrbitKit shell skeleton: Tauri v2 + Svelte 5 + TypeScript with one
placeholder mascot and the C1 repo layout. This is the shared chassis for the whole
campaign (T03–T06 build on it). Desktop `tauri dev` is a smoke goal — if the Linux
WebKitGTK runtime is missing in your context, deliver code-complete with declared
limits instead of fighting system packages (see Runtime testing).

## Scope allowlist (explicit)

- `package.json`, `pnpm-lock.yaml` (or `package-lock.json` ONLY if pnpm is unavailable after probe — record which and why), `.gitignore` (append-only, do not remove existing entries), `index.html`
- `vite.config.ts`, `svelte.config.js`, `tsconfig.json`
- `src/**` (Svelte app: main window, placeholder mascot component)
- `src-tauri/**` (tauri.conf.json, Cargo.toml, capabilities/, src/main.rs, src/lib.rs, build.rs, icons/)
- `BRIEF.md` (this brief, overwrite in worktree root)
- `evidence/scaffold-desktop/REPORT.md` + raw outputs (committed)

Anything not listed is out of scope. No formatters with autofix; read-only lint only.

## Non-goals

- No Android anything (`tauri android init` is T03; do not create `src-tauri/gen/`)
- No radial menu geometry, no detached popups, no plugin work, no mic/overlay code
- No CI files, no signing config, no publishing

## Dependencies

- Requires: bootstrap commit `okf-c1` on `main` (integration lineage `okf-campaign`)
- Exclusive resources: `package.json`, lockfile, `src/`, `src-tauri/**` (disjoint from T01 — parallel-safe)
- Coordinate via coordinator only: pnpm/corepack enablement from T01 may land mid-task; if it lands, re-source and continue; if not, use the declared fallback

## Shared contracts (consume as-is; do not redesign)

- C1: layout `src/` (Svelte 5 + TS + Vite) + `src-tauri/`; app identifier `dev.orbitkit.app`; productName `orbitkit`
- Placeholder mascot: one static Svelte component `src/lib/Mascot.svelte` (no logic), used by `src/App.svelte`
- C2 is NOT in scope (no Kotlin plugin here) but your tauri.conf must not preclude it

## Acceptance criteria

1. Repo builds per contract: `pnpm install` (or declared fallback) succeeds; `src-tauri` compiles (`cargo check` VERIFIED output)
2. App skeleton complete: identifier/productName per C1; Mascot.svelte renders in the main window
3. Runtime smoke — EITHER `pnpm tauri dev` (or equivalent verified command) shows the window (screenshot/exit-code evidence, then terminate it), OR WebKitGTK is absent in your context: then `REPORT.md` states code-complete + `cargo check` green + the exact missing system library, and desktop runtime proof is explicitly deferred (declared limit, not a failure claim)
4. Tauri version pinned (exact version in Cargo.toml/tauri.conf recorded in REPORT.md)
5. Everything committed; tree clean; worktree status `in-review` with comment

## Real runtime testing (actionable)

| # | Scenario | Exact command / interaction | Expected observable outcome |
|---|---|---|---|
| 1 | Dependency install | verified package-manager command from your probe | lockfile created, no errors |
| 2 | Native compile | `cargo check` in src-tauri (or `cargo build`) | compiles; output excerpt recorded |
| 3 | Desktop runtime (best-effort per capability) | verified `tauri dev` variant | window visible (evidence) OR declared-limit report per criterion 3 |

Runtime environment: real host shell; record commit SHA with every result; a green
`cargo check` does NOT equal desktop runtime proof.

## Reporting and evidence

- Evidence slot: `evidence/scaffold-desktop/` (in-repo, COMMITTED — not under plans/; plans/ is gitignored by design; coordinator archives to `okf_evidence/` at campaign end)
- Report must include: commands/results per scenario, commit SHA, out-of-scope findings, explicit ready handoff statement when done
- When committed and tree clean: set worktree status `in-review` with a comment. Do not merge, push, or delete anything.

## Stage checklist (mirrored in campaign TODO)

- [ ] develop
- [ ] runtime test-loop
- [ ] independent review-loop
- [ ] squash integration / conflict handling
- [ ] post-merge runtime smoke (coordinator)
- [ ] evidence preserved + cleanup verified
