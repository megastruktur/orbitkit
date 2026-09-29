import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { createMachine, hint as machineHint, tick } from "./mascotMachine";
import { createPark, parkCornerPosition } from "./park";
import type { ParkWindow, ParkWindowSize } from "./park";
import type { MascotStateDefinition } from "./config";
import type { PhysicalPoint, PhysicalRect } from "./windowFit";

function clearTauriInternals(): void {
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  clearMocks();
}

function triggerTauriCallback(handlerId: number, eventData: unknown): void {
  if (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window &&
    window.__TAURI_INTERNALS__ &&
    typeof window.__TAURI_INTERNALS__ === "object" &&
    "callbacks" in window.__TAURI_INTERNALS__
  ) {
    const callbacks = window.__TAURI_INTERNALS__.callbacks;
    if (callbacks instanceof Map) {
      const cb = callbacks.get(handlerId);
      if (typeof cb === "function") {
        cb(eventData);
      }
    }
  }
}

const WORK: PhysicalRect = { x: 0, y: 0, width: 1920, height: 1080 };
const SIZE = { width: 96, height: 96 };

const STATES: Record<string, MascotStateDefinition> = {
  idle: { pool: ["idle-a", "idle-b"] },
  walk: { pool: ["walk-a"] },
  sleep: { pool: ["sleep-a"] },
};

function makeMachine(
  states: Record<string, MascotStateDefinition> = STATES,
  now = 0,
) {
  return createMachine(states, { now, rnd: () => 0 });
}

function makeRoam() {
  return { pause: vi.fn(), resume: vi.fn() };
}

function makePassthrough() {
  return { setPaused: vi.fn() };
}

function makeWindow(start: PhysicalPoint) {
  const position: PhysicalPoint = { ...start };
  const setPosition = vi.fn(async (next: PhysicalPoint) => {
    position.x = next.x;
    position.y = next.y;
  });
  const win: ParkWindow = {
    outerPosition: async () => ({ ...position }),
    setPosition,
  };
  return { win, setPosition };
}

function setup(opts: {
  start?: PhysicalPoint;
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  now?: () => number;
  states?: Record<string, MascotStateDefinition>;
  windowSize?: ParkWindowSize;
} = {}) {
  const roam = makeRoam();
  const passthrough = makePassthrough();
  const machine = makeMachine(opts.states);
  const { win, setPosition } = makeWindow(opts.start ?? { x: 500, y: 400 });
  const showBubble = vi.fn();
  const handle = createPark({
    roam,
    passthrough,
    machine,
    sleepState: "sleep",
    corner: opts.corner ?? "bottom-right",
    workArea: WORK,
    getWindow: () => win,
    windowSize: opts.windowSize ?? SIZE,
    showBubble,
    now: opts.now,
  });
  return { handle, roam, passthrough, machine, setPosition, showBubble };
}

/** Records `emit` payloads, answers `listen` per event, and delivers events to listeners. */
function mockEventBus() {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const handlerIds: Record<string, number> = {};
  mockIPC((cmd, args) => {
    if (
      cmd === "plugin:event|listen" &&
      args &&
      typeof args === "object" &&
      "event" in args &&
      typeof args.event === "string" &&
      "handler" in args &&
      typeof args.handler === "number"
    ) {
      // Callbacks are keyed by the transformCallback id carried in `handler`.
      handlerIds[args.event] = args.handler;
      return 1;
    }
    if (cmd === "plugin:event|emit" && args && typeof args === "object" && "event" in args) {
      const { event, payload } = args;
      if (typeof event === "string") {
        emitted.push({ event, payload });
      }
    }
    return null;
  });
  return {
    emitted,
    /** Delivers an event to the registered listener, like the Tauri bus would. */
    deliver(event: string, payload: unknown): void {
      const id = handlerIds[event];
      if (id !== undefined) {
        triggerTauriCallback(id, { event, payload });
      }
    },
  };
}

function parksOf(emitted: Array<{ event: string; payload: unknown }>) {
  return emitted.filter((e) => e.event === "orbitkit://park").map((e) => e.payload);
}

function badgesOf(emitted: Array<{ event: string; payload: unknown }>) {
  return emitted.filter((e) => e.event === "orbitkit://badge").map((e) => e.payload);
}

describe("parkCornerPosition", () => {
  const work: PhysicalRect = { x: 100, y: 200, width: 800, height: 600 };

  it("places the window top-left at each work-area corner", () => {
    expect(parkCornerPosition("top-left", work, SIZE)).toEqual({ x: 100, y: 200 });
    expect(parkCornerPosition("top-right", work, SIZE)).toEqual({ x: 804, y: 200 });
    expect(parkCornerPosition("bottom-left", work, SIZE)).toEqual({ x: 100, y: 704 });
    expect(parkCornerPosition("bottom-right", work, SIZE)).toEqual({ x: 804, y: 704 });
  });

  it("clamps an oversized window into the work area instead of an off-screen corner", () => {
    const oversized = { width: 900, height: 700 };
    expect(parkCornerPosition("bottom-right", work, oversized)).toEqual({ x: 100, y: 200 });
  });

  it("returns integer physical px even for a fractional window size", () => {
    // Tauri's set_position silently fails on fractional physical px.
    const fractional = { width: 95.5, height: 95.5 };
    const pos = parkCornerPosition("bottom-right", WORK, fractional);
    expect(Number.isInteger(pos.x)).toBe(true);
    expect(Number.isInteger(pos.y)).toBe(true);
    expect(pos).toEqual({ x: Math.round(1920 - 95.5), y: Math.round(1080 - 95.5) });
  });
});

describe("createPark", () => {
  beforeEach(() => {
    clearTauriInternals();
  });

  afterEach(() => {
    clearTauriInternals();
  });

  it("exposes park/unpark/parked/notify/dispose and starts unparked", () => {
    const { handle } = setup();
    expect(typeof handle.park).toBe("function");
    expect(typeof handle.unpark).toBe("function");
    expect(typeof handle.notify).toBe("function");
    expect(typeof handle.dispose).toBe("function");
    expect(handle.parked).toBe(false);
  });

  it("park pauses roam + passthrough, hints sleep, moves to the clamped corner and emits parked:true", async () => {
    mockWindows("main");
    const bus = mockEventBus();
    const { handle, roam, passthrough, machine, setPosition } = setup({ now: () => 5000 });

    await handle.park();

    expect(handle.parked).toBe(true);
    expect(roam.pause).toHaveBeenCalledTimes(1);
    expect(passthrough.setPaused).toHaveBeenCalledWith(true);
    // K8 hint applied with the injected clock.
    expect(machine.active).toBe("sleep");
    expect(machine.since).toBe(5000);
    // Bottom-right of 1920×1080 for a 96×96 window.
    expect(setPosition).toHaveBeenCalledWith({ x: 1824, y: 984 });
    expect(parksOf(bus.emitted)).toEqual([{ parked: true }]);
  });

  it("sleep hint is sticky while parked: tick never expires it back to base", async () => {
    const { handle, machine } = setup();
    await handle.park();
    expect(tick(machine, 5000 + 60 * 60 * 1000).state).toBe("sleep");
  });

  it("notify while parked suppresses the bubble and counts it into the badge", async () => {
    mockWindows("main");
    const bus = mockEventBus();
    const { handle, showBubble } = setup();

    await handle.park();
    expect(handle.notify({ text: "one" })).toBe(false);
    expect(handle.notify({ text: "two" })).toBe(false);
    expect(showBubble).not.toHaveBeenCalled();
    expect(badgesOf(bus.emitted)).toEqual([{ count: 1 }, { count: 2 }]);
  });

  it("notify while unparked forwards to showBubble and never emits badge counts", () => {
    const { handle, showBubble } = setup();
    const bubble = { text: "hi" };
    expect(handle.notify(bubble)).toBe(true);
    expect(showBubble).toHaveBeenCalledTimes(1);
    expect(showBubble).toHaveBeenCalledWith(bubble);
  });

  it("unpark resumes roam at the pre-park position, restores the machine state, unpauses passthrough and emits parked:false", async () => {
    mockWindows("main");
    const bus = mockEventBus();
    const { handle, roam, passthrough, machine, setPosition } = setup({ start: { x: 500, y: 400 } });

    await handle.park();
    await handle.unpark();

    expect(handle.parked).toBe(false);
    // Immediate window restore (not deferred to the next roam tick), then
    // roam adopts the same point.
    expect(setPosition).toHaveBeenNthCalledWith(1, { x: 1824, y: 984 });
    expect(setPosition).toHaveBeenNthCalledWith(2, { x: 500, y: 400 });
    expect(roam.resume).toHaveBeenCalledWith({ x: 500, y: 400 });
    expect(passthrough.setPaused).toHaveBeenLastCalledWith(false);
    expect(machine.active).toBe("idle");
    expect(parksOf(bus.emitted)).toEqual([{ parked: true }, { parked: false }]);
  });

  it("park hands setPosition integer px for a fractional window size", async () => {
    const { handle, setPosition } = setup({ windowSize: { width: 95.5, height: 95.5 } });

    await handle.park();

    const arg = setPosition.mock.calls[0][0];
    expect(Number.isInteger(arg.x)).toBe(true);
    expect(Number.isInteger(arg.y)).toBe(true);
    expect(arg).toEqual({ x: 1825, y: 985 });
  });

  it("unpark hands setPosition integer px when the saved position is fractional", async () => {
    const { handle, setPosition, roam } = setup({ start: { x: 500.5, y: 400.5 } });

    await handle.park();
    await handle.unpark();

    const restore = setPosition.mock.calls[1][0];
    expect(Number.isInteger(restore.x)).toBe(true);
    expect(Number.isInteger(restore.y)).toBe(true);
    expect(restore).toEqual({ x: 501, y: 401 });
    // Roam adopts the same rounded point, so the loop never re-emits the
    // fractional position through its own setPosition.
    expect(roam.resume).toHaveBeenCalledWith({ x: 501, y: 401 });
  });

  it("double park applies the effects once", async () => {
    mockWindows("main");
    const bus = mockEventBus();
    const { handle, roam, passthrough, setPosition } = setup();

    await handle.park();
    await handle.park();

    expect(roam.pause).toHaveBeenCalledTimes(1);
    expect(passthrough.setPaused).toHaveBeenCalledTimes(1);
    expect(setPosition).toHaveBeenCalledTimes(1);
    expect(parksOf(bus.emitted)).toEqual([{ parked: true }]);
  });

  it("unpark without park is a no-op and double unpark applies once", async () => {
    mockWindows("main");
    const bus = mockEventBus();
    const { handle, roam, passthrough } = setup();

    await handle.unpark();
    expect(roam.resume).not.toHaveBeenCalled();
    expect(passthrough.setPaused).not.toHaveBeenCalled();
    expect(parksOf(bus.emitted)).toEqual([]);

    await handle.park();
    await handle.unpark();
    await handle.unpark();

    expect(roam.resume).toHaveBeenCalledTimes(1);
    expect(parksOf(bus.emitted)).toEqual([{ parked: true }, { parked: false }]);
  });

  it("dispose unparks a parked handle and releases the badge subscription", async () => {
    mockWindows("main");
    const bus = mockEventBus();
    const { handle, roam } = setup();

    await handle.park();
    await handle.dispose();

    expect(handle.parked).toBe(false);
    expect(roam.resume).toHaveBeenCalledTimes(1);
    expect(parksOf(bus.emitted)).toEqual([{ parked: true }, { parked: false }]);

    await expect(handle.dispose()).resolves.toBeUndefined();
  });

  it("park forces sleep even when its priority is above the pre-park state", async () => {
    const { handle, machine } = setup({
      now: () => 5000,
      states: {
        idle: { pool: ["idle-a"] },
        sleep: { pool: ["sleep-a"], priority: 5 },
      },
    });

    // Above-direction sanity: K8 hint() itself enters sleep here (higher
    // priority preempts idle); the forced write keeps this path working
    // when hint() is replaced by forceState.
    await handle.park();

    expect(machine.active).toBe("sleep");
    expect(machine.since).toBe(5000);
    expect(machine.sheet).toBe("sleep-a");
  });

  it("park forces sleep even while a higher-priority TTL state is alive", async () => {
    const { handle, machine } = setup({
      now: () => 5500,
      states: {
        idle: { pool: ["idle-a"] },
        walk: { pool: ["walk-a"], priority: 5, ttlMs: 1000 },
        sleep: { pool: ["sleep-a"] },
      },
    });
    machineHint(machine, "walk", 5000); // alive until 6000
    expect(machine.active).toBe("walk");

    // K8 hint() would ignore the lower-priority sleep request while walk
    // is alive; park must force it regardless.
    await handle.park();

    expect(machine.active).toBe("sleep");
    expect(machine.since).toBe(5500);
  });

  it("park forces sleep even when its priority is below the alive state", async () => {
    const { handle, machine } = setup({
      now: () => 5000,
      states: {
        idle: { pool: ["idle-a"] },
        walk: { pool: ["walk-a"], priority: 5 },
        sleep: { pool: ["sleep-a"] },
      },
    });
    machineHint(machine, "walk", 5000); // priority 5, sticky
    expect(machine.active).toBe("walk");

    // K8 hint() would ignore the lower-priority sleep request here.
    await handle.park();

    expect(machine.active).toBe("sleep");
    expect(machine.since).toBe(5000);
  });

  it("handle.hint forwards requests when unparked and suppresses them while parked", async () => {
    const { handle, machine } = setup({ now: () => 5000 });

    handle.hint("walk", 100);
    expect(machine.active).toBe("walk");

    await handle.park();
    handle.hint("idle", 200);
    expect(machine.active).toBe("sleep");

    await handle.unpark();
    handle.hint("idle", 300);
    expect(machine.active).toBe("idle");
  });

  it("unpark restores the base state even when sleep has the higher priority", async () => {
    const { handle, machine } = setup({
      now: () => 5000,
      states: {
        idle: { pool: ["idle-a"] },
        sleep: { pool: ["sleep-a"], priority: 5 },
      },
    });

    await handle.park();
    expect(machine.active).toBe("sleep");
    await handle.unpark();

    expect(machine.active).toBe("idle");
    expect(machine.since).toBe(5000);
  });

  it("overlapping unpark calls apply the restore once", async () => {
    mockWindows("main");
    mockEventBus();
    const { handle, roam, setPosition } = setup({ start: { x: 500, y: 400 } });
    await handle.park();

    let release!: () => void;
    setPosition.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const first = handle.unpark();
    const second = handle.unpark();
    release();
    await Promise.all([first, second]);

    expect(roam.resume).toHaveBeenCalledTimes(1);
    // One corner move in park + one restore in the single unpark run.
    expect(setPosition).toHaveBeenCalledTimes(2);
  });

  it("notify counts on top of external badge updates observed while parked", async () => {
    mockWindows("main");
    const bus = mockEventBus();
    const { handle, showBubble } = setup();

    await handle.park();
    bus.deliver("orbitkit://badge", { count: 10 });
    expect(handle.notify({ text: "late" })).toBe(false);
    expect(showBubble).not.toHaveBeenCalled();
    expect(badgesOf(bus.emitted)).toEqual([{ count: 11 }]);
  });
});
