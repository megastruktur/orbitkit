/**
 * K7: mascot roam + K10 drag integration.
 *
 * Roam moves the mascot window inside a rectangular zone anchored at a
 * configurable monitor-corner (or re-based around the drag drop point),
 * bouncing off the zone edges ("flip-and-continue"). The zone is computed for
 * the window's TOP-LEFT and shrunk by the window's physical size
 * (`windowSize`, e.g. `outerSize()`), so the whole window stays inside the
 * work area even at the config corner. All geometry is done in
 * PHYSICAL pixels (K9); the logical `windows.mascotWindow.roam` config
 * (`width`/`height`/`margin`/`speed`) is converted with the monitor
 * `scaleFactor`, exactly like the K9 `fitWindow` helpers.
 *
 * There is ONE drag model (sdk-v1): `createDragGesture`'s 4 px threshold
 * decides click vs drag. `createRoamDrag` wires that gesture to roam and
 * passthrough: crossing the threshold pauses roam (and reports `isDragging`
 * for `startPassthrough`), releasing re-bases the roam zone around the drop
 * point (clamped into the work area) and resumes roam. A click
 * (≤ threshold) only toggles the menu — the window never moves.
 *
 * The module never imports `@tauri-apps/api`; the Tauri `Window` surface is
 * injected, so tests run on plain fakes (same pattern as `passthrough.ts`).
 */

import type { PhysicalPoint, PhysicalRect } from "./windowFit.js";
import type { MascotRoamConfig } from "./config.js";
import {
  createDragGesture,
  type DragGestureHandlers,
} from "./dragGesture.js";

/** Maximum simulated dt per step in ms; a stalled tab must not teleport. */
export const MAX_STEP_MS = 250;

/** Loop interval floor: 1000/30 ms ⇒ the roam loop never exceeds 30 Hz. */
export const MIN_ROAM_INTERVAL_MS = 1000 / 30;

/** Roam state: window top-left + velocity in physical px (per second). */
export interface RoamState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Structural subset of Tauri's `Window` used for roaming. */
export interface RoamWindow {
  /** Current window position in physical screen coordinates. */
  outerPosition(): Promise<PhysicalPoint>;
  /**
   * Moves the window (physical screen coordinates). Both coordinates MUST be
   * integers: Tauri's `set_position` takes an integer `PhysicalPosition` and
   * rejects fractional px. Callers keep fractional position as internal roam
   * state and hand `setPosition` only the rounded value.
   */
  setPosition(pos: PhysicalPoint): Promise<void>;
}

/** Logical→physical guard: non-finite or non-positive scale falls back to 1. */
function normalScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/** Shrinks `area` by `inset` px on every side, clamped to zero size. */
function insetRect(area: PhysicalRect, inset: number): PhysicalRect {
  return {
    x: area.x + inset,
    y: area.y + inset,
    width: Math.max(0, area.width - inset * 2),
    height: Math.max(0, area.height - inset * 2),
  };
}

/** Physical window size (the `outerSize()` shape) constraining the roam zone. */
export interface RoamWindowSize {
  width: number;
  height: number;
}

/** Static size or a live getter (re-resolved at creation and every re-base). */
export type RoamWindowSizeSource = RoamWindowSize | (() => RoamWindowSize);

function windowExtent(win?: RoamWindowSizeSource): { w: number; h: number } {
  const size = typeof win === "function" ? win() : win;
  const w = size?.width;
  const h = size?.height;
  return {
    w: typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 0,
    h: typeof h === "number" && Number.isFinite(h) && h > 0 ? h : 0,
  };
}

/**
 * Travel limits for the window's TOP-LEFT so the whole window stays inside
 * the margin-inset safe area: `hi = max(lo, inner.right - winW)` (CuteCare
 * `stepRoam`). An oversized window pins at `lo`.
 */
function travelLimits(
  inner: PhysicalRect,
  win: { w: number; h: number },
): { loX: number; hiX: number; loY: number; hiY: number } {
  const loX = inner.x;
  const hiX = Math.max(loX, inner.x + inner.width - win.w);
  const loY = inner.y;
  const hiY = Math.max(loY, inner.y + inner.height - win.h);
  return { loX, hiX, loY, hiY };
}

/**
 * Computes the roam zone: the area the window's top-left may travel in.
 * A `roam.width × roam.height` physical rect (logical config × `scale`)
 * anchored at `roam.corner` of the work area, inset by `roam.margin` on every
 * side, and shrunk by `windowSize` so the window's right/bottom edge never
 * leaves the work area. Degenerate limits collapse the zone to the safe origin.
 */
export function roamBounds(
  workArea: PhysicalRect,
  scale: number,
  roam: MascotRoamConfig,
  windowSize?: RoamWindowSizeSource,
): PhysicalRect {
  const s = normalScale(scale);
  const inner = insetRect(workArea, roam.margin * s);
  const { loX, hiX, loY, hiY } = travelLimits(inner, windowExtent(windowSize));
  const w = Math.max(0, Math.min(roam.width * s, hiX - loX));
  const h = Math.max(0, Math.min(roam.height * s, hiY - loY));
  const left = roam.corner === "bottom-left" || roam.corner === "top-left";
  const top = roam.corner === "top-left" || roam.corner === "top-right";
  return {
    x: left ? loX : hiX - w,
    y: top ? loY : hiY - h,
    width: w,
    height: h,
  };
}

/**
 * Recomputes the roam zone after a drag: a `roam.width × roam.height` zone
 * centred on `dropPoint` (the window position at release), clamped into the
 * margin-inset safe area minus `windowSize`, so the mascot keeps wandering
 * near where it was dropped without any part of the window leaving the work
 * area.
 */
export function rebaseRoamBounds(
  dropPoint: PhysicalPoint,
  workArea: PhysicalRect,
  scale: number,
  roam: MascotRoamConfig,
  windowSize?: RoamWindowSizeSource,
): PhysicalRect {
  const s = normalScale(scale);
  const inner = insetRect(workArea, roam.margin * s);
  const { loX, hiX, loY, hiY } = travelLimits(inner, windowExtent(windowSize));
  const w = Math.max(0, Math.min(roam.width * s, hiX - loX));
  const h = Math.max(0, Math.min(roam.height * s, hiY - loY));
  return {
    x: Math.min(Math.max(dropPoint.x - w / 2, loX), hiX - w),
    y: Math.min(Math.max(dropPoint.y - h / 2, loY), hiY - h),
    width: w,
    height: h,
  };
}

/**
 * Advances one roam step: linear motion at the state's velocity with
 * `dtMs` capped to `MAX_STEP_MS` (negative dt ⇒ no motion), then
 * flip-and-continue at the zone edges — the offending velocity component is
 * mirrored and overshoot is reflected back into the zone. Pure: returns the
 * next state, never mutates. Degenerate (zero-width/height) axes pin the
 * position and zero the velocity on that axis.
 */
export function stepRoam(
  state: RoamState,
  dtMs: number,
  bounds: PhysicalRect,
): RoamState {
  const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS) / 1000;
  let x = state.x + state.vx * dt;
  let y = state.y + state.vy * dt;
  let vx = state.vx;
  let vy = state.vy;

  const minX = bounds.x;
  const minY = bounds.y;
  const maxX = bounds.x + bounds.width;
  const maxY = bounds.y + bounds.height;

  if (!(maxX > minX)) {
    x = minX;
    vx = 0;
  } else if (x < minX) {
    x = Math.min(minX + (minX - x), maxX);
    vx = Math.abs(vx);
  } else if (x > maxX) {
    x = Math.max(maxX - (x - maxX), minX);
    vx = -Math.abs(vx);
  }

  if (!(maxY > minY)) {
    y = minY;
    vy = 0;
  } else if (y < minY) {
    y = Math.min(minY + (minY - y), maxY);
    vy = Math.abs(vy);
  } else if (y > maxY) {
    y = Math.max(maxY - (y - maxY), minY);
    vy = -Math.abs(vy);
  }

  return { x, y, vx, vy };
}

/**
 * Velocity aimed from `from` towards the centre of `bounds` at `speed` px/s.
 * Already-centred points head right (`{x: speed, y: 0}`); non-positive or
 * non-finite speed yields rest.
 */
export function aimRoamVelocity(
  from: PhysicalPoint,
  bounds: PhysicalRect,
  speed: number,
): PhysicalPoint {
  if (!Number.isFinite(speed) || speed <= 0) {
    return { x: 0, y: 0 };
  }
  const dx = bounds.x + bounds.width / 2 - from.x;
  const dy = bounds.y + bounds.height / 2 - from.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-9)) {
    return { x: speed, y: 0 };
  }
  return { x: (dx / len) * speed, y: (dy / len) * speed };
}

export interface StartRoamOptions {
  /** Window factory; re-invoked per step so injected windows can be lazy. */
  getWindow: () => RoamWindow;
  /** Live zone getter, re-read on every step so drag re-basing takes effect. */
  bounds: () => PhysicalRect;
  /** Roam speed in px/s, in the same (physical) space as `bounds`. */
  speed: number;
  /** Receives the current velocity after every step (for `faceByVelocity`). */
  onVelocity?: (velocity: PhysicalPoint) => void;
  /** Step interval in ms; clamped up to `MIN_ROAM_INTERVAL_MS` (≤30 Hz). */
  intervalMs?: number;
}

export interface RoamController {
  /** Stops stepping and releases the timer; `resume()` restarts cleanly. */
  pause(): void;
  /**
   * Resumes stepping; the pause gap is never accumulated as dt. With `at`
   * (e.g. the drag drop point) the loop adopts that position — clamped into
   * the current zone — and re-aims the velocity into it, instead of snapping
   * back to the stale pre-pause position. With `heading` (any non-zero
   * direction vector, e.g. `{x: -1, y: 0}` for "walk left") the velocity is
   * `speed` along that direction instead of aimed at the zone centre, so a
   * scheduler can choose where the mascot walks (and thus which way it faces).
   */
  resume(at?: PhysicalPoint, heading?: PhysicalPoint): void;
  /** Permanently stops the loop. */
  stop(): void;
  readonly paused: boolean;
  readonly stopped: boolean;
}

/**
 * Starts the roam loop for an existing window. Returns the controller
 * synchronously; the first position read happens asynchronously, and until it
 * resolves `pause`/`resume`/`stop` are honoured (the loop simply stays idle).
 * Internal roam state stays fractional (so slow speeds still accumulate), but
 * only INTEGER physical coordinates ever reach `setPosition` (rounded; a call
 * is skipped while the rounded position is unchanged).
 * `setPosition` failures are logged once per failure streak and never stop
 * the loop.
 */
export function startRoam(options: StartRoamOptions): RoamController {
  const interval = Math.max(
    MIN_ROAM_INTERVAL_MS,
    options.intervalMs ?? MIN_ROAM_INTERVAL_MS,
  );
  let state: RoamState | null = null;
  let lastSent: PhysicalPoint | null = null;
  let timer: number | null = null;
  let lastTick = 0;
  let paused = false;
  let stopped = false;
  let setPositionErrorLogged = false;
  let initErrorLogged = false;

  function tick(): void {
    if (stopped || paused || state === null) return;
    const now = Date.now();
    const dt = now - lastTick;
    lastTick = now;
    state = stepRoam(state, dt, options.bounds());
    // Internal state stays fractional so slow speeds still accumulate motion
    // across steps; only the ROUNDED integer position reaches the window
    // (Tauri `set_position` takes an integer `PhysicalPosition`), and only
    // when it differs from the last one sent (no redundant native calls).
    const x = Math.round(state.x);
    const y = Math.round(state.y);
    if (lastSent === null || x !== lastSent.x || y !== lastSent.y) {
      lastSent = { x, y };
      options
        .getWindow()
        .setPosition({ x, y })
        .catch((err) => {
          if (!setPositionErrorLogged) {
            setPositionErrorLogged = true;
            console.error("orbitkit: roam: setPosition failed", err);
          }
        });
    }
    options.onVelocity?.({ x: state.vx, y: state.vy });
  }

  function arm(): void {
    if (stopped || paused || timer !== null) return;
    lastTick = Date.now(); // a pause gap must not leak into the next dt
    timer = setInterval(tick, interval);
  }

  function disarm(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  void (async () => {
    try {
      const pos = await options.getWindow().outerPosition();
      if (stopped) return;
      const v = aimRoamVelocity(pos, options.bounds(), options.speed);
      state = { x: pos.x, y: pos.y, vx: v.x, vy: v.y };
      // The window is already (about) here; don't re-send it on the first
      // tick when the rounded position is unchanged.
      lastSent = { x: Math.round(pos.x), y: Math.round(pos.y) };
      arm();
    } catch (err) {
      if (!initErrorLogged) {
        initErrorLogged = true;
        console.error(
          "orbitkit: roam: failed to read window position; roam stays idle",
          err,
        );
      }
    }
  })();

  return {
    pause() {
      paused = true;
      disarm();
    },
    resume(at?: PhysicalPoint, heading?: PhysicalPoint) {
      if (stopped) return;
      paused = false;
      if (state !== null && (at || heading)) {
        // Clamp into the current zone first: a drop can sit outside it
        // (half off-screen); the loop must start from a valid point.
        const b = options.bounds();
        const from = at ?? { x: state.x, y: state.y };
        const p = {
          x: Math.min(Math.max(from.x, b.x), b.x + b.width),
          y: Math.min(Math.max(from.y, b.y), b.y + b.height),
        };
        const hx = heading?.x ?? 0;
        const hy = heading?.y ?? 0;
        const len = Math.hypot(hx, hy);
        const v =
          Number.isFinite(len) && len > 1e-9
            ? Number.isFinite(options.speed) && options.speed > 0
              ? { x: (hx / len) * options.speed, y: (hy / len) * options.speed }
              : { x: 0, y: 0 }
            : aimRoamVelocity(p, b, options.speed);
        state = { x: p.x, y: p.y, vx: v.x, vy: v.y };
        // The native drag already carried the window to `at`; treat the
        // adopted (clamped) point as the last sent position so the first
        // tick only sends once the rounded position actually changes.
        if (at) lastSent = { x: Math.round(p.x), y: Math.round(p.y) };
      }
      arm();
    },
    stop() {
      stopped = true;
      disarm();
    },
    get paused() {
      return paused;
    },
    get stopped() {
      return stopped;
    },
  };
}

export interface RoamDragOptions {
  /** Pause/resume surface of the roam loop (a `RoamController`). */
  roam: Pick<RoamController, "pause" | "resume">;
  /** Resolves the window position at release (the drop point). */
  getDropPoint: () => Promise<PhysicalPoint>;
  /**
   * Called once per release with the drop point, before roam resumes.
   * Recompute the zone here (e.g. `rebaseRoamBounds`).
   */
  onRebase: (dropPoint: PhysicalPoint) => void;
  /** Toggle callback forwarded to the gesture (click / keyboard). */
  onToggle?: () => void;
  /** Forwarded to `createDragGesture`; e.g. native `startMascotDrag()`. */
  onDragStart?: () => void | Promise<void>;
  /** Forwarded to `createDragGesture`; default 4 px. */
  threshold?: number;
  /** Forwarded to `createDragGesture`; default 400 ms. */
  dragClearDelay?: number;
}

export interface RoamDragBinding {
  /** Attach these to the mascot element instead of a bare gesture. */
  handlers: DragGestureHandlers;
  /** Feed to `startPassthrough({ isDragging: ... })` (K10). */
  isDragging: () => boolean;
}

/**
 * Wires the single sdk-v1 drag model to roam + passthrough:
 *
 * - pointer movement crossing the threshold ⇒ roam paused, `isDragging`
 *   true, `options.onDragStart` invoked (native drag) — before any native
 *   drag attempt;
 * - release (`pointerup`, `pointercancel`, window focus change, or the
 *   suppressed trailing click) ⇒ `isDragging` false, the drop point read,
 *   `options.onRebase(dropPoint)` runs, then roam resumes — so a lost
 *   pointerup can never leave dragging stuck;
 * - a failed/rejected `onDragStart` falls through to the gesture's click
 *   fallback (its `dragged` flag clears, so a trailing click toggles the
 *   menu) while the binding releases the drag: `isDragging` false, roam
 *   resumed;
 * - ≤ threshold interactions only call `onToggle` (menu); nothing moves.
 *
 * A drop-point read that races a new drag is discarded (generation guard) so
 * a stale rebase never resumes a drag in progress.
 */
export function createRoamDrag(options: RoamDragOptions): RoamDragBinding {
  let dragging = false;
  let generation = 0;
  let dropPointErrorLogged = false;

  function beginDrag(): void | Promise<void> {
    if (dragging) return;
    dragging = true;
    generation += 1;
    options.roam.pause();
    try {
      const res = options.onDragStart?.();
      if (res && typeof (res as Promise<void>).catch === "function") {
        // Release roam when the native drag fails; the gesture keeps
        // ownership of the fallback (clears its dragged flag so the
        // trailing click still toggles the menu).
        (res as Promise<void>).catch(() => endDrag());
      }
      return res;
    } catch (err) {
      endDrag();
      throw err; // let the gesture apply its synchronous-throw fallback
    }
  }

  function endDrag(): void {
    if (!dragging) return;
    dragging = false;
    const gen = generation;
    void (async () => {
      let point: PhysicalPoint;
      try {
        point = await options.getDropPoint();
      } catch (err) {
        if (!dropPointErrorLogged) {
          dropPointErrorLogged = true;
          console.error(
            "orbitkit: roam: failed to read drop point; resuming roam in the previous zone",
            err,
          );
        }
        if (gen === generation) options.roam.resume();
        return;
      }
      if (gen !== generation) return; // a new drag began meanwhile
      try {
        options.onRebase(point);
      } finally {
        // Resume FROM the drop point: the native drag moved the window, so
        // the stale pre-drag loop position would snap back on the first step.
        if (gen === generation) options.roam.resume(point);
      }
    })();
  }

  const gesture = createDragGesture({
    onToggle: options.onToggle,
    threshold: options.threshold,
    dragClearDelay: options.dragClearDelay,
    onDragStart: beginDrag,
  });

  const handlers: DragGestureHandlers = {
    onpointerdown: (e) => gesture.onpointerdown(e),
    onpointermove: (e) => gesture.onpointermove(e),
    onpointerup: (e) => {
      gesture.onpointerup(e);
      endDrag();
    },
    onpointercancel: () => {
      gesture.onpointercancel();
      endDrag();
    },
    onclick: (e) => {
      gesture.onclick(e);
      endDrag();
    },
    onkeydown: (e) => gesture.onkeydown(e),
    onfocus: () => {
      gesture.onfocus();
      endDrag();
    },
    onwindowfocus: () => {
      gesture.onwindowfocus();
      endDrag();
    },
    reset: () => {
      gesture.reset();
      endDrag();
    },
    get isPending() {
      return gesture.isPending;
    },
    get isDragged() {
      return gesture.isDragged;
    },
  };

  return { handlers, isDragging: () => dragging };
}

export interface CreateRoamOptions {
  getWindow: () => RoamWindow;
  /**
   * Live monitor read (the `mascotMonitor()` payload shape, K9). Read once at
   * creation for the initial zone/speed and again on every drag re-base.
   */
  monitor: () => { workArea: PhysicalRect; scaleFactor: number };
  /** The `windows.mascotWindow.roam` config block (logical px / px per s). */
  roam: MascotRoamConfig;
  /**
   * Mascot window size in physical px; shrinks the roam zone so the whole
   * window stays inside the work area. Pass a getter (e.g.
   * `() => outerSizeSync()`) to keep it live: it is re-resolved at creation
   * and on every drag re-base, but NOT per step, so a mid-run size change
   * (e.g. a monitor scale change) takes effect at the next re-base or when
   * the caller recreates the handle. Omit for point-sized behaviour.
   */
  windowSize?: RoamWindowSizeSource;
  onVelocity?: (velocity: PhysicalPoint) => void;
  onToggle?: () => void;
  onDragStart?: () => void | Promise<void>;
  threshold?: number;
  dragClearDelay?: number;
  intervalMs?: number;
}

export interface RoamHandle {
  /** Roam loop controller. */
  roam: RoamController;
  /** Drag binding: element handlers + passthrough `isDragging`. */
  drag: RoamDragBinding;
  /** Current roam zone (changes after every drag re-base). */
  bounds: () => PhysicalRect;
}

/**
 * Composes `roamBounds`, `startRoam`, `createRoamDrag` and
 * `rebaseRoamBounds` into one handle: the zone starts at `roam.corner` of the
 * monitor work area, speed is converted to physical px/s via
 * `monitor().scaleFactor`, and every drag release re-bases the zone around
 * the drop point (clamped) before roam resumes.
 */
export function createRoam(options: CreateRoamOptions): RoamHandle {
  const monitor = options.monitor();
  let bounds = roamBounds(
    monitor.workArea,
    monitor.scaleFactor,
    options.roam,
    options.windowSize,
  );

  const controller = startRoam({
    getWindow: options.getWindow,
    bounds: () => bounds,
    speed: options.roam.speed * normalScale(monitor.scaleFactor),
    onVelocity: options.onVelocity,
    intervalMs: options.intervalMs,
  });

  const drag = createRoamDrag({
    roam: controller,
    getDropPoint: () => options.getWindow().outerPosition(),
    onRebase: (point) => {
      const mon = options.monitor();
      bounds = rebaseRoamBounds(
        point,
        mon.workArea,
        mon.scaleFactor,
        options.roam,
        options.windowSize,
      );
    },
    onToggle: options.onToggle,
    onDragStart: options.onDragStart,
    threshold: options.threshold,
    dragClearDelay: options.dragClearDelay,
  });

  return { roam: controller, drag, bounds: () => bounds };
}
