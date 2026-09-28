import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_STEP_MS,
  MIN_ROAM_INTERVAL_MS,
  aimRoamVelocity,
  createRoam,
  createRoamDrag,
  rebaseRoamBounds,
  roamBounds,
  startRoam,
  stepRoam,
} from "./roam";
import type { PhysicalPoint, PhysicalRect } from "./windowFit";

const WORK: PhysicalRect = { x: 0, y: 0, width: 1920, height: 1080 };

const CFG = {
  width: 300,
  height: 200,
  margin: 50,
  corner: "bottom-right" as const,
  speed: 100,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe("roamBounds", () => {
  it("anchors the zone inset by margin at the config corner", () => {
    // inner safe area: {50, 50, 1820, 980}
    expect(roamBounds(WORK, 1, CFG)).toEqual({
      x: 1570,
      y: 830,
      width: 300,
      height: 200,
    });
    expect(roamBounds(WORK, 1, { ...CFG, corner: "bottom-left" })).toEqual({
      x: 50,
      y: 830,
      width: 300,
      height: 200,
    });
    expect(roamBounds(WORK, 1, { ...CFG, corner: "top-right" })).toEqual({
      x: 1570,
      y: 50,
      width: 300,
      height: 200,
    });
    expect(roamBounds(WORK, 1, { ...CFG, corner: "top-left" })).toEqual({
      x: 50,
      y: 50,
      width: 300,
      height: 200,
    });
  });

  it("converts logical config px to physical px with the monitor scale", () => {
    // w=600 h=400, inset=100 -> inner {100, 100, 1720, 880}
    expect(roamBounds(WORK, 2, CFG)).toEqual({
      x: 1220,
      y: 580,
      width: 600,
      height: 400,
    });
  });

  it("clamps a zone larger than the safe area into the work area", () => {
    expect(
      roamBounds(WORK, 1, { ...CFG, width: 5000, height: 5000 }),
    ).toEqual({ x: 50, y: 50, width: 1820, height: 980 });
  });

  it("falls back to scale 1 for a non-positive or non-finite scale", () => {
    expect(roamBounds(WORK, 0, CFG)).toEqual(roamBounds(WORK, 1, CFG));
    expect(roamBounds(WORK, Number.NaN, CFG)).toEqual(roamBounds(WORK, 1, CFG));
  });

  it("shrinks the zone by the window size so the window stays visible", () => {
    const win = { width: 96, height: 96 };
    // bottom-right: top-left limit = 1920-96 / 1080-96
    expect(
      roamBounds(WORK, 1, { ...CFG, margin: 0, corner: "bottom-right" }, win),
    ).toEqual({
      x: 1920 - 96 - 300,
      y: 1080 - 96 - 200,
      width: 300,
      height: 200,
    });
    // top-left: unchanged by the window size
    expect(
      roamBounds(WORK, 1, { ...CFG, margin: 0, corner: "top-left" }, win),
    ).toEqual({ x: 0, y: 0, width: 300, height: 200 });
  });

  it("pins an oversized window at the safe-area origin", () => {
    expect(
      roamBounds(
        WORK,
        1,
        { ...CFG, margin: 0, corner: "bottom-right" },
        { width: 4000, height: 4000 },
      ),
    ).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("keeps the window inside the work area at every corner over 400 steps", () => {
    const win = { width: 96, height: 96 };
    for (const corner of [
      "bottom-right",
      "bottom-left",
      "top-right",
      "top-left",
    ] as const) {
      const zone = roamBounds(WORK, 1, { ...CFG, margin: 0, corner }, win);
      // Start at the far corner heading inward; 400 steps at 400 px/s cross
      // the zone several times in both axes.
      let state = {
        x: zone.x + zone.width,
        y: zone.y + zone.height,
        vx: -400,
        vy: -400,
      };
      for (let i = 0; i < 400; i++) {
        state = stepRoam(state, 33, zone);
        expect(state.x).toBeGreaterThanOrEqual(WORK.x);
        expect(state.y).toBeGreaterThanOrEqual(WORK.y);
        expect(state.x + win.width).toBeLessThanOrEqual(
          WORK.x + WORK.width,
        );
        expect(state.y + win.height).toBeLessThanOrEqual(
          WORK.y + WORK.height,
        );
      }
    }
  });
});

describe("rebaseRoamBounds", () => {
  const flat = { ...CFG, margin: 0 };

  it("centres the zone on the drop point", () => {
    expect(rebaseRoamBounds({ x: 960, y: 540 }, WORK, 1, flat)).toEqual({
      x: 810,
      y: 440,
      width: 300,
      height: 200,
    });
  });

  it("clamps the zone into the work area at every edge", () => {
    expect(rebaseRoamBounds({ x: 10, y: 10 }, WORK, 1, flat)).toMatchObject({
      x: 0,
      y: 0,
    });
    expect(
      rebaseRoamBounds({ x: 5000, y: 540 }, WORK, 1, flat),
    ).toMatchObject({ x: 1620, y: 440 });
    expect(
      rebaseRoamBounds({ x: 960, y: 2000 }, WORK, 1, flat),
    ).toMatchObject({ x: 810, y: 880 });
  });

  it("keeps the margin safe area during rebase", () => {
    // inner {50, 50, 1820, 980}; drop at (0,0) clamps to the safe corner
    expect(rebaseRoamBounds({ x: 0, y: 0 }, WORK, 1, CFG)).toEqual({
      x: 50,
      y: 50,
      width: 300,
      height: 200,
    });
  });

  it("honours the physical drop point at scale 2", () => {
    // w=600 h=400, centred on (960, 540)
    expect(rebaseRoamBounds({ x: 960, y: 540 }, WORK, 2, flat)).toEqual({
      x: 660,
      y: 340,
      width: 600,
      height: 400,
    });
  });

  it("clamps the rebased zone by the window size near the edges", () => {
    const win = { width: 96, height: 96 };
    // drop near the bottom-right corner; top-left limit 1920-96-300 / 1080-96-200
    expect(
      rebaseRoamBounds({ x: 1900, y: 1050 }, WORK, 1, flat, win),
    ).toEqual({
      x: 1920 - 96 - 300,
      y: 1080 - 96 - 200,
      width: 300,
      height: 200,
    });
  });
});

describe("stepRoam", () => {
  const BOUNDS: PhysicalRect = { x: 0, y: 0, width: 1000, height: 1000 };

  it("moves linearly inside the zone without flipping", () => {
    expect(
      stepRoam({ x: 100, y: 100, vx: 100, vy: -50 }, 100, BOUNDS),
    ).toEqual({ x: 110, y: 95, vx: 100, vy: -50 });
  });

  it("flips and reflects at the left edge", () => {
    // raw overshoot: -5 - 10 = -15 -> reflected to +15, vx mirrored
    expect(
      stepRoam({ x: -5, y: 500, vx: -100, vy: 0 }, 100, BOUNDS),
    ).toEqual({ x: 15, y: 500, vx: 100, vy: 0 });
  });

  it("flips and reflects at the right edge", () => {
    expect(
      stepRoam({ x: 1005, y: 500, vx: 100, vy: 0 }, 100, BOUNDS),
    ).toEqual({ x: 985, y: 500, vx: -100, vy: 0 });
  });

  it("flips and reflects at the top edge", () => {
    expect(
      stepRoam({ x: 500, y: -2, vx: 0, vy: -50 }, 40, BOUNDS),
    ).toEqual({ x: 500, y: 4, vx: 0, vy: 50 });
  });

  it("flips and reflects at the bottom edge", () => {
    expect(
      stepRoam({ x: 500, y: 1002, vx: 0, vy: 50 }, 40, BOUNDS),
    ).toEqual({ x: 500, y: 996, vx: 0, vy: -50 });
  });

  it("caps dt at MAX_STEP_MS so a stalled tab cannot teleport", () => {
    const capped = (MAX_STEP_MS / 1000) * 100; // 100 px/s for 250 ms = 25 px
    const moved = stepRoam(
      { x: 0, y: 0, vx: 100, vy: 0 },
      10 * MAX_STEP_MS,
      BOUNDS,
    );
    expect(moved.x).toBeCloseTo(capped);
    expect(
      stepRoam({ x: 0, y: 0, vx: 100, vy: 0 }, MAX_STEP_MS + 1, BOUNDS).x,
    ).toBeCloseTo(capped);
  });

  it("treats negative dt as no motion", () => {
    expect(stepRoam({ x: 500, y: 500, vx: 100, vy: 100 }, -5, BOUNDS)).toEqual({
      x: 500,
      y: 500,
      vx: 100,
      vy: 100,
    });
  });

  it("pins degenerate axes instead of producing NaN", () => {
    expect(
      stepRoam({ x: 50, y: 30, vx: 100, vy: 100 }, 100, {
        x: 0,
        y: 0,
        width: 0,
        height: 500,
      }),
    ).toEqual({ x: 0, y: 40, vx: 0, vy: 100 });
  });

  it("does not mutate the input state", () => {
    const state = { x: 100, y: 100, vx: 100, vy: 100 };
    stepRoam(state, 100, BOUNDS);
    expect(state).toEqual({ x: 100, y: 100, vx: 100, vy: 100 });
  });
});

describe("aimRoamVelocity", () => {
  const BOUNDS: PhysicalRect = { x: 0, y: 0, width: 1000, height: 1000 };

  it("aims at the zone centre with the requested speed", () => {
    const v = aimRoamVelocity({ x: 0, y: 0 }, BOUNDS, 100);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(100);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeGreaterThan(0);
  });

  it("heads right when already centred", () => {
    expect(aimRoamVelocity({ x: 500, y: 500 }, BOUNDS, 100)).toEqual({
      x: 100,
      y: 0,
    });
  });

  it("rests on non-positive speed", () => {
    expect(aimRoamVelocity({ x: 0, y: 0 }, BOUNDS, 0)).toEqual({ x: 0, y: 0 });
    expect(aimRoamVelocity({ x: 0, y: 0 }, BOUNDS, -5)).toEqual({ x: 0, y: 0 });
  });
});

describe("startRoam", () => {
  interface Win {
    positions: PhysicalPoint[];
    win: {
      outerPosition: () => Promise<PhysicalPoint>;
      setPosition: (p: PhysicalPoint) => Promise<void>;
    };
    readonly current: PhysicalPoint;
  }

  function fakeWindow(start: PhysicalPoint): Win {
    let pos: PhysicalPoint = { ...start };
    const positions: PhysicalPoint[] = [];
    return {
      positions,
      win: {
        outerPosition: async () => ({ ...pos }),
        setPosition: async (p: PhysicalPoint) => {
          pos = { ...p };
          positions.push({ ...p });
        },
      },
      get current() {
        return { ...pos };
      },
    };
  }

  const ZONE: PhysicalRect = { x: 0, y: 0, width: 4000, height: 4000 };

  it("steps at most 30 times per second (default and clamped intervals)", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    for (const intervalMs of [undefined, 1]) {
      setIntervalSpy.mockClear();
      const h = fakeWindow({ x: 100, y: 100 });
      const onVelocity = vi.fn();
      const ctl = startRoam({
        getWindow: () => h.win,
        bounds: () => ZONE,
        speed: 100,
        onVelocity,
        intervalMs,
      });
      await settle();
      // Whatever is requested, the armed interval is clamped to the 30 Hz floor.
      const armed = setIntervalSpy.mock.calls.filter(
        (c) => typeof c[1] === "number",
      );
      expect(armed.length).toBe(1);
      expect(armed[0][1] as number).toBeGreaterThanOrEqual(
        MIN_ROAM_INTERVAL_MS - 1e-9,
      );
      h.positions.length = 0;
      onVelocity.mockClear();
      await vi.advanceTimersByTimeAsync(3000);
      // 30 Hz ceiling over 3 s; float-timer jitter admits 89 or 90 fires.
      expect(h.positions.length).toBeLessThanOrEqual(90);
      expect(h.positions.length).toBeGreaterThanOrEqual(85);
      expect(onVelocity).toHaveBeenCalledTimes(h.positions.length);
      ctl.stop();
    }
  });

  it("moves towards the zone centre and reports the velocity", async () => {
    const h = fakeWindow({ x: 100, y: 100 });
    const velocities: PhysicalPoint[] = [];
    const ctl = startRoam({
      getWindow: () => h.win,
      bounds: () => ZONE,
      speed: 100,
      onVelocity: (v) => velocities.push(v),
    });
    await settle();
    await vi.advanceTimersByTimeAsync(200);
    expect(h.positions.length).toBeGreaterThan(0);
    expect(h.positions[0].x).toBeGreaterThan(100); // heading +x
    expect(h.positions[0].y).toBeGreaterThan(100); // heading +y
    expect(Math.hypot(velocities[0].x, velocities[0].y)).toBeCloseTo(100);
    ctl.stop();
  });

  it("resume(at) adopts the given position instead of snapping back", async () => {
    const h = fakeWindow({ x: 100, y: 100 });
    const ctl = startRoam({
      getWindow: () => h.win,
      bounds: () => ZONE,
      speed: 100,
    });
    await settle();
    ctl.pause();
    ctl.resume({ x: 2000, y: 2000 });
    await vi.advanceTimersByTimeAsync(MIN_ROAM_INTERVAL_MS + 1);
    expect(h.positions.length).toBe(1);
    // First step starts at the adopted point (one ~3.4 px step), not at the
    // stale pre-pause position (100, 100).
    const hop = Math.hypot(
      h.positions[0].x - 2000,
      h.positions[0].y - 2000,
    );
    expect(hop).toBeGreaterThan(0);
    expect(hop).toBeLessThan(10);
    ctl.stop();
  });

  it("resume(at) clamps an out-of-zone drop before stepping", async () => {
    const h = fakeWindow({ x: 100, y: 100 });
    const ctl = startRoam({
      getWindow: () => h.win,
      bounds: () => ZONE,
      speed: 100,
    });
    await settle();
    ctl.pause();
    // Half off-screen drop: clamps to the zone corner (0, 4000).
    ctl.resume({ x: -500, y: 4200 });
    await vi.advanceTimersByTimeAsync(MIN_ROAM_INTERVAL_MS + 1);
    expect(h.positions.length).toBe(1);
    const hop = Math.hypot(h.positions[0].x - 0, h.positions[0].y - 4000);
    expect(hop).toBeGreaterThan(0);
    expect(hop).toBeLessThan(10); // one ~3.4 px step from the clamped point
    ctl.stop();
  });

  it("pause freezes stepping; resume continues without a dt jump", async () => {
    const h = fakeWindow({ x: 2000, y: 2000 });
    const ctl = startRoam({
      getWindow: () => h.win,
      bounds: () => ZONE,
      speed: 100,
    });
    await settle();
    await vi.advanceTimersByTimeAsync(100);
    expect(ctl.paused).toBe(false);

    ctl.pause();
    expect(ctl.paused).toBe(true);
    const frozenAt = h.current;
    const callsAtPause = h.positions.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.positions.length).toBe(callsAtPause);
    expect(h.current).toEqual(frozenAt); // not a single step while paused

    // A 10 s stall while paused must not leak into the next dt: the first
    // tick after resume covers one interval (~33 ms ≈ 3.4 px), not a
    // capped 250 ms jump (25 px).
    await vi.advanceTimersByTimeAsync(10_000);
    ctl.resume();
    expect(ctl.paused).toBe(false);
    await vi.advanceTimersByTimeAsync(MIN_ROAM_INTERVAL_MS + 1);
    const oneTickDelta = Math.hypot(
      h.current.x - frozenAt.x,
      h.current.y - frozenAt.y,
    );
    expect(oneTickDelta).toBeGreaterThan(2);
    expect(oneTickDelta).toBeLessThan(10);
    ctl.stop();
  });

  it("stop halts the loop permanently", async () => {
    const h = fakeWindow({ x: 100, y: 100 });
    const ctl = startRoam({
      getWindow: () => h.win,
      bounds: () => ZONE,
      speed: 100,
    });
    await settle();
    ctl.stop();
    expect(ctl.stopped).toBe(true);
    const calls = h.positions.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.positions.length).toBe(calls);
  });

  it("keeps stepping when setPosition rejects, logging once per streak", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = fakeWindow({ x: 100, y: 100 });
    h.win.setPosition = vi.fn(async () => {
      throw new Error("denied");
    });
    const ctl = startRoam({
      getWindow: () => h.win,
      bounds: () => ZONE,
      speed: 100,
    });
    await settle();
    await vi.advanceTimersByTimeAsync(MIN_ROAM_INTERVAL_MS * 4);
    expect(logSpy).toHaveBeenCalledTimes(1); // one line per failure streak
    ctl.stop();
  });

  it("stays idle and logs once when the initial position read fails", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctl = startRoam({
      getWindow: () => ({
        outerPosition: async () => {
          throw new Error("no window");
        },
        setPosition: async () => {},
      }),
      bounds: () => ZONE,
      speed: 100,
    });
    await settle();
    await vi.advanceTimersByTimeAsync(1000);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(ctl.stopped).toBe(false);
    ctl.resume(); // still safe
    ctl.stop();
  });
});

describe("createRoamDrag", () => {
  function harness(
    overrides: Partial<Parameters<typeof createRoamDrag>[0]> = {},
  ) {
    const roam = { pause: vi.fn(), resume: vi.fn() };
    let drop: PhysicalPoint = { x: 1000, y: 900 };
    const getDropPoint = vi.fn(async () => ({ ...drop }));
    const onRebase = vi.fn();
    const onToggle = vi.fn();
    const onDragStart = vi.fn();
    const binding = createRoamDrag({
      roam,
      getDropPoint,
      onRebase,
      onToggle,
      onDragStart,
      ...overrides,
    });
    return {
      binding,
      roam,
      getDropPoint,
      onRebase,
      onToggle,
      onDragStart,
      setDrop: (p: PhysicalPoint) => {
        drop = p;
      },
    };
  }

  function beginDrag(h: ReturnType<typeof harness>): void {
    const { handlers } = h.binding;
    handlers.onpointerdown({ button: 0, clientX: 100, clientY: 100 });
    handlers.onpointermove({ clientX: 130, clientY: 110 }); // ~31 px > 4
  }

  it("click below threshold only toggles the menu; nothing moves", async () => {
    const h = harness();
    const { handlers } = h.binding;
    handlers.onpointerdown({ button: 0, clientX: 100, clientY: 100 });
    handlers.onpointerup();
    handlers.onclick();
    expect(h.onToggle).toHaveBeenCalledTimes(1);
    expect(h.roam.pause).not.toHaveBeenCalled();
    expect(h.binding.isDragging()).toBe(false);
    await settle();
    expect(h.getDropPoint).not.toHaveBeenCalled();
    expect(h.onRebase).not.toHaveBeenCalled();
    expect(h.roam.resume).not.toHaveBeenCalled();
  });

  it("crossing the threshold pauses roam before native drag starts", () => {
    const h = harness();
    beginDrag(h);
    expect(h.roam.pause).toHaveBeenCalledTimes(1);
    expect(h.onDragStart).toHaveBeenCalledTimes(1);
    // pause strictly precedes the native drag attempt
    expect(h.roam.pause.mock.invocationCallOrder[0]).toBeLessThan(
      h.onDragStart.mock.invocationCallOrder[0],
    );
    expect(h.binding.isDragging()).toBe(true);
  });

  it("release rebases around the drop point, then resumes roam", async () => {
    const h = harness();
    beginDrag(h);
    h.binding.handlers.onpointerup();
    expect(h.binding.isDragging()).toBe(false);
    await settle();
    expect(h.getDropPoint).toHaveBeenCalledTimes(1);
    expect(h.onRebase).toHaveBeenCalledWith({ x: 1000, y: 900 });
    expect(h.roam.resume).toHaveBeenCalledTimes(1);
    expect(h.roam.resume.mock.invocationCallOrder[0]).toBeGreaterThan(
      h.onRebase.mock.invocationCallOrder[0],
    );
  });

  it("suppresses the trailing click after a drag (no toggle)", async () => {
    const h = harness();
    beginDrag(h);
    h.binding.handlers.onpointerup();
    h.binding.handlers.onclick();
    expect(h.onToggle).not.toHaveBeenCalled();
  });

  it("a swallowed trailing click still leaves roam running; next click toggles", async () => {
    const h = harness();
    beginDrag(h);
    h.binding.handlers.onpointerup();
    // No click ever arrives (swallowed by the native drag grab).
    await settle();
    expect(h.binding.isDragging()).toBe(false);
    expect(h.roam.resume).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(400); // sdk-v1 dragged-flag auto-clear
    expect(h.binding.handlers.isDragged).toBe(false);
    h.binding.handlers.onpointerdown({ button: 0, clientX: 0, clientY: 0 });
    h.binding.handlers.onclick();
    expect(h.onToggle).toHaveBeenCalledTimes(1);
  });

  it("a window focus change during drag releases it (lost pointerup)", async () => {
    const h = harness();
    beginDrag(h);
    expect(h.binding.isDragging()).toBe(true);
    h.binding.handlers.onwindowfocus();
    expect(h.binding.isDragging()).toBe(false);
    await settle();
    expect(h.onRebase).toHaveBeenCalledWith({ x: 1000, y: 900 });
    expect(h.roam.resume).toHaveBeenCalledTimes(1);
  });

  it("pointercancel during drag releases it", async () => {
    const h = harness();
    beginDrag(h);
    h.binding.handlers.onpointercancel();
    await settle();
    expect(h.binding.isDragging()).toBe(false);
    expect(h.roam.resume).toHaveBeenCalledTimes(1);
  });

  it("a rejected native drag start behaves like a click", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness({
      onDragStart: () => Promise.reject(new Error("denied")),
    });
    beginDrag(h);
    await settle();
    expect(h.binding.isDragging()).toBe(false);
    expect(h.roam.resume).toHaveBeenCalledTimes(1);
    h.binding.handlers.onclick();
    expect(h.onToggle).toHaveBeenCalledTimes(1); // fell through to click
    expect(logSpy).toHaveBeenCalledTimes(1); // gesture's single fallback log
  });

  it("a throwing native drag start behaves like a click", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness({
      onDragStart: () => {
        throw new Error("boom");
      },
    });
    beginDrag(h);
    await settle();
    expect(h.binding.isDragging()).toBe(false);
    expect(h.roam.resume).toHaveBeenCalledTimes(1);
    h.binding.handlers.onclick();
    expect(h.onToggle).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("a failed drop-point read still resumes roam in the previous zone", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness({
      getDropPoint: async () => {
        throw new Error("gone");
      },
    });
    beginDrag(h);
    h.binding.handlers.onpointerup();
    await settle();
    expect(h.onRebase).not.toHaveBeenCalled();
    expect(h.roam.resume).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("a drag racing the rebase is never resumed by a stale release", async () => {
    const resolvers: Array<(p: PhysicalPoint) => void> = [];
    const h = harness({
      getDropPoint: () =>
        new Promise<PhysicalPoint>((resolve) => {
          resolvers.push(resolve);
        }),
    });
    beginDrag(h);
    h.binding.handlers.onpointerup(); // release #1, rebase pending
    await settle();
    expect(h.roam.resume).not.toHaveBeenCalled();

    beginDrag(h); // user grabs again before the drop point resolves
    expect(h.binding.isDragging()).toBe(true);

    resolvers[0]({ x: 1000, y: 900 }); // stale release settles
    await settle();
    expect(h.onRebase).not.toHaveBeenCalled(); // discarded
    expect(h.roam.resume).not.toHaveBeenCalled(); // still dragging
    expect(h.binding.isDragging()).toBe(true);

    h.binding.handlers.onpointerup(); // release #2 completes cleanly
    resolvers[resolvers.length - 1]({ x: 1000, y: 900 });
    await settle();
    expect(h.onRebase).toHaveBeenCalledTimes(1);
    expect(h.roam.resume).toHaveBeenCalledTimes(1);
    expect(h.binding.isDragging()).toBe(false);
  });
});

describe("createRoam", () => {
  const WORK_AREA: PhysicalRect = { x: 0, y: 0, width: 4000, height: 4000 };
  const ROAM_CFG = {
    width: 1500,
    height: 1000,
    margin: 0,
    corner: "bottom-right" as const,
    speed: 100,
  };

  function harness(start: PhysicalPoint) {
    let pos: PhysicalPoint = { ...start };
    const positions: PhysicalPoint[] = [];
    const window = {
      outerPosition: async () => ({ ...pos }),
      setPosition: async (p: PhysicalPoint) => {
        pos = { ...p };
        positions.push({ ...p });
      },
    };
    // Simulates the native drag having carried the window to `p`.
    const moveTo = (p: PhysicalPoint) => {
      pos = { ...p };
    };
    const monitor = vi.fn(() => ({
      workArea: WORK_AREA,
      scaleFactor: 2,
    }));
    const handle = createRoam({
      getWindow: () => window,
      monitor,
      roam: ROAM_CFG,
    });
    return { handle, monitor, positions, window, moveTo };
  }

  it("starts in the config corner with speed scaled to physical px/s", async () => {
    const h = harness({ x: 3900, y: 3900 });
    // zone: 1500x1000 logical -> 3000x2000 physical, bottom-right corner
    expect(h.handle.bounds()).toEqual({
      x: 1000,
      y: 2000,
      width: 3000,
      height: 2000,
    });
    await settle();
    // One tick covers speed * interval; 100 px/s logical * scale 2 = 200 px/s.
    await vi.advanceTimersByTimeAsync(MIN_ROAM_INTERVAL_MS + 1);
    expect(h.positions.length).toBe(1);
    const step = Math.hypot(
      h.positions[0].x - 3900,
      h.positions[0].y - 3900,
    );
    expect(step).toBeCloseTo((200 * MIN_ROAM_INTERVAL_MS) / 1000, 0);
    h.handle.roam.stop();
  });

  it("re-bases the zone around the drop point (clamped) on drag release", async () => {
    const h = harness({ x: 3900, y: 3900 });
    await settle();

    h.handle.drag.handlers.onpointerdown({
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    h.handle.drag.handlers.onpointermove({ clientX: 40, clientY: 0 });
    expect(h.handle.roam.paused).toBe(true);

    // The native drag carried the window to the drop point before release.
    h.moveTo({ x: 100, y: 3800 });
    h.handle.drag.handlers.onpointerup();
    await settle();
    expect(h.handle.roam.paused).toBe(false);
    // zone centred on (100, 3800), clamped into the 4000x4000 work area
    expect(h.handle.bounds()).toEqual({
      x: 0,
      y: 2000,
      width: 3000,
      height: 2000,
    });

    // The first step after release starts AT the drop point: the loop must
    // not snap back to its stale pre-drag position near (3900, 3900).
    h.positions.length = 0;
    await vi.advanceTimersByTimeAsync(MIN_ROAM_INTERVAL_MS + 1);
    expect(h.positions.length).toBe(1);
    const firstHop = Math.hypot(
      h.positions[0].x - 100,
      h.positions[0].y - 3800,
    );
    expect(firstHop).toBeGreaterThan(0);
    expect(firstHop).toBeLessThan(30); // one ~6.7 px step at 200 px/s

    // stepping continues and stays inside the new zone (flip-and-continue)
    h.positions.length = 0;
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.positions.length).toBeGreaterThan(0);
    for (const p of h.positions) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(3000);
      expect(p.y).toBeGreaterThanOrEqual(2000);
      expect(p.y).toBeLessThanOrEqual(4000);
    }
    h.handle.roam.stop();
  });

  it("honours a live windowSize getter for the initial AND re-based zones", async () => {
    let size = { width: 96, height: 96 };
    const window2 = {
      outerPosition: async () => ({ x: 3900, y: 3900 }),
      setPosition: async () => {},
    };
    const handle = createRoam({
      getWindow: () => window2,
      monitor: () => ({ workArea: WORK_AREA, scaleFactor: 2 }),
      roam: ROAM_CFG,
      windowSize: () => size,
    });
    // initial: bottom-right, shrunk by 96 px in logical-to-physical terms
    expect(handle.bounds()).toEqual({
      x: 4000 - 96 - 3000,
      y: 4000 - 96 - 2000,
      width: 3000,
      height: 2000,
    });
    await settle();
    handle.drag.handlers.onpointerdown({ button: 0, clientX: 0, clientY: 0 });
    handle.drag.handlers.onpointermove({ clientX: 40, clientY: 0 });
    // the window grew before the drop: the re-based zone must shrink further
    size = { width: 500, height: 500 };
    window2.outerPosition = async () => ({ x: 3900, y: 3900 });
    handle.drag.handlers.onpointerup();
    await settle();
    expect(handle.bounds()).toEqual({
      x: 4000 - 500 - 3000,
      y: 4000 - 500 - 2000,
      width: 3000,
      height: 2000,
    });
    handle.roam.stop();
  });

  it("a click (≤ threshold) never pauses roam nor rebases", async () => {
    const h = harness({ x: 3900, y: 3900 });
    await settle();
    const before = h.handle.bounds();
    h.handle.drag.handlers.onpointerdown({
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    h.handle.drag.handlers.onpointerup();
    h.handle.drag.handlers.onclick();
    await settle();
    expect(h.handle.roam.paused).toBe(false);
    expect(h.handle.bounds()).toBe(before);
    h.handle.roam.stop();
  });
});
