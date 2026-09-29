# REPORT — okc-contracts (campaign orbitkit-cutecare-v02, attempt 1)

Base: `098f969a0b49f9370da904f3fb92452c74d17da8` · Branch: `megastruktur/okc-contracts`

Code commits (in order):
- `7fe9e1c` — TS K7–K13 schema (config.ts) + RadialMenu dev validateConfig (K7) + AC5 component fix
- `e41a730` — TS contract tests (AC2 regex, AC3 compat, AC4 fixture, K7 withDefaults/validation)
- `0ca23cf` — Rust serde mirror + tests, versions 0.2.0-dev, literal completions (see Out-of-scope)

`evidence/` and this REPORT land in a docs-only commit on top; all gates were run at `0ca23cf`.

## Per-criterion results

### AC1 — K7 types + withDefaults + validateConfig (TS) / serde mirror (Rust) — DONE
- TS `packages/orbitkit/src/config.ts`: `MascotKind` + `"sheets"`, `MascotSheetDef`,
  `MascotAnchor`, `MascotPoolState`, `MascotStateDefinition` union, mascot `sheets/scale/anchor/faceByVelocity`;
  `MenuItem.icon: string | { svg: string }` (`MenuItemIconSvg`); `MenuLayout + "arc-anchor"`;
  `MenuArcConfig.headGap`; `MenuStaggerConfig`; `MascotWindowConfig label/url/passthrough/roam/fitContent`;
  `MascotRoamConfig` + corner union; `PopupConfig anchor/decorations/transparent/skipTaskbar/minWidth/minHeight`;
  `AppConfig.allowedOrigins` (K11). Exported frozen defaults: `DEFAULT_MASCOT_SCALE=1`,
  `DEFAULT_MASCOT_ANCHOR="bottom-center"`, `DEFAULT_FACE_BY_VELOCITY=false`, `DEFAULT_ARC_HEAD_GAP=12`,
  `DEFAULT_STAGGER={260,180,40}`, `DEFAULT_MASCOT_WINDOW_LABEL="orbitkit-mascot"`,
  `DEFAULT_MASCOT_WINDOW_URL="index.html?orbitkit=mascot"`, `DEFAULT_PASSTHROUGH=false`,
  `DEFAULT_FIT_CONTENT=false`, `DEFAULT_POPUP_ANCHOR="none"`.
  `withDefaults` fills all of the above (mascot scale/anchor/faceByVelocity always; stagger always;
  arc `{headGap:12}` when arc exists or layout is `arc`; mascotWindow label/url/passthrough/fitContent when
  the section exists; popup `anchor:"none"`; `app.allowedOrigins` copied).
  `validateConfig` covers every new field (sheets required for kind=sheets + per-sheet fields, scale
  integer ≥1, anchor enum, pool non-empty string arrays, priority/ttlMs, headGap ≥0, stagger ≥0,
  icon union, layout arc-anchor, roam positive dims + corner enum, popup fields, app.allowedOrigins).
- Rust `crates/tauri-plugin-orbitkit/src/config.rs`: mirrored structs `#[serde(rename_all = "camelCase")]`,
  same defaults via `serde(default)`/default fns (`MascotKind::Sheets`, `MascotAnchor` kebab-case,
  `MascotPoolState`, `MascotSheetDef`, `MenuItemIcon` untagged Text|Svg, `MenuStaggerConfig`,
  `MascotRoamConfig(+Corner)`, `PopupAnchor`, `AppConfig`); `MascotConfig::Default` updated.
- Re-exports: `lib.rs` extends `pub use config::{...}` (allowlisted); `index.ts` already `export *`.
- Mutation-sensitive tests: `config.test.ts` "fills sheets defaults on mascot" (fails pre-change: no
  scale/anchor/faceByVelocity), "fills mascotWindow and popup defaults", `validateConfig K7 additions`
  rejects each invalid shape; Rust `test_k7_defaults_applied_on_deserialize`,
  `test_k7_validate_rejects_invalid`.

### AC2 — id regex TS + Rust — DONE
- `MENU_ITEM_ID_REGEX = /^[a-z0-9][a-z0-9_.:-]{0,63}$/` (TS, config.ts) and
  `MenuItem::is_valid_id` (Rust, same rule, 1..=64 chars, same charset). TS validateConfig error
  message updated to the K7 pattern; Rust `MenuConfig::validate` now enforces item ids too.
- Required cases tested BOTH sides: `chat.new` ✓, `page.open:settings` ✓, `.x` ✗, `A` ✗, 65-char ✗
  (plus 64-char ✓, 33-char ✓ — old Rust rule capped at 32).
- Mutation-sensitive: `describe("MENU_ITEM_ID_REGEX (K7/AC2)")` in config.test.ts (fails pre-change:
  old regex `[a-z0-9_-]{0,31}` rejects dot/colon and accepts only ≤32); Rust
  `test_menu_item_id_validation`, `test_k7_validate_rejects_invalid`.

### AC3 — 0.1.0 starter config compat — DONE
- TS: `config.test.ts` "compat: 0.1.0 starter config (AC3)" imports
  `examples/starter/src/orbitkit.config.json` (same file, unmodified) — `validateConfig` ok, and
  `validateConfig(withDefaults(...))` ok.
- Rust: `test_starter_config_compat_k7` `include_str!`s the same file — deserializes, `validate()` ok,
  asserts K7 defaults materialize (scale=1, anchor=bottom-center, stagger 260/180/40, label/url).
- Mutation-sensitive: pre-change TS validator/withDefaults is fine on starter too; the K7-asserting
  Rust test fails pre-change (structs lack the fields), proving the mirror is exercised.

### AC4 — full K7 fixture round-trip — DONE
- `packages/orbitkit/src/test-fixtures/k7-full.json`: sheets mascot (2 sheets, pools, priority, ttlMs,
  scale 2, anchor center, faceByVelocity), arc-anchor + headGap 16 + stagger 200/120/30, icon union
  (svg object + data-URL string), ids `chat.new` / `page.open:settings`, mascotWindow
  label/url/passthrough/fitContent/roam(bottom-right,2.5), popup anchor=mascot + skipTaskbar + min sizes
  + `{ref}` placeholder url, `app.allowedOrigins`.
- TS: validates + field-by-field assertions ("parses every K7 field value").
- Rust: `test_k7_full_fixture_roundtrip` reads the SAME file via `include_str!`, asserts identical
  field values (every scalar listed above), then serializes and asserts camelCase keys + full
  deserialize equality (round-trip).
- Mutation-sensitive: field-by-field asserts fail on any drift between the two parsers.

### AC5 — baseline red test — DIAGNOSED: component regression at 098f969; fixed component
- Failure: `RadialMenu.test.ts > items not clickable while opening` — `onselect` fired on click during
  the opening animation.
- Root cause: commit `098f969` ("responsive click handling") replaced the pre-open guard
  `animPhase !== "open" && config.animation !== "none" && !checkReducedMotion()` with
  `animPhase === "closing"` in `handleItemClick`/`handleItemMouseEnter` (`git show 098f969` proves the
  removal). The template still renders `pointer-events: none` while opening — real browsers block the
  click via CSS, jsdom does not, so only the JS guard makes the contract testable. The test encodes the
  intended (pre-098f969) behaviour; the component regressed.
- Fix: restored the phase guard on both handlers (`if (disabled || animPhase !== "open") return;`).
  `animation:"none"` and reduced-motion paths are unaffected (they set `animPhase = "open"` immediately).
  `RadialMenu.test.ts` itself is UNCHANGED (no diff).
- Evidence: `raw/baseline-098f969-rerun.txt` (098f969 component + unchanged test → 1 failed, EXIT=1);
  `raw/after-fix.txt` (fixed component → passed, EXIT=0).
- Also in RadialMenu.svelte (explicitly allowlisted): K7 dev-mode `validateConfig` call
  (`import.meta.env.DEV`, console.error only, no throw).

### AC6 — gates — GREEN
- `pnpm -r build` EXIT=0 → `raw/pnpm-build.txt`
- `pnpm -r test` EXIT=0, 8 files / 168 tests passed (baseline was 147 pass + 1 fail) → `raw/pnpm-test.txt`
- `pnpm -r check` EXIT=0 → `raw/pnpm-check.txt`
- `$OKC_RUST_GATE` → `OKC_RUST_GATE_OK` (26 lib tests, clippy `-D warnings` clean) → `raw/rust-gate.txt`
- Versions: `packages/orbitkit/package.json` and `crates/tauri-plugin-orbitkit/Cargo.toml` → `0.2.0-dev`
  (root package.json NOT allowlisted — left at 0.1.0).

## Contract questions / allowlist tension (reviewer attention)
The allowlist permits `src/lib.rs` "(config re-exports only)" and omits `mobile.rs` /
`tests/desktop_windows.rs`, yet AC1 mandates new fields on `PopupConfig`, `MascotConfig`,
`MascotWindowConfig`, `MenuArcConfig` — Rust struct literals are exhaustive, so existing literals in
those files stopped compiling, and AC6 requires the gate green. Taken interpretation: mechanical,
behaviour-free literal completions are authorized collateral; no K7 field was redesigned:
- `lib.rs`: 3 test `PopupConfig` literals +6 `None` fields each (beyond re-exports only in `#[cfg(test)]`).
- `mobile.rs`: 1 test `MascotConfig` literal +4 fields (file otherwise untouched).
- `tests/desktop_windows.rs`: 1 `MascotWindowConfig` + 3 `PopupConfig` test literals completed.
- `Cargo.lock`: version ripple of the allowlisted Cargo.toml bump.
All four are visible in the `0ca23cf` diff; if the coordinator disagrees, only these hunks need
reversion — but then the gate cannot compile.

## Out-of-scope findings (not fixed)
- `packages/orbitkit/.vitest/json/` (vitest JSON reporter output) is not gitignored — regenerated by
  every `pnpm -r test`; suggest adding `.vitest/` to `.gitignore` (coordinator-owned file).
- `docs/configuration.md` / `README.md` still document the 0.1.0 schema; docs are outside the
  allowlist, so the K7 schema reference update is left to the coordinator.

## Evidence
`evidence/okc/contracts/raw/`: pnpm-build.txt, pnpm-test.txt, pnpm-check.txt, rust-gate.txt,
vitest-full-run.json (168/168), baseline-098f969-rerun.txt, after-fix.txt.

READY FOR REVIEW at 0ca23cf5143cafbf43599c29b5408a53457a7490 (branch tip adds this evidence/REPORT
docs-only commit).
