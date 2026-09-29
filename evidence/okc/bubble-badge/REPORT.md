# REPORT okc-bubble-badge (campaign orbitkit-cutecare-v02, attempt 1)

Worktree: `okc-bubble-badge`, branch `megastruktur/okc-bubble-badge`, base `2f73d78752365c82ee277ece52cf47810dd72ddc`.

## Per-criterion results

| # | Criterion | Result | Named mutation-sensitive test | Evidence |
|---|---|---|---|---|
| 1 | `<Bubble text severity ttlMs onclick onexpire>`; expires after ttl (fake timers); hover pauses ttl; severity → CSS classes/tokens, no colour literals in TS | PASS | `Bubble component > pauses the ttl while hovered and resumes with the remainder on leave` — implementation mutated to `if (true) return;` in `onPointerEnter` → test failed (`raw/mutation-ac1-hover-pause.log`, vitest_exit=1) | `Bubble.test.ts` (expiry at exact ms boundary, single `onexpire` call, hover pause + resume with remainder, sticky without `ttlMs`, `text` change restarts TTL, severity classes `orbitkit-bubble--{info\|warning\|error}`, `role="alert"` only for error; colours only in `<style>` CSS custom properties) |
| 2 | Bubble exposes logical rect (callback/bindable) for `fitWindow` | PASS | `Bubble component > exposes its logical rect via onrectchange so fitWindow can cover it` — `measure()` publish suppressed → test failed (`raw/mutation-ac2-rect.log`, vitest_exit=1) | `Bubble.test.ts`: `onrectchange` delivers mapped `LogicalRect`; `rect` is also `$bindable` (`bind:rect`); re-measure on content change, no duplicate for identical rect; feeds both rects into real `fitWindow` and asserts union `{w,h,offset}`; rect cleared to `null` on expiry |
| 3 | `<Badge count>`: hidden at 0; 1..99 verbatim; "99+" above; aria-label with count | PASS | `Badge component > caps the display at max (default 99 → '99+') …` — cap removed (`label = String(effective)`) → test failed (`raw/mutation-ac3-badge-cap.log`, vitest_exit=1) | `Badge.test.ts`: hidden at 0/default; 1/42/99 verbatim; 100 & 150 → `99+` with aria-label `100`/`150` (raw count); custom `max`; ariaLabel override |
| 4 | `onBadge(handler)` / `setBadge(count)` round-trip via `orbitkit://badge` | PASS | `bridge > orbitkit://badge (bubble-badge) > round-trips setBadge(count) → orbitkit://badge → onBadge handler` — emit event renamed to `orbitkit://badges` → round-trip test AND emit-args test failed (`raw/mutation-ac4-roundtrip.log`, vitest_exit=1) | `bridge.test.ts`: `setBadge` → `plugin:event\|emit {event:"orbitkit://badge", payload:{count}}`; `onBadge` subscribes `orbitkit://badge`, delivers `{count:42}`, real unlisten; mocked-transport round trip (emit → matching listener → handler called with `{count:12}`); non-Tauri: no-op unlisten / silent resolve |
| 5 | All text via props (no built-in strings) | PASS | `Bubble component > renders exactly the prop text (no built-in strings)` — injected literal `<span>Bubble</span>` into markup → `container.textContent` equality failed (`raw/mutation-ac5-builtin-string.log`, vitest_exit=1) | `Bubble.test.ts` exact-equality assertion; Badge renders only the numeric/capped count (per AC3) and aria-label is the count; no other literal copy in either component |
| 6 | build/test/check green (+ Rust gate) | PASS | suites assert event/command names and class names verbatim; any drift fails | `raw/gate-build.log` exit=0; `raw/gate-check.log` exit=0; `raw/gate-test.log` orbitkit vitest 296/296 success (fresh verified run, `orbitkit_vitest_exit=0`); `raw/gate-rust.log` `OKC_RUST_GATE_OK` exit=0 |

New tests: 20 (Bubble 9, Badge 6, bridge 5) → 296 total, 276 baseline all still passing.

## Deliverables

- `packages/orbitkit/src/Bubble.svelte` (new): severity-typed notification bubble; TTL with hover pause/resume by deadline math (`Date.now()`), text change restarts TTL, expiry hides + clears rect + fires `onexpire` once; `onclick`; `role="status"` / `role="alert"` (error); bindable `rect` + `onrectchange` callback exposing window-local `LogicalRect` (measured on mount/content change/`ResizeObserver` where available, deduped); severity only switches CSS classes/tokens.
- `packages/orbitkit/src/Badge.svelte` (new): count badge; hidden at 0; display capped at `max` (default 99) with `+`; aria-label = raw count (overridable); optional `listen` prop subscribes `orbitkit://badge` via `onBadge`, "latest source wins" (a `count` prop change resets prior event counts).
- `packages/orbitkit/src/bridge.ts`: ONLY added `onBadge`, `setBadge`, `BadgePayload`/`BadgeCallback` types (plus `emit` added to the existing `@tauri-apps/api/event` import line — required by `setBadge`). `setBadge` is an emit helper per brief: contracts define the badge as event-only (no Rust `set_badge` command exists); emits `orbitkit://badge {count}` broadcast, no-op outside Tauri (mirrors the `on*` listener family).
- `packages/orbitkit/src/index.ts`: appended `Bubble`, `Badge` export lines only.
- Evidence: `raw/mutation-ac{1,2,3,4,5}-*.log`, `raw/gate-{build,check,test,rust}.log`.

## Scope deviations

- `packages/orbitkit/src/index.ts`: did NOT add `export type { BubbleSeverity } from "./Bubble.svelte"`. Plain `tsc --noEmit` (the package `check` script) resolves `.svelte` modules through a wildcard ambient shim exposing only a default export; a named type re-export fails with TS2614 (`src/index.ts(25,15)`, verified). `BubbleSeverity` remains exported from `Bubble.svelte`'s `<script module>` (present in the svelte-package d.ts for package consumers); call sites use string literals.
- `packages/orbitkit/src/bridge.test.ts`: tightened the round-trip mock so an emit redelivers only to a listener subscribed to the same event name (matching real transport). Without this the round-trip test passed even when the emit event was renamed — mutation evidence ac4 initially verified only via the emit-args test. Mock-fidelity fix is test-only; no Rust source touched (rust gate pre-dates it, still valid).

## Contract questions

None blocking. Notes: contracts specify only the `orbitkit://badge {count}` event (no badge command, no Badge/Bubble config fields), so both components are prop-driven with no `config.ts` surface — consistent with the allowlist. `setBadge` implemented as a JS emit helper per brief wording ("emit helpers"); park task (`okc_park.md`) can suppress bubbles and call `setBadge`/use `onBadge` without further contract.

## Out-of-scope findings

- `packages/orbitkit/.vitest/json/output.json` (untracked, gitignored path owned by the test wrapper) is reused across runs and can be stale; readers must pass an explicit `--outputFile` per run before trusting it. Hit repeatedly during mutation verification; all evidence logs above come from per-run unique files with `startTime` recorded.
- @testing-library/svelte `render` props are loosely typed (`Record<string, any>`): callback params need explicit annotations in tests under `strict` — cosmetic, no action.

## Gates

- `pnpm install --frozen-lockfile` exit=0
- `pnpm -r build` exit=0; `pnpm -r check` exit=0; `pnpm -r test` exit=0 (orbitkit: 296/296, verified fresh)
- `$OKC_RUST_GATE` → `OKC_RUST_GATE_OK`, exit=0 (no Rust changes on branch)
- `git status --porcelain` lists only allowlisted paths (+ `packages/orbitkit/.vitest/`, untracked, never committed)

READY FOR REVIEW at 7d2111932fa722817d57de29cae0a80174c472c9
