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

export interface MenuAngleResolutionInput {
  layout?: "orbit" | "arc" | "arc-anchor";
  arc?: {
    position?: "top" | "bottom" | "left" | "right";
    span?: number;
    /** K7 arc-anchor only: px gap above the mascot's top edge (geometry, not angles). */
    headGap?: number;
  };
  startAngle?: number;
  endAngle?: number;
}

export interface ResolvedMenuAngles {
  startAngle: number;
  endAngle: number;
}

/**
 * Resolves start and end angles for radial menu items based on layout configuration.
 *
 * Angles use K3 geometry: 0 = right, clockwise, screen y points down.
 * Centre angles: top -90, right 0, bottom 90, left 180.
 * For `layout: "arc"`:
 *   startAngle = centre - span/2
 *   endAngle = centre + span/2
 * For `layout: "arc-anchor"` (K7): same top-centred arc as `"arc"` with
 * `position: "top"`; the anchor placement itself is handled by
 * `resolveMenuOrigin` against the mascot bounds.
 * Defaults:
 *   position: "top" (-90)
 *   span: 180
 *
 * For `layout: "orbit"` (or default):
 *   startAngle = menu.startAngle ?? -90
 *   endAngle = menu.endAngle ?? 270
 */
export function resolveMenuAngles(
  menu?: MenuAngleResolutionInput | null
): ResolvedMenuAngles {
  if (menu?.layout === "arc" || menu?.layout === "arc-anchor") {
    const position = menu.layout === "arc-anchor" ? "top" : menu.arc?.position ?? "top";
    const span = menu.arc?.span ?? 180;

    let centre: number;
    switch (position) {
      case "top":
        centre = -90;
        break;
      case "right":
        centre = 0;
        break;
      case "bottom":
        centre = 90;
        break;
      case "left":
        centre = 180;
        break;
      default:
        centre = -90;
    }

    return {
      startAngle: round2(centre - span / 2),
      endAngle: round2(centre + span / 2),
    };
  }

  return {
    startAngle: menu?.startAngle ?? -90,
    endAngle: menu?.endAngle ?? 270,
  };
}

/** K7: mascot bounds in window coordinates (RadialMenu `anchorRect` prop). */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** K7 arc-anchor: window-coordinate origin of the arc's centre point. */
export interface MenuOrigin {
  x: number;
  y: number;
}

/**
 * K7 layout "arc-anchor": the arc's centre point sits horizontally centred on
 * the mascot bounds and `headGap` px above the mascot's top edge.
 * Items are positioned relative to this origin, so the component shifts the
 * menu container by the returned offset. `headGap` comes from
 * `menu.arc.headGap` (config default 12).
 */
export function resolveMenuOrigin(
  anchorRect: AnchorRect | null | undefined,
  headGap: number
): MenuOrigin {
  if (!anchorRect) {
    return { x: 0, y: 0 };
  }
  return {
    x: anchorRect.x + anchorRect.width / 2,
    y: anchorRect.y - headGap,
  };
}
