/**
 * okc park: generic do-not-disturb ("parked") mode for the mascot.
 *
 * Composes the merged roam (K7/K10 roam-drag), passthrough (K10) and mascot
 * machine (K8) surfaces — nothing here re-implements them:
 * - `park()` pauses roam + passthrough polling, moves the window into the
 *   configured work-area corner (clamped via `clampToWorkArea`, K9), forces
 *   the consumer-provided `sleepState` on the machine (bypassing `hint()`
 *   priority rules; sticky when the state has no `ttlMs`) and emits
 *   `orbitkit://park {parked:true}`.
 * - `unpark()` restores the pre-park position by resuming roam at the saved
 *   point (the loop clamps it back into the roam zone), forces the machine's
 *   BASE state back on (not the transient pre-park state — its TTL must not
 *   replay), resumes passthrough and emits `orbitkit://park {parked:false}`.
 * - `notify()` is the bubble gate: while unparked it forwards to
 *   `showBubble`; while parked it does not show the bubble and counts it into
 *   the badge (`orbitkit://badge {count}`), on top of the last observed badge
 *   count.
 *
 * No `@tauri-apps/api` usage beyond the bridge wrappers, which no-op outside
 * Tauri; the window surface is injected like in `roam.ts`/`passthrough.ts`,
 * so tests run on plain fakes.
 */

import { hint as machineHint, type MascotMachine } from "./mascotMachine.js";
import type { PassthroughController } from "./passthrough.js";
import type { RoamController } from "./roam.js";
import { onBadge, setBadge, setParked } from "./bridge.js";
import { clampToWorkArea, type PhysicalPoint, type PhysicalRect } from "./windowFit.js";

/** Work-area corner the mascot is parked in. */
export type ParkCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** Window size in physical px, used for corner placement. */
export interface ParkWindowSize {
  width: number;
  height: number;
}

/** Static size or a live getter (re-resolved at every `park()`). */
export type ParkWindowSizeSource = ParkWindowSize | (() => ParkWindowSize);

/** Structural subset of Tauri's `Window` used by park (same shape as `RoamWindow`). */
export interface ParkWindow {
  /** Current window position in physical screen coordinates. */
  outerPosition(): Promise<PhysicalPoint>;
  /** Moves the window (physical screen coordinates). */
  setPosition(position: PhysicalPoint): Promise<void>;
}

export interface CreateParkOptions {
  /** Roam loop surface; `resume(at)` restores the pre-park position (K7). */
  roam: Pick<RoamController, "pause" | "resume">;
  /** Passthrough surface; `setPaused` pauses cursor polling while parked (K10). */
  passthrough: Pick<PassthroughController, "setPaused">;
  /** Mascot state machine the sleep hint is applied to (K8). */
  machine: MascotMachine;
  /** Consumer-provided sleep state name hinted on `park()`. */
  sleepState: string;
  /** Work-area corner to move the window into. */
  corner: ParkCorner;
  /**
   * Monitor work area in physical px the corner resolves against; re-read on
   * every `park()` (e.g. `() => mascotMonitor().workArea`).
   */
  workArea: PhysicalRect | (() => PhysicalRect);
  /** Mascot window access: position is saved on `park()`, restored on `unpark()`. */
  getWindow: () => ParkWindow;
  /** Window size in physical px for corner placement; defaults to point-sized. */
  windowSize?: ParkWindowSizeSource;
  /** Delivers bubbles while not parked (e.g. mounts a `Bubble`). */
  showBubble?: (bubble: unknown) => void;
  /** Clock for machine hints; defaults to `Date.now`. */
  now?: () => number;
}

export interface ParkHandle {
  /** Enters park mode; a no-op when already parked. */
  park(): Promise<void>;
  /** Leaves park mode and restores the pre-park state; no-op when unparked. */
  unpark(): Promise<void>;
  /** Whether the mascot is currently parked. */
  readonly parked: boolean;
  /**
   * Routes a K8 state request (`machine.hint`) into the machine. While parked
   * it is a no-op (the sleep state must survive every request — route state
   * requests through this while park mode is in use); otherwise it forwards
   * with K8 priority rules.
   */
  hint(state: string, now: number): void;
  /**
   * Bubble gate: while unparked the bubble is forwarded to `showBubble` and
   * `true` is returned; while parked it is suppressed (`false` returned) and
   * counted into the badge on top of the last observed `orbitkit://badge`
   * count.
   */
  notify<B>(bubble: B): boolean;
  /** Unparks (if parked) and releases the badge-count subscription. */
  dispose(): Promise<void>;
}

/**
 * Window top-left for `corner` of `workArea`, clamped into the work area via
 * `clampToWorkArea` (K9) — an oversized window is clamped to the work-area
 * origin.
 */
export function parkCornerPosition(
  corner: ParkCorner,
  workArea: PhysicalRect,
  windowSize: ParkWindowSize,
): PhysicalPoint {
  const target = {
    x:
      corner === "top-right" || corner === "bottom-right"
        ? workArea.x + workArea.width - windowSize.width
        : workArea.x,
    y:
      corner === "bottom-left" || corner === "bottom-right"
        ? workArea.y + workArea.height - windowSize.height
        : workArea.y,
    width: windowSize.width,
    height: windowSize.height,
  };
  const clamped = clampToWorkArea(target, workArea);
  return { x: clamped.x, y: clamped.y };
}

/** Creates the park handle; see module docs. */
export function createPark(options: CreateParkOptions): ParkHandle {
  const now = options.now ?? Date.now;

  let parked = false;
  let inflight: Promise<void> | null = null;
  let savedPosition: PhysicalPoint | null = null;
  let badgeSent = 0;
  let badgeObserved = 0;

  const unlistenBadge = onBadge((payload) => {
    badgeObserved = payload.count;
  }).catch((err) => {
    console.error("[orbitkit] park: badge subscription failed.", err);
    return () => {};
  });

  /**
   * Writes a state directly through the machine's public mutable fields (K8
   * interface), bypassing `hint()` priority rules — park mode must enter and
   * leave `sleepState` regardless of configured priorities. No-op for unknown
   * or empty-pool names (the machine then keeps its current state).
   */
  function forceState(machine: MascotMachine, name: string, at: number): void {
    const def = machine.states[name];
    const pool = def && "pool" in def ? def.pool : undefined;
    if (!pool || pool.length === 0) return;
    machine.active = name;
    machine.since = at;
    machine.sheet = pool[Math.min(pool.length - 1, Math.floor(machine.rnd() * pool.length))] ?? "";
  }

  async function doPark(): Promise<void> {
    const win = options.getWindow();
    // Everything fallible is captured before state is applied; a failure
    // leaves `parked` false and the idempotent effects safe to re-apply.
    const position = await win.outerPosition();
    const size = options.windowSize;
    const windowSize = !size ? { width: 0, height: 0 } : typeof size === "function" ? size() : size;
    const workArea = typeof options.workArea === "function" ? options.workArea() : options.workArea;
    const target = parkCornerPosition(options.corner, workArea, windowSize);

    savedPosition = position;

    options.roam.pause();
    options.passthrough.setPaused(true);
    forceState(options.machine, options.sleepState, now());
    await win.setPosition(target);
    parked = true;
    await setParked(true);
  }

  async function park(): Promise<void> {
    if (parked) return;
    if (inflight) return inflight;
    inflight = doPark().finally(() => {
      inflight = null;
    });
    await inflight;
  }

  async function doUnpark(): Promise<void> {
    options.passthrough.setPaused(false);
    // Restore the BASE state (a transient pre-park state with a live TTL must
    // not replay its park-time clock), again bypassing priority rules.
    forceState(options.machine, options.machine.base, now());
    if (savedPosition) {
      // Restore the position immediately (resume(at) only adopts it on the
      // next loop tick), then let roam adopt the same point — clamped into
      // the (untouched) zone — and re-aim from there: prior position AND
      // zone are back.
      await options.getWindow().setPosition(savedPosition);
      options.roam.resume(savedPosition);
    } else {
      options.roam.resume();
    }
    savedPosition = null;
    parked = false;
    await setParked(false);
  }

  async function unpark(): Promise<void> {
    if (!parked) return;
    if (inflight) return inflight;
    inflight = doUnpark().finally(() => {
      inflight = null;
    });
    await inflight;
  }

  function notify<B>(bubble: B): boolean {
    if (!parked) {
      options.showBubble?.(bubble);
      return true;
    }
    // Count on top of the latest observed badge count (external updates made
    // while parked are honoured); badgeSent keeps rapid notifies from racing
    // the async listener redelivery.
    badgeSent = Math.max(badgeObserved, badgeSent) + 1;
    // Fire-and-forget broadcast: a failed badge emit must not break the
    // bubble producer; the count itself is already tracked locally.
    void setBadge(badgeSent).catch(() => {});
    return false;
  }

  function hint(state: string, at: number): void {
    if (parked) return;
    machineHint(options.machine, state, at);
  }

  async function dispose(): Promise<void> {
    if (parked) await unpark();
    (await unlistenBadge)();
  }

  return {
    park,
    unpark,
    get parked() {
      return parked;
    },
    hint,
    notify,
    dispose,
  };
}
