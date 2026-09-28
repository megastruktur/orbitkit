// Deterministic pixel-art sprite sheet generator for the demo-b1 mascot —
// an animated demo PLANET (original art, no third-party assets). Identity
// from the 0.1.0 starter SVG: blue body, tilted light-blue ring, white eyes
// with dark pupils. No dependencies: PNGs are encoded with node:zlib.
//
// Usage: node scripts/gen-sheets.mjs
// Writes 128x32 RGBA PNG strips (4 frames of 32x32) to public/sheets/.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FRAME = 32;
const FRAMES = 4;

// ---------------------------------------------------------------------------
// Minimal PNG encoder (RGBA, 8-bit, filter 0)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------
function makeCanvas() {
  return { px: Buffer.alloc(FRAME * FRAME * 4) }; // transparent black
}

function put(c, x, y, [r, g, b, a = 255]) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= FRAME || y >= FRAME) return;
  const i = (y * FRAME + x) * 4;
  c.px[i] = r;
  c.px[i + 1] = g;
  c.px[i + 2] = b;
  c.px[i + 3] = a;
}

function fillRect(c, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) put(c, x + dx, y + dy, color);
}

function fillEllipse(c, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) put(c, x, y, color);
    }
  }
}

// 3x3 pixel "z" glyph (top bar, diagonal pixel, bottom bar).
const Z3 = ["###", ".#.", "###"];
// 4x4 pixel "z" glyph.
const Z4 = ["####", "..#.", ".#..", "####"];

function drawZ(c, x, y, rows, color) {
  rows.forEach((row, dy) =>
    [...row].forEach((ch, dx) => {
      if (ch === "#") put(c, x + dx, y + dy, color);
    })
  );
}

// ---------------------------------------------------------------------------
// Demo PLANET (owner request: orbital theme, identity from the 0.1.0 starter
// SVG — blue body #4f7cff, tilted light-blue ring #9db4ff, white eyes with
// dark #10141a pupils). Pixel-art: body circle, ring drawn as a band along a
// rotated ellipse; the ring passes BEHIND the body on the upper half and IN
// FRONT on the lower half. "Ring rotation" = a shading phase travelling
// along the ring path. Body centre stays pinned so the visual footprint and
// the bottom-centre anchor in the fixed window are unchanged.
// ---------------------------------------------------------------------------
const C = {
  body: [79, 124, 255],    // #4f7cff
  bodyShade: [58, 96, 210],// darker body rim (same hue, pixel-art depth)
  ring: [157, 180, 255],   // #9db4ff
  ringDim: [122, 146, 216],// ring shading (travelling phase)
  eye: [255, 255, 255],
  pupil: [16, 20, 26],     // #10141a
  white: [245, 250, 252],
};

const BODY_CX = 16;
const BODY_CY = 18; // body centre; body bottom at y=26 keeps a similar
                    // bottom-anchored footprint to the previous sprite
const BODY_R = 8;

// Ring ellipse (logical units before rotation): rx=13, ry=4.5, tilted -20deg.
const RING_RX = 13;
const RING_RY = 4.5;
const RING_ROT = (-20 * Math.PI) / 180;

/** Ring path point at parameter t (radians), rotated by RING_ROT. */
function ringPoint(t, cx, cy) {
  const ex = RING_RX * Math.cos(t);
  const ey = RING_RY * Math.sin(t);
  return {
    x: cx + ex * Math.cos(RING_ROT) - ey * Math.sin(RING_ROT),
    y: cy + ex * Math.sin(RING_ROT) + ey * Math.cos(RING_ROT),
    // sin(t) < 0 is the upper (behind-planet) half of the ring.
    behind: Math.sin(t) < 0,
  };
}

function inBody(x, y) {
  const dx = x - BODY_CX;
  const dy = y - BODY_CY;
  return dx * dx + dy * dy <= (BODY_R + 0.2) * (BODY_R + 0.2);
}

function drawRing(c, cx, cy, phase, extraOuter) {
  // Denser sampling than pixels; phase shifts which arc segments are bright.
  const STEPS = 720;
  for (let i = 0; i < STEPS; i++) {
    const t = (i / STEPS) * 2 * Math.PI;
    const p = ringPoint(t, cx, cy);
    if (p.behind && inBody(p.x, p.y)) continue; // hidden behind the planet
    // Travelling highlight: bright where the phase wave crosses, dim else.
    const w = Math.cos(t * 2 - phase);
    const color = w > 0.35 ? C.ring : C.ringDim;
    put(c, p.x, p.y, color);
    put(c, p.x + 0.5, p.y, color);
    if (extraOuter && w > 0.35) put(c, p.x + (p.behind ? -0.5 : 1), p.y, C.ring);
  }
}

function drawEyes(c, cy, kind) {
  // Eyes sit on the upper body, left+right of centre (0.1.0 reference look).
  const lx = BODY_CX - 4;
  const rx = BODY_CX + 2;
  if (kind === "open") {
    fillRect(c, lx, cy - 3, 3, 4, C.eye);
    fillRect(c, rx, cy - 3, 3, 4, C.eye);
    fillRect(c, lx + 1, cy - 2, 2, 2, C.pupil);
    fillRect(c, rx + 1, cy - 2, 2, 2, C.pupil);
  } else if (kind === "wide") {
    fillRect(c, lx - 1, cy - 4, 4, 6, C.eye);
    fillRect(c, rx, cy - 4, 4, 6, C.eye);
    fillRect(c, lx, cy - 2, 2, 2, C.pupil);
    fillRect(c, rx + 1, cy - 2, 2, 2, C.pupil);
  } else {
    // closed: dark lid lines
    fillRect(c, lx, cy - 1, 3, 1, C.pupil);
    fillRect(c, rx, cy - 1, 3, 1, C.pupil);
  }
}

function drawPlanet(c, bob, { ringPhase = 0, eyes = "open", z = null, zY = null, ringBoost = false }) {
  const cy = BODY_CY + bob;
  // Ring behind-half first, then the body, then the front-half ring.
  drawRingPass(c, cy, ringPhase, ringBoost, true);
  // Body: flat blue disc with a darker bottom-right rim for depth.
  fillEllipse(c, BODY_CX, cy, BODY_R, BODY_R, C.bodyShade);
  fillEllipse(c, BODY_CX, cy - 0.5, BODY_R - 1, BODY_R - 1, C.body);
  // Face.
  drawEyes(c, cy, eyes);
  // Ring front-half.
  drawRingPass(c, cy, ringPhase, ringBoost, false);
  // Sleep "z": small glyph top-right.
  if (z === 3) drawZ(c, BODY_CX + 8, zY ?? 4, Z3, C.white);
  if (z === 4) drawZ(c, BODY_CX + 8, zY ?? 3, Z4, C.white);
}

// One half-pass of the ring; split by the rotated ellipse's own geometry so
// the band lines up with drawRing's visibility rule.
function drawRingPass(c, cy, phase, extraOuter, behindPass) {
  const STEPS = 720;
  for (let i = 0; i < STEPS; i++) {
    const t = (i / STEPS) * 2 * Math.PI;
    const p = ringPoint(t, BODY_CX, cy);
    if (p.behind !== behindPass) continue;
    if (p.behind && inBody(p.x, p.y)) continue;
    const w = Math.cos(t * 2 - phase);
    const color = w > 0.35 ? C.ring : C.ringDim;
    put(c, p.x, p.y, color);
    put(c, p.x + 0.5, p.y, color);
    if (extraOuter && w > 0.35) put(c, p.x + (p.behind ? -0.5 : 1), p.y, C.ring);
  }
}

function strip(drawFrame) {
  const px = Buffer.alloc(FRAME * FRAMES * FRAME * 4);
  for (let f = 0; f < FRAMES; f++) {
    const c = makeCanvas();
    drawFrame(f, c);
    for (let y = 0; y < FRAME; y++) {
      c.px.copy(
        px,
        (y * FRAME * FRAMES + f * FRAME) * 4,
        y * FRAME * 4,
        (y + 1) * FRAME * 4
      );
    }
  }
  return encodePng(FRAME * FRAMES, FRAME, px);
}

// --- idle: slow ring rotation + gentle bob, blink on frame 2 ----------------
const idle = strip((f, c) => {
  drawPlanet(c, f % 2 === 1 ? 1 : 0, {
    ringPhase: f * (Math.PI / 6), // slow spin
    eyes: f === 2 ? "closed" : "open", // occasional blink
  });
});

// --- alert: fast ring spin + pulse band, wide eyes ---------------------------
const alert = strip((f, c) => {
  drawPlanet(c, 0, {
    ringPhase: f * (Math.PI / 2), // 3x faster spin
    eyes: "wide",
    ringBoost: f % 2 === 0, // pulsing outer band
  });
});

// --- sleep: closed eyes, slowest ring, growing "z" ---------------------------
const sleep = strip((f, c) => {
  drawPlanet(c, f === 1 ? 1 : 0, {
    ringPhase: f * (Math.PI / 12), // slowest spin
    eyes: "closed",
    z: f === 0 ? null : f === 1 ? 3 : 4,
    zY: f === 1 ? 6 : 3,
  });
});

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sheets");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "glim-idle.png"), idle);
writeFileSync(join(outDir, "glim-alert.png"), alert);
writeFileSync(join(outDir, "glim-sleep.png"), sleep);
console.log("wrote glim-idle.png, glim-alert.png, glim-sleep.png (planet frames) to public/sheets/");
