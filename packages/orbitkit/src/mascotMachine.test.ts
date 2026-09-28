// @vitest-environment node
import { describe, expect, it } from "vitest";

// Vite `?raw` compile-time import; no bundled types (no vite/client under
// pnpm strict + frozen lockfile), hence the expect-error.
// @ts-expect-error vite ?raw import has no type declarations in this package
import mascotSource from "./mascotMachine.ts?raw";
import { createMachine, hint, tick } from "./mascotMachine";
import type { MascotPoolState } from "./config";

/** Deterministic rnd: returns seeded values in order, then repeats the last. */
function seqRnd(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const states = {
  idle: { pool: ["small-a", "small-b"], priority: 0 } satisfies MascotPoolState,
  alert: { pool: ["jump"], priority: 10, ttlMs: 500 } satisfies MascotPoolState,
};

describe("mascotMachine (K8)", () => {
  it("starts in the base state (idle when defined) with a picked sheet", () => {
    const m = createMachine(states, { rnd: () => 0 });
    expect(tick(m, 0)).toEqual({ state: "idle", sheet: "small-a" });
  });

  it("a higher priority hint preempts the current state", () => {
    const m = createMachine(states, { rnd: () => 0 });
    hint(m, "alert", 100);
    expect(tick(m, 150)).toEqual({ state: "alert", sheet: "jump" });
  });

  it("an equal priority hint replaces the current state", () => {
    const m = createMachine(
      {
        idle: { pool: ["small"], priority: 0 },
        walk: { pool: ["walk"], priority: 0 },
      },
      { rnd: () => 0 },
    );
    hint(m, "walk", 10);
    expect(tick(m, 20)).toEqual({ state: "walk", sheet: "walk" });
  });

  it("a lower priority hint is ignored while a higher one is alive", () => {
    const m = createMachine(
      {
        idle: { pool: ["small"], priority: 0 },
        busy: { pool: ["busy"], priority: 5, ttlMs: 400 },
      },
      { rnd: () => 0 },
    );
    hint(m, "busy", 0);
    hint(m, "idle", 100); // lower than busy, still alive
    expect(tick(m, 200)).toEqual({ state: "busy", sheet: "busy" });
  });

  it("ttl expiry falls back to idle (base) even after other sticky hints", () => {
    const m = createMachine(
      {
        idle: { pool: ["small"], priority: 0 },
        happy: { pool: ["happy"], priority: 3 },
        alert: { pool: ["jump"], priority: 10, ttlMs: 500 },
      },
      { rnd: () => 0 },
    );
    hint(m, "happy", 0);
    hint(m, "alert", 100);
    expect(tick(m, 400)).toEqual({ state: "alert", sheet: "jump" });
    expect(tick(m, 600)).toEqual({ state: "idle", sheet: "small" });
  });

  it("without idle, ttl expiry falls back to the highest-priority sticky state", () => {
    const m = createMachine(
      {
        calm: { pool: ["calm"], priority: 1 },
        happy: { pool: ["happy"], priority: 3 },
        alert: { pool: ["jump"], priority: 10, ttlMs: 500 },
      },
      { rnd: () => 0 },
    );
    hint(m, "alert", 0);
    expect(tick(m, 499)).toEqual({ state: "alert", sheet: "jump" });
    expect(tick(m, 500)).toEqual({ state: "happy", sheet: "happy" });
  });

  it("pool pick uses the injectable rnd (first and last pool entries)", () => {
    const first = createMachine(states, { rnd: () => 0 });
    expect(tick(first, 0).sheet).toBe("small-a");
    const last = createMachine(states, { rnd: () => 0.999 });
    expect(tick(last, 0).sheet).toBe("small-b");
  });

  it("staying in a state does not repick the sheet on tick", () => {
    let calls = 0;
    const rnd = () => {
      calls += 1;
      return calls === 1 ? 0 : 0.999;
    };
    const m = createMachine(states, { rnd });
    expect(m.sheet).toBe("small-a");
    for (let t = 1; t <= 5; t += 1) {
      expect(tick(m, t)).toEqual({ state: "idle", sheet: "small-a" });
    }
    expect(calls).toBe(1); // no extra picks while staying in the state
  });

  it("re-entering the same state repicks from the pool", () => {
    const m = createMachine(
      {
        idle: { pool: ["small-a", "small-b"], priority: 0 },
        walk: { pool: ["walk"], priority: 0 },
      },
      { rnd: seqRnd(0, 0, 0.999) },
    );
    expect(tick(m, 0).sheet).toBe("small-a");
    hint(m, "walk", 10); // equal replace
    hint(m, "idle", 20); // re-enter idle
    expect(tick(m, 30)).toEqual({ state: "idle", sheet: "small-b" });
  });

  it("re-hinting the active state is a no-op: no repick and no ttl refresh", () => {
    const m = createMachine(states, { rnd: () => 0 });
    hint(m, "alert", 100);
    hint(m, "alert", 300); // same state: must not extend the ttl
    expect(tick(m, 599)).toEqual({ state: "alert", sheet: "jump" });
    expect(tick(m, 600)).toEqual({ state: "idle", sheet: "small-a" });
  });

  it("ignores unknown states and states without a usable pool", () => {
    const m = createMachine(
      { idle: { pool: ["small"], priority: 0 }, ghost: { pool: [], priority: 99 } },
      { rnd: () => 0 },
    );
    hint(m, "ghost", 0);
    hint(m, "unknown", 0);
    expect(tick(m, 10)).toEqual({ state: "idle", sheet: "small" });
  });

  it("expires a dead ttl state before applying a lower-priority hint", () => {
    const m = createMachine(
      { ...states, walk: { pool: ["walk"], priority: 0 } },
      { rnd: () => 0 },
    );
    hint(m, "alert", 0);
    hint(m, "walk", 1000); // alert (ttl 500) already dead; walk vs idle: equal replaces
    expect(tick(m, 1000)).toEqual({ state: "walk", sheet: "walk" });
  });

  it("starts a fresh ttl when a state is re-hinted after its expiry", () => {
    const m = createMachine(states, { rnd: () => 0 });
    hint(m, "alert", 0);
    hint(m, "alert", 1200); // first alert died at 500; new entry is since=1200
    expect(tick(m, 1699)).toEqual({ state: "alert", sheet: "jump" });
    expect(tick(m, 1700)).toEqual({ state: "idle", sheet: "small-a" });
  });

  it("loads in node without window and imports no Tauri modules", () => {
    // This file runs under `@vitest-environment node`: evaluating the static
    // import of mascotMachine.js above already proves the module loads with
    // no window/DOM dependency. The raw-source scan pins "no Tauri import":
    // @tauri-apps/api itself is isomorphic, so a load failure would not catch
    // it (a bare `import "node:fs"` would, but node types are unavailable).
    expect(typeof window).toBe("undefined");
    expect(typeof createMachine).toBe("function");
    // The ?raw import pins "no Tauri import" at source level: @tauri-apps/api
    // itself is isomorphic, so a load failure would not catch an import.
    expect(typeof window).toBe("undefined");
    expect(typeof createMachine).toBe("function");
    expect(mascotSource.length).toBeGreaterThan(0);
    expect(mascotSource).not.toMatch(/@tauri-apps/);
  });
});
