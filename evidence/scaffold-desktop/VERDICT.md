# Independent Review Verdict — okf-scaffold-desktop (T02)

Status: FINAL — PASS
Candidate Commit: dce4935d5aa2d380aad686d434367e0cbcfe61fd
Base Commit: 669c986a68bd9fae0bf0bdd46fb691c714fc1ca6
Reviewer: independent, read-only on code & repo files (only this VERDICT.md + gitignored
build output from verification commands were written)

## Checklist of acceptance criteria

- [x] 1. Repo builds per contract: `pnpm install` succeeds; `src-tauri` compiles (cargo check VERIFIED output).
- [x] 2. App skeleton complete: identifier `dev.orbitkit.app` / productName `orbitkit` per C1 contract; `src/lib/Mascot.svelte` renders in main window.
- [x] 3. Runtime smoke — second branch (WebKitGTK absent in reviewer context): REPORT.md states code-complete + cargo check green + exact missing system library (`webkit2gtk-4.1`), desktop runtime proof explicitly deferred as a declared sandbox constraint.
- [x] 4. Tauri version pinned: exact versions in Cargo.toml / package.json / Cargo.lock, recorded in REPORT.md.
- [x] 5. Scope adherence: files within allowlist (per the in-repo BRIEF.md contract; one disclosed, justified extra: `pnpm-workspace.yaml`). No Android files. Git tree clean.

## Independent verification performed (this review, on commit dce4935)

| Check | Command | Result |
|---|---|---|
| Git state | `git status`, `rev-parse HEAD` | HEAD = candidate `dce4935`; tree clean (before this review's own VERDICT.md write; only untracked file now is this file) |
| Install | `pnpm install --frozen-lockfile` | EXIT=0 — lockfile intact, all 6 deps at pins |
| Frontend build | `pnpm build` | EXIT=0, 113 modules; **identical asset hashes** to recorded `raw/08` (`index-DSDys2RL.css`, `index-ByP1rV-h.js`) — reproducible |
| Typecheck | `pnpm exec tsc --noEmit` | EXIT=0, "TypeScript: No errors found" |
| Native compile | `cargo check` in `src-tauri` (run twice, incl. after `touch src/main.rs src/lib.rs build.rs`) | EXIT=0 both times, "Finished `dev` profile" |
| Link discriminator | `cargo build` in `src-tauri` | EXIT=101 — **independently reproduced the exact declared-limit error**: `unable to find dynamic system library 'webkit2gtk-4.1' using strategy 'no_fallback'` + `unable to open library directory '/hu/lib': FileNotFound` — matches `raw/05` verbatim |
| Sandbox probes | `ls /usr/lib \| wc -l` → 33 (stub); `/usr/lib64` → only `ld-linux` symlink; `ldconfig` unavailable/no webkit entries; `pkg-config --modversion webkit2gtk-4.1` → `2.52.6` (docker shim, `gcc:14`, host `/usr` at `/hu`); `docker run -v /usr:/hu:ro gcc:14 ls /hu/lib/libwebkit2gtk-4.1.so.0.21.10` → exists | Confirms: host HAS WebKitGTK 2.52.6; sandbox linker has no filesystem path to it. `cargo check` green / link impossible — exactly as REPORT.md declares |
| Render check | built `dist/` served via `vite preview` :4173, headless browser DOM query | `.mascot svg` present (5 circles + ellipse), `h1` = `orbitkit`, `<title>` = `orbitkit` — Mascot.svelte renders through the real Svelte 5 production bundle (web-layer proof; desktop webview proof correctly deferred) |
| Config | `src-tauri/tauri.conf.json` | `identifier: "dev.orbitkit.app"`, `productName: "orbitkit"`, window `label: "main"`; `capabilities/default.json` grants `core:default` to `["main"]` — consistent |
| Pins | `Cargo.toml`, `Cargo.lock`, `package.json` | `tauri =2.11.6`, `tauri-build =2.6.3` (lock resolves same); npm exact pins `@tauri-apps/cli 2.11.5`, `@tauri-apps/api 2.11.1`, `svelte 5.57.1`, `vite 8.3.0`, `typescript 7.0.2`; all recorded in REPORT.md table |
| Scope | `git diff --name-only base..candidate` (34 files), `git ls-files \| grep -Ei "android|gen/|gradle|kotlin"` | No Android/gen artifacts; icons are desktop set only; all files in allowlist except `pnpm-workspace.yaml` (see findings) |

## Findings

### acceptance (1, minor, non-blocking — disclosed deviation)
- `pnpm-workspace.yaml` is beyond the literal allowlist (both the coordinator paraphrase and
  BRIEF.md line 17–22). It is auto-created by pnpm 12.4.1 during install (release-age supply-chain
  gate exclusion for `@tauri-apps/cli` platform binaries), is required for `pnpm install --frozen-lockfile`
  to succeed with the pinned CLI (verified: my frozen install passed with it present), and is
  **explicitly disclosed** in REPORT.md "Out-of-scope findings" #2 rather than silently included.
  Judged a lockfile-system necessity, not scope creep.
- Note on allowlist interpretation: the coordinator's criterion-5 paraphrase omits `index.html`
  and `BRIEF.md`, but the in-repo task brief (BRIEF.md lines 17, 21) explicitly allowlists both.
  No violation against the actual task contract.

### correctness (0)
- None. Source reviewed: `main.rs`/`lib.rs` (stock Tauri v2 `Builder::default()`, C2 not precluded),
  `App.svelte` imports and renders `Mascot.svelte` (static, no logic — per contract), `main.ts`
  uses Svelte 5 `mount()`, vite/svelte/ts configs match the Tauri v2 template conventions.
  Compile + typecheck + build + render all independently green.

### API (0)
- None. No plugin/custom-IPC surface added; capabilities minimal (`core:default` on `main` only).

### security (0)
- None for a scaffold. Informational: `app.security.csp: null` is the Tauri v2 template default;
  should be tightened when real content loads (later campaign tasks, not T02 scope).

### Observations (informational, no action required)
- Evidence log numbering skips `07` (05, 06, 08, 09 exist); REPORT index matches actual files. Cosmetic.
- REPORT's honesty is verified: its declared limit reproduces byte-for-byte under independent
  rerun (`cargo build` exit 101, same linker error), and its sandbox/host attribution matches
  direct probes (stub sandbox `/usr` vs. host WebKitGTK 2.52.6 visible only via docker shim).
- Worktree status `in-review` with comment (brief criterion 5) is claimed in REPORT.md handoff;
  lives outside the repo, not independently verified by this review.

## Final verdict

**PASS.**

All five acceptance criteria independently verified on candidate `dce4935`. Build contract
green (install/build/typecheck/cargo check, all reproduced by reviewer). C1 skeleton complete
and renders. Criterion 3 satisfied via the declared-limit branch, which the reviewer reproduced
exactly (link fails on `webkit2gtk-4.1` in this sandbox; host has the library; report says
"sandbox constraint", not a false "missing library" claim). Pins exact and recorded. Scope clean
modulo one disclosed, justified, verified-necessary extra file (`pnpm-workspace.yaml`).

Desktop runtime proof remains deferred by design → post-merge runtime smoke on a non-sandboxed
host (stage checklist) is the correct designated verifier.
