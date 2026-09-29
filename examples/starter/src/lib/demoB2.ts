/**
 * demo-b2 pure wiring helpers (starter-local; no library changes).
 *
 * Small decision functions the MascotView B2 wiring uses, extracted so the
 * wiring logic is unit-testable without a GUI (mirrors windowFit.ts).
 */

/**
 * Instance key for the Nth "note" click (1-based). Deterministic, unique per
 * click, and always K11-valid against the plugin-side regex
 * `^[a-z0-9_-]{1,32}$` (`note-1`, `note-2`, …) so the plugin creates a NEW
 * `orbitkit-popup-notes-<key>` window per click instead of re-showing the
 * singleton.
 */
export function noteInstanceKey(click: number): string {
  const n = Math.max(1, Math.floor(click));
  return `note-${n}`;
}

/**
 * Badge "+1": the next unread count. Floor guard keeps a corrupted count
 * from going negative; the +1 is the demo's whole point.
 */
export function nextBadgeCount(count: number): number {
  return Math.max(0, Math.floor(count)) + 1;
}

/** Park menu item label: flips with the parked state (single toggle item). */
export function parkMenuLabel(parked: boolean): string {
  return parked ? "Unpark" : "Park";
}

/**
 * K8 gate (UI side): while parked, mascot state requests are ignored —
 * returns `null` (keep the current display state). Unparked requests pass
 * through unchanged.
 */
export function gatedMascotState(
  parked: boolean,
  incoming: string,
): string | null {
  return parked ? null : incoming;
}
