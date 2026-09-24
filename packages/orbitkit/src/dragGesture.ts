export const DRAG_THRESHOLD = 4;
export const DEFAULT_DRAG_CLEAR_DELAY = 400;

export interface DragGestureOptions {
  /**
   * Distance in pixels before drag is recognized.
   * Default: DRAG_THRESHOLD (4).
   */
  threshold?: number;
  /**
   * Callback invoked when drag threshold is crossed.
   * Typically calls `startMascotDrag()`.
   */
  onDragStart?: () => void | Promise<void>;
  /**
   * Callback to toggle or open/close menu on click or keyboard activation.
   */
  onToggle?: () => void;
  /**
   * Predicate indicating whether the radial menu is currently open.
   */
  isMenuOpen?: () => boolean;
  /**
   * Closes the radial menu instantly without animation.
   */
  closeMenuInstant?: () => void;
  /**
   * Auto-clear delay in milliseconds for the dragged flag when native drag swallows the terminating click.
   * Default: DEFAULT_DRAG_CLEAR_DELAY (400 ms). Set to 0 to disable timer.
   */
  dragClearDelay?: number;
}

export interface DragGestureHandlers {
  onpointerdown: (e: { button: number; clientX: number; clientY: number }) => void;
  onpointermove: (e: { clientX: number; clientY: number }) => void;
  onpointerup: (e?: { button?: number }) => void;
  onpointercancel: () => void;
  onclick: (e?: { defaultPrevented?: boolean; preventDefault?: () => void }) => void;
  onkeydown: (e: { key: string; defaultPrevented?: boolean; preventDefault?: () => void }) => void;
  onfocus: () => void;
  onwindowfocus: () => void;
  readonly isPending: boolean;
  readonly isDragged: boolean;
  reset: () => void;
}

/**
 * Pure state machine managing drag vs click disambiguation for the mascot overlay.
 *
 * Rules:
 * - pointerdown: records initial x/y coordinates and sets pending flag if primary button. If `dragged` was already set, arms the auto-clear timer. Non-primary buttons are ignored.
 * - pointermove: when moved > threshold (4px), triggers `closeMenuInstant` if menu is open, starts drag, and sets `dragged = true`.
 * - drag-end signals: window focus (`onfocus`/`onwindowfocus`), `pointerup`/`pointercancel` while dragged, or a subsequent `pointerdown` arm the auto-clear timer (`dragClearDelay`, default 400ms) to clear `dragged` state if the platform swallows the terminating mouseup/click.
 * - click: if `dragged` was set, suppresses toggle, clears the auto-clear timer, and resets `dragged = false`. Otherwise calls `onToggle`.
 * - pointerup/pointercancel: resets pending; if `dragged` is true, arms the auto-clear timer.
 * - keydown (Enter/Space): calls `onToggle`.
 * - Errors from `onDragStart` clear the timer and reset `dragged = false` allowing click to fall through.
 */
export function createDragGesture(options: DragGestureOptions = {}): DragGestureHandlers {
  const threshold = options.threshold ?? DRAG_THRESHOLD;
  const dragClearDelay = options.dragClearDelay ?? DEFAULT_DRAG_CLEAR_DELAY;
  let startX = 0;
  let startY = 0;
  let pending = false;
  let dragged = false;
  let dragTimer: unknown = undefined;

  function clearDragTimer() {
    if (dragTimer !== undefined) {
      clearTimeout(dragTimer as number);
      dragTimer = undefined;
    }
  }

  function armDragTimer() {
    clearDragTimer();
    if (dragClearDelay > 0) {
      dragTimer = setTimeout(() => {
        dragged = false;
        dragTimer = undefined;
      }, dragClearDelay);
    }
  }

  function onpointerdown(e: { button: number; clientX: number; clientY: number }) {
    if (dragClearDelay === 0) {
      dragged = false;
      clearDragTimer();
    } else if (dragged) {
      armDragTimer();
    } else {
      clearDragTimer();
    }
    if (e.button !== 0) {
      return;
    }
    startX = e.clientX;
    startY = e.clientY;
    pending = true;
  }

  function onpointermove(e: { clientX: number; clientY: number }) {
    if (!pending) {
      return;
    }
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dist = Math.hypot(dx, dy);

    if (dist > threshold) {
      pending = false;
      dragged = true;
      clearDragTimer();
      if (options.isMenuOpen && options.isMenuOpen()) {
        options.closeMenuInstant?.();
      }

      if (options.onDragStart) {
        try {
          const res = options.onDragStart();
          if (res && typeof (res as Promise<void>).catch === "function") {
            (res as Promise<void>).catch((err) => {
              clearDragTimer();
              console.error("[dragGesture] Failed to start native drag:", err);
              dragged = false;
            });
          }
        } catch (err) {
          clearDragTimer();
          console.error("[dragGesture] Failed to start native drag:", err);
          dragged = false;
        }
      }
    }
  }

  function onpointerup(_e?: { button?: number }) {
    pending = false;
    if (dragged) {
      armDragTimer();
    }
  }

  function onpointercancel() {
    pending = false;
    if (dragged) {
      armDragTimer();
    }
  }

  function onwindowfocus() {
    if (dragged) {
      armDragTimer();
    }
  }

  function onclick(e?: { defaultPrevented?: boolean; preventDefault?: () => void }) {
    clearDragTimer();
    if (dragged) {
      dragged = false;
      e?.preventDefault?.();
      return;
    }
    options.onToggle?.();
  }
  function onkeydown(e: { key: string; defaultPrevented?: boolean; preventDefault?: () => void }) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault?.();
      options.onToggle?.();
    }
  }

  function reset() {
    clearDragTimer();
    pending = false;
    dragged = false;
  }

  return {
    onpointerdown,
    onpointermove,
    onpointerup,
    onpointercancel,
    onclick,
    onkeydown,
    onfocus: onwindowfocus,
    onwindowfocus,
    get isPending() {
      return pending;
    },
    get isDragged() {
      return dragged;
    },
    reset,
  };
}
