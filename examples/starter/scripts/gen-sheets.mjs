// Deterministic pixel-art sprite sheet generator for the demo-b1 mascot
// "Glim" (original art, no third-party assets). No dependencies: PNGs are
// encoded with node:zlib.
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
// Glim: a little teal blob, feet pinned to y=29 (bottom of the body).
// Body squish changes only the top of the body so idle feet never jump.
// ---------------------------------------------------------------------------
const C = {
  outline: [24, 74, 62],
  body: [64, 199, 165],
  belly: [191, 242, 226],
  eye: [255, 255, 255],
  pupil: [23, 32, 42],
  amber: [255, 211, 77],
  white: [245, 250, 252],
};

const BODY_BOTTOM = 27; // last body row; feet sit below it

function drawGlim(c, xoff, { squish = 0, eyes = "open", exclaimY = null, z = null, zY = null, breathe = 0 }) {
  const cx = 16 + xoff;
  // Feet: fixed, never move with idle squish.
  fillRect(c, cx - 6, BODY_BOTTOM + 1, 4, 2, C.outline);
  fillRect(c, cx + 2, BODY_BOTTOM + 1, 4, 2, C.outline);
  fillRect(c, cx - 6, BODY_BOTTOM, 4, 1, C.body);
  fillRect(c, cx + 2, BODY_BOTTOM, 4, 1, C.body);
  // Body: bottom pinned at BODY_BOTTOM, top rises/falls with squish.
  const ry = 8 - squish - breathe;
  fillEllipse(c, cx, BODY_BOTTOM - ry, 9, ry + 0.5, C.outline);
  fillEllipse(c, cx, BODY_BOTTOM - ry, 8, ry, C.body);
  // Belly patch.
  fillEllipse(c, cx, BODY_BOTTOM - 3, 4, 3, C.belly);
  // Face.
  const eyeY = BODY_BOTTOM - ry + 3;
  if (eyes === "open") {
    fillRect(c, cx - 5, eyeY, 3, 4, C.eye);
    fillRect(c, cx + 2, eyeY, 3, 4, C.eye);
    fillRect(c, cx - 4, eyeY + 1, 2, 2, C.pupil);
    fillRect(c, cx + 3, eyeY + 1, 2, 2, C.pupil);
  } else if (eyes === "wide") {
    fillRect(c, cx - 5, eyeY - 1, 4, 5, C.eye);
    fillRect(c, cx + 2, eyeY - 1, 4, 5, C.eye);
    fillRect(c, cx - 4, eyeY + 1, 2, 2, C.pupil);
    fillRect(c, cx + 3, eyeY + 1, 2, 2, C.pupil);
  } else {
    // closed: sleepy lids
    fillRect(c, cx - 5, eyeY + 1, 3, 1, C.pupil);
    fillRect(c, cx + 2, eyeY + 1, 3, 1, C.pupil);
  }
  // Mouth.
  if (eyes === "closed") fillRect(c, cx - 1, BODY_BOTTOM - 4, 2, 1, C.outline);
  else fillRect(c, cx - 2, BODY_BOTTOM - 4, 4, 1, C.outline);
  // Alert "!": bouncing amber mark above the head.
  if (exclaimY !== null) {
    fillRect(c, cx + 8, exclaimY, 1, 3, C.amber);
    fillRect(c, cx + 8, exclaimY + 4, 1, 1, C.amber);
  }
  // Sleep "z": growing glyph top-right.
  if (z === 3) drawZ(c, cx + 7, zY ?? 3, Z3, C.white);
  if (z === 4) drawZ(c, cx + 7, zY ?? 2, Z4, C.white);
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

// --- idle: gentle breathing squish, blink on frame 2; feet never move -------
const idle = strip((f, c) => {
  drawGlim(c, 0, {
    squish: f % 2 === 1 ? 1 : 0,
    eyes: f === 2 ? "closed" : "open",
  });
});

// --- alert: wide eyes + bouncing "!"; whole sprite shakes horizontally ------
const alert = strip((f, c) => {
  drawGlim(c, f % 2 === 0 ? -1 : 1, {
    eyes: "wide",
    exclaimY: 3 + (f % 2) * 2,
  });
});

// --- sleep: closed eyes, breathing, growing "z" ------------------------------
const sleep = strip((f, c) => {
  drawGlim(c, 0, {
    eyes: "closed",
    breathe: f === 1 || f === 2 ? 1 : 0,
    z: f === 0 ? null : f === 1 ? 3 : 4,
    zY: f === 1 ? 6 : 3,
  });
});

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sheets");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "glim-idle.png"), idle);
writeFileSync(join(outDir, "glim-alert.png"), alert);
writeFileSync(join(outDir, "glim-sleep.png"), sleep);
console.log("wrote glim-idle.png, glim-alert.png, glim-sleep.png to public/sheets/");
