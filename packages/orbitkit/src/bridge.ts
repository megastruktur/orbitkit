import { invoke } from "@tauri-apps/api/core";
import { listen, emit, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MenuConfig } from "./config";

export type OrbitKitErrorCode =
  | "permission_denied"
  | "unsupported"
  | "not_found"
  | "invalid_config";

const VALID_ERROR_CODES: Record<string, true> = {
  permission_denied: true,
  unsupported: true,
  not_found: true,
  invalid_config: true,
};

export class OrbitKitError extends Error {
  readonly code: OrbitKitErrorCode;

  constructor(code: OrbitKitErrorCode, message: string) {
    super(message);
    this.name = "OrbitKitError";
    this.code = code;
    Object.setPrototypeOf(this, OrbitKitError.prototype);
  }
}

export function normalizeError(err: unknown): OrbitKitError {
  if (err instanceof OrbitKitError) {
    return err;
  }

  let code: OrbitKitErrorCode = "unsupported";
  let message = "OrbitKit operation failed";

  if (typeof err === "string") {
    message = err;
    const lower = err.toLowerCase();
    if (lower.includes("permission_denied")) {
      code = "permission_denied";
    } else if (lower.includes("not_found")) {
      code = "not_found";
    } else if (
      lower.includes("invalid_config") ||
      lower.includes("invalid_argument")
    ) {
      code = "invalid_config";
    } else {
      code = "unsupported";
    }
  } else if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.length > 0) {
      message = obj.message;
    } else if ("message" in obj && obj.message != null) {
      message = String(obj.message);
    } else if (typeof (err as Error).toString === "function") {
      const str = (err as Error).toString();
      if (str !== "[object Object]") {
        message = str;
      }
    }

    const rawCode = typeof obj.code === "string" ? obj.code.toLowerCase() : "";
    if (VALID_ERROR_CODES[rawCode]) {
      code = rawCode as OrbitKitErrorCode;
    } else if (rawCode === "invalid_argument") {
      code = "invalid_config";
    } else {
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes("permission_denied")) {
        code = "permission_denied";
      } else if (lowerMsg.includes("not_found")) {
        code = "not_found";
      } else if (
        lowerMsg.includes("invalid_config") ||
        lowerMsg.includes("invalid_argument")
      ) {
        code = "invalid_config";
      } else {
        code = "unsupported";
      }
    }
  }

  return new OrbitKitError(code, message);
}

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    window !== null &&
    "__TAURI_INTERNALS__" in window
  );
}

async function callPlugin<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauri()) {
    throw new OrbitKitError(
      "unsupported",
      `OrbitKit command '${cmd}' is unsupported outside of Tauri.`
    );
  }
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw normalizeError(err);
  }
}

export interface ShowOverlayOptions {
  menu: MenuConfig;
  mascot?: { size: number };
}

export async function overlayPermission(): Promise<boolean> {
  const res = await callPlugin<{ granted: boolean } | boolean>(
    "plugin:orbitkit|overlay_permission"
  );
  return typeof res === "boolean" ? res : (res?.granted ?? false);
}

export async function requestOverlayPermission(): Promise<void> {
  await callPlugin<void>("plugin:orbitkit|request_overlay_permission");
}

export async function showOverlay(options: ShowOverlayOptions): Promise<void> {
  await callPlugin<void>("plugin:orbitkit|show_overlay", {
    menu: options.menu,
    mascot: options.mascot,
  });
}

export async function hideOverlay(): Promise<void> {
  await callPlugin<void>("plugin:orbitkit|hide_overlay");
}

/** K11: options for `openPopup` beyond the popup config id. */
export interface OpenPopupOptions {
  /** K11: `{param}` placeholder values, substituted URL-encoded into the URL. */
  params?: Record<string, string>;
  /**
   * K11: instance key for multiple windows of one popup kind. Must match
   * `^[a-z0-9_-]{1,32}$`; label becomes `orbitkit-popup-{id}-{instanceKey}`.
   */
  instanceKey?: string;
}

/**
 * K11: opens the configured popup `id`. Idempotent — an already-open label is
 * shown + focused instead of duplicated. `openPopup(id)` stays valid.
 */
export async function openPopup(id: string, options?: OpenPopupOptions): Promise<void> {
  const args: Record<string, unknown> = { id };
  if (options?.params !== undefined) {
    args.params = options.params;
  }
  if (options?.instanceKey !== undefined) {
    args.instanceKey = options.instanceKey;
  }
  await callPlugin<void>("plugin:orbitkit|open_popup", args);
}

/** K11: closes the popup window by full label (e.g. `orbitkit-popup-notes`). */
export async function closePopup(label: string): Promise<void> {
  await callPlugin<void>("plugin:orbitkit|close_popup", { label });
}

/** K11: labels of all currently open OrbitKit popup windows. */
export async function listPopups(): Promise<string[]> {
  return await callPlugin<string[]>("plugin:orbitkit|list_popups");
}

export async function setMascotState(state: string): Promise<void> {
  await callPlugin<void>("plugin:orbitkit|set_mascot_state", { state });
}

export async function emitMenuAction(id: string): Promise<void> {
  await callPlugin<void>("plugin:orbitkit|emit_menu_action", { id });
}

export async function startMascotDrag(): Promise<void> {
  await callPlugin<void>("plugin:orbitkit|start_mascot_drag");
}

export type MenuActionPayload = {
  id: string;
  source: "webview" | "overlay";
};

export type MenuActionCallback = (payload: MenuActionPayload) => void;

export type { UnlistenFn };

export async function onMenuAction(
  cb: MenuActionCallback
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  try {
    return await listen<MenuActionPayload>("orbitkit://menu-action", (event) => {
      cb(event.payload);
    });
  } catch (err) {
    throw normalizeError(err);
  }
}

export type MascotStatePayload = {
  state: string;
};

export type MascotStateCallback = (payload: MascotStatePayload) => void;

export async function onMascotState(
  cb: MascotStateCallback
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  try {
    return await listen<MascotStatePayload>("orbitkit://mascot-state", (event) => {
      cb(event.payload);
    });
  } catch (err) {
    throw normalizeError(err);
  }
}

/**
 * Legacy payload of the Android `orbitkit://popup-open` event (emitted by the
 * native Kotlin layer and the mobile plugin arm). Superseded on desktop by
 * `orbitkit://popup-shown` / `PopupLifecyclePayload` (K11).
 */
export type PopupOpenPayload = {
  id: string;
  title: string;
  url: string;
  width: number;
  height: number;
};

export type PopupOpenCallback = (payload: PopupOpenPayload) => void;

/**
 * Legacy: subscribes to the Android `orbitkit://popup-open` sheet event.
 * Desktop popups use `onPopupShown` (K11).
 */
export async function onPopupOpen(
  cb: PopupOpenCallback
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  try {
    return await listen<PopupOpenPayload>("orbitkit://popup-open", (event) => {
      cb(event.payload);
    });
  } catch (err) {
    throw normalizeError(err);
  }
}

/** Legacy payload of the Android `orbitkit://popup-close` event. */
export type PopupClosePayload = {
  id: string;
};

export type PopupCloseCallback = (payload: PopupClosePayload) => void;

/**
 * Legacy: subscribes to the Android `orbitkit://popup-close` sheet event.
 * Desktop popups use `onPopupClosed` (K11).
 */
export async function onPopupClose(
  cb: PopupCloseCallback
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  try {
    return await listen<PopupClosePayload>("orbitkit://popup-close", (event) => {
      cb(event.payload);
    });
  } catch (err) {
    throw normalizeError(err);
  }
}

/** K11: payload of `orbitkit://popup-shown` / `orbitkit://popup-closed`. */
export type PopupLifecyclePayload = {
  /** Full window label, e.g. `orbitkit-popup-notes` or
   * `orbitkit-popup-notes-chat-1`. */
  label: string;
};

export type PopupLifecycleCallback = (payload: PopupLifecyclePayload) => void;

/** K11: subscribes to `orbitkit://popup-shown` (create and re-show). */
export async function onPopupShown(
  cb: PopupLifecycleCallback
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  try {
    return await listen<PopupLifecyclePayload>(
      "orbitkit://popup-shown",
      (event) => {
        cb(event.payload);
      }
    );
  } catch (err) {
    throw normalizeError(err);
  }
}

/** K11: subscribes to `orbitkit://popup-closed`. */
export async function onPopupClosed(
  cb: PopupLifecycleCallback
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  try {
    return await listen<PopupLifecyclePayload>(
      "orbitkit://popup-closed",
      (event) => {
        cb(event.payload);
      }
    );
  } catch (err) {
    throw normalizeError(err);
  }
}

/** Physical-pixel rectangle in global screen space (K9). */
export type PhysRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Payload of the `mascot_monitor` command (K9). */
export type MascotMonitorPayload = {
  workArea: PhysRect;
  scaleFactor: number;
};

/**
 * Returns work area + scale factor of the monitor containing the mascot window
 * centre (K9). Unsupported on mobile (rejects with `OrbitKitError` code
 * `"unsupported"`).
 */
export async function mascotMonitor(): Promise<MascotMonitorPayload> {
  return callPlugin<MascotMonitorPayload>("plugin:orbitkit|mascot_monitor");
}

/** Payload of the `tauri://scale-change` window event. */
export type ScaleChangePayload = {
  scaleFactor: number;
  size: { width: number; height: number };
};

export type ScaleChangeCallback = (payload: ScaleChangePayload) => void;

/** Subscribes to this window's `tauri://scale-change`; returns an unlisten function. */
export async function onScaleChange(
  cb: ScaleChangeCallback
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  try {
    return await getCurrentWindow().onScaleChanged((event) => {
      cb(event.payload);
    });
  } catch (err) {
    throw normalizeError(err);
  }
}

/** Payload of the `orbitkit://badge` event: current unread-badge count. */
export type BadgePayload = {
  count: number;
};

export type BadgeCallback = (payload: BadgePayload) => void;

/**
 * Subscribes to `orbitkit://badge` count events; returns an unlisten function.
 * Outside Tauri, resolves to a no-op unlisten without subscribing.
 */
export async function onBadge(cb: BadgeCallback): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  try {
    return await listen<BadgePayload>("orbitkit://badge", (event) => {
      cb(event.payload);
    });
  } catch (err) {
    throw normalizeError(err);
  }
}

/**
 * Emits `orbitkit://badge {count}` (broadcast to every listener, including the
 * emitting webview). Outside Tauri, resolves without emitting.
 */
export async function setBadge(count: number): Promise<void> {
  if (!isTauri()) {
    return;
  }
  try {
    await emit("orbitkit://badge", { count });
  } catch (err) {
    throw normalizeError(err);
  }
}

export * from "./dragGesture.js";
