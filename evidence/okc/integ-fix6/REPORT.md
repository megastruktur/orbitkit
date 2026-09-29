# REPORT okc-integ-fix6 — final-review Minors before owner merge

Campaign: orbitkit-cutecare-v02, attempt 1. Base: `b7ba24be727bba00a373cb121e241c53462f284c` (campaign tip).
Scope: exactly the 4 real Minor findings; findings 4 & 6 are documented known limitations and were not touched.

**READY FOR REVIEW at `6738fb8`** (code tip; this REPORT ships in the evidence commit that is `6738fb8`'s direct child — see the handoff comment for the exact tip SHA)

## 1. Tarball ships test file — `packages/orbitkit/package.json`

- **What**: `build` used `rm -f dist/*.test.*` (top-level only), so `dist/mascot/sheets.test.js` (imports `vitest`) shipped in the npm tarball.
- **Fix**: build script line only → `svelte-package -i src -o dist && find dist -name '*.test.*' -delete` (recursive; GNU + BSD find compatible).
- **Proof**: `pnpm --filter @orbitkit/ui pack --pack-destination /tmp/okc-pack` → `tar -tzf | grep -c '\.test\.'` = **0** (`raw/pack-proof.log`).
- New tarball `orbitkit-ui-0.2.0.tgz` sha256:
  `0fdca5935132c42a797c213baf0bff78e0b0855f4551fa5520b104098e4d808e`
  (differs from the previous `582656f7…`, as expected).

## 2. park hands fractional px to `setPosition` — `packages/orbitkit/src/park.ts`

- **What**: Tauri `set_position` accepts only integer physical px; fractional coordinates make the move silently fail (same bug class as the integ-fix4 roam fix, still present in park).
  - `parkCornerPosition` returned `workArea.x + workArea.width - windowSize.width` etc. — fractional whenever `windowSize` is fractional (e.g. 95.5).
  - `doUnpark` restored `savedPosition` verbatim — fractional when the pre-park position was fractional.
- **Fix**: `parkCornerPosition` returns `Math.round`ed point (after K9 clamp); `doUnpark` rounds once and passes the same integer point to both `setPosition` and `roam.resume` (roam never re-emits the fractional position).
- **Red-first proof** (`raw/red-park-b7ba24b.log`): 3 new mutation-sensitive tests fail at base SHA in a scratch worktree at `b7ba24b` (`~/.cache/okc-fix6-red`, removed afterwards): `Number.isInteger` assertion errors on fractional `1824.5/984.5` (park) and `500.5/400.5` (unpark restore) + `parkCornerPosition` fractional-window-size unit case. Vitest exit 1, 3 failed / 18 passed.
- **Green**: worktree (fixed `park.ts`): `src/park.test.ts` 21/21 passed, exit 0. Full suite: 379/379 (baseline 376 + 3 new).

## 3. CHANGELOG `[0.2.0]` missing Breaking note — `CHANGELOG.md`

- **What**: `close_popup` arg shape changed id→label (K11) with no Breaking entry.
- **Fix**: `### Changed` entry: `close_popup` takes the full popup window **label** (`{label: string}`, e.g. `orbitkit-popup-notes[-<instanceKey>]`) instead of the popup `id`; `open_popup` takes `{id, params?, instanceKey?}`.

## 4. Stale K11 command docs

- **What**: `crates/tauri-plugin-orbitkit/README.md:91-92` and `docs/architecture/contracts.md:92` still documented `open_popup {id}` / `close_popup {id}`, "desktop only"; `list_popups` / `mascot_monitor` missing entirely.
- **Fix** (shapes exactly as `docs/api.md`):
  - both docs: `open_popup {id, params?, instanceKey?}` → label-based window `orbitkit-popup-{id}[-{instanceKey}]`, `orbitkit://popup-shown {label}`; `close_popup {label}` → `orbitkit://popup-closed {label}` (+ legacy Android `popup-close {id}`); added `list_popups` (`string[]`) and `mascot_monitor` (`{workArea, scaleFactor}`) rows.
  - Mobile support noted: `open_popup`/`close_popup` supported (in-app sheet); only `list_popups`/`mascot_monitor` return `unsupported` on mobile.
  - `contracts.md` desktop-label example aligned to `orbitkit-popup-<id>[-<instanceKey>]`.

## Gates (foreground; exit codes in `raw/`)

| Gate | Result |
|---|---|
| `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test && pnpm -r check` | exit 0 — vitest **379/379, 17 files** + starter node:test **30/30** (`raw/gate-js.log`) |
| `bash plans/orbitkit-cutecare-v02/okc_tools/rust_gate.sh` | exit 0 — `OKC_RUST_GATE_OK`, **67 passed** = baseline (`raw/gate-rust-starter.log`) |
| `bash plans/orbitkit-cutecare-v02/okc_tools/starter_gate.sh` | exit 0 — `OKC_STARTER_GATE_OK` |
| `pnpm --filter @orbitkit/ui pack` tarball test-file count | **0** (`raw/pack-proof.log`) |

## Red log

- `raw/red-park-b7ba24b.log` — base-SHA run (scratch git worktree at `b7ba24b`, outside this worktree), 3 failed / 18 passed, exit 1.

## Out-of-scope findings

- None blocking. (Note: `pnpm pack` does not re-run `build`/prepack; the tarball proof packs the `dist/` produced by the gate's `pnpm -r build`, which is also what CI/publish would ship.)
- Findings 4 & 6 (known limitations) intentionally untouched per brief.

## Commits (this attempt)

1. `36d1404` red tests — park integer-px
2. `85d077e` park Math.round (corner target + restored position)
3. `273eb0e` build: recursive test-file removal
4. `6738fb8` docs — K11 label-based popup shapes + 0.2.0 Breaking note

READY FOR REVIEW at `6738fb8` (evidence commit = its direct child)

---

## Round 2 — FAIL item fixed

Review of `d96d48a49ee6f765cfa91c72e6231853529730d2` passed 5 of 6 items; docs item failed. Fixes (commit `7a2b245`):

- **F1 (Major) `CHANGELOG.md` Breaking line** now states all three verified facts:
  1. `close_popup` takes the window `label` returned by `open_popup` / `listPopups` (0.1.0 took the popup `id`);
  2. on desktop a bare popup id returns `not_found` (`desktop.rs:414-419` rejects a value without `POPUP_LABEL_PREFIX`);
  3. the Android arm still accepts a bare id (it adds the prefix) (`mobile.rs:134-139`).
  `crates/tauri-plugin-orbitkit/README.md` `close_popup` row additionally notes the desktop bare-id → `not_found` behavior.
- **F2 (Minor) `packages/orbitkit/src/park.ts` comment** no longer claims the rounded point stays inside the area; it now states that rounding after the K9 clamp can overshoot the work-area edge by at most 0.5 px. Comment only — no code change.

Untouched per brief: find build line, dist/test-fixtures, all r1-verified items.

### Round-2 gates (foreground; logs in `raw/`)

| Gate | Result |
|---|---|
| `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test && pnpm -r check` | exit 0 — vitest **379/379, 17 files** + starter node:test **30/30** (`raw/gate-js-r2.log`) |
| `rust_gate.sh` | exit 0 — `OKC_RUST_GATE_OK`, **67 passed** (`raw/gate-rust-starter-r2.log`; cached compile — no Rust-side changes in r2) |
| `starter_gate.sh` | exit 0 — `OKC_STARTER_GATE_OK` (starter `cargo check` + clippy) |

READY FOR REVIEW at `7a2b245` (this REPORT's evidence commit is its direct child — exact tip in the handoff comment)

---

## Round 3 — coordinator wording error corrected

Review of r2 (`b38307c2a4f150ddd407b24f1bb28e1d6d7e7160`) = PASS; the round-2 CHANGELOG wording (coordinator-authored) was factually wrong. Fix (commit below):

- **F1 `CHANGELOG.md:33`** — `open_popup` returns `()` (verified `commands.rs:43`, `desktop.rs:319`, `bridge.ts:158 Promise<void>`); it does not return a label. The label source is now stated as: the window `label` (K11 `orbitkit-popup-{id}` or `orbitkit-popup-{id}-{instanceKey}`, as reported by `listPopups` and the `orbitkit://popup-shown {label}` event). Format verified against `popup_label()` (`lib.rs:50-61`). Rest of the Breaking line unchanged (0.1.0 took the popup id; desktop bare id → `not_found`; Android accepts a bare id). The README `close_popup` row never repeated the wrong claim — no change there.
- **F2 `REPORT.md`** — starter's 30 node:test tests are not part of the 379 vitest tests; both round-1 and round-2 gate tables now report "vitest 379/379 + starter node:test 30/30".

### Round-3 gate (foreground; log in `raw/`)

| Gate | Result |
|---|---|
| `pnpm -r build && pnpm -r test && pnpm -r check` | exit 0 — vitest **379/379** + starter node:test **30/30** (`raw/gate-js-r3.log`) |

READY FOR REVIEW at `4aba567` (evidence commit = its direct child — exact tip in the handoff comment)
