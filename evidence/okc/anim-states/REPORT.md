# okc-anim-states REPORT

Task: K8 mascot state machine (`mascotMachine.ts`) + `<Mascot>` kind=sheets state→sheet wiring.
Base: `743239f` (campaign tip, includes okc-contracts K7 schema + okc-anim-sheets).

## Per-criterion results

### C1 — K8 rules covered by tests (`mascotMachine.test.ts`, node env)

| Rule | Test (mutation-sensitive) |
|---|---|
| higher preempts | `a higher priority hint preempts the current state` |
| equal replaces | `an equal priority hint replaces the current state` |
| lower ignored while higher alive | `a lower priority hint is ignored while a higher one is alive` (also asserts post-expiry fallback is idle, not the ignored hint) |
| TTL expiry → highest sticky base (`idle` when present) | `ttl expiry falls back to idle (base) even after other sticky hints`; without idle: `without idle, ttl expiry falls back to the highest-priority sticky state` |

### C2 — injectable `rnd`, repick semantics

- `pool pick uses the injectable rnd (first and last pool entries)` — `rnd: () => 0` / `() => 0.999` pick first/last deterministically.
- `staying in a state does not repick the sheet on tick` — rnd call-count stays at 1 across 5 ticks (would fail if tick repicked).
- `re-entering the same state repicks from the pool` — seeded rnd yields pool[0] then pool[1] on re-entry.

### C3 — no Tauri import / node-loadable

Test `loads in node without window and without any Tauri import` runs in a `// @vitest-environment node` file: the static top-level import of `mascotMachine.ts` evaluating under node with `typeof window === "undefined"` proves the module has no window/DOM dependency and no Tauri import (a Tauri/window top-level dependency would throw at import).

### C4 — `<Mascot state="alert">` pool wiring + TTL fallback

Component test in `Mascot.test.ts` (sheets describe): `resolves the sheet via the K8 state machine and returns to idle after ttl` — `state="alert"` (pool `["tall"]`, ttlMs 600) renders `tall.png` + `data-state="alert"`; after `vi.advanceTimersByTime(700)` (fake timers) renders `small.png` (idle pool) + `data-state="idle"`.

### C5 — gates green

- `pnpm -r build` exit 0; `pnpm -r test` exit 0 — **201/201** (baseline 187 + 12 machine + 2 new component tests); `pnpm -r check` exit 0. Raw: `raw/build.log`, `raw/test.log`, `raw/*.exit`, `raw/check.log`.
- `$OKC_RUST_GATE` → `OKC_RUST_GATE_OK`, exit 0, 26 tests ok, clippy `-D warnings` clean. Raw: `raw/rust-gate.log`, `raw/rust-gate.exit`.

## Carry-over fixes (from anim-sheets review)

1. **(Major, vacuous test)** `freezes on frame 0 under reduced motion even as time passes`: `advanceTimersByTime(2000)` → `1500` (2000 ms = one full period of `small`: 4 frames @ 2 fps, wraps to frame 0 either way). Mutation verified by actually removing the guard (`if (isReducedMotion) return;` → `if (false) return;`) in `Mascot.svelte`: the freeze test **fails** with `AssertionError: expected '-96px' to be '0px'` and it is the only failing test in the file (others skipped by `-t` filter). Guard restored; full suite green afterwards.
2. **(Minor, new test)** `resets the frame to 0 when the sheet changes mid-animation`: after 1500 ms on `small` (frame 3, `-96px`), rerender with `sheet: "tall"` → `background-position-x: 0px` immediately.
3. **(Info, clock)** The frame clock still counts `setInterval` ticks (unchanged; not expanded per "do not expand scope"). The **state-machine** clock uses elapsed `Date.now()` rather than `performance.now()` deliberately: criterion 4 requires vitest fake timers, and vitest's `useFakeTimers` fakes `Date` by default but not `performance.now()`, so `Date.now()` is what makes TTL expiry fake-timer-testable.

## Contract questions (non-blocking; semantics chosen and documented in `mascotMachine.ts` header)

K8 fixes the four priority/expiry rules but is silent on three edges. Chosen behavior (pinned by tests):

- Re-hinting the **active** state is a no-op: no sheet repick and no TTL refresh (`re-hinting the active state is a no-op: no repick and no ttl refresh`). Refreshing TTL would change expiry semantics; no-repick is required by C2's "staying" rule.
- Preempted/replaced states are **removed, not stacked**: after a temporary state expires the machine falls back to its *base* (`idle` when defined), not to the previously preempted state (pinned by `ttl expiry falls back to idle (base) even after other sticky hints`).
- Base resolution when `idle` is absent: the highest-priority sticky state (ties: definition order); states without a usable `pool` are ignored everywhere (pinned by `ignores unknown states and states without a usable pool`).

## Scope deviations

- `Mascot.test.ts` gained the C4 wiring test beyond the two carry-over fixes. Justification: criterion 4 names component behavior (`<Mascot state="alert">` shows jump; TTL → idle pool); without it the Svelte wiring is untested and no mutation-sensitive test covers C4. Test-only change, inside the file already permitted for carry-over fixes.
- No other allowlist deviations. `git status` before commit lists only: `Mascot.svelte`, `Mascot.test.ts`, `index.ts` (own exports), new `mascotMachine.ts` / `mascotMachine.test.ts`, `evidence/okc/anim-states/**`. The disposable vitest JSON reporter dir `packages/orbitkit/.vitest/` is untracked and deleted before commit (never added).

## Out-of-scope findings (not fixed)

1. `pnpm -r check` is plain `tsc --noEmit`, which never typechecks `.svelte` files — a latent `config.states` → `createMachine` type mismatch (union `MascotStateDefinition` vs pool records) would not have been caught by the gate. Mitigated here by widening `createMachine` to accept `Record<string, MascotStateDefinition>` and duck-narrowing (`"pool" in def`) inside; consider adding `svelte-check` to the JS gate later.
2. `packages/orbitkit/.vitest/` (vitest JSON reporter output written on every `vitest run` in this harness) is not gitignored; the brief forbids committing it. A `.gitignore` entry would prevent accidental adds — left alone (gitignore is outside my allowlist).
3. `bridge.onMascotState` rethrows `normalizeError(err)` from its catch (no guard) — consumer code must attach `.catch`. Component handles it; other callers may not.

## Round 2 (coordinator review of 5dd79d7494c1 → FAIL; fixes)

### F1 (Major) — hint() compared priority against an already-dead TTL state

`hint(alert, 0)` then `hint(walk, 1000)` (alert ttlMs 500, walk priority 0): the walk hint was dropped because priority was compared against the *expired-but-not-yet-collected* alert; the next tick fell back to idle and the hint was lost. Likewise a fresh re-hint of the same state after its TTL died did not start a new TTL (the stale no-op-on-active check hit first).

**Fix**: `expireIfDue(machine, now)` runs at the top of `hint()` (shared with `tick()`), so priority/same-state checks always compare against what is actually alive. Re-hinting after expiry enters fresh (new `since`).

**Tests that fail on old code** (mutation verified — `expireIfDue` removed from `hint()`, both FAIL, rest skipped; `raw/round2-mutations.log`):
- `expires a dead ttl state before applying a lower-priority hint` → `expected { state: 'idle', … } to deeply equal { state: 'walk', … }`
- `starts a fresh ttl when a state is re-hinted after its expiry` → `expected { state: 'idle', … } to deeply equal { state: 'alert', … }`

The round-1 test `re-hinting the active state is a no-op: no repick and no ttl refresh` still passes (no-op applies only while the state is alive); docstring updated to say so.

### F2 (Minor) — "no Tauri import" test made real

`@tauri-apps/api` is isomorphic, so a node load test alone cannot catch an added import. The test now imports the module **source** via Vite's `?raw` compile-time import (`import mascotSource from "./mascotMachine.ts?raw"` with a targeted `@ts-expect-error` — the package has no vite/client types under pnpm strict + frozen lockfile; a `node:fs` read would need `@types/node`) and asserts `not.toMatch(/@tauri-apps/)`.

**Mutation verified**: adding `import "@tauri-apps/api/core";` to `mascotMachine.ts` fails exactly this test (`expected … not to match /@tauri-apps/`); restored, suite green. Caveat: vite's transform cache keys on mtime with second granularity — a same-second rewrite can serve stale `?raw` content (see `raw/round2-mutations.log`); real edits and CI are unaffected.

### F3 (Minor) — index.ts diff vs 743239f is now only added lines

Round 1 accidentally stripped `.js` from the two pre-existing `"./mascot/sheets.js"` export lines and used extensionless paths for the new ones. Restored: the two sheets lines are byte-identical to base, new lines use `"./mascotMachine.js"`, matching the file's convention. `git diff 743239f HEAD -- packages/orbitkit/src/index.ts` now shows only additions.

### F4 (Info)

A state with `ttlMs` used as the base (e.g. `idle` itself carrying `ttlMs`) re-enters and repicks itself on every expiry — each entry restarts its TTL, so it cycles. Pathological config, no crash, no unbounded loop within a tick; left as is.

## Commits

- Round 1 code + raw evidence: `5dd79d7494c1` (+ REPORT commit `9ff8f6f7c39c`)
- Round 2 code + raw evidence: `3c294942ef9e`; REPORT updated on top.

READY FOR REVIEW at 3c294942ef9e
