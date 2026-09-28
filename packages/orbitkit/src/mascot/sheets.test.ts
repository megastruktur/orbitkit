import { describe, expect, it } from "vitest";
import type { MascotSheetDef } from "../config";
import { frameAt, sheetFrameStyle, sheetGeometry } from "./sheets";

const walk: MascotSheetDef = {
  src: "walk.png",
  frameWidth: 32,
  frameHeight: 32,
  frames: 4,
  fps: 2,
  loop: true,
};

describe("frameAt", () => {
  it("advances one frame per 1000/fps ms", () => {
    expect(frameAt(walk, 0)).toBe(0);
    expect(frameAt(walk, 1)).toBe(0);
    expect(frameAt(walk, 499)).toBe(0);
    expect(frameAt(walk, 500)).toBe(1);
    expect(frameAt(walk, 999)).toBe(1);
    expect(frameAt(walk, 1000)).toBe(2);
    expect(frameAt(walk, 1500)).toBe(3);
  });

  it("wraps modulo frames when loop is enabled", () => {
    // 4 frames @ 2 fps -> 2000 ms period.
    expect(frameAt(walk, 2000)).toBe(0);
    expect(frameAt(walk, 2500)).toBe(1);
    expect(frameAt(walk, 5499)).toBe(2);
    expect(frameAt(walk, 10000)).toBe(0);
  });

  it("clamps at the last frame when loop is disabled", () => {
    const once: MascotSheetDef = { ...walk, loop: false };
    expect(frameAt(once, 1500)).toBe(3);
    expect(frameAt(once, 2000)).toBe(3);
    expect(frameAt(once, 999999)).toBe(3);
  });

  it("guards degenerate sheets: fps<=0 acts as 1fps, frames<=0 acts as 1", () => {
    const zeroFps: MascotSheetDef = { ...walk, fps: 0 };
    expect(frameAt(zeroFps, 1000)).toBe(1);
    expect(frameAt(zeroFps, 2500)).toBe(2); // 2500ms at the guarded 1fps
    const zeroFrames: MascotSheetDef = { ...walk, frames: 0 };
    expect(frameAt(zeroFrames, 12345)).toBe(0);
  });

  it("treats negative elapsed time as frame 0", () => {
    expect(frameAt(walk, -250)).toBe(0);
  });
});

describe("sheetGeometry", () => {
  it("scales frame dimensions by the integer scale factor", () => {
    const geo = sheetGeometry(walk, 2);
    expect(geo).toMatchObject({
      frameWidth: 32,
      frameHeight: 32,
      scale: 2,
      width: 64,
      height: 64,
      anchor: "bottom-center",
    });
  });

  it("defaults to bottom-center anchoring with the bottom edge pinned", () => {
    const geo = sheetGeometry(walk, 1);
    expect(geo.style).toContain("position: absolute");
    expect(geo.style).toContain("bottom: 0px");
    expect(geo.style).toContain("left: 50%");
    expect(geo.transform).toBe("translateX(-50%)");
  });

  it("centers the frame when anchor=center (no bottom pin)", () => {
    const geo = sheetGeometry(walk, 1, "center");
    expect(geo.anchor).toBe("center");
    expect(geo.style).toContain("top: 50%");
    expect(geo.style).toContain("left: 50%");
    expect(geo.style).not.toContain("bottom:");
    expect(geo.transform).toBe("translate(-50%, -50%)");
  });

  it("normalizes non-integer and degenerate scales to a positive integer", () => {
    expect(sheetGeometry(walk, 2.9).scale).toBe(2);
    expect(sheetGeometry(walk, 1).scale).toBe(1);
    expect(sheetGeometry(walk, 0).scale).toBe(1);
    expect(sheetGeometry(walk, -3).scale).toBe(1);
    expect(sheetGeometry(walk).scale).toBe(1);
  });
});

describe("sheetFrameStyle", () => {
  const geo = sheetGeometry(walk, 2);

  it("renders the hard-swapped frame via background-position without interpolation", () => {
    const style = sheetFrameStyle(walk, geo, 3, false);
    expect(style).toContain("background-image: url('walk.png')");
    // 4 frames * 32px * scale 2 = 256px strip; frame 3 -> -3 * 64px.
    expect(style).toContain("background-size: 256px 64px");
    expect(style).toContain("background-position-x: -192px");
    expect(style).toContain("image-rendering: pixelated");
    expect(style).not.toContain("animation");
  });

  it("appends the mirror flip to the anchor transform", () => {
    const plain = sheetFrameStyle(walk, geo, 0, false);
    expect(plain).toContain("transform: translateX(-50%)");
    const mirrored = sheetFrameStyle(walk, geo, 0, true);
    expect(mirrored).toContain("transform: translateX(-50%) scaleX(-1)");
  });

  it("clamps out-of-range frame indices into the sheet", () => {
    expect(sheetFrameStyle(walk, geo, 99, false)).toContain(
      "background-position-x: -192px",
    );
  });
});
