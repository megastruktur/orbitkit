import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import Badge from "./Badge.svelte";

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
        if (typeof cb === "function") cb(eventData);
      }
    }
  }
}

function badgeEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".orbitkit-badge");
  expect(el).not.toBeNull();
  return el!;
}

describe("Badge component", () => {
  afterEach(() => {
    cleanup();
    clearTauriInternals();
  });

  it("is hidden at count 0 (and by default)", () => {
    const { container: empty } = render(Badge, { props: {} });
    expect(empty.querySelector(".orbitkit-badge")).toBeNull();

    const { container } = render(Badge, { props: { count: 0 } });
    expect(container.querySelector(".orbitkit-badge")).toBeNull();
  });

  it("shows counts 1..99 verbatim with aria-label equal to the count", () => {
    const { container, rerender } = render(Badge, { props: { count: 1 } });
    expect(badgeEl(container).textContent).toBe("1");
    expect(badgeEl(container).getAttribute("aria-label")).toBe("1");

    rerender({ props: { count: 42 } });
    expect(badgeEl(container).textContent).toBe("42");
    expect(badgeEl(container).getAttribute("aria-label")).toBe("42");

    rerender({ props: { count: 99 } });
    expect(badgeEl(container).textContent).toBe("99");
    expect(badgeEl(container).getAttribute("aria-label")).toBe("99");
  });

  it("caps the display at max (default 99 → '99+') while the aria-label keeps the raw count", () => {
    const { container, rerender } = render(Badge, { props: { count: 100 } });
    expect(badgeEl(container).textContent).toBe("99+");
    expect(badgeEl(container).getAttribute("aria-label")).toBe("100");

    rerender({ props: { count: 150 } });
    expect(badgeEl(container).textContent).toBe("99+");
    expect(badgeEl(container).getAttribute("aria-label")).toBe("150");

    rerender({ props: { count: 3, max: 2 } });
    expect(badgeEl(container).textContent).toBe("2+");
    expect(badgeEl(container).getAttribute("aria-label")).toBe("3");
  });

  it("lets consumers override the aria-label text", () => {
    const { container } = render(Badge, {
      props: { count: 4, ariaLabel: "4 unread" },
    });
    expect(badgeEl(container).getAttribute("aria-label")).toBe("4 unread");
  });

  it("subscribes to orbitkit://badge and re-renders on events when listen is set", async () => {
    mockWindows("main");
    let eventHandlerId: number | null = null;
    let listenedEvent = "";
    mockIPC((cmd, args) => {
      if (cmd === "plugin:event|listen" && args && typeof args === "object") {
        if ("event" in args && typeof args.event === "string") {
          listenedEvent = args.event;
        }
        if ("handler" in args && typeof args.handler === "number") {
          eventHandlerId = args.handler;
        }
        return 9001;
      }
      return null;
    });

    const { container, rerender } = render(Badge, {
      props: { count: 0, listen: true },
    });
    expect(listenedEvent).toBe("orbitkit://badge");
    expect(eventHandlerId).not.toBeNull();
    expect(container.querySelector(".orbitkit-badge")).toBeNull();

    triggerTauriCallback(eventHandlerId!, {
      event: "orbitkit://badge",
      payload: { count: 5 },
    });
    await vi.waitFor(() => {
      expect(badgeEl(container).textContent).toBe("5");
    });
    expect(badgeEl(container).getAttribute("aria-label")).toBe("5");

    // A count prop change supersedes the earlier event ("latest wins").
    await rerender({ props: { count: 2, listen: true } });
    expect(badgeEl(container).textContent).toBe("2");

    triggerTauriCallback(eventHandlerId!, {
      event: "orbitkit://badge",
      payload: { count: 7 },
    });
    await vi.waitFor(() => {
      expect(badgeEl(container).textContent).toBe("7");
    });
  });

  it("does not subscribe to orbitkit://badge by default (prop-driven only)", async () => {
    mockWindows("main");
    let listenCalled = false;
    mockIPC((cmd) => {
      if (cmd === "plugin:event|listen") listenCalled = true;
      return null;
    });

    const { container } = render(Badge, { props: { count: 3 } });
    expect(badgeEl(container).textContent).toBe("3");
    expect(listenCalled).toBe(false);
  });
});
