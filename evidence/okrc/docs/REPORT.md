# okrc-docs Report: `docs` (radial-caption campaign)

**Worktree**: `/home/megastruktur/orca/workspaces/orbitkit/okrc-docs`
**Branch**: `megastruktur/okrc-docs`
**Base commit**: `c49f084` (campaign tip, post-merge gate green — per task dependency)
**Scope**: document the `caption` menu field (hovered-item caption) in
`docs/api.md`, `docs/configuration.md`, `packages/orbitkit/README.md`.
No source changes; docs-only commit `docs(menu): K14 caption field`.

---

## 1. Changes

| File | Change |
|---|---|
| `docs/configuration.md:100` | New `menu.caption` row in §2.2 field table: type/`false` default, one `aria-hidden` `.orbitkit-caption` span, hover+focus with focus priority, disabled items never change it, empty when idle, cleared on close, `data-caption` + CSS `content: attr(data-caption)`, per-item `::after` tooltip suppression, pure-CSS arc positioning, `.orbitkit-caption` override hook, byte-identical DOM when off. |
| `docs/configuration.md:120` | Reconciled `menu.items[].label` row: label shows in `aria-label`/`title` and on hover/focus as the per-item `::after` tooltip by default, or in the single container caption when `menu.caption` is `true` (was: unconditionally "Displayed in tooltips"). |
| `docs/configuration.md:209` | `withDefaults` list: added `- menu.caption: false`. |
| `docs/configuration.md:238` | Validation guarantees: added rule 8 "`menu.caption`, when present, is a boolean." |
| `docs/api.md:64` | `<RadialMenu />` `config` prop row now names the optional `caption` flag. |
| `docs/api.md:71-87` | New "Hovered-item caption (`config.caption`)" note under the props table (all six behaviors in plain prose, no contract tags). |
| `docs/api.md:220` | §1.3 `withDefaults` default list now includes `caption: false`. |
| `packages/orbitkit/README.md:22` | `<RadialMenu />` feature bullet: optional hovered-item caption replacing per-item hover tooltips. |
| `packages/orbitkit/README.md:61-62` | Quick Example menu block sets `caption: true` (minimal usage snippet). |

Contract tags (K14/RT-1) intentionally absent from user-facing docs per coordinator note.

## 2. Cross-check: documented vs actual (merged source at `c49f084`)

| Documented claim | Doc location | Actual code / test | Match |
|---|---|---|---|
| `MenuConfig.caption?: boolean`, default `false`, absent ⇒ byte-identical DOM | configuration.md:100; api.md:87; api.md:220; configuration.md:209 | `config.ts:107-113` (doc comment says exactly this), `config.ts:289-290` (`caption: menuInput?.caption ?? false`), `RadialMenu.svelte:101` (`config.caption === true`), `RadialMenu.test.ts:1076-1082` (no caption element / no `data-caption` when absent) | ✅ |
| Exactly ONE additional child `<span class="orbitkit-caption" aria-hidden="true">`, excluded from role=menu content semantics | configuration.md:100; api.md:73-75 | `RadialMenu.svelte:489-498` (`{#if captionOn}` single span, `aria-hidden="true"`), comment `:490-492`; `RadialMenu.test.ts:1084-1095` ("exactly one") | ✅ |
| Text mirrors hovered (`pointerenter`) OR keyboard-focused (`focusin`) enabled item; focus wins over hover; empty when neither | configuration.md:100; api.md:75-78 | `RadialMenu.svelte:103-113` (`captionText` checks `captionFocusId` before `captionHoverId`, enabled items only), handlers `:124-148` (`pointerenter`/`focusin`); `RadialMenu.test.ts:1097-1131` | ✅ |
| Hovering a disabled item does not change the caption | configuration.md:100; api.md:78 | `RadialMenu.svelte:124-129` (early return on `disabled`); `RadialMenu.test.ts:1133-1142` | ✅ |
| Caption cleared when the menu closes | configuration.md:100; api.md:78-79 | `RadialMenu.svelte:249-252` (ids nulled on close); `RadialMenu.test.ts:1144-1155` | ✅ |
| Text via `data-caption` attribute + CSS `content: attr(data-caption)`; span stays empty | configuration.md:100; api.md:79-81 | `RadialMenu.svelte:496` (`data-caption={captionText}`), `:670-674` (`::after { content: attr(data-caption) }`) | ✅ |
| Per-item `::after` tooltips suppressed while caption is on | configuration.md:100; api.md:81-82; README.md:22; configuration.md:120 | `RadialMenu.svelte:686-691` (`.orbitkit-radial-menu[data-caption] .orbitkit-radial-item::after { content: none }`), container attr `:438` | ✅ |
| Positioning: inside container, bottom-centre for `arc.position: "top"`, top-centre for `"bottom"`, plain centred otherwise; pure CSS; never outside bounds | configuration.md:100; api.md:82-85 | `RadialMenu.svelte:116-122` (`captionArcClass`; `arc-anchor` → top), `:676-684` (`translate(-50%, 8px)` / `calc(-100% - 8px)`), base placement `:651-656`; `RadialMenu.test.ts:1157-1170` | ✅ |
| `.orbitkit-caption` consumer-overridable; dark-slate defaults matching item styling | configuration.md:100; api.md:85-86 | `RadialMenu.svelte:648-667` (`rgba(26,32,44,0.95)` / `#e2e8f0` / 12px / radius 6px / padding 3px 8px) | ✅ |
| Label shown via `aria-label`/`title` and on hover/focus; tooltip vs caption switch | configuration.md:120 | `RadialMenu.svelte:464-465` (`aria-label={item.label}`, `title={item.label}`), `:637-639` (`:hover::after`, `:focus-visible::after`), `:686-691` | ✅ |
| `caption` must be a boolean | configuration.md:238 | `config.ts:599-602` (`menu.caption: must be a boolean`); `config.test.ts:1023-1032` | ✅ |
| README snippet compiles against the real type | README.md:61-62 (`caption: true` inside `menu` block) | `MenuConfig.caption?: boolean` (`config.ts:113`); `caption: true` in a `menu` literal typechecks in `config.test.ts:1005-1011` (suite green); other snippet identifiers unchanged from the previously verified snippet | ✅ |

Raw grep of every `caption` occurrence across code, tests, and the three docs:
`raw/02-docs-cross-check.txt` (89 lines).

## 3. Contradiction sweep (acceptance criterion 3)

`grep -n "tooltip|aria-label|title"` over `docs/**` + `packages/orbitkit/README.md`
(research step): the only per-item tooltip claim was `configuration.md:119`
("Displayed in tooltips and accessibility labels") — reconciled at
`configuration.md:120`. `docs/architecture/contracts.md:48-60,152` documents the
frozen K2-A1 contract history and claims nothing about tooltips/captions; no
contradiction (caption absence in a historical contract excerpt is not a false
claim). No other tooltip/aria-label claims touch menu labels.

## 4. Gate

Exact commands from repo root (`okrc_COMMON.md`), node_modules present:

| Step | Result | Evidence |
|---|---|---|
| `pnpm -r build` | pass (`svelte-package` + `vite build` + starter OK) | `raw/01-pnpm-r-gate.txt` |
| `pnpm -r test` | pass — 17 files / 414 tests (orbitkit) + 33 node tests (starter) | `raw/01-pnpm-r-gate.txt` |
| `pnpm -r check` | pass (`tsc --noEmit` ×2) | `raw/01-pnpm-r-gate.txt` |
| Full chain exit code | `GATE_EXIT=0` | `raw/01-pnpm-r-gate.txt` (last line) |

Gate ran twice: once before this report (observed 0), once captured to
`raw/01-pnpm-r-gate.txt` (0) — identical result; docs are md-only, no source
touched (`git status --porcelain`: only the three allowlisted files).

## 5. Non-goals respected

No source/test/config changes; no CHANGELOG/version edits; no push/tags/rebase;
scope limited to `docs/api.md`, `docs/configuration.md`,
`packages/orbitkit/README.md`, `evidence/okrc/docs/**`.

## 6. Commit

Written and finalized BEFORE `git add` (order per BRIEF). Docs commit created
immediately after this file, as the child of `c49f084`; final SHA reported in the
task handoff line.
