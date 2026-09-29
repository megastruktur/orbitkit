import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import passthroughSource from "./passthrough.ts?raw";
import {
  DEFAULT_PASSTHROUGH_INTERVAL_MS,
  MIN_PASSTHROUGH_INTERVAL_MS,
  rectContains,
  startPassthrough,
  toLogical,
  type PassthroughWindow,
  type RectEdges,
} from "./passthrough.js";

function domRect(left: number, top: number, right: number, bottom: number): DOMRect {
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    left,
    top,
    right,
    bottom,
    toJSON() {
      return this;
    },
  } as DOMRect;
}

interface Harness {
  win: PassthroughWindow & { x: number; y: number; sf: number };
  cursor: { x: number; y: number };
  dragging: { value: boolean };
  cursorPosition: Mock<() => Promise<{ x: number; y: number }>>;
}

function makeHarness(opts: {
  x: number;
  y: number;
  sf: number;
  cursorX: number;
  cursorY: number;
}): Harness {
  const h: Harness = {
    win: {
      x: opts.x,
      y: opts.y,
      sf: opts.sf,
      outerPosition: vi.fn(async () => ({ x: h.win.x, y: h.win.y })),
      scaleFactor: vi.fn(async () => h.win.sf),
      setIgnoreCursorEvents: vi.fn(async () => {}),
    },
    cursor: { x: opts.cursorX, y: opts.cursorY },
    dragging: { value: false },
    cursorPosition: vi.fn(async () => ({ x: h.cursor.x, y: h.cursor.y })),
  };
  return h;
}

/** Flush microtasks of the immediate poll without advancing the interval. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("toLogical", () => {
  // Criterion 2: (cursorPhysical - windowPosPhysical) / scaleFactor.
  it("converts physical cursor to logical window coords at scale 1, 1.25 and 2", () => {
    const windowPos = { x: 400, y: 200 };
    expect(toLogical({ x: 450, y: 250 }, windowPos, 1)).toEqual({ x: 50, y: 50 });
    expect(toLogical({ x: 450, y: 250 }, windowPos, 1.25)).toEqual({ x: 40, y: 40 });
    expect(toLogical({ x: 450, y: 250 }, windowPos, 2)).toEqual({ x: 25, y: 25 });
  });

  it("handles negative window positions", () => {
    expect(toLogical({ x: -80, y: -30 }, { x: -100, y: -50 }, 1)).toEqual({ x: 20, y: 20 });
  });
});

describe("rectContains", () => {
  it("treats edge points as inside (inclusive)", () => {
    const r: RectEdges = { left: 10, top: 10, right: 20, bottom: 20 };
    expect(rectContains(r, 10, 10)).toBe(true);
    expect(rectContains(r, 20, 20)).toBe(true);
    expect(rectContains(r, 15, 15)).toBe(true);
    expect(rectContains(r, 9.99, 15)).toBe(false);
    expect(rectContains(r, 15, 20.01)).toBe(false);
  });
});

describe("startPassthrough", () => {
  // Criterion 1: controller shape + unregister function.
  it("returns a controller whose registerHitRegion returns an unregister fn", () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 5, cursorY: 5 });
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: h.cursorPosition });
    expect(typeof ctl.registerHitRegion).toBe("function");
    expect(typeof ctl.setPaused).toBe("function");
    expect(typeof ctl.stop).toBe("function");
    const unregister = ctl.registerHitRegion(() => [
      { left: 0, top: 0, right: 10, bottom: 10 },
    ]);
    expect(typeof unregister).toBe("function");
    unregister();
    ctl.stop();
  });

  // Criterion 2, integration: same physical cursor, hit depends on scaleFactor.
  it("hit-tests in logical coords: physical (450,250) inside only at scale 2", async () => {
    // Scale 2: logical (25,25) — inside the region.
    const h2 = makeHarness({ x: 400, y: 200, sf: 2, cursorX: 450, cursorY: 250 });
    const ctl2 = startPassthrough({ getWindow: () => h2.win, cursorPosition: h2.cursorPosition });
    ctl2.registerHitRegion(() => [{ left: 20, top: 20, right: 30, bottom: 30 }]);
    await settle();
    expect(h2.win.setIgnoreCursorEvents).toHaveBeenCalledWith(false);

    // Scale 1 with the same physical point: logical (50,50) — outside.
    const h1 = makeHarness({ x: 400, y: 200, sf: 1, cursorX: 450, cursorY: 250 });
    const ctl1 = startPassthrough({ getWindow: () => h1.win, cursorPosition: h1.cursorPosition });
    ctl1.registerHitRegion(() => [{ left: 20, top: 20, right: 30, bottom: 30 }]);
    await settle();
    expect(h1.win.setIgnoreCursorEvents).toHaveBeenCalledWith(true);
    ctl1.stop();
    ctl2.stop();
  });

  it("hit-tests at fractional scale 1.25", async () => {
    // (450-400)/1.25 = 40 → inside region [35..45].
    const h = makeHarness({ x: 400, y: 200, sf: 1.25, cursorX: 450, cursorY: 250 });
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: h.cursorPosition });
    ctl.registerHitRegion(() => [{ left: 35, top: 35, right: 45, bottom: 45 }]);
    await settle();
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledWith(false);
    ctl.stop();
  });

  it("supports element regions via getBoundingClientRect", async () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 15, cursorY: 15 });
    const el = document.createElement("div");
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue(domRect(10, 10, 20, 20));
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: h.cursorPosition });
    ctl.registerHitRegion(el);
    await settle();
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledWith(false);
    ctl.stop();
  });

  // Criterion 3: interactive iff inside OR dragging; API called only on change.
  it("calls setIgnoreCursorEvents only when the state changes", async () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 50, cursorY: 50 }); // outside
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: h.cursorPosition });
    ctl.registerHitRegion(() => [{ left: 0, top: 0, right: 10, bottom: 10 }]);
    await settle();
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(1);
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledWith(true);

    h.cursor.x = 5;
    h.cursor.y = 5; // now inside
    await vi.advanceTimersByTimeAsync(DEFAULT_PASSTHROUGH_INTERVAL_MS);
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(2);
    expect(h.win.setIgnoreCursorEvents).toHaveBeenLastCalledWith(false);

    // Stay inside: repeat polls must not call the API again.
    await vi.advanceTimersByTimeAsync(DEFAULT_PASSTHROUGH_INTERVAL_MS * 3);
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(2);
    ctl.stop();
  });

  it("keeps the window interactive while dragging even outside regions", async () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 500, cursorY: 500 });
    h.dragging.value = true;
    const ctl = startPassthrough({
      getWindow: () => h.win,
      cursorPosition: h.cursorPosition,
      isDragging: () => h.dragging.value,
    });
    ctl.registerHitRegion(() => [{ left: 0, top: 0, right: 10, bottom: 10 }]);
    await settle();
    expect(h.win.setIgnoreCursorEvents).toHaveBeenLastCalledWith(false);

    h.dragging.value = false;
    await vi.advanceTimersByTimeAsync(DEFAULT_PASSTHROUGH_INTERVAL_MS);
    expect(h.win.setIgnoreCursorEvents).toHaveBeenLastCalledWith(true);
    ctl.stop();
  });

  // Criterion 4: pause stops polling and leaves the window non-interactive.
  it("setPaused(true) stops polling and forces passthrough", async () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 5, cursorY: 5 }); // inside region
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: h.cursorPosition });
    ctl.registerHitRegion(() => [{ left: 0, top: 0, right: 10, bottom: 10 }]);
    await settle();
    expect(h.win.setIgnoreCursorEvents).toHaveBeenLastCalledWith(false);

    ctl.setPaused(true);
    expect(h.win.setIgnoreCursorEvents).toHaveBeenLastCalledWith(true);
    const pollsBefore = h.cursorPosition.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.cursorPosition.mock.calls.length).toBe(pollsBefore); // polling stopped
    // Even though the cursor is still over the region, the window stays
    // non-interactive (no further state flips).
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(2);
    ctl.stop();
  });

  it("setPaused is a no-op when already in the requested state", async () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 500, cursorY: 500 }); // outside → ignoring
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: h.cursorPosition });
    ctl.registerHitRegion(() => [{ left: 0, top: 0, right: 10, bottom: 10 }]);
    await settle();
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(1);

    ctl.setPaused(true); // already ignoring: no extra API call
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(1);
    ctl.setPaused(false);
    await settle();
    ctl.setPaused(false); // already running: nothing happens
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(1);
    ctl.stop();
  });

  it("setPaused(false) resumes polling", async () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 5, cursorY: 5 });
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: h.cursorPosition });
    ctl.registerHitRegion(() => [{ left: 0, top: 0, right: 10, bottom: 10 }]);
    ctl.setPaused(true);
    const pollsWhilePaused = h.cursorPosition.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.cursorPosition.mock.calls.length).toBe(pollsWhilePaused);

    ctl.setPaused(false);
    await settle(); // immediate sample on resume
    expect(h.cursorPosition.mock.calls.length).toBeGreaterThan(pollsWhilePaused);
    ctl.stop();
  });

  it("a stale in-flight poll does not override a pause issued mid-poll", async () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 5, cursorY: 5 });
    let releaseCursor: ((v: { x: number; y: number }) => void) | null = null;
    const deferredCursor = vi.fn(
      () => new Promise<{ x: number; y: number }>((resolve) => (releaseCursor = resolve)),
    );
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: deferredCursor });
    ctl.registerHitRegion(() => [{ left: 0, top: 0, right: 10, bottom: 10 }]);
    ctl.setPaused(true); // poll still in flight; pause forces non-interactive
    expect(h.win.setIgnoreCursorEvents).toHaveBeenLastCalledWith(true);
    releaseCursor!({ x: 5, y: 5 });
    await settle();
    // Stale poll must not flip the window back to interactive.
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(1);
    ctl.stop();
  });

  // Criterion 5: poll errors are logged once per failure streak; polling continues.
  it("logs poll errors once and keeps polling", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 500, cursorY: 500 });
    h.cursorPosition.mockRejectedValue(new Error("cursorPosition unavailable"));
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: h.cursorPosition });
    ctl.registerHitRegion(() => [{ left: 0, top: 0, right: 10, bottom: 10 }]);
    await vi.advanceTimersByTimeAsync(DEFAULT_PASSTHROUGH_INTERVAL_MS * 4);
    expect(h.cursorPosition.mock.calls.length).toBeGreaterThanOrEqual(4); // still polling
    expect(logSpy).toHaveBeenCalledTimes(1);

    // Recovery re-arms logging for the next failure streak.
    h.cursorPosition.mockResolvedValue({ x: 500, y: 500 });
    await vi.advanceTimersByTimeAsync(DEFAULT_PASSTHROUGH_INTERVAL_MS);
    expect(h.win.setIgnoreCursorEvents).toHaveBeenLastCalledWith(true);
    h.cursorPosition.mockRejectedValue(new Error("again"));
    await vi.advanceTimersByTimeAsync(DEFAULT_PASSTHROUGH_INTERVAL_MS);
    expect(logSpy).toHaveBeenCalledTimes(2);
    ctl.stop();
  });

  it("unregistering a region takes effect on the next poll", async () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 5, cursorY: 5 });
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: h.cursorPosition });
    const unregister = ctl.registerHitRegion(() => [
      { left: 0, top: 0, right: 10, bottom: 10 },
    ]);
    await settle();
    expect(h.win.setIgnoreCursorEvents).toHaveBeenLastCalledWith(false);
    unregister();
    await vi.advanceTimersByTimeAsync(DEFAULT_PASSTHROUGH_INTERVAL_MS);
    expect(h.win.setIgnoreCursorEvents).toHaveBeenLastCalledWith(true);
    ctl.stop();
  });

  it("stop() stops polling and drops regions", async () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 5, cursorY: 5 });
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: h.cursorPosition });
    ctl.registerHitRegion(() => [{ left: 0, top: 0, right: 10, bottom: 10 }]);
    await settle();
    ctl.stop();
    const pollsBefore = h.cursorPosition.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.cursorPosition.mock.calls.length).toBe(pollsBefore);
  });

  it("retries setIgnoreCursorEvents on the next poll after a rejected call", async () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 5, cursorY: 5 }); // inside region
    let failNext = true;
    vi.mocked(h.win.setIgnoreCursorEvents).mockImplementation(async () => {
      if (failNext) {
        failNext = false;
        throw new Error("ipc hiccup");
      }
    });
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctl = startPassthrough({ getWindow: () => h.win, cursorPosition: h.cursorPosition });
    ctl.registerHitRegion(() => [{ left: 0, top: 0, right: 10, bottom: 10 }]);
    await settle();
    // First attempt rejected: cursor state is unchanged (still inside), so the
    // next poll must retry the SAME transition (ignore=false) — an
    // implementation that records the intent before the call resolves would
    // never call again.
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(DEFAULT_PASSTHROUGH_INTERVAL_MS);
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(2);
    expect(h.win.setIgnoreCursorEvents).toHaveBeenLastCalledWith(false);
    expect(logSpy).toHaveBeenCalledTimes(1);
    ctl.stop();
  });

  it("logs apply errors once per streak while still retrying every poll", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 500, cursorY: 500 }); // outside region
    vi.mocked(h.win.setIgnoreCursorEvents).mockRejectedValue(new Error("capability denied"));
    const ctl = startPassthrough({
      getWindow: () => h.win,
      cursorPosition: h.cursorPosition,
      isDragging: () => h.dragging.value,
    });
    ctl.registerHitRegion(() => [{ left: 0, top: 0, right: 10, bottom: 10 }]);
    await vi.advanceTimersByTimeAsync(DEFAULT_PASSTHROUGH_INTERVAL_MS * 10);
    // Retry is intact: one call per poll (immediate sample + 10 ticks).
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(11);
    // Error-once: a rejected call per poll must not spam the log.
    expect(logSpy).toHaveBeenCalledTimes(1);

    // One success re-arms logging; the next FAILURE streak logs exactly once more.
    vi.mocked(h.win.setIgnoreCursorEvents).mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(DEFAULT_PASSTHROUGH_INTERVAL_MS);
    expect(h.win.setIgnoreCursorEvents).toHaveBeenCalledTimes(12);
    vi.mocked(h.win.setIgnoreCursorEvents).mockRejectedValue(new Error("denied again"));
    h.dragging.value = true; // force a state change → a new rejected call
    await vi.advanceTimersByTimeAsync(DEFAULT_PASSTHROUGH_INTERVAL_MS * 3);
    expect(logSpy).toHaveBeenCalledTimes(2);
    ctl.stop();
  });

  it("clamps intervalMs to the K10 ≤10 Hz budget and samples immediately at start", async () => {
    const h = makeHarness({ x: 0, y: 0, sf: 1, cursorX: 500, cursorY: 500 });
    const ctl = startPassthrough({
      getWindow: () => h.win,
      cursorPosition: h.cursorPosition,
      intervalMs: 1, // below budget → clamped to MIN_PASSTHROUGH_INTERVAL_MS
    });
    await settle();
    expect(h.cursorPosition).toHaveBeenCalledTimes(1); // immediate first sample
    await vi.advanceTimersByTimeAsync(MIN_PASSTHROUGH_INTERVAL_MS - 1);
    expect(h.cursorPosition).toHaveBeenCalledTimes(1); // 99 ms after start: nothing yet
    await vi.advanceTimersByTimeAsync(1);
    expect(h.cursorPosition).toHaveBeenCalledTimes(2); // exactly at 100 ms
    ctl.stop();
  });
});

// Criterion 6, mutation-sensitive guard: the jsdom fakes cannot distinguish a
// static from an injected API, so assert the source itself: no top-level
// import/export line may reference @tauri-apps. Reintroducing
// `import { cursorPosition } from "@tauri-apps/api/window"` fails this; the
// lazy dynamic `import("@tauri-apps/api/window")` inside defaultCursorPosition
// does not (it is mid-line, not a module-load import).
describe("passthrough module load", () => {
  it("imports no @tauri-apps API at module load", () => {
    const offenders = passthroughSource
      .split("\n")
      .filter((line) => /^(import|export)\b/.test(line.trim()) && line.includes("@tauri-apps"));
    expect(offenders).toEqual([]);
  });
});
