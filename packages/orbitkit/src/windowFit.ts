/**
 * K9 geometry helpers: content-sized mascot window math.
 *
 * All window math is done in PHYSICAL pixels (K9). Logical inputs are converted
 * with the mascot window's current monitor `scaleFactor`. Fractional logical
 * coordinates are rounded outwards (min edges floored, max edges ceiled) so the
 * window always fully covers the content union on any device scale.
 */

export interface LogicalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhysicalPoint {
  x: number;
  y: number;
}

export interface PhysicalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FitWindowResult {
  /** Physical width of the window. */
  w: number;
  /** Physical height of the window. */
  h: number;
  /** Global physical top-left position the window must take. */
  offset: PhysicalPoint;
}

/**
 * Computes the physical window size and position covering the union bounding
 * box of `rects` (logical px) at device `scale`, grown by `padding` logical px
 * on every side. Empty input or non-positive scale yields a zero-sized window
 * at the origin.
 */
export function fitWindow(
  rects: readonly LogicalRect[],
  scale: number,
  padding = 0,
): FitWindowResult {
  if (rects.length === 0 || !Number.isFinite(scale) || scale <= 0) {
    return { w: 0, h: 0, offset: { x: 0, y: 0 } };
  }

  const pad = Math.ceil(padding * scale);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x * scale);
    minY = Math.min(minY, r.y * scale);
    maxX = Math.max(maxX, (r.x + r.width) * scale);
    maxY = Math.max(maxY, (r.y + r.height) * scale);
  }

  const x = Math.floor(minX) - pad;
  const y = Math.floor(minY) - pad;
  const w = Math.ceil(maxX) + pad - x;
  const h = Math.ceil(maxY) + pad - y;
  return { w, h, offset: { x, y } };
}

export interface ClampCompensation {
  dx: number;
  dy: number;
}

export interface ClampResult extends PhysicalRect {
  /**
   * Applied position delta (`clamped - original`). Inner content shifted by
   * `(-dx, -dy)` stays visually fixed while the window itself is clamped.
   */
  compensation: ClampCompensation;
}

/**
 * Nudges `rect` (physical px) so it lies fully inside `workArea` (physical px),
 * preserving its size, and reports the applied delta as `compensation {dx,dy}`.
 * A rect larger than the work area aligns to the work area's top-left corner.
 */
export function clampToWorkArea(
  rect: PhysicalRect,
  workArea: PhysicalRect,
): ClampResult {
  const x = clampAxis(rect.x, rect.width, workArea.x, workArea.width);
  const y = clampAxis(rect.y, rect.height, workArea.y, workArea.height);
  return {
    x,
    y,
    width: rect.width,
    height: rect.height,
    compensation: { dx: x - rect.x, dy: y - rect.y },
  };
}

function clampAxis(
  pos: number,
  size: number,
  areaPos: number,
  areaSize: number,
): number {
  if (size >= areaSize) return areaPos;
  if (pos < areaPos) return areaPos;
  const maxPos = areaPos + areaSize - size;
  if (pos > maxPos) return maxPos;
  return pos;
}
