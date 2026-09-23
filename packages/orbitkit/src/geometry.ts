export interface ItemPosition {
  x: number;
  y: number;
  angle: number;
}

function round2(val: number): number {
  const rounded = Math.round(val * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Computes layout coordinates and angles for radial menu items.
 *
 * @param n - Number of items to place
 * @param radius - Distance from center in pixels
 * @param startDeg - Start angle in degrees (0 = right, clockwise screen y down)
 * @param endDeg - End angle in degrees
 * @returns Array of item positions relative to center, rounded to 0.01
 */
export function layoutItems(
  n: number,
  radius: number,
  startDeg: number,
  endDeg: number
): ItemPosition[] {
  if (n <= 0) return [];

  const span = endDeg - startDeg;
  const isFullRing = Math.abs(span) >= 360;

  const items: ItemPosition[] = [];

  if (isFullRing) {
    if (n === 1) {
      const rad = (startDeg * Math.PI) / 180;
      return [
        {
          x: round2(radius * Math.cos(rad)),
          y: round2(radius * Math.sin(rad)),
          angle: round2(startDeg),
        },
      ];
    }

    const step = (span >= 0 ? 360 : -360) / n;
    for (let i = 0; i < n; i++) {
      const angle = startDeg + i * step;
      const rad = (angle * Math.PI) / 180;
      items.push({
        x: round2(radius * Math.cos(rad)),
        y: round2(radius * Math.sin(rad)),
        angle: round2(angle),
      });
    }
  } else {
    if (n === 1) {
      const angle = (startDeg + endDeg) / 2;
      const rad = (angle * Math.PI) / 180;
      return [
        {
          x: round2(radius * Math.cos(rad)),
          y: round2(radius * Math.sin(rad)),
          angle: round2(angle),
        },
      ];
    }

    const step = span / (n - 1);
    for (let i = 0; i < n; i++) {
      const angle = i === n - 1 ? endDeg : startDeg + i * step;
      const rad = (angle * Math.PI) / 180;
      items.push({
        x: round2(radius * Math.cos(rad)),
        y: round2(radius * Math.sin(rad)),
        angle: round2(angle),
      });
    }
  }

  return items;
}
