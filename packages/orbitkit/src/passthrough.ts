/**
 * K10: opt-in click-through for the transparent mascot window.
 *
 * Outside registered hit regions the window ignores cursor events so clicks
 * reach the apps underneath; inside a region (or while dragging) it is
 * interactive. State is re-evaluated by polling the OS cursor position
 * (≤10 Hz, default 150 ms) — the same pattern as CuteCare's mascot
 * `cursorPoll()`, but the Tauri window API is injected so the module never
 * imports `@tauri-apps/api` at load and tests can run on plain fakes.
 *
 * Opt-in via `windows.mascotWindow.passthrough` config; default off leaves
 * 0.1.0 behaviour unchanged.
 */

/** Minimum poll interval, honouring K10's ≤10 Hz cursor-polling budget. */
export const MIN_PASSTHROUGH_INTERVAL_MS = 100;

/** Default poll interval in ms (≤10 Hz, K10). */
export const DEFAULT_PASSTHROUGH_INTERVAL_MS = 150;

/** Physical (screen) coordinates as reported by Tauri. */
export interface PhysicalPositionLike {
  x: number;
  y: number;
}

/**
 * Structural subset of Tauri's `Window` used for passthrough. Satisfied by
 * `getCurrentWindow()`; injected so tests never touch the real API.
 */
export interface PassthroughWindow {
  /** Window position in physical screen coordinates. */
  outerPosition(): Promise<PhysicalPositionLike>;
  /** DPI scale factor of the monitor the window is on. */
  scaleFactor(): Promise<number>;
  /** `true` → clicks pass through the window. */
  setIgnoreCursorEvents(ignore: boolean): Promise<void>;
}

/** Hit region: a DOM element (queried per poll) or rects in logical window coordinates. */
export type HitRegion = Element | (() => RectEdges[]);

/** Axis-aligned rectangle in logical window coordinates (`DOMRect` satisfies this). */
export interface RectEdges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PassthroughOptions {
  /**
   * Poll interval in ms. Clamped up to `MIN_PASSTHROUGH_INTERVAL_MS` so the
   * poller never exceeds 10 Hz (K10). Default: `DEFAULT_PASSTHROUGH_INTERVAL_MS`.
   */
  intervalMs?: number;
  /** Provides the mascot `Window` handle. */
  getWindow: () => PassthroughWindow;
  /**
   * Cursor position in physical screen coordinates. Defaults to Tauri's
   * `cursorPosition()` (resolved lazily at first poll, not at module load).
   */
  cursorPosition?: () => Promise<PhysicalPositionLike>;
  /** True while the mascot is being dragged; drag is always interactive. */
  isDragging?: () => boolean;
}

export interface PassthroughController {
  /**
   * Registers a hit region (logical window coordinates). Returns an
   * unregister function.
   */
  registerHitRegion(region: HitRegion): () => void;
  /**
   * `true` → stop polling and leave the window non-interactive
   * (`setIgnoreCursorEvents(true)`), e.g. while the mascot is parked/asleep.
   * `false` → resume polling. No-op if the state is unchanged.
   */
  setPaused(paused: boolean): void;
  /** Stops polling and drops all registered regions. */
  stop(): void;
}

/**
 * Converts a physical cursor position to logical window coordinates:
 * `(cursorPhysical - windowPosPhysical) / scaleFactor`.
 */
export function toLogical(
  cursorPhysical: PhysicalPositionLike,
  windowPosPhysical: PhysicalPositionLike,
  scaleFactor: number,
): { x: number; y: number } {
  return {
    x: (cursorPhysical.x - windowPosPhysical.x) / scaleFactor,
    y: (cursorPhysical.y - windowPosPhysical.y) / scaleFactor,
  };
}

/** Inclusive rectangle containment: points exactly on an edge count as inside. */
export function rectContains(rect: RectEdges, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

type CursorPositionFn = () => Promise<PhysicalPositionLike>;

let lazyCursorPosition: Promise<CursorPositionFn> | null = null;

/** Lazy default: dynamic import so nothing from @tauri-apps loads at module load. */
function defaultCursorPosition(): Promise<PhysicalPositionLike> {
  lazyCursorPosition ??= import("@tauri-apps/api/window").then((m) => m.cursorPosition);
  return lazyCursorPosition.then((fn) => fn());
}

export function startPassthrough(options: PassthroughOptions): PassthroughController {
  const intervalMs = Math.max(
    MIN_PASSTHROUGH_INTERVAL_MS,
    options.intervalMs ?? DEFAULT_PASSTHROUGH_INTERVAL_MS,
  );
  const getWindow = options.getWindow;
  const isDragging = options.isDragging ?? (() => false);
  const cursorPosition = options.cursorPosition ?? defaultCursorPosition;

  const regions = new Set<HitRegion>();
  let lastApplied: boolean | null = null; // null = unknown, never applied
  let paused = false;
  let stopped = false;
  let pollInFlight = false;
  let errorLogged = false;
  let applyErrorLogged = false;
  let timer: number | null = null;

  function rectsOf(region: HitRegion): RectEdges[] {
    if (typeof region === "function") return region();
    return [region.getBoundingClientRect()];
  }

  /** Applies the interactive state, calling the Tauri API only on change. */
  function apply(interactive: boolean): void {
    if (lastApplied === interactive) return;
    lastApplied = interactive;
    getWindow()
      .setIgnoreCursorEvents(!interactive)
      .then(() => {
        applyErrorLogged = false; // a clean call re-arms apply-error logging
      })
      .catch((err) => {
        // Apply did not take effect: forget the intent so the next poll
        // retries the same transition instead of treating it as done.
        if (lastApplied === interactive) lastApplied = null;
        // Retry happens every poll, but the log must not: one line per
        // failure streak, re-armed by the next successful call.
        if (!applyErrorLogged) {
          applyErrorLogged = true;
          console.error("orbitkit: passthrough: setIgnoreCursorEvents failed", err);
        }
      });
  }

  async function poll(): Promise<void> {
    if (stopped || paused || pollInFlight) return;
    pollInFlight = true;
    try {
      const win = getWindow();
      const [windowPos, scaleFactor, cursor] = await Promise.all([
        win.outerPosition(),
        win.scaleFactor(),
        cursorPosition(),
      ]);
      if (stopped || paused) return; // stale in-flight poll: state was torn down meanwhile
      const logical = toLogical(cursor, windowPos, scaleFactor);
      let inside = false;
      for (const region of regions) {
        for (const rect of rectsOf(region)) {
          if (rectContains(rect, logical.x, logical.y)) {
            inside = true;
            break;
          }
        }
        if (inside) break;
      }
      // Drag is always interactive: while dragging the cursor lives outside
      // the frame (window moves under it), and a mid-drag switch to
      // click-through would swallow the terminating pointerup.
      apply(inside || isDragging());
      errorLogged = false; // recovered: a future failure is worth logging again
    } catch (err) {
      // Poll errors must not spam the log every interval: log the first of a
      // failure streak, stay silent until a poll succeeds again.
      if (!errorLogged) {
        errorLogged = true;
        console.error(
          "orbitkit: passthrough poll failed; keeping previous cursor-events state",
          err,
        );
      }
    } finally {
      pollInFlight = false;
    }
  }

  function armTimer(): void {
    if (timer !== null) return;
    timer = setInterval(() => {
      void poll();
    }, intervalMs);
  }

  function disarmTimer(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function registerHitRegion(region: HitRegion): () => void {
    regions.add(region);
    return () => {
      regions.delete(region);
    };
  }

  function setPaused(value: boolean): void {
    if (stopped || value === paused) return;
    paused = value;
    if (paused) {
      disarmTimer();
      apply(false); // passthrough stays engaged: window non-interactive
    } else {
      armTimer();
      void poll(); // resume with an immediate sample instead of waiting an interval
    }
  }

  function stop(): void {
    stopped = true;
    paused = false;
    disarmTimer();
    regions.clear();
  }

  armTimer();
  void poll(); // first sample immediately instead of after a full interval

  return { registerHitRegion, setPaused, stop };
}
