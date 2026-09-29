/**
 * demo-b1 pure window-fit math (starter-local; no library changes).
 *
 * Model (Design B, single source of truth for MascotView):
 * - The mascot window is sized and positioned ONCE (at boot) to the largest
 *   content union — the open-menu union (mascot + arc + pad). The idle
 *   content (the mascot only) fits inside it; the extra area is transparent
 *   and click-through under K10 passthrough.
 * - Menu open/close therefore never calls setSize/setPosition: transitions
 *   are content-only inside the fixed transparent surface. This removes the
 *   macOS blink by construction: no per-toggle native resize/move pair can
 *   be composited as NEW size at OLD origin.
 * - The mascot is pinned bottom-centre inside the window by CSS
 *   (`.fit-shift` at left:50%/bottom:0), so its window-local position is a
 *   pure function of the window size — identical in both states.
 * - The one-time fit chooses the window rect so the mascot's SCREEN position
 *   is identical before and after it. Only a work-area clamp may move the
 *   window away from the ideal position; the clamp delta is compensated by a
 *   content translate (`shift`) that likewise never changes on open/close —
 *   EXCEPT downward: the mascot is bottom-pinned at the window's bottom edge
 *   (padding grows above+sides only), so a positive y compensation would push
 *   it PAST that edge and clip it. The y compensation is therefore capped at
 *   the mascot's bottom edge; when the cap binds (window clamped up against
 *   the work-area bottom, e.g. by a taskbar), the mascot moves UP with the
 *   window — it yields to the work-area edge like any OS window, never cut.
 *   After a native drag or a monitor/scale change the window is re-clamped
 *   ONCE via `clampFixedWindow` (window-only move; the same "moves with the
 *   window" behaviour), not per menu toggle.
 *
 * All coordinates are LOGICAL px. Angles/geometry follow K7 arc-anchor: the
 * arc centre sits `headGap` px above the mascot's top edge, centred.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface DemoFitInput {
  /** Current mascot-window rect, logical screen coords. */
  window: Rect;
  /** Work area of the mascot's monitor, logical screen coords. */
  workArea: Rect;
  /** Rendered mascot box in px (frame * scale), e.g. 96. */
  mascot: number;
  /** K7 arc-anchor head gap (px above the mascot's top edge). */
  headGap: number;
  /** Menu radius (disc-centre distance from the arc centre). */
  radius: number;
  /** Menu disc size. */
  itemSize: number;
  /** Transparent padding kept around the open-menu content union. */
  menuPad: number;
}

export interface DemoFitResult {
  /** Fixed window rect (logical screen coords); identical in both states. */
  window: Rect;
  /** Content compensation translate (logical px); zero unless clamped. The
   * y component is capped so the bottom-pinned mascot never passes the
   * window's bottom edge (when the cap binds, the mascot moves with the
   * window instead of being clipped). */
  shift: Point;
  /** Mascot bounds in the fixed window coords (post-shift). */
  anchor: Rect;
  /** Mascot top-left in the fixed window (post-shift). */
  mascotLocal: Point;
}

/** Nudges `pos` so [pos, pos+size] lies inside [areaPos, areaPos+areaSize]. */
function clampRange(pos: number, size: number, areaPos: number, areaSize: number): number {
  if (size >= areaSize) return areaPos;
  if (pos < areaPos) return areaPos;
  if (pos + size > areaPos + areaSize) return areaPos + areaSize - size;
  return pos;
}

/**
 * Computes the FIXED window rect that fits the open-menu content union,
 * keeping the mascot's screen position identical to its position inside
 * `input.window` (the CSS bottom-centre pin derives that from the current
 * window rect). The result does not depend on any open/close state: the
 * starter applies it once at boot; `anchor` is then constant for the
 * RadialMenu across menu transitions. A work-area clamp is compensated by
 * `shift` so the mascot still stays put — except that the downward (y)
 * compensation is capped at the window's bottom edge: the bottom-pinned
 * mascot is never clipped; near work-area edges it moves up with the window.
 */
export function demoWindowFit(input: DemoFitInput): DemoFitResult {
  const m = input.mascot;
  // CSS pins the mascot bottom-centre: local position is pure in the size.
  const mascotLocalNow: Point = {
    x: (input.window.width - m) / 2,
    y: input.window.height - m,
  };
  // Mascot top-left in logical screen coords, right now.
  const g: Point = {
    x: input.window.x + mascotLocalNow.x,
    y: input.window.y + mascotLocalNow.y,
  };

  // Content union bounds relative to the mascot's top-left. The arc spans
  // angles -180..0 (upper half): discs sit at or above the arc centre line.
  // reach = disc-centre radius + half a disc → bound of the outermost disc box.
  // This is the LARGEST content state (menu open); the fixed window always
  // uses it so the idle content fits with room to spare.
  const reach = input.radius + input.itemSize / 2;
  const minX = m / 2 - reach;
  const maxX = m / 2 + reach;
  const minY = -(input.headGap + reach);
  const maxY = Math.max(m, input.itemSize / 2 - input.headGap);

  // Padding grows above + sides only — the bottom edge stays exactly at the
  // mascot's bottom so the CSS bottom-centre pin is exact (bottom padding
  // would displace the pinned mascot by menuPad).
  const minXp = minX - input.menuPad;
  const minYp = minY - input.menuPad;
  const maxXp = maxX + input.menuPad;
  const maxYp = maxY;

  const width = Math.ceil(maxXp - minXp);
  const height = Math.ceil(maxYp - minYp);
  // Where the mascot must sit inside the window so the content union starts
  // at (0,0): the CSS pin then places it exactly there.
  const gNew: Point = { x: -minXp, y: -minYp };

  // Ideal window position keeps the mascot's screen position exactly.
  const ideal: Point = { x: g.x - gNew.x, y: g.y - gNew.y };
  // Clamp into the work area (size preserved). The clamp delta C moves the
  // window by C; compensating the content by -C keeps the mascot fixed —
  // except downward: the mascot's bottom sits exactly at the window's bottom
  // edge (padding grows above+sides only), so a positive y compensation
  // would push it past that edge and CLIP it. Cap the y compensation at the
  // mascot's bottom edge; when the cap binds, the mascot rides up with the
  // window (yields to the work-area edge, e.g. the taskbar) — never cut.
  // (`height - m - gNew.y` is the padding slack below the mascot's bottom;
  // it is always >= 0 because maxYp >= m.)
  const cx = clampRange(ideal.x, width, input.workArea.x, input.workArea.width);
  const cy = clampRange(ideal.y, height, input.workArea.y, input.workArea.height);
  const shift: Point = {
    x: ideal.x - cx,
    y: Math.min(ideal.y - cy, height - m - gNew.y),
  };

  const mascotLocal: Point = { x: gNew.x + shift.x, y: gNew.y + shift.y };
  return {
    window: { x: cx, y: cy, width, height },
    shift,
    anchor: { x: mascotLocal.x, y: mascotLocal.y, width: m, height: m },
    mascotLocal,
  };
}

/**
 * Re-clamps a fixed-size window into the work area after a native drag or a
 * monitor/scale change. Returns the clamped rect — the caller moves the
 * WINDOW only (setPosition); the mascot stays pinned at its constant
 * window-local position and moves with it (the accepted behaviour near
 * edges). The window SIZE is untouched, so the mascot's local position — a
 * pure function of the size — and with it the arc anchorRect never change.
 * Deliberately stateless: no content shift is produced or consumed
 * (contentShift/anchorRect are boot-constant; a shift update here is what
 * desynced the arc from the mascot in the round-1 design). Identity when
 * the window is already inside. Called ONCE per settle — never per menu
 * open/close.
 */
export function clampFixedWindow(window: Rect, workArea: Rect): Rect {
  const cx = clampRange(window.x, window.width, workArea.x, workArea.width);
  const cy = clampRange(window.y, window.height, workArea.y, workArea.height);
  return { ...window, x: cx, y: cy };
}
