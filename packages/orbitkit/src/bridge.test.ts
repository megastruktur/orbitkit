import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import {
  closePopup,
  emitMenuAction,
  hideOverlay,
  isTauri,
  mascotMonitor,
  normalizeError,
  onMascotState,
  onMenuAction,
  onPopupClose,
  onPopupOpen,
  onScaleChange,
  openPopup,
  OrbitKitError,
  overlayPermission,
  requestOverlayPermission,
  setMascotState,
  showOverlay,
  startMascotDrag,
  type MenuConfig,
  type PopupOpenPayload,
} from "./index";

const sampleMenu: MenuConfig = {
  items: [
    { id: "item-1", label: "One" },
    { id: "item-2", label: "Two" },
  ],
  radius: 96,
  startAngle: -90,
  endAngle: 270,
};

function clearTauriInternals(): void {
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  clearMocks();
}

function triggerTauriCallback(handlerId: number, eventData: unknown): void {
  if (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window &&
    window.__TAURI_INTERNALS__ &&
    typeof window.__TAURI_INTERNALS__ === "object" &&
    "callbacks" in window.__TAURI_INTERNALS__
  ) {
    const callbacks = window.__TAURI_INTERNALS__.callbacks;
    if (callbacks instanceof Map) {
      const cb = callbacks.get(handlerId);
      if (typeof cb === "function") {
        cb(eventData);
      }
    }
  }
}

describe("bridge", () => {
  describe("isTauri environment detection", () => {
    it("returns true when __TAURI_INTERNALS__ is present in window", () => {
      mockWindows("main");
      mockIPC(() => null);
      expect(isTauri()).toBe(true);
    });

    it("returns false when __TAURI_INTERNALS__ is absent", () => {
      clearTauriInternals();
      expect(isTauri()).toBe(false);
    });
  });

  describe("K4 commands via Tauri IPC", () => {
    beforeEach(() => {
      mockWindows("main");
    });

    afterEach(() => {
      clearTauriInternals();
    });

    it("1a. overlayPermission invokes plugin:orbitkit|overlay_permission and returns true for { granted: true }", async () => {
      let recordedCmd = "";
      mockIPC((cmd) => {
        recordedCmd = cmd;
        if (cmd === "plugin:orbitkit|overlay_permission") {
          return { granted: true };
        }
        return null;
      });

      const granted = await overlayPermission();
      expect(recordedCmd).toBe("plugin:orbitkit|overlay_permission");
      expect(granted).toBe(true);
    });

    it("1b. overlayPermission returns false when mockIPC returns { granted: false }", async () => {
      let recordedCmd = "";
      mockIPC((cmd) => {
        recordedCmd = cmd;
        if (cmd === "plugin:orbitkit|overlay_permission") {
          return { granted: false };
        }
        return null;
      });

      const granted = await overlayPermission();
      expect(recordedCmd).toBe("plugin:orbitkit|overlay_permission");
      expect(granted).toBe(false);
    });

    it("1c. overlayPermission returns false when mockIPC returns bare false", async () => {
      let recordedCmd = "";
      mockIPC((cmd) => {
        recordedCmd = cmd;
        if (cmd === "plugin:orbitkit|overlay_permission") {
          return false;
        }
        return null;
      });

      const granted = await overlayPermission();
      expect(recordedCmd).toBe("plugin:orbitkit|overlay_permission");
      expect(granted).toBe(false);
    });

    it("1d. overlayPermission returns true when mockIPC returns bare true", async () => {
      let recordedCmd = "";
      mockIPC((cmd) => {
        recordedCmd = cmd;
        if (cmd === "plugin:orbitkit|overlay_permission") {
          return true;
        }
        return null;
      });

      const granted = await overlayPermission();
      expect(recordedCmd).toBe("plugin:orbitkit|overlay_permission");
      expect(granted).toBe(true);
    });

    it("2. requestOverlayPermission invokes plugin:orbitkit|request_overlay_permission", async () => {
      let recordedCmd = "";
      mockIPC((cmd) => {
        recordedCmd = cmd;
        return null;
      });

      await requestOverlayPermission();
      expect(recordedCmd).toBe("plugin:orbitkit|request_overlay_permission");
    });

    it("3. showOverlay invokes plugin:orbitkit|show_overlay with menu and mascot", async () => {
      let recordedCmd = "";
      let recordedArgs: unknown = null;

      mockIPC((cmd, args) => {
        recordedCmd = cmd;
        recordedArgs = args;
        return null;
      });

      await showOverlay({
        menu: sampleMenu,
        mascot: { size: 48 },
      });

      expect(recordedCmd).toBe("plugin:orbitkit|show_overlay");
      expect(recordedArgs).toEqual({
        menu: sampleMenu,
        mascot: { size: 48 },
      });
    });

    it("4. hideOverlay invokes plugin:orbitkit|hide_overlay", async () => {
      let recordedCmd = "";
      mockIPC((cmd) => {
        recordedCmd = cmd;
        return null;
      });

      await hideOverlay();
      expect(recordedCmd).toBe("plugin:orbitkit|hide_overlay");
    });

    it("5. openPopup invokes plugin:orbitkit|open_popup with id payload", async () => {
      let recordedCmd = "";
      let recordedArgs: unknown = null;

      mockIPC((cmd, args) => {
        recordedCmd = cmd;
        recordedArgs = args;
        return null;
      });

      await openPopup("settings");
      expect(recordedCmd).toBe("plugin:orbitkit|open_popup");
      expect(recordedArgs).toEqual({ id: "settings" });
    });

    it("6. closePopup invokes plugin:orbitkit|close_popup with id payload", async () => {
      let recordedCmd = "";
      let recordedArgs: unknown = null;

      mockIPC((cmd, args) => {
        recordedCmd = cmd;
        recordedArgs = args;
        return null;
      });

      await closePopup("palette");
      expect(recordedCmd).toBe("plugin:orbitkit|close_popup");
      expect(recordedArgs).toEqual({ id: "palette" });
    });

    it("7. setMascotState invokes plugin:orbitkit|set_mascot_state with state payload", async () => {
      let recordedCmd = "";
      let recordedArgs: unknown = null;

      mockIPC((cmd, args) => {
        recordedCmd = cmd;
        recordedArgs = args;
        return null;
      });

      await setMascotState("thinking");
      expect(recordedCmd).toBe("plugin:orbitkit|set_mascot_state");
      expect(recordedArgs).toEqual({ state: "thinking" });
    });

    it("8. emitMenuAction invokes plugin:orbitkit|emit_menu_action with id payload", async () => {
      let recordedCmd = "";
      let recordedArgs: unknown = null;

      mockIPC((cmd, args) => {
        recordedCmd = cmd;
        recordedArgs = args;
        return null;
      });

      await emitMenuAction("item-1");
      expect(recordedCmd).toBe("plugin:orbitkit|emit_menu_action");
      expect(recordedArgs).toEqual({ id: "item-1" });
    });

    it("9. startMascotDrag invokes plugin:orbitkit|start_mascot_drag", async () => {
      let recordedCmd = "";
      mockIPC((cmd) => {
        recordedCmd = cmd;
        return null;
      });

      await startMascotDrag();
      expect(recordedCmd).toBe("plugin:orbitkit|start_mascot_drag");
    });

    it("10. startMascotDrag normalizes plugin errors to OrbitKitError", async () => {
      mockIPC(() => {
        throw { code: "not_found", message: "Window not found" };
      });

      await expect(startMascotDrag()).rejects.toThrow(OrbitKitError);
    });
  });

  describe("K9 mascot_monitor + scale-change", () => {
    beforeEach(() => {
      mockWindows("main");
    });

    afterEach(() => {
      clearTauriInternals();
    });

    it("11. mascotMonitor invokes plugin:orbitkit|mascot_monitor and returns payload", async () => {
      let recordedCmd = "";
      let recordedArgs: unknown = null;
      mockIPC((cmd, args) => {
        recordedCmd = cmd;
        recordedArgs = args ?? null;
        return {
          workArea: { x: -1920, y: 0, width: 1920, height: 1080 },
          scaleFactor: 1.5,
        };
      });

      const payload = await mascotMonitor();

      expect(recordedCmd).toBe("plugin:orbitkit|mascot_monitor");
      expect(recordedArgs).toEqual({});
      expect(payload).toEqual({
        workArea: { x: -1920, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1.5,
      });
    });

    it("12. mascotMonitor maps mobile 'unsupported' rejection to OrbitKitError", async () => {
      mockIPC(() => {
        throw {
          code: "unsupported",
          message: "mascot_monitor is not supported on this platform",
        };
      });

      const err = await mascotMonitor().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(OrbitKitError);
      if (err instanceof OrbitKitError) {
        expect(err.code).toBe("unsupported");
      }
    });

    it("13. onScaleChange subscribes to tauri://scale-change on the current window and delivers payload", async () => {
      let eventHandlerId: number | null = null;
      let listenedEvent = "";
      let listenTarget: unknown = null;

      mockIPC((cmd, args) => {
        if (
          cmd === "plugin:event|listen" &&
          args &&
          typeof args === "object"
        ) {
          if ("event" in args && typeof args.event === "string") {
            listenedEvent = args.event;
          }
          if ("handler" in args && typeof args.handler === "number") {
            eventHandlerId = args.handler;
          }
          if ("target" in args) {
            listenTarget = args.target;
          }
          return 202;
        }
        return null;
      });

      const callback = vi.fn();
      const unlisten = await onScaleChange(callback);

      expect(listenedEvent).toBe("tauri://scale-change");
      // Scoped to the current window — not a global Any-target listen.
      expect(listenTarget).toEqual({ kind: "Window", label: "main" });
      expect(eventHandlerId).not.toBeNull();

      triggerTauriCallback(eventHandlerId!, {
        event: "tauri://scale-change",
        payload: { scaleFactor: 2, size: { width: 2560, height: 1440 } },
      });

      expect(callback).toHaveBeenCalledWith({
        scaleFactor: 2,
        size: { width: 2560, height: 1440 },
      });

      let unlistened = false;
      mockIPC((cmd) => {
        if (cmd === "plugin:event|unlisten") {
          unlistened = true;
        }
        return null;
      });
      unlisten();
      expect(unlistened).toBe(true);
    });

    it("14. onScaleChange returns a no-op unlisten function outside Tauri without throwing", async () => {
      clearTauriInternals();
      expect(isTauri()).toBe(false);
      const cb = vi.fn();
      const unlisten = await onScaleChange(cb);
      expect(typeof unlisten).toBe("function");
      expect(() => unlisten()).not.toThrow();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe("Event subscriptions", () => {
    beforeEach(() => {
      mockWindows("main");
    });

    afterEach(() => {
      clearTauriInternals();
    });

    it("subscribes to orbitkit://menu-action and delivers payload to callback", async () => {
      let eventHandlerId: number | null = null;
      let listenedEvent = "";

      mockIPC((cmd, args) => {
        if (
          cmd === "plugin:event|listen" &&
          args &&
          typeof args === "object"
        ) {
          if ("event" in args && typeof args.event === "string") {
            listenedEvent = args.event;
          }
          if ("handler" in args && typeof args.handler === "number") {
            eventHandlerId = args.handler;
          }
          return 101;
        }
        return null;
      });

      const callback = vi.fn();
      const unlisten = await onMenuAction(callback);

      expect(listenedEvent).toBe("orbitkit://menu-action");
      expect(eventHandlerId).not.toBeNull();

      triggerTauriCallback(eventHandlerId!, {
        event: "orbitkit://menu-action",
        payload: { id: "action-target", source: "overlay" },
      });

      expect(callback).toHaveBeenCalledWith({
        id: "action-target",
        source: "overlay",
      });

      let unlistened = false;
      mockIPC((cmd) => {
        if (cmd === "plugin:event|unlisten") {
          unlistened = true;
        }
        return null;
      });

      unlisten();
      expect(unlistened).toBe(true);
    });

    it("subscribes to orbitkit://mascot-state and delivers payload to callback", async () => {
      let eventHandlerId: number | null = null;
      let listenedEvent = "";

      mockIPC((cmd, args) => {
        if (
          cmd === "plugin:event|listen" &&
          args &&
          typeof args === "object"
        ) {
          if ("event" in args && typeof args.event === "string") {
            listenedEvent = args.event;
          }
          if ("handler" in args && typeof args.handler === "number") {
            eventHandlerId = args.handler;
          }
          return 102;
        }
        return null;
      });

      const callback = vi.fn();
      const unlisten = await onMascotState(callback);

      expect(listenedEvent).toBe("orbitkit://mascot-state");
      expect(eventHandlerId).not.toBeNull();

      triggerTauriCallback(eventHandlerId!, {
        event: "orbitkit://mascot-state",
        payload: { state: "celebrating" },
      });

      expect(callback).toHaveBeenCalledWith({
        state: "celebrating",
      });

      let unlistened = false;
      mockIPC((cmd) => {
        if (cmd === "plugin:event|unlisten") {
          unlistened = true;
        }
        return null;
      });

      unlisten();
      expect(unlistened).toBe(true);
    });

    it("subscribes to orbitkit://popup-open and delivers payload to callback", async () => {
      let eventHandlerId: number | null = null;
      let listenedEvent = "";

      mockIPC((cmd, args) => {
        if (
          cmd === "plugin:event|listen" &&
          args &&
          typeof args === "object"
        ) {
          if ("event" in args && typeof args.event === "string") {
            listenedEvent = args.event;
          }
          if ("handler" in args && typeof args.handler === "number") {
            eventHandlerId = args.handler;
          }
          return 103;
        }
        return null;
      });

      const callback = vi.fn();
      const unlisten = await onPopupOpen(callback);

      expect(listenedEvent).toBe("orbitkit://popup-open");
      expect(eventHandlerId).not.toBeNull();

      const payload: PopupOpenPayload = {
        id: "notes",
        title: "Notes",
        url: "index.html?popup=notes",
        width: 320,
        height: 400,
      };

      triggerTauriCallback(eventHandlerId!, {
        event: "orbitkit://popup-open",
        payload,
      });

      expect(callback).toHaveBeenCalledWith(payload);

      let unlistened = false;
      mockIPC((cmd) => {
        if (cmd === "plugin:event|unlisten") {
          unlistened = true;
        }
        return null;
      });

      unlisten();
      expect(unlistened).toBe(true);
    });

    it("subscribes to orbitkit://popup-close and delivers payload to callback", async () => {
      let eventHandlerId: number | null = null;
      let listenedEvent = "";

      mockIPC((cmd, args) => {
        if (
          cmd === "plugin:event|listen" &&
          args &&
          typeof args === "object"
        ) {
          if ("event" in args && typeof args.event === "string") {
            listenedEvent = args.event;
          }
          if ("handler" in args && typeof args.handler === "number") {
            eventHandlerId = args.handler;
          }
          return 104;
        }
        return null;
      });

      const callback = vi.fn();
      const unlisten = await onPopupClose(callback);

      expect(listenedEvent).toBe("orbitkit://popup-close");
      expect(eventHandlerId).not.toBeNull();

      triggerTauriCallback(eventHandlerId!, {
        event: "orbitkit://popup-close",
        payload: { id: "notes" },
      });

      expect(callback).toHaveBeenCalledWith({ id: "notes" });

      let unlistened = false;
      mockIPC((cmd) => {
        if (cmd === "plugin:event|unlisten") {
          unlistened = true;
        }
        return null;
      });

      unlisten();
      expect(unlistened).toBe(true);
    });
  });

  describe("Error normalization", () => {
    beforeEach(() => {
      mockWindows("main");
    });

    afterEach(() => {
      clearTauriInternals();
    });

    it("normalizes permission_denied error from invoke", async () => {
      mockIPC((cmd) => {
        if (cmd === "plugin:orbitkit|request_overlay_permission") {
          throw {
            code: "permission_denied",
            message: "User denied system alert window permission",
          };
        }
        return null;
      });

      await expect(requestOverlayPermission()).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(OrbitKitError);
        if (err instanceof OrbitKitError) {
          expect(err.code).toBe("permission_denied");
          expect(err.message).toContain("User denied system alert window permission");
        }
        return true;
      });
    });

    it("normalizes not_found error from invoke", async () => {
      mockIPC((cmd) => {
        if (cmd === "plugin:orbitkit|open_popup") {
          throw {
            code: "not_found",
            message: "Popup 'missing' not found in configuration",
          };
        }
        return null;
      });

      await expect(openPopup("missing")).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(OrbitKitError);
        if (err instanceof OrbitKitError) {
          expect(err.code).toBe("not_found");
          expect(err.message).toContain("Popup 'missing' not found");
        }
        return true;
      });
    });

    it("normalizes invalid_config error from invoke", async () => {
      mockIPC((cmd) => {
        if (cmd === "plugin:orbitkit|show_overlay") {
          throw {
            code: "invalid_config",
            message: "Menu items must have unique IDs",
          };
        }
        return null;
      });

      await expect(
        showOverlay({ menu: sampleMenu })
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(OrbitKitError);
        if (err instanceof OrbitKitError) {
          expect(err.code).toBe("invalid_config");
        }
        return true;
      });
    });

    it("normalizes unsupported error from invoke", async () => {
      mockIPC((cmd) => {
        if (cmd === "plugin:orbitkit|open_popup") {
          throw {
            code: "unsupported",
            message: "open_popup is not yet implemented on desktop",
          };
        }
        return null;
      });

      await expect(openPopup("settings")).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(OrbitKitError);
        if (err instanceof OrbitKitError) {
          expect(err.code).toBe("unsupported");
        }
        return true;
      });
    });

    it("normalizes unknown or arbitrary errors strictly into unsupported (no unknown)", () => {
      const errFromUnknownCode = normalizeError({
        code: "weird_custom_code",
        message: "Something failed internally",
      });
      expect(errFromUnknownCode.code).toBe("unsupported");
      expect(errFromUnknownCode.message).toBe("Something failed internally");

      const errFromString = normalizeError("permission_denied: rejected by user");
      expect(errFromString.code).toBe("permission_denied");

      const errFromPlainError = normalizeError(new Error("Network timeout"));
      expect(errFromPlainError.code).toBe("unsupported");
      expect(errFromPlainError.message).toBe("Network timeout");

      const existing = new OrbitKitError("not_found", "Already normalized");
      expect(normalizeError(existing)).toBe(existing);
    });
  });

  describe("Non-Tauri behavior", () => {
    beforeEach(() => {
      clearTauriInternals();
    });

    it("all 8 commands reject with {code: 'unsupported'} outside Tauri", async () => {
      expect(isTauri()).toBe(false);

      const calls = [
        overlayPermission(),
        requestOverlayPermission(),
        showOverlay({ menu: sampleMenu }),
        hideOverlay(),
        openPopup("win"),
        closePopup("win"),
        setMascotState("idle"),
        emitMenuAction("act-1"),
      ];

      for (const call of calls) {
        await expect(call).rejects.toSatisfy((err: unknown) => {
          expect(err).toBeInstanceOf(OrbitKitError);
          if (err instanceof OrbitKitError) {
            expect(err.code).toBe("unsupported");
          }
          return true;
        });
      }
    });

    it("onMenuAction returns a no-op unlisten function outside Tauri without throwing", async () => {
      expect(isTauri()).toBe(false);
      const cb = vi.fn();
      const unlisten = await onMenuAction(cb);
      expect(typeof unlisten).toBe("function");
      expect(() => unlisten()).not.toThrow();
      expect(cb).not.toHaveBeenCalled();
    });

    it("onMascotState returns a no-op unlisten function outside Tauri without throwing", async () => {
      expect(isTauri()).toBe(false);
      const cb = vi.fn();
      const unlisten = await onMascotState(cb);
      expect(typeof unlisten).toBe("function");
      expect(() => unlisten()).not.toThrow();
      expect(cb).not.toHaveBeenCalled();
    });

    it("onPopupOpen returns a no-op unlisten function outside Tauri without throwing", async () => {
      expect(isTauri()).toBe(false);
      const cb = vi.fn();
      const unlisten = await onPopupOpen(cb);
      expect(typeof unlisten).toBe("function");
      expect(() => unlisten()).not.toThrow();
      expect(cb).not.toHaveBeenCalled();
    });

    it("onPopupClose returns a no-op unlisten function outside Tauri without throwing", async () => {
      expect(isTauri()).toBe(false);
      const cb = vi.fn();
      const unlisten = await onPopupClose(cb);
      expect(typeof unlisten).toBe("function");
      expect(() => unlisten()).not.toThrow();
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
