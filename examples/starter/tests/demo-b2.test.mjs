// demo-b2 mutation-sensitive checks (run: `pnpm --filter starter test`).
//
// Every assertion here fails against the pre-demo-b2 starter (no roam block,
// no popup anchors, 6 menu items, no demoB2 helpers), so a regression of the
// B2 wiring logic is caught without a GUI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { demoWindowFit } from "../src/lib/windowFit.ts";
import {
  gatedMascotState,
  nextBadgeCount,
  noteInstanceKey,
  parkMenuLabel,
} from "../src/lib/demoB2.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "src/orbitkit.config.json"), "utf8"));

// K11 instanceKey shape (plugin-side regex ^[a-z0-9_-]{1,32}$).
const INSTANCE_KEY_REGEX = /^[a-z0-9_-]{1,32}$/;

test("note instance keys are unique per click and K11-valid", () => {
  const keys = [1, 2, 3, 10].map((n) => noteInstanceKey(n));
  assert.equal(new Set(keys).size, keys.length, "keys are unique per click");
  for (const key of keys) {
    assert.match(
      key,
      INSTANCE_KEY_REGEX,
      `key ${key} matches the K11 instanceKey regex`,
    );
  }
  assert.equal(noteInstanceKey(1), "note-1");
  assert.equal(noteInstanceKey(3), "note-3");
});

test("badge counter increments by one and never goes negative", () => {
  assert.equal(nextBadgeCount(0), 1);
  assert.equal(nextBadgeCount(1), 2);
  assert.equal(nextBadgeCount(41), 42);
  assert.equal(nextBadgeCount(-5), 1);
  assert.ok(nextBadgeCount(998) > 998, "counter grows");
});

test("park menu label flips with the parked state", () => {
  assert.equal(parkMenuLabel(false), "Park");
  assert.equal(parkMenuLabel(true), "Unpark");
});

test("mascot state requests are gated while parked (K8)", () => {
  assert.equal(gatedMascotState(true, "alert"), null, "parked: request ignored");
  assert.equal(gatedMascotState(true, "idle"), null, "parked: any request ignored");
  assert.equal(gatedMascotState(false, "alert"), "alert", "unparked: request passes");
  assert.equal(gatedMascotState(false, "sleep"), "sleep", "unparked: request passes");
});

test("mascot window configures K7 roam with faceByVelocity", () => {
  assert.equal(config.mascot.faceByVelocity, true, "mascot faces its walking direction");
  const roam = config.windows.mascotWindow.roam;
  assert.ok(roam, "mascot window has a roam block");
  assert.ok(roam.width > 0 && roam.height > 0, "roam zone has positive extent");
  assert.ok(roam.margin >= 0, "roam margin is non-negative");
  assert.ok(roam.speed > 0, "roam speed is positive");
  assert.ok(
    ["top-left", "top-right", "bottom-left", "bottom-right"].includes(roam.corner),
    "roam corner is one of the four work-area corners",
  );
});

test("popups are anchored: notes to the mascot, settings centred", () => {
  const byId = new Map(config.windows.popups.map((p) => [p.id, p]));
  assert.equal(byId.get("notes")?.anchor, "mascot", "notes anchored to mascot");
  assert.equal(byId.get("settings")?.anchor, "center", "settings centred on monitor");
});

test("menu has the demo-b2 items and a radius that fits 9 items", () => {
  const menu = config.menu;
  const ids = menu.items.map((i) => i.id);
  for (const id of ["app.bubble", "app.badge", "app.park"]) {
    assert.ok(ids.includes(id), `menu has the ${id} item`);
  }
  // Chord between adjacent items must exceed the item diameter: no overlap.
  const n = menu.items.length;
  const chord = 2 * menu.radius * Math.sin((Math.PI / n) / 2);
  assert.ok(
    chord >= menu.itemSize,
    `adjacent item chord ${chord.toFixed(1)}px fits itemSize ${menu.itemSize}px for ${n} items`,
  );
});

test("roam zone exceeds the fixed window on a reference work area", () => {
  // The fixed Design-B window is the largest content union; the roam zone
  // (zone minus window) is degenerate unless the zone is bigger than the
  // window on both axes — otherwise the mascot cannot walk at all.
  const mascotSize = config.mascot.size;
  const fit = demoWindowFit({
    window: { x: 0, y: 0, width: 400, height: 400 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    mascot: mascotSize,
    headGap: config.menu.arc?.headGap ?? 12,
    radius: config.menu.radius,
    itemSize: config.menu.itemSize ?? 44,
    menuPad: 8,
  });
  const roam = config.windows.mascotWindow.roam;
  assert.ok(
    roam.width > fit.window.width,
    `roam width ${roam.width} exceeds fixed window width ${fit.window.width}`,
  );
  assert.ok(
    roam.height > fit.window.height,
    `roam height ${roam.height} exceeds fixed window height ${fit.window.height}`,
  );
});

test("starter backend opens a new notes instance per click", () => {
  const lib = readFileSync(join(root, "src-tauri/src/lib.rs"), "utf8");
  assert.ok(lib.includes("note_counter"), "notes click counter present");
  assert.ok(lib.includes("note-"), "notes instance key prefix present");
  assert.ok(
    lib.includes('open_popup("notes".to_string(), None, Some(instance))'),
    "notes opened with an instance key (K11 new window per click)",
  );
  assert.ok(
    lib.includes('open_popup("settings".to_string(), None, None)'),
    "settings opened WITHOUT an instance key (idempotent singleton)",
  );
});

test("r2: roam/park window adapter rounds coordinates to integer physical px", () => {
  // Tauri set_position rejects fractional physical px, which silently froze
  // every roam step (review FAIL on 184200f). The shared adapter must round.
  const view = readFileSync(join(root, "src/views/MascotView.svelte"), "utf8");
  const start = view.indexOf("function physWindowAdapter()");
  assert.ok(start !== -1, "shared physWindowAdapter exists");
  const body = view.slice(start, view.indexOf("onMount(", start));
  assert.match(
    body,
    /Math\.round\(pos\.x\)[\s\S]*Math\.round\(pos\.y\)/,
    "adapter rounds pos to integer physical px before setPosition",
  );
});

test("r2: badge count tracks orbitkit://badge events", () => {
  // park.ts counts parked bubbles on top of the last observed badge event;
  // the demo count must re-sync from the event, or the next "badge +1" sends
  // a stale value (review FAIL on 184200f).
  const view = readFileSync(join(root, "src/views/MascotView.svelte"), "utf8");
  const start = view.indexOf("onBadge((payload)");
  assert.ok(start !== -1, "onBadge subscription present");
  assert.match(
    view.slice(start, start + 160),
    /badgeCount = payload\.count/,
    "badgeCount re-synced from the badge event payload",
  );
});
