// Unit tests for the demo-b1 pure window-fit math (src/lib/windowFit.ts).
// Run: node --test --experimental-strip-types tests/*.test.mjs
//
// Mutation-sensitive vs the pre-round2 inline formula (c1fff75): that formula
// returned shift = oldPos - clampedPos (double-counting the flex re-centre),
// which produced a NON-ZERO shift and a mascot jump on every unclamped fit —
// the `deepEqual(shift, {x:0,y:0})` and screen-invariant assertions below
// fail on it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoWindowFit } from "../src/lib/windowFit.ts";

const BASE = {
  // Reviewer repro from c1fff75: default 296x296 overlay at (960,480).
  window: { x: 960, y: 480, width: 296, height: 296 },
  workArea: { x: 0, y: 0, width: 1280, height: 800 },
  mascot: 96,
  headGap: 12,
  radius: 96,
  itemSize: 44,
  idlePadX: 24,
  menuPad: 8,
};

/** Mascot top-left on screen after applying a fit result. */
function mascotScreen(result) {
  return {
    x: result.window.x + result.mascotLocal.x,
    y: result.window.y + result.mascotLocal.y,
  };
}

test("idle fit keeps the mascot screen-fixed with zero shift (no clamp)", () => {
  const r = demoWindowFit(BASE, "idle");
  assert.deepEqual(r.shift, { x: 0, y: 0 });
  assert.deepEqual(mascotScreen(r), { x: 1060, y: 680 }); // centre of the old window
  assert.deepEqual(r.window, { x: 1036, y: 680, width: 144, height: 96 });
});

test("open fit keeps the mascot screen-fixed with zero shift; arc hovers above", () => {
  const idle = demoWindowFit(BASE, "idle");
  const open = demoWindowFit({ ...BASE, window: idle.window }, "open");
  assert.deepEqual(open.shift, { x: 0, y: 0 });
  // Mascot did not move on screen (B1.4: no jump on menu open).
  assert.deepEqual(mascotScreen(open), mascotScreen(idle));
  // Window = arc ∪ mascot + pad above/sides; bottom pinned to mascot bottom.
  assert.equal(open.window.width, 252); // 2*(96+22+8)
  assert.equal(open.window.height, 234); // headGap(12)+reach(118)+pad(8)+mascot(96)
  // CSS-pin identities: mascot local pos is exactly bottom-centre.
  assert.equal((open.window.width - BASE.mascot) / 2, open.mascotLocal.x);
  assert.equal(open.window.height - BASE.mascot, open.mascotLocal.y);
  // Arc centre (anchorRect contract) = above the mascot top edge, centred.
  const anchorCentre = {
    x: open.anchor.x + open.anchor.width / 2,
    y: open.anchor.y - BASE.headGap,
  };
  assert.deepEqual(anchorCentre, {
    x: open.mascotLocal.x + BASE.mascot / 2,
    y: open.mascotLocal.y - BASE.headGap,
  });
  // The arc's top stays inside the window.
  assert.ok(open.anchor.y - BASE.headGap - (BASE.radius + BASE.itemSize / 2) >= 0);
});

test("idle re-fit after open returns to the same window rect (no drift)", () => {
  const idle1 = demoWindowFit(BASE, "idle");
  const open = demoWindowFit({ ...BASE, window: idle1.window }, "open");
  const idle2 = demoWindowFit({ ...BASE, window: open.window }, "idle");
  assert.deepEqual(idle2.window, idle1.window);
  assert.deepEqual(idle2.shift, { x: 0, y: 0 });
});

test("work-area clamp shifts the content 1:1 so the mascot still stays put", () => {
  const idle = demoWindowFit(BASE, "idle");
  // Area too narrow for the open window (idle window right edge + arc): the
  // clamp must engage and compensate, keeping the mascot screen-fixed.
  const tight = { x: 0, y: 0, width: 1100, height: 800 };
  const openTight = demoWindowFit({ ...BASE, window: idle.window, workArea: tight }, "open");
  assert.equal(openTight.window.x + openTight.window.width, 1100); // right edge clamped
  assert.notDeepEqual(openTight.shift, { x: 0, y: 0 });
  // Mascot screen position is STILL the pre-fit position (B1.4: no jump even
  // when the work area forces the window to move).
  assert.deepEqual(mascotScreen(openTight), mascotScreen(idle));
  // shift is exactly ideal - clamped: window.x + shift.x restores the ideal
  // position the unclamped fit would have chosen for the same content.
  assert.equal(openTight.window.x + openTight.shift.x, 982);
});

test("window rect satisfies the bottom-centre pin in every state", () => {
  for (const state of /** @type {const} */ (["idle", "open"])) {
    const r = demoWindowFit(BASE, state);
    assert.equal((r.window.width - BASE.mascot) / 2, r.mascotLocal.x);
    assert.equal(r.window.height - BASE.mascot, r.mascotLocal.y);
  }
});
