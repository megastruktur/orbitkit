// Unit tests for the b1-fix-flash Design-B window-fit math (src/lib/windowFit.ts).
// Run: node --test --experimental-strip-types tests/*.test.mjs
//
// Design B (owner's B1 macOS smoke FAIL fix): the mascot window is sized ONCE
// to fit the OPEN menu content union and never resized/repositioned on menu
// open/close — transitions are content-only. The pre-fix model (342df70)
// computed a different window rect per state ("idle" 144x96 vs "open"
// 252x234) and applied setSize+setPosition on every toggle; between the two
// native calls macOS composited one frame of NEW size at the OLD origin, so
// the bottom-centre-pinned mascot blinked at a wrong screen spot.
//
// Mutation-sensitive vs 342df70: the identity test below fails on the
// per-state model (idle/open rects differ), and `clampFixedWindow` did not
// exist at all.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as windowFit from "../src/lib/windowFit.ts";

const demoWindowFit = windowFit.demoWindowFit;
const clampFixedWindow = windowFit.clampFixedWindow;

const BASE = {
  // Reviewer repro from c1fff75: default 296x296 overlay at (960,480).
  window: { x: 960, y: 480, width: 296, height: 296 },
  workArea: { x: 0, y: 0, width: 1280, height: 800 },
  mascot: 96,
  headGap: 12,
  radius: 96,
  itemSize: 44,
  menuPad: 8,
};

/** Mascot top-left on screen implied by a fit result (bottom-centre pin). */
function mascotScreen(result) {
  return {
    x: result.window.x + result.mascotLocal.x,
    y: result.window.y + result.mascotLocal.y,
  };
}

test("Design B: idle and open states share ONE fixed window rect", () => {
  // The legacy two-arg call is kept on purpose: the red run at 342df70 must
  // show idle.window (144x96) != open.window (252x234).
  const idle = demoWindowFit(BASE, "idle");
  const open = demoWindowFit(BASE, "open");
  assert.deepEqual(idle.window, open.window,
    "window rect must be identical in idle and open states (no setSize/setPosition per toggle)");
  assert.deepEqual(idle.anchor, open.anchor,
    "mascot window bounds (arc anchor) must be identical in both states");
  assert.deepEqual(idle.shift, open.shift,
    "clamp compensation must not change across open/close");
  assert.deepEqual(mascotScreen(idle), mascotScreen(open),
    "mascot screen position identical in both states");
});

test("fixed fit keeps mascot screen-fixed with zero shift (no clamp)", () => {
  const r = demoWindowFit(BASE);
  // Open-union rect: reach = 96 + 44/2 = 118; width = 2*(48+118) + 2*8 = 252;
  // height = (12+118) + 8 (top) + 96 (mascot) = 234.
  assert.deepEqual(r.window, { x: 982, y: 542, width: 252, height: 234 });
  assert.deepEqual(r.shift, { x: 0, y: 0 });
  // Feet stay exactly at the pre-fit position (old window (960,480,296,296):
  // mascot bottom-centre at (1060,680)).
  assert.deepEqual(mascotScreen(r), { x: 1060, y: 680 });
  assert.deepEqual(r.anchor, { x: 78, y: 138, width: 96, height: 96 });
});

test("fixed window satisfies the bottom-centre pin", () => {
  const r = demoWindowFit(BASE);
  assert.equal((r.window.width - BASE.mascot) / 2, r.mascotLocal.x);
  assert.equal(r.window.height - BASE.mascot, r.mascotLocal.y);
});

test("arc (with menuPad margin) fits inside the fixed window", () => {
  const r = demoWindowFit(BASE);
  const cx = r.mascotLocal.x + BASE.mascot / 2;
  const cy = r.mascotLocal.y - BASE.headGap; // arc centre, headGap above mascot top
  const reach = BASE.radius + BASE.itemSize / 2;
  assert.ok(cx - reach - BASE.menuPad >= 0, "left discs inside window");
  assert.ok(cy - reach - BASE.menuPad >= 0, "top discs inside window");
  assert.ok(cx + reach <= r.window.width, "right discs inside window");
});

test("work-area clamp shifts content 1:1 so mascot still stays put", () => {
  // Area too narrow for the fixed window's ideal x: 982 + 252 = 1234 > 1100.
  const tight = { x: 0, y: 0, width: 1100, height: 800 };
  const r = demoWindowFit({ ...BASE, workArea: tight });
  assert.equal(r.window.x + r.window.width, 1100, "right edge clamped");
  assert.notDeepEqual(r.shift, { x: 0, y: 0 });
  // Mascot screen position STILL the pre-fit position (feet never move).
  assert.deepEqual(mascotScreen(r), { x: 1060, y: 680 });
  assert.equal(r.shift.x, 982 - r.window.x,
    "shift is exactly ideal - clamped");
});

test("re-fit at the fixed rect is idempotent (no drift)", () => {
  const fit = demoWindowFit(BASE);
  const again = demoWindowFit({ ...BASE, window: fit.window });
  assert.deepEqual(again.window, fit.window);
  assert.deepEqual(again.shift, fit.shift);
  assert.deepEqual(again.anchor, fit.anchor);
});

test("clampFixedWindow is identity when the window is inside the work area", () => {
  const fit = demoWindowFit(BASE);
  assert.deepEqual(clampFixedWindow(fit.window, BASE.workArea), fit.window);
});

test("clamp moves the WINDOW only: size — and with it the pinned mascot and the arc anchor — is untouched", () => {
  // F1 guard: the clamp result is a bare rect. contentShift/anchorRect are
  // boot-constant; nothing in the clamp output can desync the arc anchor
  // (= mascot local + boot shift) from the rendered mascot.
  const fit = demoWindowFit(BASE);
  const dragged = { x: 1200, y: fit.window.y, width: fit.window.width, height: fit.window.height };
  const res = clampFixedWindow(dragged, BASE.workArea);
  assert.deepEqual(res, {
    x: BASE.workArea.width - fit.window.width,
    y: dragged.y,
    width: fit.window.width,
    height: fit.window.height,
  });
  assert.deepEqual(Object.keys(res).sort(), ["height", "width", "x", "y"],
    "clamp returns only a rect: no shift/anchor updates to drift");
});

test("clamp is stateless: below-area, back-to-centre, left-edge sequence never moves the mascot locally", () => {
  // F2 guard: no accumulating shift. The mascot's window-local position is
  // a pure function of the (unchanged) window size, so it is the same
  // before and after any clamp sequence — even after returning to centre.
  const fit = demoWindowFit(BASE);
  const pinOf = (r) => ({ x: (r.width - BASE.mascot) / 2, y: r.height - BASE.mascot });
  const pinBefore = pinOf(fit.window);
  assert.deepEqual(pinBefore, fit.mascotLocal); // sanity: bottom-centre pin

  // 1) dragged so the feet hang below the work area
  let r = clampFixedWindow({ x: 600, y: 790, width: fit.window.width, height: fit.window.height }, BASE.workArea);
  assert.equal(r.y, BASE.workArea.height - fit.window.height, "re-entered from the bottom");
  // 2) dragged back to the middle of the screen
  r = clampFixedWindow({ x: 600, y: 300, width: fit.window.width, height: fit.window.height }, BASE.workArea);
  assert.deepEqual(r, { x: 600, y: 300, width: fit.window.width, height: fit.window.height },
    "identity when back inside (no residual offset)");
  // 3) pushed against the left edge
  r = clampFixedWindow({ x: -60, y: 300, width: fit.window.width, height: fit.window.height }, BASE.workArea);
  assert.equal(r.x, BASE.workArea.x, "re-entered from the left");
  // The mascot never moved INSIDE the window anywhere in the sequence.
  assert.deepEqual(pinOf(r), pinBefore);
  // And the boot arc anchor IS the mascot's (constant) window-local position:
  // both are post-shift values from the one-time fit, so the clamp — which
  // changes neither the size nor the boot shift — keeps them equal.
  assert.deepEqual(fit.anchor, {
    x: fit.mascotLocal.x,
    y: fit.mascotLocal.y,
    width: BASE.mascot,
    height: BASE.mascot,
  });
});
