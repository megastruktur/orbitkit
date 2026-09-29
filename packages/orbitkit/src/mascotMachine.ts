import type { MascotPoolState, MascotStateDefinition } from "./config";

/**
 * K8: pure mascot state machine over K7 `mascot.states` pools.
 *
 * No Tauri / DOM / window usage — loads in node. Time is supplied by the
 * caller (`hint` / `tick` take `now`), so tests and the component control
 * the clock (component uses `Date.now()`, compatible with vitest fake timers).
 *
 * Semantics (contract K8):
 * - A machine always shows one resolved state, starting at its *base*:
 *   `idle` when defined, otherwise the highest-priority sticky state
 *   (no `ttlMs`; ties broken by definition order), otherwise none.
 * - `hint(m, state, now)` requests a state:
 *   - higher priority preempts the current state;
 *   - equal priority replaces it;
 *   - lower priority is ignored while the current one is alive;
 *   - re-hinting the active state is a no-op (no sheet repick, no TTL refresh).
 *   Preempted/replaced states are removed, not stacked.
 * - `tick(m, now)` expires the active state once `now - since >= ttlMs` and
 *   falls back to the base state (sheet repicked on that re-entry). Sticky
 *   states never expire.
 * - The pool sheet is chosen with the injectable `rnd` (Math.random-shaped,
 *   returns `[0, 1)`) on every entry into a state; staying in a state never
 *   repicks.
 */

/** Math.random-shaped PRNG returning values in `[0, 1)`. */
export type MascotRnd = () => number;

/** Resolved machine output: active state name and its picked sheet. */
export interface MascotMachineSnapshot {
  /** Resolved state name; `""` when the machine has no resolvable state. */
  state: string;
  /** Sheet picked from the state's pool; `""` when none. */
  sheet: string;
}

/** K8 machine instance. Create with `createMachine`; mutate via `hint`/`tick`. */
export interface MascotMachine {
  /**
   * State definitions the machine was created from (accepts the full K7
   * `config.states` map; non-pool entries are ignored by the machine).
   */
  readonly states: Record<string, MascotStateDefinition>;
  /** Injectable PRNG used for pool picks. */
  readonly rnd: MascotRnd;
  /** Fall-back state name (`""` when none qualifies). */
  base: string;
  /** Currently shown state (`""` when none). */
  active: string;
  /** Time the active state was entered. */
  since: number;
  /** Sheet picked on entry into the active state. */
  sheet: string;
}

export interface MascotMachineOptions {
  /** PRNG for pool picks; defaults to `Math.random`. */
  rnd?: MascotRnd;
  /** Creation time; defaults to 0. */
  now?: number;
}

function poolOf(def: MascotStateDefinition | undefined): MascotPoolState | undefined {
  return def && "pool" in def ? def : undefined;
}

function priorityOf(
  states: Record<string, MascotStateDefinition>,
  name: string,
): number {
  const priority = poolOf(states[name])?.priority;
  return typeof priority === "number" ? priority : 0;
}

function hasPool(states: Record<string, MascotStateDefinition>, name: string): boolean {
  const pool = poolOf(states[name])?.pool;
  return Array.isArray(pool) && pool.length > 0;
}

/** Base = `idle` when defined, else highest-priority sticky state (tie: definition order). */
function resolveBase(states: Record<string, MascotStateDefinition>): string {
  if (hasPool(states, "idle")) return "idle";
  let best = "";
  let bestPriority = -Infinity;
  for (const [name, def] of Object.entries(states)) {
    if (poolOf(def)?.ttlMs != null || !hasPool(states, name)) continue;
    const priority = priorityOf(states, name);
    if (priority > bestPriority) {
      best = name;
      bestPriority = priority;
    }
  }
  return best;
}

function pickSheet(machine: MascotMachine, name: string): string {
  const pool = poolOf(machine.states[name])?.pool;
  if (!Array.isArray(pool) || pool.length === 0) return "";
  const index = Math.min(pool.length - 1, Math.floor(machine.rnd() * pool.length));
  const sheet = pool[index];
  return typeof sheet === "string" ? sheet : "";
}

function enter(machine: MascotMachine, name: string, now: number): void {
  machine.active = name;
  machine.since = now;
  machine.sheet = pickSheet(machine, name);
}

/** Create a machine rooted at its base state (`idle` when defined); picks its sheet. */
export function createMachine(
  states: Record<string, MascotStateDefinition>,
  options: MascotMachineOptions = {},
): MascotMachine {
  const machine: MascotMachine = {
    states,
    rnd: options.rnd ?? Math.random,
    base: "",
    active: "",
    since: options.now ?? 0,
    sheet: "",
  };
  machine.base = resolveBase(states);
  if (machine.base !== "") enter(machine, machine.base, options.now ?? 0);
  return machine;
}

function expireIfDue(machine: MascotMachine, now: number): void {
  const ttl = poolOf(machine.states[machine.active])?.ttlMs;
  if (machine.active !== "" && ttl != null && now - machine.since >= ttl) {
    if (machine.base !== "") enter(machine, machine.base, now);
    else {
      machine.active = "";
      machine.sheet = "";
    }
  }
}

/**
 * Request a state at time `now`. An already-dead `ttlMs` state is expired
 * first, so priority/same-state checks compare against what is actually
 * alive. Higher priority preempts, equal replaces, lower is ignored while
 * the current one is alive; re-hinting the still-alive active state is a
 * no-op (no repick, no TTL refresh) while re-hinting after expiry starts a
 * fresh TTL. Unknown names are ignored.
 */
export function hint(machine: MascotMachine, state: string, now: number): void {
  expireIfDue(machine, now);
  if (!hasPool(machine.states, state)) return;
  if (state === machine.active) return;
  const currentPriority =
    machine.active === "" ? -Infinity : priorityOf(machine.states, machine.active);
  if (priorityOf(machine.states, state) >= currentPriority) {
    enter(machine, state, now);
  }
}

/**
 * Advance the machine to time `now`, expiring a live `ttlMs` state into the
 * base state, and return the resolved `{ state, sheet }` snapshot.
 */
export function tick(machine: MascotMachine, now: number): MascotMachineSnapshot {
  expireIfDue(machine, now);
  return { state: machine.active, sheet: machine.sheet };
}
