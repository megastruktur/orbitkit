// Derives every click point the Windows recording script uses, from the REAL
// starter config (examples/starter/src/orbitkit.config.json).
// Mirrors, verbatim in math:
//   - packages/orbitkit/src/geometry.ts      (resolveMenuAngles, layoutItems, resolveMenuOrigin)
//   - examples/starter/src/lib/windowFit.ts  (demoWindowFit content-union -> fixed window, bottom-centre pin)
//   - examples/starter/src/views/MascotView.svelte (MENU_PAD = 8; RadialMenu outside .fit-shift)
//   - packages/orbitkit/src/components/RadialMenu.svelte (disc CENTRE = origin + pos, translate(-50%,-50%))
// Usage: node derive-geometry.mjs [path-to-orbitkit.config.json]

import { readFileSync } from "node:fs";

const cfgPath = process.argv[2] ?? "examples/starter/src/orbitkit.config.json";
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));

// --- mascot rendered box (sheets kind): frame * integer scale ---------------
const sheet = Object.values(cfg.mascot.sheets)[0];
const m = sheet.frameWidth * cfg.mascot.scale;
if (m !== cfg.mascot.size) {
  throw new Error(`frame*scale=${m} != mascot.size=${cfg.mascot.size}`);
}
if (sheet.frameWidth !== sheet.frameHeight) throw new Error("non-square frame");
if (cfg.mascot.anchor !== "bottom-center") throw new Error("expected bottom-center pin");

// --- menu geometry (K7 arc-anchor) ------------------------------------------
const radius = cfg.menu.radius;
const itemSize = cfg.menu.itemSize ?? 44;
const headGap = cfg.menu.arc?.headGap ?? 12;
const MENU_PAD = 8; // MascotView.svelte const, not part of config
if (cfg.menu.layout !== "arc-anchor") throw new Error("expected arc-anchor");

// resolveMenuAngles: layout "arc-anchor" -> centre -90 (top), span arc.span ?? 180
const span = cfg.menu.arc?.span ?? 180;
const centreDeg = -90;
const startDeg = centreDeg - span / 2;
const endDeg = centreDeg + span / 2;

// --- demoWindowFit content union -> fixed window + bottom-centre pin --------
const reach = radius + itemSize / 2;
const minX = m / 2 - reach;
const minY = -(headGap + reach);
const maxX = m / 2 + reach;
const maxY = Math.max(m, itemSize / 2 - headGap);
const minXp = minX - MENU_PAD;
const minYp = minY - MENU_PAD;
const maxXp = maxX + MENU_PAD;
const W = Math.ceil(maxXp - minXp);
const H = Math.ceil(maxY - minYp);
// gNew: local position of the mascot's top-left inside the fixed window
// (equals the CSS pin ((W-m)/2, H-m) because the union is centred horizontally
// and bottom-pinned — assert both views agree).
const gNew = { x: -minXp, y: -minYp };
const pin = { x: (W - m) / 2, y: H - m };
if (gNew.x !== pin.x || gNew.y !== pin.y) {
  throw new Error(`fit gNew ${JSON.stringify(gNew)} != CSS pin ${JSON.stringify(pin)}`);
}

// resolveMenuOrigin: arc centre = horizontally centred on mascot bounds,
// headGap above its top edge (window coords).
const origin = { x: pin.x + m / 2, y: pin.y - headGap };

// --- layoutItems (partial arc: step = span/(n-1)) ---------------------------
const round2 = (v) => (Object.is(Math.round(v * 100) / 100, -0) ? 0 : Math.round(v * 100) / 100);
const items = cfg.menu.items;
const n = items.length;
const step = (endDeg - startDeg) / (n - 1);
const disc = items.map((item, i) => {
  const angle = i === n - 1 ? endDeg : startDeg + i * step;
  const rad = (angle * Math.PI) / 180;
  const dx = round2(radius * Math.cos(rad));
  const dy = round2(radius * Math.sin(rad));
  return {
    index: i,
    id: item.id,
    label: item.label,
    angleDeg: round2(angle),
    window: { x: round2(origin.x + dx), y: round2(origin.y + dy) },
  };
});

// --- startup contentShift ----------------------------------------------------
// crates/tauri-plugin-orbitkit/src/desktop.rs: the plugin creates the mascot
// window small and square (calculate_overlay_size = max(mascot, 2*(radius +
// itemSize)) + 16) at the primary-monitor bottom-right (margin 24; config x/y
// override). MascotView's demoWindowFit then places the 360x288 window so the
// mascot keeps its screen position, clamping the ideal position into the WORK
// area and compensating the content by the clamp delta (contentShift). The
// mascot's window-local position is gNew + shift, NOT the raw pin.
const overlayMargin = 24; // desktop.rs show_overlay margin constant
const prefit = Math.max(m, 2 * (radius + itemSize)) + 16;
const monitor = { x: 0, y: 0, width: 1920, height: 1080 }; // windows-latest
const workArea = { x: 0, y: 0, width: 1920, height: 1040 }; // 40 px bottom taskbar (Server 2022 runner); script reads the live WorkingArea
const prefitCfg = cfg.windows.mascotWindow ?? {};
const prefitX = prefitCfg.x ?? monitor.x + monitor.width - prefit - overlayMargin;
const prefitY = prefitCfg.y ?? monitor.y + monitor.height - prefit - overlayMargin;
const g = { x: prefitX + (prefit - m) / 2, y: prefitY + prefit - m }; // CSS pin of the square pre-fit window
const ideal = { x: g.x - pin.x, y: g.y - pin.y };
const clampRange = (pos, size, areaPos, areaSize) =>
  size >= areaSize ? areaPos : pos < areaPos ? areaPos : pos + size > areaPos + areaSize ? areaPos + areaSize - size : pos;
const clamped = {
  x: clampRange(ideal.x, W, workArea.x, workArea.width),
  y: clampRange(ideal.y, H, workArea.y, workArea.height),
};
const shift = { x: ideal.x - clamped.x, y: ideal.y - clamped.y };
const pinS = { x: pin.x + shift.x, y: pin.y + shift.y };
const originS = { x: origin.x + shift.x, y: origin.y + shift.y };

// --- sample screen placement -------------------------------------------------
// Roam zone 960x480 margin 12 corner bottom-left -> zone origin
// (12, 1040-12-480) = (12, 548); the starter places the window at the zone
// origin before roaming starts.
const sample = { x: 12, y: 548 };
const screen = (p) => ({ x: sample.x + p.x, y: sample.y + p.y });

const out = {
  config: cfgPath,
  mascot: { kind: cfg.mascot.kind, frame: sheet.frameWidth, scale: cfg.mascot.scale, renderedBox: m },
  fixedWindow: { width: W, height: H, pinLocal: pinS, arcOriginLocal: originS },
  startupContentShift: {
    prefitWindow: { size: prefit, x: prefitX, y: prefitY },
    mascotScreenAtBoot: g,
    idealWindowPos: ideal,
    clampedWindowPos: clamped,
    shift,
    note: "boot-constant; roam placement and post-drag re-clamps move the WINDOW only",
  },
  assumptions: {
    dpiScale: "runner at 100% -> logical == physical px (GetWindowRect)",
    workArea: "PrimaryScreen.WorkingArea at record time; derivation sample 1920x1040",
  },
  sampleWindowRect: sample,
  discs: disc.map((d) => ({
    ...d,
    window: { x: round2(d.window.x + shift.x), y: round2(d.window.y + shift.y) },
  })).map((d) => ({ ...d, screen: screen(d.window) })),
  mascotCentreWindow: { x: pinS.x + m / 2, y: pinS.y + m / 2 },
  mascotCentreScreen: screen({ x: pinS.x + m / 2, y: pinS.y + m / 2 }),
};
console.log(JSON.stringify(out, null, 2));
