---
name: orbitkit-release
description: "How to cut an OrbitKit release: version bumps, lockfiles, gates (JS + containerized Rust), CHANGELOG, annotated tag, push, CI watch."
version: 1.0.0
author: Magos Logis
metadata:
  hermes:
    tags: [orbitkit, release, changelog, tag, tauri, pnpm, cargo]
---

# OrbitKit Release Process

How to release OrbitKit (verified on v0.3.0, 2026-10-09). Repo:
`/home/megastruktur/projects/dev/orbitkit` (remote: `git@github.com:megastruktur/orbitkit.git`).

## 0. What a release IS here

- A release = a `chore(release)` commit + an **annotated git tag** `vX.Y.Z`, pushed to `origin`.
- There is **no npm publish** (`orbitkit` root is `private`, `@orbitkit/ui` is consumed via git URL /
  workspace; npm registry returns 404), **no crates.io publish**, and **no GitHub Release object**
  (releases API list is empty; tags are the deliverable).
- Versioning: `@orbitkit/ui` (packages/orbitkit/package.json) and `tauri-plugin-orbitkit`
  (crates/tauri-plugin-orbitkit/Cargo.toml) are bumped **in lockstep**. `tauri-plugin-orbitkit-recorder`
  stays at its own version (internal/optional). Semver: features → minor bump (0.2.x → 0.3.0).

## 1. Sandbox PATH gotchas (this host)

The Hermes sandbox has a stubbed `/usr` and a profile-local toolchain. Export once per session:

```bash
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$HOME/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin:$PATH"
```

- `pnpm` is **not** on PATH: `corepack enable --install-directory ~/.local/bin` (once) → `pnpm` works;
  plain `corepack pnpm ...` fails because package scripts spawn `pnpm` recursively.
- `cargo` lives in the rustup toolchain dir above. **Rust cannot link on the host** (no `cc`, no
  `crt1.o`) — see §3.
- `gh` CLI is not installed; use GitHub REST `api.github.com` (public repo, no auth needed for
  status checks) or `ssh -T git@github.com` for push auth.

## 2. JS gates (host, fast)

```bash
pnpm run test && pnpm run check && pnpm run build
```

Baseline as of 0.3.0: 428 vitest unit tests (packages/orbitkit) + 33 starter `node --test`
integration tests; `tsc --noEmit`; svelte-package + vite build. Known noise, not failures:
svelte `import.meta.env` packaging warning, vite `INEFFECTIVE_DYNAMIC_IMPORT`, a
`non_reactive_update` warning in MascotView.svelte.

## 3. Rust gate (container, required)

Host cannot link Rust. Use the Debian build container (image exists: `orbitkit-linux-desktop:1`):

```bash
scripts/linux-desktop.sh exec examples/starter -- cargo test -p tauri-plugin-orbitkit
```

Baseline as of 0.3.0: 68 unit (lib.rs) + 13 integration (desktop_windows.rs) + 0 doc-tests, all green.
Build only (full Tauri app): `scripts/linux-desktop.sh build examples/starter` — much slower, not
required for a release; unit tests are the gate.

## 4. Version bumps + lockfiles

1. `packages/orbitkit/package.json` → new version.
2. `crates/tauri-plugin-orbitkit/Cargo.toml` → same version.
3. `cargo update -p tauri-plugin-orbitkit` — updates `Cargo.lock` **without compiling** (works
   despite the missing linker; compiles nothing).
4. `pnpm install --lockfile-only` — no-op for `workspace:*` deps but confirms the lockfile is
   consistent (`✓ Lockfile passes supply-chain policies`).

## 5. CHANGELOG

Keep a Changelog format; the `[Unreleased]` section is accumulated by campaigns, but it is often
**incomplete — backfill from git history** before releasing:

```bash
git log --oneline v<PREV>..HEAD          # everything since the last tag
git tag -n99 v<PREV>                      # previous tag message = expected scope
git show <commit> --stat                  # per-commit detail for entries
```

On 0.3.0 the accumulated section was missing: right-click trigger (K14-era campaign okr), the K14
caption entry, theming tokens, Mascot children slot, prepare script, and the Windows `find.exe`
build fix. Cross-check campaign merges (`Merge campaign ...` commits) against the section, then
retitle `[Unreleased]` → `## [X.Y.Z] — YYYY-MM-DD` (UTC date) and leave `## [Unreleased]` with
"Nothing yet." Bump note: packages versioned in lockstep (entry under `### Changed`).

## 6. Commit, tag, push, verify

```bash
git add CHANGELOG.md Cargo.lock crates/tauri-plugin-orbitkit/Cargo.toml packages/orbitkit/package.json
git commit -m "chore(release): X.Y.Z — <one-line highlights> ...

Release gates: pnpm test (N unit + M starter integration), pnpm check,
pnpm build — green; cargo test -p tauri-plugin-orbitkit (68 unit + 13
integration) — green in the linux-desktop container."

git tag -a vX.Y.Z -m "OrbitKit X.Y.Z — <highlights> ..."   # annotated, detailed; matches v0.2.0 style
git push origin main vX.Y.Z
```

Verify (external state, never assume):

```bash
git ls-remote --tags origin | grep vX.Y.Z        # tag + peeled commit on the remote
curl -s "https://api.github.com/repos/megastruktur/orbitkit/actions/runs?head_sha=<SHA>" \
  | python3 -c "import json,sys; [print(r['name'],r['status'],r.get('conclusion')) for r in json.load(sys.stdin)['workflow_runs']]"
```

CI (`ci.yml`) triggers on push to main + tags; 6 jobs (js/rust/linux/windows/macos/android) take
~10–20 min. Release is DONE only when the pushed run is green. Poll with a bounded background loop
(`for i in $(seq 1 30); do ...; sleep 45; done`, `notify=true`) rather than blocking.

## 7. Checklist (compressed)

- [ ] `git pull --ff-only` on main, tree clean
- [ ] JS gates green (host): test + check + build
- [ ] Rust gate green (container): `cargo test -p tauri-plugin-orbitkit`
- [ ] Versions bumped in both manifests; `Cargo.lock` updated; `pnpm-lock.yaml` consistent
- [ ] CHANGELOG `[Unreleased]` backfilled from `git log v<prev>..HEAD`, retitled with UTC date
- [ ] Release commit + annotated tag `vX.Y.Z` (detailed message) + push
- [ ] `git ls-remote` shows the tag; CI run on the release SHA is green
