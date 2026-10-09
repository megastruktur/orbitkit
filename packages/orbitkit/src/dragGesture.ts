export const DRAG_THRESHOLD = 4;
export const DEFAULT_DRAG_CLEAR_DELAY = 400;

/** Pointer button that opens (toggles) the radial menu. */
export type OpenButton = "left" | "right";

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
  /**
   * Pointer button that opens (toggles) the menu. Default `"left"`: primary
   * button toggles, non-primary buttons are ignored (legacy behavior).
   * `"right"`: button 2 sets pending and toggles (via the click event or the
   * `contextmenu` handler — browsers do not deliver `click` for button 2),
   * while the primary button only drags and never toggles. With
   * `openButton: "right"` the `contextmenu` event must also be wired: the
   * handler suppresses the OS context menu (preventDefault) over the mascot.
   */
  openButton?: OpenButton;
}

export interface DragGestureHandlers {
  onpointerdown: (e: { button: number; clientX: number; clientY: number }) => void;
  onpointermove: (e: { clientX: number; clientY: number }) => void;
  onpointerup: (e?: { button?: number }) => void;
  onpointercancel: () => void;
  onclick: (e?: { defaultPrevented?: boolean; preventDefault?: () => void }) => void;
  oncontextmenu: (e?: { preventDefault?: () => void }) => void;
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
 * - pointerdown: records initial x/y coordinates and sets pending flag if primary button. If `dragged` was already set, arms the auto-clear timer. Non-primary buttons are ignored. With `openButton: "right"`, button 2 also sets pending (toggle path) and the primary button only drags.
 * - pointermove: when moved > threshold (4px), triggers `closeMenuInstant` if menu is open, starts drag, and sets `dragged = true`.
 * - drag-end signals: window focus (`onfocus`/`onwindowfocus`), `pointerup`/`pointercancel` while dragged, or a subsequent `pointerdown` arm the auto-clear timer (`dragClearDelay`, default 400ms) to clear `dragged` state if the platform swallows the terminating mouseup/click.
 * - click: if `dragged` was set, suppresses toggle, clears the auto-clear timer, and resets `dragged = false`. Otherwise calls `onToggle` (with `openButton: "right"` only when the gesture started on button 2).
 * - contextmenu (only with `openButton: "right"`): always preventDefaults so the OS context menu never shows over the mascot, then toggles unless the gesture was a drag. Browsers deliver no `click` for button 2, so this is the real toggle path for right-button presses.
 * - pointerup/pointercancel: resets pending; if `dragged` is true, arms the auto-clear timer.
 * - keydown (Enter/Space): calls `onToggle`.
 * - Errors from `onDragStart` clear the timer and reset `dragged = false` allowing click to fall through.
 */
export function createDragGesture(options: DragGestureOptions = {}): DragGestureHandlers {
  const threshold = options.threshold ?? DRAG_THRESHOLD;
  const dragClearDelay = options.dragClearDelay ?? DEFAULT_DRAG_CLEAR_DELAY;
  const openButton: OpenButton = options.openButton ?? "left";
  let startX = 0;
  let startY = 0;
  let pending = false;
  let dragged = false;
  let dragTimer: unknown = undefined;
  // Button of the gesture currently in flight (-1 = none). Lets `onclick`
  // tell an open-button click from a drag-only-button click without relying
  // on the DOM `click` event carrying the button (it never does here).
  let downButton = -1;

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
    if (openButton === "left") {
      if (e.button !== 0) {
        return;
      }
    } else if (e.button !== 0 && e.button !== 2) {
      // openButton "right": right sets pending (toggle path), left drags,
      // every other button is ignored.
      return;
    }
    downButton = e.button;
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
    if (openButton === "right" && downButton !== 2) {
      // Primary-button click: drag-only, never opens the menu.
      return;
    }
    options.onToggle?.();
  }
  function oncontextmenu(e?: { preventDefault?: () => void }) {
    if (openButton !== "right") {
      return;
    }
    // Suppress the OS context menu over the mascot. Browsers deliver no
    // `click` for button 2, so this event is the real right-press toggle.
    e?.preventDefault?.();
    clearDragTimer();
    if (dragged) {
      dragged = false;
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
    downButton = -1;
  }

  return {
    onpointerdown,
    onpointermove,
    onpointerup,
    onpointercancel,
    onclick,
    oncontextmenu,
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
