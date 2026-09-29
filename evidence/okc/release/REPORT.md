# REPORT — okc-release (campaign orbitkit-cutecare-v02, attempt 1)

Worktree: `/home/megastruktur/orca/workspaces/orbitkit/okc-release`, branch `megastruktur/okc-release`, base `5c2a4db` (campaign tip).

## Per-criterion results

### AC1 — Starter still covers every okc_SMOKE.md B1+B2 item
PASS. Config verified programmatically: `mascot.kind: "sheets"` (3 sheets: idle/alert/sleep with state pools, alert ttlMs), `menu.layout: "arc-anchor"` + stagger + headGap 12, 9 items, `passthrough: true`, `fitContent: true`, roam zone `bottom-left`, popups `notes` (anchor mascot) + `settings` (anchor center). Handlers verified in `MascotView.svelte` (bubble/badge/park + passthrough hit regions + roam drag binding) and `src-tauri/src/lib.rs` (notes instanceKey `note-N`, settings singleton, timer sleep 5 s, alert ttl 8 s). Starter tests `tests/demo-b1.test.mjs`, `demo-b2.test.mjs`, `windowFit.test.mjs`: 30 pass (raw/e_test.log).

### AC2 — Menu labels + README explain each demo action
PASS. `examples/starter/README.md` now documents all 9 actions (Notes/Timer/Bubble/Alert/Badge +1/Settings/About/Park/Quit) with their exact backend calls (`open_popup("notes", None, Some("note-N"))` vs singleton settings) plus a "Demo actions (B1 + B2 smoke coverage)" table mapping every item to its smoke item, and the always-on roam/drag/passthrough/keyboard behaviour. Config labels are descriptive (tooltips render them).

### AC3 — docs/api.md + docs/configuration.md document every K7–K13 field/command/event
**R1 verdict: FAIL** (docs vs source drift). **R2 verdict: PASS** — every finding fixed against source and re-verified by a recorded grep:
- Machine-generated cross-check in `raw/ac3-crosscheck.txt`: **all 127 exports** of `packages/orbitkit/src/index.ts` (MISSING=0), **all 11 `build.rs` COMMANDS**, and **all 8 event names** mapped to the `docs/api.md` line documenting them; plus a `grep -rn unsupported docs/` proof that `unsupported` claims co-locate only with `list_popups`/`mascot_monitor`/mobile arms or generic error-code mentions.
- R1 MAJOR fixes: mobile arms corrected — `open_popup`/`close_popup` are **supported on Android** (sheet `bringToFront` + `orbitkit://popup-shown`/`popup-closed` + legacy events, `mobile.rs:106-149`); only `list_popups` (`mobile.rs:153`) and `mascot_monitor` (`mobile.rs:178`) are `unsupported` (K13 section, openPopup/closePopup sentences, error table, plus `docs/platforms/android.md:174`, `docs/architecture.md:56`); `<Mascot />` gained `sheet`/`velocityX` and `<RadialMenu />` gained `anchorRect`/`label` props; exact signatures copied from source (`createMachine(states, options?)`, `sheetGeometry(sheet, scale?, anchor?)`, `parkCornerPosition(corner, workArea, windowSize)`); stale 0.1.0 popup API fixed in `getting-started.md` and `desktop.md`.
- R1 MINOR fixes: configuration.md validation guarantee 1 includes `"sheets"`, top-level `app?: AppConfig` in the structure snippet, full K7 `withDefaults` list (stagger/headGap/scale/anchor/faceByVelocity/label/url/passthrough/fitContent/popup anchor/animation); contract IDs aligned to okc_CONTRACTS.md (K12 = Menu & icons, K13 = Platform arms; park/badge carry no K number anywhere); CHANGELOG roam limitation uses the brief wording (very slow speeds, ~5 ticks ≈ 170 ms after out-of-zone drop), "fixed-size window growth" contradiction removed, stray `[Unreleased]` P2 section deleted so `[0.2.0]` is the top released entry; api.md §6 names every value export (incl. `DRAG_THRESHOLD`, `DEFAULT_DRAG_CLEAR_DELAY`, `DEFAULT_MASCOT_WINDOW_LABEL`, `DEFAULT_MASCOT_WINDOW_URL`) and groups all payload/callback types; label examples use the real scheme `orbitkit-popup-<id>-<instanceKey>` (e.g. `orbitkit-popup-notes-note-2`, per `popup_label`); root README Features refreshed for 0.2.0.
- Remaining K7–K13 coverage summary (unchanged from r1, verified r2): K7 sheets/states/arc-anchor/stagger/svg-icon/regex; K8 machine+roam API; K9 fitWindow/clampToWorkArea/mascot_monitor/fitContent; K10 passthrough; K11 popups end-to-end; K12 sanitize allowlist section; K13 platform-arms section.

### AC4 — All gates green
PASS (foreground runs; raw logs in `raw/`):
- `pnpm install --frozen-lockfile` exit 0
- `pnpm -r build` exit 0; `pnpm -r test` exit 0 — **376/376** + starter 30; `pnpm -r check` exit 0
- `bash plans/orbitkit-cutecare-v02/okc_tools/rust_gate.sh` exit 0 — **67 passed**, clippy `-D warnings` clean, `OKC_RUST_GATE_OK`
- `bash plans/orbitkit-cutecare-v02/okc_tools/starter_gate.sh` exit 0 — `OKC_STARTER_GATE_OK`
- `scripts/linux-desktop.sh build examples/starter` exit 0 — "Build successful", binary `examples/starter/src-tauri/target-linux/debug/starter`
- Lockfile constraint: `pnpm-lock.yaml` diff **empty**; `Cargo.lock` diff = exactly 1 line (`0.2.0-dev` → `0.2.0`).

### AC5 — `pnpm --filter @orbitkit/ui pack`
PASS. Produced `orbitkit-ui-0.2.0.tgz`, sha256:
`582656f72bdda449ddb611ddf222fbfca4b0682a916d3c8d28ab453521790b2b`
Tarball **not committed** (deleted after hashing; it is not gitignored, so removal keeps the tree clean).

## Carried findings folded in
- above-RIGHT vs contract above-LEFT: docs/api.md §1.2 note + configuration.md placement note + CHANGELOG Known limitations.
- Mixed-DPI Windows off-scale placement: configuration.md placement note + CHANGELOG.
- Coordinate-space switch (no unit source, **no unit test**): configuration.md §2.1 + CHANGELOG.
- Starter-only polish: roam-zone placement `PhysicalPosition` rounded (`Math.round`) in `MascotView.svelte:379` — committed separately.

## Out-of-scope findings
- `okc-rust-gate:1` docker image did not exist on this host; built it from `plans/orbitkit-cutecare-v02/okc_tools/rust-gate.Dockerfile` (tooling prerequisite, not a repo change).
- `orbitkit-ui-*.tgz` is not in any `.gitignore`; brief says "delete it keep gitignored" — the file is deleted (tree clean); adding a gitignore entry would exceed the allowlist, so none was added.
- (r1) `orbitkit-ui-*.tgz` was not gitignored; tarball deleted after hashing, no gitignore change (allowlist).
- (r1→r2, resolved) root README Features described the 0.1.0 surface; refreshed for 0.2.0 in round 2 (r2 brief item 8).

## Verification evidence
- R1: `raw/e_pnpm_install.log`, `raw/e_build.log`, `raw/e_test.log` (376/376 + 30 starter), `raw/e_check.log`, `raw/e_rust_gate.log` (67 passed, OKC_RUST_GATE_OK), `raw/e_starter_gate.log`, `raw/e_linux_build.log`, `raw/e_pack.log`, `raw/exit-codes.txt`.
- R2 (docs-only): `raw/ac3-crosscheck.txt` (command + output: 127 exports MISSING=0, 11 commands, 8 events → api.md lines; `unsupported` co-location grep), `raw/r2_build.log`, `raw/r2_test.log`, `raw/r2_check.log`, `raw/r2-exit-codes.txt` (build=0, test=0, check=0).

READY FOR REVIEW at acd13b504473abc0e81ddaefd13acc39f270e88b
