import type { MascotAnchor, MascotSheetDef } from "../config";

/** K7 (kind="sheets"): rendered geometry of one sheet frame inside the mascot window. */
export interface SheetGeometry {
  /** Frame size in sheet pixels (pre-scale). */
  frameWidth: number;
  frameHeight: number;
  /** Resolved integer upscale factor (>= 1). */
  scale: number;
  /** Rendered size = frame size * scale. */
  width: number;
  height: number;
  /** Resolved anchor (default "bottom-center"). */
  anchor: MascotAnchor;
  /** Absolute-positioning CSS placement inside the mascot window. */
  style: string;
  /** Positioning transform; mirror appends `scaleX(-1)` to this. */
  transform: string;
}

/**
 * Pure frame index for an elapsed time on a sprite sheet.
 * Hard frame swap semantics: index advances every 1000/fps ms.
 * - loop !== false: index wraps modulo frames.
 * - loop === false: index clamps at the last frame.
 */
export function frameAt(sheet: MascotSheetDef, elapsedMs: number): number {
  const frames = Math.max(1, Math.floor(sheet.frames));
  const fps = typeof sheet.fps === "number" && sheet.fps > 0 ? sheet.fps : 1;
  const elapsed = elapsedMs > 0 ? elapsedMs : 0;
  const index = Math.floor((elapsed / 1000) * fps);
  if (sheet.loop === false) {
    return Math.min(index, frames - 1);
  }
  return index % frames;
}

/**
 * Pure placement math for one sheet frame inside the mascot window.
 * - "bottom-center": bottom edge pinned to the window bottom, centred
 *   horizontally — feet stay on the same baseline when sheets of different
 *   heights swap.
 * - "center": centred within the window on both axes.
 */
export function sheetGeometry(
  sheet: MascotSheetDef,
  scale?: number,
  anchor?: MascotAnchor,
): SheetGeometry {
  // Integer upscale factor (default 1; floors, minimum 1).
  const s =
    typeof scale === "number" && Number.isFinite(scale)
      ? Math.max(1, Math.floor(scale))
      : 1;
  const resolvedAnchor: MascotAnchor = anchor === "center" ? "center" : "bottom-center";
  // Whole sheet pixels: a fractional frame size puts every frame boundary
  // (background-size / background-position-x) off the pixel grid, so the
  // renderer bleeds a neighbouring frame's column in or shaves an edge one.
  const frameWidth = Number.isFinite(sheet.frameWidth)
    ? Math.max(1, Math.round(sheet.frameWidth))
    : 1;
  const frameHeight = Number.isFinite(sheet.frameHeight)
    ? Math.max(1, Math.round(sheet.frameHeight))
    : 1;
  const width = frameWidth * s;
  const height = frameHeight * s;

  const transform =
    resolvedAnchor === "center" ? "translate(-50%, -50%)" : "translateX(-50%)";
  const style =
    resolvedAnchor === "center"
      ? [
          "position: absolute",
          "top: 50%",
          "left: 50%",
          `width: ${width}px`,
          `height: ${height}px`,
          `transform: ${transform}`,
        ].join("; ")
      : [
          "position: absolute",
          "bottom: 0px",
          "left: 50%",
          `width: ${width}px`,
          `height: ${height}px`,
          `transform: ${transform}`,
        ].join("; ");

  return {
    frameWidth,
    frameHeight,
    scale: s,
    width,
    height,
    anchor: resolvedAnchor,
    style,
    transform,
  };
}

/**
 * Full CSS for the frame element: placement from `geo`, hard-swapped frame
 * via background-position (no interpolation), pixelated upscaling, and an
 * optional horizontal mirror (`scaleX(-1)`).
 */
export function sheetFrameStyle(
  sheet: MascotSheetDef,
  geo: SheetGeometry,
  frame: number,
  mirror: boolean,
): string {
  const frames = Math.max(1, Math.floor(sheet.frames));
  const safeFrame = Math.min(Math.max(0, Math.floor(frame)), frames - 1);
  const bgX = -(safeFrame * geo.width);
  const parts = [
    geo.style,
    `background-image: url('${sheet.src}')`,
    "background-repeat: no-repeat",
    `background-size: ${frames * geo.width}px ${geo.height}px`,
    `background-position-x: ${bgX}px`,
    "image-rendering: pixelated",
    `transform: ${mirror ? `${geo.transform} scaleX(-1)` : geo.transform}`,
  ];
  return parts.join("; ");
}
