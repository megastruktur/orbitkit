# REPORT okc-menu (campaign orbitkit-cutecare-v02, attempt 1)

Base: `df298a9d1063042ba06b73096cc0bd3231820ec7` (contains merged K7 config schema).
Scope: only allowlisted files under `packages/orbitkit/src/` + `evidence/okc/menu/**`.
`packages/orbitkit/src/index.ts`: appended 4 own export lines only.

## Per-criterion results

**1. `layout:"arc-anchor"` centres the arc `headGap` px above `anchorRect`; symmetric for even/odd counts — PASS**
- `geometry.ts`: `resolveMenuOrigin(anchorRect, headGap)` → `{x: anchorRect.x + width/2, y: anchorRect.y − headGap}`; `resolveMenuAngles` treats `arc-anchor` as the top-centred arc (default span 180).
- `RadialMenu.svelte`: new `anchorRect` prop; container gets `transform: translate(origin.x px, origin.y px)` only when `layout === "arc-anchor"`.
- Mutation-sensitive test: `RadialMenu.test.ts` "centres the arc headGap above anchorRect…" — asserts `transform: translate(130px, 188px)` for anchor `{100,200,60×80}`, `headGap:12` (pre-change: no `anchorRect` prop, no transform → fails); plus mirror symmetry and centre-PAIR straddle for 6 items (`xs[2]+xs[3] ≈ 0`, `xs[2]<0<xs[3]`).
- Odd-count symmetry: `geometry.test.ts` "places 6 arc-anchor items symmetrically…" + 5-item component stagger test (centre index 2 at 0 ms).

**2. Per-item delay `stepMs·|i−centre|` open, reversed close; values exposed as CSS vars; 5- and 6-item tests — PASS**
- `menuAnimation.ts`: `getItemDelay/getTotalAnimationDuration/getItemAnimationStyle` take an optional `MenuStaggerSpec` (openMs/closeMs/stepMs). Open: `stepMs·|i−(n−1)/2|`; close: `stepMs·(maxDist−dist)` (edges first, centre last). Even counts centre on a pair (both pair members share min open delay 20 ms at step 40). Exposed as `--stagger-delay` / `--stagger-duration` custom properties on each item.
- Mutation-sensitive tests: `menuAnimation.test.ts` "K7 arc-anchor stagger" describe — 5 items `[80,40,0,40,80]` open / `[0,40,80,40,0]` close; 6 items `[100,60,20,20,60,100]` open / `[0,40,80,80,40,0]` close; totals 340/260 (n=5), 360/260 (n=6); custom `stepMs:10`; style strings contain `--stagger-delay`/`--stagger-duration` (pre-change: no spec param, index-linear 20 ms → fails). Component-level: `RadialMenu.test.ts` "stagger delays run centre→edges…(5 items, no arc block)" asserts rendered `animation-delay` and `getPropertyValue("--stagger-delay")` — also covers the coordinator note (no `arc` block present; TS-defaulted `headGap` not needed by this path).

**3. Items not clickable until open settles; closing wave finishes before unmount — PASS**
- sdk-v1 guard kept: clicks/hover ignored unless `animPhase === "open"`; `pointer-events: none` while animating.
- `finishItemAnimation` unifies animationend/transitionend: during closing, only the last-scheduled item (max close delay: centre for odd n, either pair member for even n) unmounts; timer fallback unchanged.
- Mutation-sensitive test: `RadialMenu.test.ts` "items are not clickable until the open wave settles; the closing wave finishes before unmount" — 5-item arc-anchor: click mid-wave → no `onselect`; after settle → select fires; on close, `animationEnd(items[0])` (edge, 0 ms) does NOT unmount, `animationEnd(items[2])` (centre, 80 ms) unmounts (pre-change: unmount checked `index === 0` → fails).
- Legacy close tests ("close DOM stays until animationend…", "bubbling animationend…") pass unmodified — legacy max-close item is still index 0.

**4. `{svg}` icons through K12 allowlist sanitizer, rendered as data-URL `<img>` — PASS**
- New `iconSanitize.ts`: `sanitizeMenuIconSvg` (DOMParser `image/svg+xml`; allowlist tags svg/g/path/circle/rect/line/polyline/polygon/ellipse; allowlist attrs d/viewBox/fill/cx/cy/r/x/y/width/height/points/transform/opacity + `stroke*` prefix; strips `on*`, `href`/`xlink:href`, removes unknown elements with their subtree — script, foreignObject, style, use, animate) and `sanitizeMenuIconToDataUrl` (reuses `mascot/svg.ts toSvgDataUrl`). Unsanitizable input → `null` → renders nothing.
- Mutation-sensitive tests: `iconSanitize.test.ts` (script/onload/onclick/onerror/href/xlink:href/foreignObject/style stripped; clean markup kept; malformed XML and non-svg root → null) and `RadialMenu.test.ts` "renders {svg} icons through the K12 sanitizer as data-URL images" (pre-change: no `{svg}` handling → fails).

**5. Label prop change updates aria-label/tooltip without reopening — PASS**
- `RadialMenu.test.ts` "updates aria-label and title when an item label prop changes without reopening": rerender with changed label → accessible name and `title` update, old name gone, same mounted `<div role="menu">` node (menu-node identity assertion is the mutation-sensitive part: fails on any reopen/remount mutation). Behaviour pre-existed (reactive `item.label` in `aria-label`/`title`); the test pins it.

**6. Existing orbit/arc layouts and keyboard nav unchanged; existing tests green — PASS**
- No existing test body modified — `RadialMenu.test.ts`/`menuAnimation.test.ts`/`geometry.test.ts` changes are import-line additions + appended describes only. Full suite: **200/200 pass** (baseline 168 + 32 new).
- Legacy timing (index-linear 20 ms, 220/180 durations) is preserved for orbit/arc by design (see Contract questions).

**7. build/test/check green — PASS**
- `pnpm -r build` EXIT 0; `pnpm -r test` EXIT 0 (200/200); `pnpm -r check` EXIT 0 (see `raw/gates.log`).
- `$OKC_RUST_GATE` EXIT 0, `OKC_RUST_GATE_OK` — no Rust changed (see `raw/rust_gate.log`).

## Contract questions
- **K7 stagger scope vs acceptance criterion 6.** Read literally, K7 makes centre→edges/260/180/40 the stagger behaviour generally, which would flip existing component pins ("stagger delays 0, 20, 40, … ms") that criterion 6 declares must stay green. `withDefaults` fills `stagger` for every layout, so "stagger present" cannot gate it. Resolution implemented: the K7 stagger math engages **only when `layout === "arc-anchor"`**; orbit/arc keep the legacy un-parameterized path (index-linear 20 ms, 220/180 ms). Schema/config untouched. Flagging in case the coordinator wants a contract clarification for later tasks.
- **Coordinator note (arc-anchor without `arc` block)** confirmed: the component never reads `arc` on this path except `arc?.headGap` (self-defaulted to `DEFAULT_ARC_HEAD_GAP=12`); test "…(5 items, no arc block)" covers it. `config.ts`/`config.rs` untouched.

## Scope deviations
- None. `git status` at commit lists exactly the allowlisted files + `evidence/okc/menu/**`.

## Out-of-scope findings
- `svelte-package` warns during build: "Avoid usage of `import.meta.env` in your code" — pre-existing (`RadialMenu.svelte` dev-validation, added in the K7 contracts commit), not touched here.

## Evidence
- `raw/gates.log` — build/test/check + Rust gate exit codes.
- `raw/vitest.log` — full vitest output (200/200).
- `raw/rust_gate.log` — `cargo test -p tauri-plugin-orbitkit --lib` + clippy `-D warnings` in docker, `OKC_RUST_GATE_OK`.

READY FOR REVIEW at 4314da2851901f3c7f30295426adcede9eb35ff7
