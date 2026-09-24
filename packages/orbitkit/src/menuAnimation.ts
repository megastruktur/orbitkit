/**
 * Pure timing and animation math for OrbitKit RadialMenu spawn and collapse animations.
 * Matches Android overlay behavior (R-DEV-2) for desktop parity.
 */

export const OPEN_DURATION = 220; // ms
export const CLOSE_DURATION = 180; // ms
export const STAGGER_DELAY = 20; // ms
export const OPEN_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
export const CLOSE_EASING = "cubic-bezier(0.4, 0, 1, 1)";

export type MenuAnimPhase = "opening" | "open" | "closing" | "closed";

/**
 * Returns the stagger delay in milliseconds for an item at `index`
 * in a menu with `total` items for the given animation direction.
 */
export function getItemDelay(
  index: number,
  total: number,
  direction: "open" | "close"
): number {
  if (total <= 0 || index < 0) return 0;
  if (direction === "open") {
    return index * STAGGER_DELAY;
  }
  return Math.max(0, (total - 1 - index) * STAGGER_DELAY);
}

/**
 * Returns the total duration in milliseconds until the last item finishes animating.
 */
export function getTotalAnimationDuration(
  total: number,
  direction: "open" | "close"
): number {
  if (total <= 0) return 0;
  const maxDelay = (total - 1) * STAGGER_DELAY;
  const duration = direction === "open" ? OPEN_DURATION : CLOSE_DURATION;
  return maxDelay + duration;
}

/**
 * Computes the item's inline animation style and custom properties.
 */
export function getItemAnimationStyle(
  index: number,
  total: number,
  phase: MenuAnimPhase,
  pos: { x: number; y: number },
  animationConfig?: "spawn" | "none"
): string {
  if (animationConfig === "none") {
    return "";
  }

  const dx = -pos.x;
  const dy = -pos.y;

  if (phase === "opening") {
    const delay = getItemDelay(index, total, "open");
    return [
      `--spawn-tx: ${dx}px`,
      `--spawn-ty: ${dy}px`,
      `animation: orbitkit-radial-item-open ${OPEN_DURATION}ms ${OPEN_EASING} ${delay}ms both`,
      `animation-delay: ${delay}ms`,
      `pointer-events: none`,
    ].join("; ");
  }

  if (phase === "closing") {
    const delay = getItemDelay(index, total, "close");
    return [
      `--spawn-tx: ${dx}px`,
      `--spawn-ty: ${dy}px`,
      `animation: orbitkit-radial-item-close ${CLOSE_DURATION}ms ${CLOSE_EASING} ${delay}ms both`,
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
