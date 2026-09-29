import { describe, expect, it } from "vitest";
import {
  clampToWorkArea,
  fitWindow,
  type LogicalRect,
  type PhysicalRect,
} from "./windowFit";

describe("fitWindow (K9 AC1)", () => {
  it("passes a single integral rect through at scale 1", () => {
    const rects: LogicalRect[] = [{ x: 100, y: 50, width: 60, height: 40 }];
    expect(fitWindow(rects, 1)).toEqual({
      w: 60,
      h: 40,
      offset: { x: 100, y: 50 },
    });
  });

  it("rounds fractional edges outwards at scale 1.5", () => {
    // min edge 1.5 * 1.5 = 2.25 -> floor 2; max edge (1.5 + 3.3) * 1.5 = 7.2 -> ceil 8
    const rects: LogicalRect[] = [{ x: 1.5, y: 1.5, width: 3.3, height: 3.3 }];
    expect(fitWindow(rects, 1.5)).toEqual({
      w: 6,
      h: 6,
      offset: { x: 2, y: 2 },
    });
  });

  it("grows by ceil(padding * scale) on every side", () => {
    const rects: LogicalRect[] = [{ x: 1.5, y: 1.5, width: 3.3, height: 3.3 }];
    // pad = ceil(1 * 1.5) = 2; x0 = 2 - 2 = 0; w = 8 + 2 - 0 = 10
    expect(fitWindow(rects, 1.5, 1)).toEqual({
      w: 10,
      h: 10,
      offset: { x: 0, y: 0 },
    });
  });

  it("unions multiple content rects", () => {
    const rects: LogicalRect[] = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 50, y: 25, width: 5, height: 5 },
    ];
    expect(fitWindow(rects, 2)).toEqual({
      w: 110,
      h: 60,
      offset: { x: 0, y: 0 },
    });
  });

  it("unions rects with fractional edges off the origin", () => {
    const rects: LogicalRect[] = [
      { x: 10.4, y: 20.6, width: 10, height: 10 },
    ];
    // x: 20.8 -> 20, right 40.8 -> 41 => w 21; y: 41.2 -> 41, bottom 61.2 -> 62 => h 21
    expect(fitWindow(rects, 2)).toEqual({
      w: 21,
      h: 21,
      offset: { x: 20, y: 41 },
    });
  });

  it("handles negative logical coordinates", () => {
    const rects: LogicalRect[] = [{ x: -10, y: -5, width: 4, height: 4 }];
    expect(fitWindow(rects, 1)).toEqual({
      w: 4,
      h: 4,
      offset: { x: -10, y: -5 },
    });
  });

  it("returns a zero-sized window at the origin for empty input", () => {
    expect(fitWindow([], 2)).toEqual({ w: 0, h: 0, offset: { x: 0, y: 0 } });
  });

  it("returns a zero-sized window for non-positive scale", () => {
    const rects: LogicalRect[] = [{ x: 1, y: 1, width: 2, height: 2 }];
    expect(fitWindow(rects, 0)).toEqual({ w: 0, h: 0, offset: { x: 0, y: 0 } });
    expect(fitWindow(rects, -1.5)).toEqual({
      w: 0,
      h: 0,
      offset: { x: 0, y: 0 },
    });
  });
});

describe("clampToWorkArea (K9 AC2)", () => {
  const work: PhysicalRect = { x: 0, y: 0, width: 1920, height: 1080 };

  it("keeps an inside rect unchanged with zero compensation", () => {
    const rect: PhysicalRect = { x: 100, y: 200, width: 300, height: 200 };
    expect(clampToWorkArea(rect, work)).toEqual({
      x: 100,
      y: 200,
      width: 300,
      height: 200,
      compensation: { dx: 0, dy: 0 },
    });
  });

  it("pushes a rect overflowing the left edge inside", () => {
    const rect: PhysicalRect = { x: -30, y: 500, width: 100, height: 100 };
    expect(clampToWorkArea(rect, work)).toEqual({
      x: 0,
      y: 500,
      width: 100,
      height: 100,
      compensation: { dx: 30, dy: 0 },
    });
  });

  it("pulls a rect overflowing the right edge inside", () => {
    const rect: PhysicalRect = { x: 1900, y: 500, width: 100, height: 100 };
    expect(clampToWorkArea(rect, work)).toEqual({
      x: 1820,
      y: 500,
      width: 100,
      height: 100,
      compensation: { dx: -80, dy: 0 },
    });
  });

  it("pushes a rect overflowing the top edge inside", () => {
    const rect: PhysicalRect = { x: 500, y: -10, width: 100, height: 100 };
    expect(clampToWorkArea(rect, work)).toEqual({
      x: 500,
      y: 0,
      width: 100,
      height: 100,
      compensation: { dx: 0, dy: 10 },
    });
  });

  it("pulls a rect overflowing the bottom edge inside", () => {
    const rect: PhysicalRect = { x: 500, y: 1050, width: 100, height: 100 };
    expect(clampToWorkArea(rect, work)).toEqual({
      x: 500,
      y: 980,
      width: 100,
      height: 100,
      compensation: { dx: 0, dy: -70 },
    });
  });

  it("clamps a top-left corner overflow", () => {
    const rect: PhysicalRect = { x: -5, y: -7, width: 100, height: 100 };
    expect(clampToWorkArea(rect, work)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      compensation: { dx: 5, dy: 7 },
    });
  });

  it("clamps a bottom-right corner overflow", () => {
    const rect: PhysicalRect = { x: 1900, y: 1070, width: 100, height: 100 };
    expect(clampToWorkArea(rect, work)).toEqual({
      x: 1820,
      y: 980,
      width: 100,
      height: 100,
      compensation: { dx: -80, dy: -90 },
    });
  });

  it("aligns an oversized rect to the work area top-left", () => {
    const rect: PhysicalRect = { x: 100, y: 200, width: 2000, height: 1200 };
    expect(clampToWorkArea(rect, work)).toEqual({
      x: 0,
      y: 0,
      width: 2000,
      height: 1200,
      compensation: { dx: -100, dy: -200 },
    });
  });

  it("clamps against an offset work area with negative origin", () => {
    const left: PhysicalRect = { x: -1920, y: 0, width: 1920, height: 1080 };
    const rect: PhysicalRect = { x: -2000, y: 500, width: 100, height: 100 };
    expect(clampToWorkArea(rect, left)).toEqual({
      x: -1920,
      y: 500,
      width: 100,
      height: 100,
      compensation: { dx: 80, dy: 0 },
    });
  });
});
