import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
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

export async function openPopup(id: string): Promise<void> {
  await callPlugin<void>("plugin:orbitkit|open_popup", { id });
}

export async function closePopup(id: string): Promise<void> {
  await callPlugin<void>("plugin:orbitkit|close_popup", { id });
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

export type PopupOpenPayload = {
  id: string;
  title: string;
  url: string;
  width: number;
  height: number;
};

export type PopupOpenCallback = (payload: PopupOpenPayload) => void;

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

export type PopupClosePayload = {
  id: string;
};

export type PopupCloseCallback = (payload: PopupClosePayload) => void;

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

export * from "./dragGesture.js";
