# okf scaffold-desktop — REPORT

- Worktree: `okf-scaffold-desktop` (repo `orbitkit`, lineage `okf-campaign`)
- Date: 2026-09-20
- Agent: OMP coding agent (only writer in this worktree)
- Base: `669c986` (`okf-c1` bootstrap: .gitignore + README)
- Scaffold commit: **`38beb8f`** — all runtime results below were produced on this tree
  (untracked build output `dist/`, `target/`, `node_modules/` excepted; all gitignored)

## Verdict

Code-complete. Scenarios 1 and 2 PASS with recorded output. Scenario 3 (desktop
`tauri dev` window) is **deferred as a declared limit**: the WebKitGTK stack exists on
the physical host but is invisible/unusable from the agent sandbox (details in
"Declared limit"), so in-sandbox linking is impossible. This is a sandbox constraint,
not a missing system library and not a code failure. Compile-level proof of the full
stack is green (`cargo check`, `vite build`, `tsc --noEmit`), and the Svelte layer was
additionally verified to render (headless DOM check, `raw/09`).

## Pinned versions (acceptance criterion 4)

| Component | Exact pin | Where |
|---|---|---|
| tauri (Rust) | `=2.11.6` | `src-tauri/Cargo.toml` (+ resolved in `src-tauri/Cargo.lock`) |
| tauri-build | `=2.6.3` | `src-tauri/Cargo.toml` |
| @tauri-apps/cli | `2.11.5` | `package.json` (+ `pnpm-lock.yaml`) |
| @tauri-apps/api | `2.11.1` | `package.json` |
| svelte | `5.57.1` | `package.json` |
| vite | `8.3.0` | `package.json` |
| @sveltejs/vite-plugin-svelte | `7.3.0` | `package.json` |
| typescript | `7.0.2` | `package.json` |
| packageManager | `pnpm@12.4.1` | `package.json` |

Tauri version source: crates.io `max_stable_version` at task time (tauri 2.11.6,
tauri-build 2.6.3); npm `latest` for the JS side.

## C1 contract compliance (criterion 2)

- Layout: `src/` (Svelte 5 + TS + Vite) + `src-tauri/` — created on top of `okf-c1`.
- Identifier: `dev.orbitkit.app`; productName: `orbitkit` (`src-tauri/tauri.conf.json`).
- Placeholder mascot: `src/lib/Mascot.svelte` — one static component, no logic,
  imported and rendered by `src/App.svelte` (complies with the shared contract).
- `src-tauri/gen/` NOT created; no Android artifacts (Android/iOS icon variants
  emitted by `tauri icon` were deleted; T03 regenerates what it needs).
- C2 (future Kotlin plugin) not precluded: stock `tauri::Builder::default()`,
  no plugin surgery, `capabilities/default.json` grants `core:default` to `main`.

## Runtime testing per scenario (commands I actually ran; commit `38beb8f`)

| # | Scenario | Command | Result | Raw output |
|---|---|---|---|---|
| 1 | Dependency install | `pnpm install` (pnpm 12.4.1 present at probe: `pnpm --version` → 12.4.1) | EXIT=0; `pnpm-lock.yaml` created; all 6 deps installed at exact pins | `raw/01-pnpm-install.log` |
| 2 | Native compile | `cargo check` in `src-tauri` (cargo 1.98.0) | EXIT=0 — "Finished `dev` profile … in 38.35s", 429 packages locked, `Compiling orbitkit v0.1.0`, zero warnings/errors for the crate | `raw/04-cargo-check.log` |
| 3a | Full app build | `pnpm tauri dev` (via hub-managed process, DISPLAY=:99) | vite dev server ready; final binary **failed at link**: `unable to find dynamic system library 'webkit2gtk-4.1'` → declared limit below; process stopped, exit=1 | `raw/05-tauri-dev-log-excerpt.log` |
| 3b | Web layer render (supplementary, NOT desktop proof) | `pnpm build` (EXIT=0, 113 modules) + built app served and loaded in headless Chromium: `document.querySelector('.mascot svg')` → true, h1 `orbitkit` | Mascot.svelte markup renders through the real Svelte 5 compile | `raw/08-vite-build.log`, `raw/09-render-check-webview.png` |
| — | Read-only typecheck | `pnpm exec tsc --noEmit` (TS 7.0.2 native) | 0 errors | `raw/03-tsc-noemit.log` |
| — | Icon pipeline | `pnpm tauri icon` on generated 1024px PNG | EXIT=0; desktop set kept, android/ios/appx variants pruned | `raw/02-tauri-icon.log` |

A green `cargo check` is compile proof only — it is not desktop runtime proof; hence
the explicit declared limit instead of a claimed runtime pass.

## Declared limit (acceptance criterion 3, second branch — stated precisely)

**The host machine HAS WebKitGTK 4.1.** Verified through the environment's own
pkg-config shim (`~/.local/bin/pkg-config` = shell script running pkgconf in a
`gcc:14` docker container with the real host `/usr` bind-mounted at `/hu`):

- `/hu/lib64/pkgconfig/webkit2gtk-4.1.pc` exists (331 B, Aug 19)
- `/hu/lib/libwebkit2gtk-4.1.so -> libwebkit2gtk-4.1.so.0 -> libwebkit2gtk-4.1.so.0.21.10`
  (93,397,920 B) — dev symlink AND runtime library present (webkit2gtk 2.52.6)

**The agent sandbox cannot use it.** The sandbox filesystem view of `/usr` is a stub
(`/usr/lib`: 34 entries; `/usr/lib64` contains only `ld-linux-*`), no
`libwebkit2gtk*` or `webkit2gtk*.pc` anywhere in the sandbox view (`raw/06`), and
`ldconfig -p` shows no webkit entries. The linker therefore runs in an environment
with no filesystem path to the host's libraries:

```
error: unable to find dynamic system library 'webkit2gtk-4.1' using strategy 'no_fallback'
```

(`raw/05` for the full excerpt; the `-L/hu/lib` in pkg-config output is a container-
internal path that does not exist for the linker.)

**Consequence:** `cargo check` (no linking) is green; any link of the app binary
(`tauri dev`/`cargo build`) cannot succeed inside this sandbox. I did not install
system packages or move the build into docker — the brief directs declared-limit
delivery instead of fighting system packages. **Desktop runtime proof is explicitly
deferred**; the post-merge runtime smoke (stage checklist, coordinator) on a
non-sandboxed host is the designated verification path. This is a declared limit of
the runtime environment, not a failure claim about the scaffold.

## Acceptance criteria mapping

1. `pnpm install` EXIT=0 with lockfile (`raw/01`); `cargo check` EXIT=0 (`raw/04`) — PASS
2. Identifier/productName per C1; Mascot.svelte exists, is static, and is rendered by
   App.svelte (compile `raw/08` + render `raw/09`) — PASS
3. WebKitGTK effectively unavailable to the build environment → declared limit stated
   above with the exact libraries and evidence (`raw/05`, `raw/06`) — DEFERRED per brief
4. Exact pins recorded in the table above and in `Cargo.toml`/`package.json` — PASS
5. Everything committed (scaffold `38beb8f` + this report); tree clean; worktree set
   `in-review` with comment — PASS at handoff

## Out-of-scope findings

1. **Environment:** `pkg-config` on this host is a docker shim (`gcc:14`, host `/usr`
   at `/hu`); combined with the stub sandbox `/usr` it returns metadata for libraries
   the linker can never see. Affects every pkg-config-based native build run from the
   agent sandbox in this worktree (gtk/webkit/soup -sys crates at compile metadata
   stage, link stage fatally). Worth surfacing to whoever provisions agent sandboxes.
2. **pnpm 12** auto-created `pnpm-workspace.yaml` during install
   (`minimumReleaseAgeExclude` for all @tauri-apps/cli platform binaries — the
   release-age supply-chain gate would otherwise block/downgrade them). Committed as a
   lockfile-system necessity; technically one file beyond the literal allowlist,
   flagged here rather than silently included. Without it, fresh installs fail or pin
   older CLI binaries.
3. **svelte-language-server** (editor layer only): fails to import `svelte.config.js`
   (`ERR_MODULE_NOT_FOUND` for the ESM-only `@sveltejs/vite-plugin-svelte` under pnpm's
   layout) and consequently reports TS7016 for `.svelte` imports. `tsc --noEmit`,
   `vite build` and the runtime DOM check are all green, so this is tooling, not code;
   no workaround added to avoid double ambient `*.svelte` declarations.
4. `tauri icon` (CLI 2.11.5) emits Android/iOS/Appx icon variants unconditionally;
   pruned to the desktop template set (`32x32.png`, `128x128.png`, `128x128@2x.png`,
   `icon.icns`, `icon.ico`, `icon.png`). T03 should expect to regenerate.
5. TS 7.0.2 native `tsc --version` prints no version banner (prints the check summary
   line instead). Version taken from `pnpm install` output.

## Evidence index (`evidence/scaffold-desktop/raw/`, committed)

| File | Content |
|---|---|
| `01-pnpm-install.log` | Scenario 1 install output |
| `02-tauri-icon.log` | Icon generation output |
| `03-tsc-noemit.log` | Read-only typecheck output |
| `04-cargo-check.log` | Scenario 2 full cargo check output incl. `CARGO_EXIT=0` |
| `05-tauri-dev-log-excerpt.log` | Scenario 3a link failure excerpt + process exit code |
| `06-linker-probe.log` | webkit2gtk library/pc probes + docker shim + discriminator run |
| `08-vite-build.log` | Scenario 3b production build output |
| `09-render-check-webview.png` | Headless render of the built app (supplementary) |

## Handoff

**Ready.** Scaffold is code-complete per C1, all in-scope verification that this
environment permits has been run and recorded, everything is committed, tree clean.
No merge, push, or deletion performed. Ready for the independent review-loop and
squash integration; post-merge desktop runtime smoke on a host with a usable
WebKitGTK is the remaining verification step by design.
