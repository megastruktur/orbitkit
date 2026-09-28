/**
 * demo-b1 pure window-fit math (starter-local; no library changes).
 *
 * Model (single source of truth for MascotView):
 * - The mascot is pinned bottom-centre inside its window by CSS
   (`.fit-shift` at left:50%/bottom:0), so its window-local position is a pure
   function of the window size — the DOM never re-centres on resize.
 * - For each state ("idle" content fit, "open" menu fit) the target window
   rect is chosen so the mascot's SCREEN position is bit-identical across
   transitions (SMOKE B1.2/B1.4: feet never move).
 * - Only a work-area clamp may move the window away from the ideal position;
   that clamp delta is compensated 1:1 by a content translate (`shift`),
   so the mascot still stays put (rare edge case).
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
  /** Horizontal transparent padding kept beside the mascot in the idle fit. */
  idlePadX: number;
  /** Padding grown around the content union while the menu is open. */
  menuPad: number;
}

export type DemoFitState = "idle" | "open";

export interface DemoFitResult {
  /** Target window rect (logical screen coords). */
  window: Rect;
  /** Content compensation translate (logical px); zero unless clamped. */
  shift: Point;
  /** Mascot bounds in the TARGET window coords (post-shift). */
  anchor: Rect;
  /** Mascot top-left in the target window (post-shift). */
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
 * Computes the target window rect for `state` that keeps the mascot's screen
 * position fixed, the work-area-compensating content shift, and the mascot
 * bounds the RadialMenu needs as `anchorRect` (post-shift window coords).
 */
export function demoWindowFit(input: DemoFitInput, state: DemoFitState): DemoFitResult {
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
  let minX: number;
  let minY: number;
  let maxX: number;
  let maxY: number;
  if (state === "idle") {
    minX = -input.idlePadX;
    minY = 0;
    maxX = m + input.idlePadX;
    maxY = m;
  } else {
    const reach = input.radius + input.itemSize / 2;
    minX = m / 2 - reach;
    maxX = m / 2 + reach;
    minY = -(input.headGap + reach);
    maxY = Math.max(m, input.itemSize / 2 - input.headGap);
  }
  // Padding: open state grows above + sides only — the bottom edge stays
  // exactly at the mascot's bottom so the CSS bottom-centre pin is exact in
  // both states (bottom padding would make the pinned mascot jump by menuPad).
  const padX = state === "open" ? input.menuPad : 0;
  const padTop = state === "open" ? input.menuPad : 0;
  const minXp = minX - padX;
  const minYp = minY - padTop;
  const maxXp = maxX + padX;
  const maxYp = maxY;

  const width = Math.ceil(maxXp - minXp);
  const height = Math.ceil(maxYp - minYp);
  // Where the mascot must sit inside the new window so the content union
  // starts at (0,0): the CSS pin then places it exactly there.
  const gNew: Point = { x: -minXp, y: -minYp };

  // Ideal window position keeps the mascot's screen position exactly.
  const ideal: Point = { x: g.x - gNew.x, y: g.y - gNew.y };
  // Clamp into the work area (size preserved). The clamp delta C moves the
  // window by C; compensating the content by -C keeps the mascot fixed.
  const cx = clampRange(ideal.x, width, input.workArea.x, input.workArea.width);
  const cy = clampRange(ideal.y, height, input.workArea.y, input.workArea.height);
  const shift: Point = { x: ideal.x - cx, y: ideal.y - cy };

  const mascotLocal: Point = { x: gNew.x + shift.x, y: gNew.y + shift.y };
  return {
    window: { x: cx, y: cy, width, height },
    shift,
    anchor: { x: mascotLocal.x, y: mascotLocal.y, width: m, height: m },
    mascotLocal,
  };
}
