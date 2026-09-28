# REPORT okc-park (campaign orbitkit-cutecare-v02, attempt 1)

Task file: `plans/orbitkit-cutecare-v02/okc_park.md`. Contracts consumed as-is: K7, K8, K10,
event `orbitkit://park {parked: bool}` (contracts "Events summary").

## Result: ALL ACCEPTANCE CRITERIA MET

| AC | Criterion | Result | Mutation-sensitive test (would fail pre-change) |
|----|-----------|--------|------------------------------------------------|
| 1 | `createPark({ roam, passthrough, machine, sleepState, corner })` → `{ park(), unpark(), parked }` | PASS | `park.test.ts > createPark > "exposes park/unpark/parked/notify/dispose and starts unparked"` (module did not exist at base) |
| 2 | park: roam paused, window moved to clamped corner, `hint(sleepState)` sticky, passthrough paused, `orbitkit://park {parked:true}` emitted | PASS | `"park pauses roam + passthrough, hints sleep, moves to the clamped corner and emits parked:true"` asserts exact corner coords `{x:1824, y:984}`, `machine.active === "sleep"`, `machine.since` from injected clock, and the exact emitted payload; `"sleep hint is sticky while parked"` proves no expiry; `"parkCornerPosition > clamps an oversized window"` proves the clamp |
| 3 | While parked, `notify(bubble)` does not show a bubble and increments badge count | PASS | `"notify while parked suppresses the bubble and counts it into the badge"`: `showBubble` not called, `orbitkit://badge` counts `[1, 2]`; `"notify while unparked..."` proves the gate only suppresses while parked |
| 4 | unpark restores prior position + roam zone, clears sleep hint, resumes passthrough, emits `parked:false` | PASS | `"unpark resumes roam at the pre-park position..."`: window `setPosition` called with the exact saved position `{x:500, y:400}` (immediate restore — `resume(at)` alone only adopts on the next loop tick), `roam.resume` adopts the same point clamped into the untouched zone, `machine.active === "idle"`, `setPaused(false)`, payload `{parked:false}` |
| 5 | Idempotent park/unpark | PASS | `"double park applies the effects once"` (pause/setPosition/emit exactly once); `"unpark without park is a no-op and double unpark applies once"` |
| 6 | build/test/check green | PASS | `pnpm -r build` exit 0; `pnpm -r test` 366/366 (baseline 350 + 16 new: 11 in `park.test.ts`, 5 in `bridge.test.ts` park describe); `pnpm -r check` exit 0; `$OKC_RUST_GATE` → `OKC_RUST_GATE_OK`, 48/48 lib tests (unchanged — no Rust touched) |

Raw outputs with exit codes: `raw/build.log`, `raw/test.log`, `raw/check.log`, `raw/rust_gate.log`.

## Design notes (contract conformance)

- `createPark` consumes merged surfaces structurally: `Pick<RoamController, "pause" | "resume">`,
  `Pick<PassthroughController, "setPaused">`, `MascotMachine` mutated only via `hint` (K8).
  "Roam zone restore" is by construction: park never mutates the zone; `resume(savedPosition)`
  re-adopts the pre-park point clamped into the zone (documented K7 resume semantics). Cosmetic
  note: with a non-zero `roam.inset`/margin the corner target sits at the work-area edge while
  the zone is inset, so resume may clamp the mascot a few px inside the zone — that is K7
  zone behaviour, not park logic.
- AC2 "hint(sleepState) sticky": stickiness follows the state's own K8 definition (no `ttlMs` →
  sticky). Park hints once; the sticky test pins it.
- AC4 "clears sleep hint" = re-hint of the pre-park `machine.active` state (equal priority →
  replaces, per K8). If a consumer gives `sleepState` a higher priority than the pre-park
  state, K8 hint rules apply and the state stays — consumer config semantics, not park logic.
- AC3 `notify`: there was no bubble producer API at base (Bubble is a Svelte component), so the
  handle exposes `notify<B>(bubble): boolean` + optional `showBubble` callback. Parked → bubble
  suppressed, `setBadge(base + n)` emitted on top of the last observed `orbitkit://badge` count
  (tracked via `onBadge`, so pre-existing consumer badge counts are incremented, not clobbered).
  Unpark does NOT reset the badge (suppressed notifications stay "unread"; clearing is the
  consumer's act). Rapid notifies cannot race: counts come from a local counter, not from the
  async listener.
- `parked` is a live getter; handle also has `dispose()` (unparks if parked, releases the badge
  listener) — the only lifecycle surface beyond AC1's three members.
- `windowSize` (physical px) is optional input for corner math; default point-sized. It is
  needed because `RoamWindow` exposes no size.
- bridge.ts: ONLY `ParkPayload`/`ParkCallback` types + `onPark`/`setParked` appended after
  `setBadge`; no existing section reordered or edited. `index.ts`: only park export lines appended.
- Outside Tauri every bridge call no-ops (same convention as badge), so `createPark` works in
  plain node/jsdom; window surface is injected (`ParkWindow` = `RoamWindow` shape).

## Scope deviations

None. Files touched: `packages/orbitkit/src/park.ts` (new), `park.test.ts` (new),
`bridge.ts` (+`onPark`/`setParked` only), `bridge.test.ts` (park describe + import lines),
`index.ts` (park export lines), `evidence/okc/park/**`.

## Out-of-scope findings

- None blocking. (Note: `pnpm -r build` prints a pre-existing
  `[INEFFECTIVE_DYNAMIC_IMPORT]` chunk warning about `passthrough.js`/`bridge.js` — present at
  baseline, untouched.)

## Contract questions

None — K7/K8/K10 and the events summary were sufficient.

## Round 2 (review fixes, branch tip)

Coordinator review findings at `2306e12`: F1 (Major, AC2+AC4), F2 (Major, AC5), F3 (covered
by F1), F4 (Minor). All fixed inside `park.ts` per coordinator decision; `mascotMachine.ts`
untouched.

### F1 — state forcing via public K8 machine fields (AC2 + AC4)

- `park.ts` adds private `forceState(machine, name, now)`: writes `active`/`since`/`sheet`
  directly (sheet picked with `machine.rnd`, same `min(len-1, floor(rnd*len))` rule as the
  machine); no-op for unknown/empty-pool names. `hint()` priority rules are bypassed in both
  directions.
- `park()`: `forceState(sleepState)` — sleep is entered even when a higher/equal-priority
  state is alive.
- `unpark()`: `forceState(machine.base)` — restores the BASE state (F3: a transient TTL
  state playing at park time is not re-hinted, so its park-time clock never replays).
- New handle member `hint(state, now)`: parked → no-op (sleep survives any request);
  unparked → forwards to `machine.hint`. Consumers route state requests through it while
  park mode is in use (documented on `ParkHandle.hint`).
- Proof (`raw/round2_red_proof.log`, old `park.ts` + new tests → 6 failures):
  - `"park forces sleep even when its priority is below the alive state"` (walk@5 alive,
    sleep@0 → old `hint()` ignored, force enters) — RED pre-fix
  - `"park forces sleep even while a higher-priority TTL state is alive"` (walk@5 ttl1000
    alive, sleep@0) — RED pre-fix
  - `"handle.hint forwards requests when unparked and suppresses them while parked"` — RED
    pre-fix (member absent)
  - `"unpark restores the base state even when sleep has the higher priority"` (sleep@5,
    base idle@0 → old `hint(idle)` ignored, mascot slept forever) — RED pre-fix
  - `"park forces sleep even when its priority is above the pre-park state"` (sleep@5 vs
    idle@0) is the above-direction sanity pair — green both sides by K8 rules, kept pinned.

### F2 — unpark in-flight guard (AC5)

- `unpark()` now mirrors `park()`: shared `inflight` promise — overlapping `unpark()` calls
  (or park/unpark overlap) collapse into one transition; `parked` still gates the sequential
  no-ops.
- Proof: `"overlapping unpark calls apply the restore once"` — two concurrent `unpark()`
  with a gated `setPosition` → `roam.resume` exactly once, `setPosition` exactly twice
  (corner + restore). RED pre-fix (both runs completed → 2 resumes; test timed out on the
  old code's missing release path at 5s).

### F4 — live badge base (AC3)

- `notify()` counts on top of the latest observed `orbitkit://badge` count instead of a
  snapshot frozen at park time; `badgeSent` (max of observed and last sent) keeps rapid
  notifies from racing the listener redelivery. External badge updates made while parked are
  honoured; no clobbering of concurrent consumer counts.
- Proof: `"notify counts on top of external badge updates observed while parked"` — external
  `{count:10}` delivered mid-park, then one suppressed bubble → emitted `{count:11}`. RED
  pre-fix (old snapshot emitted `{count:1}`).

### Round-2 verification

- `pnpm -r build` exit 0; `pnpm -r test` 373/373 (366 + 7 new tests); `pnpm -r check` exit 0;
  `$OKC_RUST_GATE` → `OKC_RUST_GATE_OK`, 48/48 lib tests. Logs refreshed in `raw/`.
- `packages/orbitkit/src/bridge.ts` untouched in round 2; still only `onPark`/`setParked`.

## Final state

READY FOR REVIEW at 3aec425 (code; branch tip adds this evidence/REPORT commit)
