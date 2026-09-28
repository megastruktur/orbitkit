import { describe, expect, it } from "vitest";
import {
  OPEN_DURATION,
  CLOSE_DURATION,
  getItemDelay,
  getMaxItemDelay,
  getTotalAnimationDuration,
  getItemAnimationStyle,
} from "./menuAnimation";

describe("menuAnimation timing helpers", () => {
  it("calculates open stagger delays matching 0, 20, 40, 60 ms", () => {
    const total = 4;
    expect(getItemDelay(0, total, "open")).toBe(0);
    expect(getItemDelay(1, total, "open")).toBe(20);
    expect(getItemDelay(2, total, "open")).toBe(40);
    expect(getItemDelay(3, total, "open")).toBe(60);
  });

  it("calculates close stagger delays in reverse order", () => {
    const total = 4;
    // Total 4 items: indices 0..3
    // item 3 collapses first (delay 0), item 0 collapses last (delay 60)
    expect(getItemDelay(3, total, "close")).toBe(0);
    expect(getItemDelay(2, total, "close")).toBe(20);
    expect(getItemDelay(1, total, "close")).toBe(40);
    expect(getItemDelay(0, total, "close")).toBe(60);
  });

  it("handles boundary cases for delay calculations", () => {
    expect(getItemDelay(-1, 4, "open")).toBe(0);
    expect(getItemDelay(0, 0, "open")).toBe(0);
    expect(getItemDelay(0, 1, "open")).toBe(0);
    expect(getItemDelay(0, 1, "close")).toBe(0);
  });

  it("computes total animation durations accurately", () => {
    expect(getTotalAnimationDuration(0, "open")).toBe(0);
    expect(getTotalAnimationDuration(0, "close")).toBe(0);

    // 1 item: maxDelay 0 + duration
    expect(getTotalAnimationDuration(1, "open")).toBe(OPEN_DURATION);
    expect(getTotalAnimationDuration(1, "close")).toBe(CLOSE_DURATION);

    // 4 items: 3 * 20 = 60ms delay + duration
    expect(getTotalAnimationDuration(4, "open")).toBe(60 + OPEN_DURATION);
    expect(getTotalAnimationDuration(4, "close")).toBe(60 + CLOSE_DURATION);
  });

  it("generates correct animation styles for opening phase", () => {
    const pos = { x: 50, y: -50 };
    const style = getItemAnimationStyle(1, 4, "opening", pos, "spawn");
    expect(style).toContain("--spawn-tx: -50px");
    expect(style).toContain("--spawn-ty: 50px");
    expect(style).toContain("orbitkit-radial-item-open");
    expect(style).toContain("animation-delay: 20ms");
    expect(style).toContain("pointer-events: none");
  });

  it("generates correct animation styles for closing phase", () => {
    const pos = { x: 100, y: 0 };
    // item 0 in 4 items has close delay (4 - 1 - 0) * 20 = 60ms
    const style = getItemAnimationStyle(0, 4, "closing", pos, "spawn");
    expect(style).toContain("--spawn-tx: -100px");
    expect(style).toContain("--spawn-ty: 0px");
    expect(style).toContain("orbitkit-radial-item-close");
    expect(style).toContain("animation-delay: 60ms");
    expect(style).toContain("pointer-events: none");
  });

  it("returns empty string when animation is 'none'", () => {
    const pos = { x: 50, y: 50 };
    expect(getItemAnimationStyle(0, 4, "opening", pos, "none")).toBe("");
    expect(getItemAnimationStyle(0, 4, "closing", pos, "none")).toBe("");
    expect(getItemAnimationStyle(0, 4, "open", pos, "none")).toBe("");
  });

  it("sets pointer-events auto when open and start-state transform/opacity when closed", () => {
    const pos = { x: 50, y: -50 };
    expect(getItemAnimationStyle(0, 4, "open", pos, "spawn")).toBe("pointer-events: auto;");
    const closedStyle = getItemAnimationStyle(0, 4, "closed", pos, "spawn");
    expect(closedStyle).toContain("opacity: 0");
    expect(closedStyle).toContain("scale: 0");
    expect(closedStyle).toContain("translate: -50px 50px");
    expect(closedStyle).toContain("pointer-events: none");
  });
});

describe("K7 arc-anchor stagger (centre→edges)", () => {
  const spec = { openMs: 260, closeMs: 180, stepMs: 40 };
  const pos = { x: 50, y: -50 };

  it("stagger 5 items open: centre first, edges last (80,40,0,40,80 ms)", () => {
    expect(getItemDelay(0, 5, "open", spec)).toBe(80);
    expect(getItemDelay(1, 5, "open", spec)).toBe(40);
    expect(getItemDelay(2, 5, "open", spec)).toBe(0);
    expect(getItemDelay(3, 5, "open", spec)).toBe(40);
    expect(getItemDelay(4, 5, "open", spec)).toBe(80);
  });

  it("stagger 6 items open: centre PAIR shares the minimum delay (100,60,20,20,60,100 ms)", () => {
    expect(getItemDelay(0, 6, "open", spec)).toBe(100);
    expect(getItemDelay(1, 6, "open", spec)).toBe(60);
    expect(getItemDelay(2, 6, "open", spec)).toBe(20);
    expect(getItemDelay(3, 6, "open", spec)).toBe(20);
    expect(getItemDelay(4, 6, "open", spec)).toBe(60);
    expect(getItemDelay(5, 6, "open", spec)).toBe(100);
  });

  it("stagger close is the reversed wave: edges first, centre last", () => {
    expect([0, 1, 2, 3, 4].map((i) => getItemDelay(i, 5, "close", spec))).toEqual([
      0, 40, 80, 40, 0,
    ]);
    expect([0, 1, 2, 3, 4, 5].map((i) => getItemDelay(i, 6, "close", spec))).toEqual([
      0, 40, 80, 80, 40, 0,
    ]);
  });

  it("per-item duration and totals come from openMs/closeMs", () => {
    expect(getTotalAnimationDuration(5, "open", spec)).toBe(80 + 260);
    expect(getTotalAnimationDuration(5, "close", spec)).toBe(80 + 180);
    expect(getTotalAnimationDuration(6, "open", spec)).toBe(100 + 260);
    expect(getTotalAnimationDuration(6, "close", spec)).toBe(80 + 180);

    const openStyle = getItemAnimationStyle(0, 5, "opening", pos, "spawn", spec);
    expect(openStyle).toContain("orbitkit-radial-item-open 260ms");
    expect(openStyle).toContain("animation-delay: 80ms");
    expect(openStyle).toContain("--stagger-delay: 80ms");
    expect(openStyle).toContain("--stagger-duration: 260ms");

    const closeStyle = getItemAnimationStyle(2, 5, "closing", pos, "spawn", spec);
    expect(closeStyle).toContain("orbitkit-radial-item-close 180ms");
    expect(closeStyle).toContain("animation-delay: 80ms");
    expect(closeStyle).toContain("--stagger-delay: 80ms");
    expect(closeStyle).toContain("--stagger-duration: 180ms");
  });

  it("marks the centre (odd) / centre pair (even) as the last scheduled close items", () => {
    const maxClose5 = getMaxItemDelay(5, "close", spec);
    expect(getItemDelay(2, 5, "close", spec)).toBe(maxClose5);
    expect(getItemDelay(0, 5, "close", spec)).toBeLessThan(maxClose5);

    const maxClose6 = getMaxItemDelay(6, "close", spec);
    expect(getItemDelay(2, 6, "close", spec)).toBe(maxClose6);
    expect(getItemDelay(3, 6, "close", spec)).toBe(maxClose6);
    expect(getItemDelay(0, 6, "close", spec)).toBeLessThan(maxClose6);
  });

  it("scales delays with a custom stepMs", () => {
    const custom = { openMs: 100, closeMs: 90, stepMs: 10 };
    expect([0, 1, 2, 3, 4].map((i) => getItemDelay(i, 5, "open", custom))).toEqual([
      20, 10, 0, 10, 20,
    ]);
  });
});
