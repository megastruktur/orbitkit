// STUB owned by oks-bridge

import type { MenuConfig } from "./config";

export function isTauri(): boolean {
  // STUB owned by oks-bridge
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function overlayPermission(): Promise<{ granted: boolean }> {
  // STUB owned by oks-bridge
  return { granted: true };
}

export async function requestOverlayPermission(): Promise<void> {
  // STUB owned by oks-bridge
}

export async function showOverlay(_options: {
  menu: MenuConfig;
  mascot?: { size: number };
}): Promise<void> {
  // STUB owned by oks-bridge
}

export async function hideOverlay(): Promise<void> {
  // STUB owned by oks-bridge
}

export async function openPopup(_id: string): Promise<void> {
  // STUB owned by oks-bridge
}

export async function closePopup(_id: string): Promise<void> {
  // STUB owned by oks-bridge
}

export async function setMascotState(_state: string): Promise<void> {
  // STUB owned by oks-bridge
}

export async function emitMenuAction(_id: string): Promise<void> {
  // STUB owned by oks-bridge
}

export type MenuActionCallback = (payload: {
  id: string;
  source: "webview" | "overlay";
}) => void;

export type UnlistenFn = () => void;

export async function onMenuAction(
  _cb: MenuActionCallback
): Promise<UnlistenFn> {
  // STUB owned by oks-bridge
  return () => {};
}

export type MascotStateCallback = (payload: { state: string }) => void;

export async function onMascotState(
  _cb: MascotStateCallback
): Promise<UnlistenFn> {
  // STUB owned by oks-bridge
  return () => {};
}
