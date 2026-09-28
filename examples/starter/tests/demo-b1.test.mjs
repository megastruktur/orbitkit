// demo-b1 mutation-sensitive checks (run: `node --test tests/` from examples/starter).
//
// Every assertion here fails against the pre-demo-b1 starter (svg mascot,
// orbit menu, 5 undotted items, no passthrough/fitContent), so any regression
// of the B1 acceptance criteria is caught without a GUI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { demoWindowFit } from "../src/lib/windowFit.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "src/orbitkit.config.json"), "utf8"));

// K7 MENU_ITEM_ID_REGEX — identical literal to config.ts / config.rs.
const MENU_ITEM_ID_REGEX = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;

function decodePng(path) {
  // Minimal decode for the generator's own output: filter-0 rows, RGBA.
  const buf = readFileSync(path);
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path}: PNG signature`);
  let o = 8;
  let w = 0;
  let h = 0;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString("ascii", o + 4, o + 8);
    if (type === "IHDR") {
      w = buf.readUInt32BE(o + 8);
      h = buf.readUInt32BE(o + 12);
      assert.equal(buf[o + 8 + 8], 8, `${path}: 8-bit depth`);
      assert.equal(buf[o + 8 + 9], 6, `${path}: RGBA colour type`);
    }
    if (type === "IDAT") idat.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  return { w, h };
}

test("mascot is a kind=sheets Glim with idle/alert/sleep pools and TTL", () => {
  const m = config.mascot;
  assert.equal(m.kind, "sheets");
  assert.equal(m.scale, 3, "integer upscale 3 (32px frames -> 96px)");
  assert.equal(m.anchor, "bottom-center");
  assert.equal(m.faceByVelocity, false);
  assert.equal(m.initialState, "idle");
  for (const name of ["glim-idle", "glim-alert", "glim-sleep"]) {
    const s = m.sheets[name];
    assert.ok(s, `sheet ${name} defined`);
    assert.equal(s.frameWidth, 32);
    assert.equal(s.frameHeight, 32);
    assert.equal(s.frames, 4);
    assert.ok(s.fps > 0);
    assert.notEqual(s.loop, false);
  }
  assert.deepEqual(Object.keys(m.states).sort(), ["alert", "idle", "sleep"]);
  assert.deepEqual(m.states.idle.pool, ["glim-idle"]);
  assert.deepEqual(m.states.alert.pool, ["glim-alert"]);
  assert.equal(m.states.alert.ttlMs, 8000, "alert reverts to idle after ~8s");
  assert.ok(!("ttlMs" in m.states.sleep), "sleep is sticky");
  assert.ok(!("ttlMs" in m.states.idle), "idle is sticky");
});

test("sheet PNGs exist as 128x32 strips (4 frames of 32x32, original art)", () => {
  for (const name of ["glim-idle", "glim-alert", "glim-sleep"]) {
    const { w, h } = decodePng(join(root, "public/sheets", `${name}.png`));
    assert.equal(w, 128, `${name}: 4 frames side by side`);
    assert.equal(h, 32);
  }
});

test("menu is arc-anchor with 6 dotted-id items, {svg} icons and K7 stagger", () => {
  const menu = config.menu;
  assert.equal(menu.layout, "arc-anchor");
  assert.equal(menu.arc?.position, "top");
  assert.equal(menu.arc?.span, 180);
  assert.equal(menu.arc?.headGap, 12);
  assert.deepEqual(menu.stagger, { openMs: 260, closeMs: 180, stepMs: 40 });
  assert.equal(menu.animation, "spawn");
  assert.equal(menu.items.length, 6);
  const ids = menu.items.map((i) => i.id);
  for (const id of ids) {
    assert.match(id, MENU_ITEM_ID_REGEX, `id ${id} matches K7 regex`);
    assert.ok(id.includes("."), `id ${id} is dotted`);
  }
  assert.deepEqual(
    ids,
    ["app.notes", "app.timer", "app.alert", "app.settings", "app.about", "app.quit"]
  );
  for (const item of menu.items) {
    assert.equal(typeof item.icon?.svg, "string", `${item.id}: inline {svg} icon`);
    assert.ok(item.icon.svg.includes("<path") || item.icon.svg.includes("<circle"));
  }
  // The demo's alert item drives setMascotState("alert") from the backend.
  assert.ok(ids.includes("app.alert"), "menu has the alert item");
});

test("mascot window opts into K10 passthrough and K9 fitContent", () => {
  const mw = config.windows.mascotWindow;
  assert.equal(mw.transparent, true);
  assert.equal(mw.decorations, false);
  assert.equal(mw.alwaysOnTop, true);
  assert.equal(mw.passthrough, true);
  assert.equal(mw.fitContent, true);
});

test("starter backend handles the dotted demo actions", () => {
  const lib = readFileSync(join(root, "src-tauri/src/lib.rs"), "utf8");
  assert.ok(lib.includes('"app.alert"'), "alert action handled (setMascotState alert)");
  assert.ok(lib.includes('"app.timer"'), "timer action handled (sleep 5s)");
  assert.ok(lib.includes('"app.notes"') && lib.includes('"app.settings"'), "popup actions handled");
  assert.ok(lib.includes('"app.quit"'), "quit action handled");
  assert.ok(!lib.includes('"busy"'), "no stale busy state left");
});

test("capabilities grant the window setters the demo JS relies on", () => {
  const cap = JSON.parse(
    readFileSync(join(root, "src-tauri/capabilities/default.json"), "utf8")
  );
  for (const p of [
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-set-ignore-cursor-events",
  ]) {
    assert.ok(cap.permissions.includes(p), `${p} granted`);
  }
});

test("MascotView wires passthrough, fitContent and arc-anchor", () => {
  const view = readFileSync(join(root, "src/views/MascotView.svelte"), "utf8");
  assert.ok(view.includes("startPassthrough"), "K10 passthrough started");
  assert.ok(view.includes("registerHitRegion"), "hit regions registered");
  // Hit regions are RectEdges ({left,top,right,bottom}): the menu region must
  // hand the DOMRect to the poller, not a re-mapped {x,y,width,height} object
  // (whose left/top/right/bottom are undefined -> cursor never inside).
  const regionFn = view.match(/function menuHitRegion\(\)[\s\S]*?\n  \}/);
  assert.ok(regionFn, "menuHitRegion defined");
  assert.ok(
    regionFn[0].includes("getBoundingClientRect())") ||
      /=>\s*item\.getBoundingClientRect\(\)/.test(regionFn[0]),
    "menu hit region returns DOMRects directly"
  );
  assert.ok(!/x:\s*r\.x/.test(regionFn[0]), "no {x,y,width,height} re-mapping in hit region");
  // K9 fitContent runs through the pure, unit-tested helper (round-2 model:
  // bottom-centre pin + clamp-only compensation; no pos-clamped double-count).
  assert.ok(view.includes("demoWindowFit"), "pure window-fit helper drives the fit");
  assert.ok(
    /await\s+applyWindowFit\("open"\)[\s\S]*?menuOpen = true/.test(view),
    "open fit is awaited before the menu mounts (anchor matches new geometry)"
  );
  assert.ok(view.includes("mascotMonitor"), "K9 mascot monitor used for work area");
  assert.ok(view.includes("anchorRect"), "arc-anchor rect comes from the fit");
  assert.ok(view.includes("contentShift"), "clamp compensation applied to content");
  // Pixel-crisp guarantee: no CSS scaling of the sprite container.
  assert.ok(!/\.mascot-clickable[^}]*scale\(/.test(view), "mascot is never CSS-scaled");
});

test("window-fit helper keeps the mascot screen-fixed across idle/open", () => {
  // Mirrors the dedicated windowFit.test.mjs invariants with a compact case:
  // reviewer repro from c1fff75 (296x296 overlay at 960x480) must not move
  // Glim and must produce zero shift when unclamped.
  const src = readFileSync(join(root, "src/lib/windowFit.ts"), "utf8");
  assert.ok(src.includes("export function demoWindowFit"), "helper exported");
  const idle = demoWindowFit(base, "idle");
  const open = demoWindowFit({ ...base, window: idle.window }, "open");
  assert.deepEqual(open.shift, { x: 0, y: 0 }, "no compensation without a clamp");
  for (const r of [idle, open]) {
    assert.equal(
      r.window.x + r.mascotLocal.x,
      1060,
      "mascot screen x invariant"
    );
    assert.equal(
      r.window.y + r.mascotLocal.y,
      680,
      "mascot screen y invariant (feet stay put)"
    );
  }
  // Old-formula regression: a clamped fit shifts content by ideal - clamped,
  // never by the old-position delta.
  const tight = { ...base, workArea: { x: 0, y: 0, width: 1100, height: 800 } };
  const clamped = demoWindowFit({ ...tight, window: idle.window }, "open");
  assert.equal(clamped.window.x + clamped.mascotLocal.x, 1060);
});

const base = {
  window: { x: 960, y: 480, width: 296, height: 296 },
  workArea: { x: 0, y: 0, width: 1280, height: 800 },
  mascot: 96,
  headGap: 12,
  radius: 96,
  itemSize: 44,
  idlePadX: 24,
  menuPad: 8,
};
