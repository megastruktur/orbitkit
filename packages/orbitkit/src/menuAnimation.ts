/**
 * Pure timing and animation math for OrbitKit RadialMenu spawn and collapse animations.
 * Matches Android overlay behavior (R-DEV-2) for desktop parity.
 */

import { DEFAULT_STAGGER } from "./config.js";

export const OPEN_DURATION = 220; // ms
export const CLOSE_DURATION = 180; // ms
export const STAGGER_DELAY = 20; // ms
export const OPEN_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
export const CLOSE_EASING = "cubic-bezier(0.4, 0, 1, 1)";

/**
 * K7 stagger timing engaged for `layout: "arc-anchor"` menus.
 * The legacy orbit/arc path stays un-parameterized (index-linear, 20 ms).
 */
export interface MenuStaggerSpec {
  openMs: number;
  closeMs: number;
  stepMs: number;
}

/** K7 defaults (menu.stagger default 260/180/40), single source: config.ts. */
export const DEFAULT_ANCHOR_STAGGER: MenuStaggerSpec = {
  openMs: DEFAULT_STAGGER.openMs,
  closeMs: DEFAULT_STAGGER.closeMs,
  stepMs: DEFAULT_STAGGER.stepMs,
};

export type MenuAnimPhase = "opening" | "open" | "closing" | "closed";

/**
 * K7: distance of an item from the menu centre. Odd counts centre on one item
 * (distance 0); even counts centre on a pair (both pair members share the
 * minimum distance 0.5).
 */
function centreDistance(index: number, total: number): number {
  return Math.abs(index - (total - 1) / 2);
}

/**
 * Returns the stagger delay in milliseconds for an item at `index`
 * in a menu with `total` items for the given animation direction.
 *
 * Without `spec` (orbit/arc legacy): index-linear 0/20/40… on open, reversed
 * on close. With a `MenuStaggerSpec` (arc-anchor): open delay is
 * `stepMs·|i − centre|` (centre→edges wave); close delay is reversed
 * (edges first, centre last).
 */
export function getItemDelay(
  index: number,
  total: number,
  direction: "open" | "close",
  spec?: MenuStaggerSpec
): number {
  if (total <= 0 || index < 0 || index >= total) return 0;
  if (spec) {
    const distance = centreDistance(index, total);
    const maxDistance = (total - 1) / 2;
    return spec.stepMs * (direction === "open" ? distance : maxDistance - distance);
  }
  if (direction === "open") {
    return index * STAGGER_DELAY;
  }
  return Math.max(0, (total - 1 - index) * STAGGER_DELAY);
}

/**
 * Largest per-item delay for a direction — the item whose animation ends last
 * (RadialMenu uses this to detect that the open/close wave has fully settled).
 */
export function getMaxItemDelay(
  total: number,
  direction: "open" | "close",
  spec?: MenuStaggerSpec
): number {
  let max = 0;
  for (let i = 0; i < total; i += 1) {
    max = Math.max(max, getItemDelay(i, total, direction, spec));
  }
  return max;
}

/**
 * Returns the total duration in milliseconds until the last item finishes animating.
 */
export function getTotalAnimationDuration(
  total: number,
  direction: "open" | "close",
  spec?: MenuStaggerSpec
): number {
  if (total <= 0) return 0;
  const maxDelay = getMaxItemDelay(total, direction, spec);
  const duration = spec
    ? direction === "open"
      ? spec.openMs
      : spec.closeMs
    : direction === "open"
      ? OPEN_DURATION
      : CLOSE_DURATION;
  return maxDelay + duration;
}

/**
 * Computes the item's inline animation style and custom properties.
 * `spec` (arc-anchor) swaps the per-item duration for the configured
 * openMs/closeMs and the delay for the centre→edges stagger.
 */
export function getItemAnimationStyle(
  index: number,
  total: number,
  phase: MenuAnimPhase,
  pos: { x: number; y: number },
  animationConfig?: "spawn" | "none",
  spec?: MenuStaggerSpec
): string {
  if (animationConfig === "none") {
    return "";
  }

  const dx = -pos.x;
  const dy = -pos.y;

  if (phase === "opening") {
    const delay = getItemDelay(index, total, "open", spec);
    const duration = spec ? spec.openMs : OPEN_DURATION;
    return [
      `--spawn-tx: ${dx}px`,
      `--spawn-ty: ${dy}px`,
      `--stagger-delay: ${delay}ms`,
      `--stagger-duration: ${duration}ms`,
      `animation: orbitkit-radial-item-open ${duration}ms ${OPEN_EASING} ${delay}ms both`,
      `animation-delay: ${delay}ms`,
      `pointer-events: none`,
    ].join("; ");
  }

  if (phase === "closing") {
    const delay = getItemDelay(index, total, "close", spec);
    const duration = spec ? spec.closeMs : CLOSE_DURATION;
    return [
      `--spawn-tx: ${dx}px`,
      `--spawn-ty: ${dy}px`,
      `--stagger-delay: ${delay}ms`,
      `--stagger-duration: ${duration}ms`,
      `animation: orbitkit-radial-item-close ${duration}ms ${CLOSE_EASING} ${delay}ms both`,
      `animation-delay: ${delay}ms`,
      `pointer-events: none`,
    ].join("; ");
  }

  if (phase === "closed") {
    return [
      `--spawn-tx: ${dx}px`,
      `--spawn-ty: ${dy}px`,
      `opacity: 0`,
      `scale: 0`,
      `translate: ${dx}px ${dy}px`,
      `pointer-events: none`,
    ].join("; ");
  }

  return "pointer-events: auto;";
}
