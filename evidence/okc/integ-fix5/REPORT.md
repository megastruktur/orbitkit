# REPORT okc-integ-fix5 — docs only

**Base:** `ed160793d542099ee640aa4a8f965b87d0bb6785` (campaign tip, release r2)
**Fix commit (review target):** `4dd2623dcc73fc3bb03f6a2ece5f7d4cb677e1f8` — `docs/api.md` + `CHANGELOG.md`, 2 files, +6/−2. The only commit after it adds this report under `evidence/okc/integ-fix5/`.

## Change 1 — `docs/api.md` §`setParked` (line 270)

Old text claimed parked mascots "stop roaming, polling, and passthrough, and re-show at a screen corner via `parkCornerPosition` on unpark" — none of that is `setParked`'s behaviour.

Source of truth:

- `packages/orbitkit/src/bridge.ts:457-466` — `setParked` **only** emits `orbitkit://park { parked }` to every listener (including the emitting webview); outside Tauri it resolves without emitting. No window move, no roam/passthrough control.
- `packages/orbitkit/src/park.ts:5-13` (module docs) + `park.ts:168-200` — corner move on `park()` (`parkCornerPosition` at :168, clamped via `clampToWorkArea`, forces `sleepState`), pre-park-position restore on `unpark()` (`:194-200`), both transitions emit `orbitkit://park { parked }`. That is `createPark`'s lifecycle.

New text: `setParked` documented as broadcast-only, explicitly stating it does not move the window or pause roam/passthrough, deferring that lifecycle to `createPark`. The "re-show screen corner via `parkCornerPosition` on unpark" claim is removed from `setParked`. Corner-move/restore behaviour moved into the `createPark` bullet of §Roam & park (api.md:286). Event table row (api.md:433) already correct ("Park (do-not-disturb) state broadcast") — unchanged.

## Change 2 — `CHANGELOG.md` `[0.2.0]` → Added

Release r2 (`ed16079`) rewrote `[Unreleased]` → `[0.2.0]` but deleted three shipped feature entries instead of moving them. Verified via `git show --stat 03ac9af c50fb4a 45e0203` (2026-09-23/24) and `git show ed16079 -- CHANGELOG.md` (deleted lines). Restored as three bullets under `[0.2.0]` → Added, each name verified present in current source:

| Entry | Source check |
| --- | --- |
| `startMascotDrag` / `createDragGesture` | `packages/orbitkit/src/bridge.ts` (`startMascotDrag`), `packages/orbitkit/src/dragGesture.ts` (`createDragGesture`) |
| `menu.layout: "arc"`, `resolveMenuAngles`, `menu.animation` | `packages/orbitkit/src/config.ts:71` (`MenuLayout = "orbit" \| "arc" \| "arc-anchor"`), `config.ts:98,261` (`menu.animation`), `config.ts:249` + `packages/orbitkit/src/geometry.ts` (`resolveMenuAngles`) |
| Android `open_popup`/`close_popup` + `bringToFront` | `crates/tauri-plugin-orbitkit/src/mobile.rs:121` (`run_mobile_plugin("bringToFront", …)`), `lib.rs` `lookup_popup`/`popup_open_payload` |

No other entries invented; wording reconstructed from the deleted `[Unreleased]` text.

## Gates (foreground, full chain, exit 0)

- `pnpm install --frozen-lockfile` — ok
- `pnpm -r build` — ok (pre-existing warnings only: svelte-package `import.meta.env` note, `non_reactive_update` in `MascotView.svelte` — both on base)
- `pnpm -r test` — **orbitkit 17 files, 376/376 passed** (baseline 376); **starter node --test 30/30 passed** (baseline 30)
- `pnpm -r check` — ok (tsc --noEmit per package, exit 0)

Baseline match: 376 + 30 ✓

## Allowlist compliance

Changed files: `docs/api.md`, `CHANGELOG.md`, `evidence/okc/integ-fix5/REPORT.md` only. Tree clean after evidence commit.

## READY FOR REVIEW at `4dd2623dcc73fc3bb03f6a2ece5f7d4cb677e1f8`
