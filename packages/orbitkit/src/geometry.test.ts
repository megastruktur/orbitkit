import { describe, expect, it } from "vitest";
import { layoutItems, resolveMenuAngles } from "./geometry";
import arcVectors from "./arc-vectors.json";

describe("layoutItems geometry", () => {
  it("full ring n=4 distributes 4 cardinal points without duplicating endpoint (0..360)", () => {
    const points = layoutItems(4, 100, 0, 360);
    expect(points).toHaveLength(4);
    // 0 deg: right (100, 0)
    expect(points[0]).toEqual({ x: 100, y: 0, angle: 0 });
    // 90 deg: down (0, 100)
    expect(points[1]).toEqual({ x: 0, y: 100, angle: 90 });
    // 180 deg: left (-100, 0)
    expect(points[2]).toEqual({ x: -100, y: 0, angle: 180 });
    // 270 deg: up (0, -100)
    expect(points[3]).toEqual({ x: 0, y: -100, angle: 270 });
  });

  it("full ring n=4 with negative start angle (-90..270) produces 4 cardinal points", () => {
    const points = layoutItems(4, 100, -90, 270);
    expect(points).toHaveLength(4);
    // -90 deg: up (0, -100)
    expect(points[0]).toEqual({ x: 0, y: -100, angle: -90 });
    // 0 deg: right (100, 0)
    expect(points[1]).toEqual({ x: 100, y: 0, angle: 0 });
    // 90 deg: down (0, 100)
    expect(points[2]).toEqual({ x: 0, y: 100, angle: 90 });
    // 180 deg: left (-100, 0)
    expect(points[3]).toEqual({ x: -100, y: 0, angle: 180 });
  });

  it("partial arc -90..90 n=3 includes both endpoints and midpoint", () => {
    const points = layoutItems(3, 100, -90, 90);
    expect(points).toHaveLength(3);
    // start endpoint: -90 deg -> (0, -100)
    expect(points[0]).toEqual({ x: 0, y: -100, angle: -90 });
    // midpoint: 0 deg -> (100, 0)
    expect(points[1]).toEqual({ x: 100, y: 0, angle: 0 });
    // end endpoint: 90 deg -> (0, 100)
    expect(points[2]).toEqual({ x: 0, y: 100, angle: 90 });
  });

  it("partial arc n=1 places single item at midpoint angle", () => {
    const points = layoutItems(1, 100, -90, 90);
    expect(points).toHaveLength(1);
    // midpoint between -90 and 90 is 0 deg -> (100, 0)
    expect(points[0]).toEqual({ x: 100, y: 0, angle: 0 });

    const points2 = layoutItems(1, 100, 0, 180);
    expect(points2).toHaveLength(1);
    // midpoint between 0 and 180 is 90 deg -> (0, 100)
    expect(points2[0]).toEqual({ x: 0, y: 100, angle: 90 });
  });

  it("full ring n=1 places single item at start angle", () => {
    const points = layoutItems(1, 100, 0, 360);
    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({ x: 100, y: 0, angle: 0 });

    const pointsNeg = layoutItems(1, 100, -90, 270);
    expect(pointsNeg).toHaveLength(1);
    expect(pointsNeg[0]).toEqual({ x: 0, y: -100, angle: -90 });
  });

  it("scales coordinates proportionally with radius", () => {
    const r50 = layoutItems(4, 50, 0, 360);
    const r150 = layoutItems(4, 150, 0, 360);

    expect(r50[0]).toEqual({ x: 50, y: 0, angle: 0 });
    expect(r150[0]).toEqual({ x: 150, y: 0, angle: 0 });

    expect(r50[1]).toEqual({ x: 0, y: 50, angle: 90 });
    expect(r150[1]).toEqual({ x: 0, y: 150, angle: 90 });

    expect(r50[2]).toEqual({ x: -50, y: 0, angle: 180 });
    expect(r150[2]).toEqual({ x: -150, y: 0, angle: 180 });

    expect(r50[3]).toEqual({ x: 0, y: -50, angle: 270 });
    expect(r150[3]).toEqual({ x: 0, y: -150, angle: 270 });
  });

  it("handles negative angles and counter-clockwise directions cleanly", () => {
    // Negative angles arc: -180 to -90, n=2 (both endpoints)
    const negArc = layoutItems(2, 100, -180, -90);
    expect(negArc).toHaveLength(2);
    expect(negArc[0]).toEqual({ x: -100, y: 0, angle: -180 });
    expect(negArc[1]).toEqual({ x: 0, y: -100, angle: -90 });

    // Counter-clockwise full ring (360 -> 0)
    const ccw = layoutItems(4, 100, 360, 0);
    expect(ccw).toHaveLength(4);
    expect(ccw[0].angle).toBe(360);
    expect(ccw[1].angle).toBe(270);
    expect(ccw[2].angle).toBe(180);
    expect(ccw[3].angle).toBe(90);
  });

  it("distributes 12 items across full ring without duplicating endpoint", () => {
    const points = layoutItems(12, 100, 0, 360);
    expect(points).toHaveLength(12);

    // Each step is 360 / 12 = 30 degrees
    for (let i = 0; i < 12; i++) {
      expect(points[i].angle).toBe(i * 30);
    }

    // Verify first and last items are 30 deg apart (endpoint 360 not duplicated)
    expect(points[0].angle).toBe(0);
    expect(points[11].angle).toBe(330);
  });

  it("returns empty array when n is 0 or negative", () => {
    expect(layoutItems(0, 100, 0, 360)).toEqual([]);
    expect(layoutItems(-1, 100, 0, 360)).toEqual([]);
    expect(layoutItems(-5, 50, -90, 90)).toEqual([]);
  });

  it("rounds coordinates to 0.01 precision and normalizes negative zero", () => {
    // 45 degrees: cos(45) = sin(45) = 1 / sqrt(2) ≈ 0.70710678...
    // With r = 100, x = 70.71, y = 70.71
    const points = layoutItems(1, 100, 45, 45);
    expect(points[0].x).toBe(70.71);
    expect(points[0].y).toBe(70.71);

    // Ensure -0 is normalized to 0
    // at 180 deg, sin(180) can produce negative zero or tiny floating number
    const p180 = layoutItems(1, 100, 180, 180);
    expect(p180[0].x).toBe(-100);
    expect(p180[0].y).toBe(0);
    expect(Object.is(p180[0].y, -0)).toBe(false);
  });
});

describe("resolveMenuAngles geometry", () => {
  it("resolves arc top with default span 180 (-180..0)", () => {
    const angles = resolveMenuAngles({
      layout: "arc",
      arc: { position: "top", span: 180 },
    });
    expect(angles).toEqual({ startAngle: -180, endAngle: 0 });
  });

  it("resolves arc bottom with default span 180 (0..180)", () => {
    const angles = resolveMenuAngles({
      layout: "arc",
      arc: { position: "bottom", span: 180 },
    });
    expect(angles).toEqual({ startAngle: 0, endAngle: 180 });
  });

  it("resolves arc left with default span 180 (90..270)", () => {
    const angles = resolveMenuAngles({
      layout: "arc",
      arc: { position: "left", span: 180 },
    });
    expect(angles).toEqual({ startAngle: 90, endAngle: 270 });
  });

  it("resolves arc right with default span 180 (-90..90)", () => {
    const angles = resolveMenuAngles({
      layout: "arc",
      arc: { position: "right", span: 180 },
    });
    expect(angles).toEqual({ startAngle: -90, endAngle: 90 });
  });

  it("resolves arc with omitted span defaulting to 180", () => {
    const angles = resolveMenuAngles({
      layout: "arc",
      arc: { position: "top" },
    });
    expect(angles).toEqual({ startAngle: -180, endAngle: 0 });
  });

  it("resolves arc top with custom span 120 (-150..-30)", () => {
    const angles = resolveMenuAngles({
      layout: "arc",
      arc: { position: "top", span: 120 },
    });
    expect(angles).toEqual({ startAngle: -150, endAngle: -30 });
  });

  it("resolves arc right with custom span 90 (-45..45)", () => {
    const angles = resolveMenuAngles({
      layout: "arc",
      arc: { position: "right", span: 90 },
    });
    expect(angles).toEqual({ startAngle: -45, endAngle: 45 });
  });

  it("resolves orbit layout from configured startAngle and endAngle", () => {
    const angles = resolveMenuAngles({
      layout: "orbit",
      startAngle: 0,
      endAngle: 360,
    });
    expect(angles).toEqual({ startAngle: 0, endAngle: 360 });
  });

  it("resolves default orbit angles when layout is undefined or omitted", () => {
    const angles = resolveMenuAngles({});
    expect(angles).toEqual({ startAngle: -90, endAngle: 270 });
  });

  it("matches all canonical vectors from arc-vectors.json", () => {
    for (const vector of arcVectors) {
      const input = {
        layout: vector.layout as "orbit" | "arc",
        arc: vector.arc as { position?: "top" | "bottom" | "left" | "right"; span?: number } | undefined,
        startAngle: vector.layout === "orbit" ? vector.startAngle : undefined,
        endAngle: vector.layout === "orbit" ? vector.endAngle : undefined,
      };
      const resolved = resolveMenuAngles(input);
      expect(resolved.startAngle).toBe(vector.startAngle);
      expect(resolved.endAngle).toBe(vector.endAngle);

      const positions = layoutItems(vector.n, 96, resolved.startAngle, resolved.endAngle);
      expect(positions).toEqual(vector.positions);
    }
  });
});
