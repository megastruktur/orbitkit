import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import PopupSheet from "./PopupSheet.svelte";
import type { PopupOpenPayload } from "./bridge";
import MockNotes from "./test-fixtures/MockNotes.svelte";
import MockSettings from "./test-fixtures/MockSettings.svelte";
import MockFallback from "./test-fixtures/MockFallback.svelte";
import MockInteractive from "./test-fixtures/MockInteractive.svelte";

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
    const internals = window.__TAURI_INTERNALS__;
    if (internals && typeof internals === "object" && "callbacks" in internals) {
      const callbacks = (internals as Record<string, unknown>).callbacks;
      if (callbacks instanceof Map) {
        const cb = callbacks.get(handlerId);
        if (typeof cb === "function") {
          cb(eventData);
        }
      }
    }
  }
}

describe("PopupSheet component", () => {
  let openHandlerId: number | null = null;
  let closeHandlerId: number | null = null;
  let closePopupMock = vi.fn();

  beforeEach(() => {
    mockWindows("main");
    openHandlerId = null;
    closeHandlerId = null;
    closePopupMock = vi.fn();

    mockIPC((cmd, args) => {
      if (
        cmd === "plugin:event|listen" &&
        args &&
        typeof args === "object"
      ) {
        if (
          "event" in args &&
          args.event === "orbitkit://popup-open" &&
          "handler" in args &&
          typeof args.handler === "number"
        ) {
          openHandlerId = args.handler;
          return 201;
        }
        if (
          "event" in args &&
          args.event === "orbitkit://popup-close" &&
          "handler" in args &&
          typeof args.handler === "number"
        ) {
          closeHandlerId = args.handler;
          return 202;
        }
      }
      if (
        cmd === "plugin:orbitkit|close_popup" &&
        args &&
        typeof args === "object" &&
        "id" in args &&
        typeof args.id === "string"
      ) {
        closePopupMock(args.id);
        return null;
      }
      return null;
    });
  });

  afterEach(() => {
    cleanup();
    clearTauriInternals();
    vi.restoreAllMocks();
  });

  function emitOpen(payload: PopupOpenPayload) {
    if (openHandlerId !== null) {
      triggerTauriCallback(openHandlerId, {
        event: "orbitkit://popup-open",
        payload,
      });
    }
  }

  function emitClose(id: string) {
    if (closeHandlerId !== null) {
      triggerTauriCallback(closeHandlerId, {
        event: "orbitkit://popup-close",
        payload: { id },
      });
    }
  }

  const defaultProps = {
    components: {
      notes: MockNotes,
      settings: MockSettings,
    },
    fallback: MockFallback,
    reducedMotion: true, // Use reduced motion in unit tests for deterministic timing
  };

  it("1. open renders mapped component", async () => {
    render(PopupSheet, { props: defaultProps });

    emitOpen({
      id: "notes",
      title: "Notes Window",
      url: "index.html?popup=notes",
      width: 320,
      height: 400,
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    expect(screen.getByText("Notes Window")).toBeDefined();
    expect(screen.getByTestId("mock-notes")).toBeDefined();
  });

  it("2. unknown id renders fallback", async () => {
    render(PopupSheet, { props: defaultProps });

    emitOpen({
      id: "unknown-tool",
      title: "Unknown Plugin",
      url: "index.html?popup=unknown-tool",
      width: 300,
      height: 350,
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    expect(screen.getByText("Unknown Plugin")).toBeDefined();
    expect(screen.getByTestId("mock-fallback")).toBeDefined();
    expect(screen.getByText("Mock Fallback for unknown-tool")).toBeDefined();
  });

  it("3. close via ✕ calls closePopup", async () => {
    render(PopupSheet, { props: defaultProps });

    emitOpen({
      id: "notes",
      title: "Notes Window",
      url: "index.html?popup=notes",
      width: 320,
      height: 400,
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    const closeBtn = screen.getByRole("button", { name: /close/i });
    await fireEvent.click(closeBtn);

    expect(closePopupMock).toHaveBeenCalledWith("notes");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("4. popup-close event closes it", async () => {
    render(PopupSheet, { props: defaultProps });

    emitOpen({
      id: "settings",
      title: "Settings Window",
      url: "index.html?popup=settings",
      width: 340,
      height: 420,
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    expect(screen.getByTestId("mock-settings")).toBeDefined();

    emitClose("settings");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("5. second open replaces first using replaceState", async () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    render(PopupSheet, { props: defaultProps });

    emitOpen({
      id: "notes",
      title: "First Popup (Notes)",
      url: "index.html?popup=notes",
      width: 320,
      height: 400,
    });

    await waitFor(() => {
      expect(screen.getByText("First Popup (Notes)")).toBeDefined();
    });
    expect(screen.getByTestId("mock-notes")).toBeDefined();
    expect(pushSpy).toHaveBeenCalledWith({ orbitkitPopup: "notes" }, "");
    expect(replaceSpy).not.toHaveBeenCalled();

    // Emit second open
    emitOpen({
      id: "settings",
      title: "Second Popup (Settings)",
      url: "index.html?popup=settings",
      width: 360,
      height: 440,
    });

    await waitFor(() => {
      expect(screen.getByText("Second Popup (Settings)")).toBeDefined();
    });
    expect(screen.queryByText("First Popup (Notes)")).toBeNull();
    expect(screen.queryByTestId("mock-notes")).toBeNull();
    expect(screen.getByTestId("mock-settings")).toBeDefined();
    expect(replaceSpy).toHaveBeenCalledWith({ orbitkitPopup: "settings" }, "");

    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });

  it("6. Escape closes it", async () => {
    render(PopupSheet, { props: defaultProps });

    emitOpen({
      id: "notes",
      title: "Notes Window",
      url: "index.html?popup=notes",
      width: 320,
      height: 400,
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    await fireEvent.keyDown(window, { key: "Escape" });

    expect(closePopupMock).toHaveBeenCalledWith("notes");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("7. backdrop click closes sheet and calls closePopup", async () => {
    render(PopupSheet, { props: defaultProps });

    emitOpen({
      id: "notes",
      title: "Notes Window",
      url: "index.html?popup=notes",
      width: 320,
      height: 400,
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    const backdrop = screen.getByRole("presentation");
    await fireEvent.click(backdrop);

    expect(closePopupMock).toHaveBeenCalledWith("notes");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("8. popstate event closes sheet and calls closePopup", async () => {
    render(PopupSheet, { props: defaultProps });

    emitOpen({
      id: "notes",
      title: "Notes Window",
      url: "index.html?popup=notes",
      width: 320,
      height: 400,
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    await fireEvent(window, new PopStateEvent("popstate"));

    expect(closePopupMock).toHaveBeenCalledWith("notes");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("9. manages focus on open and close", async () => {
    const triggerBtn = document.createElement("button");
    triggerBtn.textContent = "Open Sheet Trigger";
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    render(PopupSheet, { props: defaultProps });

    emitOpen({
      id: "notes",
      title: "Notes Window",
      url: "index.html?popup=notes",
      width: 320,
      height: 400,
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(document.activeElement).toBe(dialog);
    });

    const closeBtn = screen.getByRole("button", { name: /close/i });
    await fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    expect(document.activeElement).toBe(triggerBtn);
    document.body.removeChild(triggerBtn);
  });

  it("10. applies width and height styles correctly", async () => {
    render(PopupSheet, { props: defaultProps });

    emitOpen({
      id: "notes",
      title: "Sized Popup",
      url: "index.html?popup=notes",
      width: 320,
      height: 400,
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("style")).toMatch(/width:\s*min\(320px,\s*(-24px \+ 100vw|calc\(100vw - 24px\))\)/);
    expect(dialog.getAttribute("style")).toContain("height: min(400px, 85vh)");
  });

  it("11. dev/test custom events work", async () => {
    render(PopupSheet, { props: defaultProps });

    window.dispatchEvent(
      new CustomEvent("orbitkit:test-popup-open", {
        detail: {
          id: "settings",
          title: "Test Settings",
          url: "?popup=settings",
          width: 350,
          height: 450,
        },
      })
    );

    await waitFor(() => {
      expect(screen.getByText("Test Settings")).toBeDefined();
      expect(screen.getByTestId("mock-settings")).toBeDefined();
    });

    window.dispatchEvent(
      new CustomEvent("orbitkit:test-popup-close", {
        detail: { id: "settings" },
      })
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("12. traps focus with Tab and Shift+Tab wrap", async () => {
    const outsideBtn = document.createElement("button");
    outsideBtn.textContent = "Outside Control";
    document.body.appendChild(outsideBtn);

    render(PopupSheet, {
      props: {
        ...defaultProps,
        components: {
          ...defaultProps.components,
          interactive: MockInteractive,
        },
      },
    });

    emitOpen({
      id: "interactive",
      title: "Interactive Sheet",
      url: "index.html?popup=interactive",
      width: 320,
      height: 400,
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    const closeBtn = screen.getByRole("button", { name: "Close" });
    const actionBtn = screen.getByTestId("sheet-button");
    const dialog = screen.getByRole("dialog");

    // Initially sheet card is focused
    expect(document.activeElement).toBe(dialog);

    // Tab from dialog card moves to first focusable element (close button)
    await fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab from first focusable wraps around to last focusable (action button)
    await fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(actionBtn);

    // Tab from last focusable wraps around to first focusable (close button)
    await fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);

    // If focus escapes to an outside element, Tab pulls focus to first inside element
    outsideBtn.focus();
    expect(document.activeElement).toBe(outsideBtn);
    await fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);

    // If focus escapes to an outside element, Shift+Tab pulls focus to last inside element
    outsideBtn.focus();
    expect(document.activeElement).toBe(outsideBtn);
    await fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(actionBtn);

    document.body.removeChild(outsideBtn);
  });
});
