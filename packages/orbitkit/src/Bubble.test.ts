import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import Bubble from "./Bubble.svelte";
import { fitWindow, type LogicalRect } from "./windowFit";

function bubbleEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".orbitkit-bubble");
  expect(el).not.toBeNull();
  return el!;
}

describe("Bubble component", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders exactly the prop text (no built-in strings)", () => {
    const { container } = render(Bubble, { props: { text: "Deploy done" } });
    expect(container.textContent).toBe("Deploy done");
  });

  it("maps severity to CSS classes without hardcoding colours in script", () => {
    const { container, rerender } = render(Bubble, { props: { text: "t" } });
    expect(bubbleEl(container).classList.contains("orbitkit-bubble--info")).toBe(
      true,
    );
    expect(bubbleEl(container).getAttribute("role")).toBe("status");

    rerender({ props: { text: "t", severity: "warning" } });
    expect(
      bubbleEl(container).classList.contains("orbitkit-bubble--warning"),
    ).toBe(true);
    expect(bubbleEl(container).getAttribute("role")).toBe("status");

    rerender({ props: { text: "t", severity: "error" } });
    expect(
      bubbleEl(container).classList.contains("orbitkit-bubble--error"),
    ).toBe(true);
    expect(bubbleEl(container).getAttribute("role")).toBe("alert");
  });

  it("expires after ttlMs and fires onexpire exactly once", async () => {
    vi.useFakeTimers();
    const onexpire = vi.fn();
    const { container } = render(Bubble, {
      props: { text: "t", ttlMs: 500, onexpire },
    });

    vi.advanceTimersByTime(499);
    await tick();
    expect(container.querySelector(".orbitkit-bubble")).not.toBeNull();
    expect(onexpire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await tick();
    expect(container.querySelector(".orbitkit-bubble")).toBeNull();
    expect(onexpire).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    await tick();
    expect(onexpire).toHaveBeenCalledTimes(1);
  });

  it("pauses the ttl while hovered and resumes with the remainder on leave", async () => {
    vi.useFakeTimers();
    const onexpire = vi.fn();
    const { container } = render(Bubble, {
      props: { text: "t", ttlMs: 500, onexpire },
    });
    const el = bubbleEl(container);

    vi.advanceTimersByTime(200);
    await tick();
    fireEvent.pointerEnter(el);

    // 600 ms while hovered > remaining 300 ms: must stay visible.
    vi.advanceTimersByTime(600);
    await tick();
    expect(container.querySelector(".orbitkit-bubble")).not.toBeNull();
    expect(onexpire).not.toHaveBeenCalled();

    fireEvent.pointerLeave(el);
    // remaining was 300 ms at pointer-enter time (deadline 500, now 200):
    // resumed deadline = 800 + 300 = 1100.
    vi.advanceTimersByTime(299);
    await tick();
    expect(container.querySelector(".orbitkit-bubble")).not.toBeNull();

    vi.advanceTimersByTime(1);
    await tick();
    expect(container.querySelector(".orbitkit-bubble")).toBeNull();
    expect(onexpire).toHaveBeenCalledTimes(1);
  });

  it("never expires without ttlMs; hover is a no-op", async () => {
    vi.useFakeTimers();
    const { container } = render(Bubble, { props: { text: "t" } });
    const el = bubbleEl(container);

    fireEvent.pointerEnter(el);
    vi.advanceTimersByTime(60000);
    await tick();
    fireEvent.pointerLeave(el);
    vi.advanceTimersByTime(60000);
    await tick();
    expect(container.querySelector(".orbitkit-bubble")).not.toBeNull();
  });

  it("restarts the ttl when the text changes (new notification)", async () => {
    vi.useFakeTimers();
    const onexpire = vi.fn();
    const { container, rerender } = render(Bubble, {
      props: { text: "a", ttlMs: 500, onexpire },
    });

    vi.advanceTimersByTime(300);
    await tick();
    await rerender({ props: { text: "b", ttlMs: 500, onexpire } });

    // Old deadline was 500; a new full window started at 300 → 800.
    vi.advanceTimersByTime(499);
    await tick();
    expect(container.querySelector(".orbitkit-bubble")).not.toBeNull();

    vi.advanceTimersByTime(1);
    await tick();
    expect(container.querySelector(".orbitkit-bubble")).toBeNull();
    expect(onexpire).toHaveBeenCalledTimes(1);
  });

  it("invokes onclick on click without affecting the ttl", async () => {
    vi.useFakeTimers();
    const onclick = vi.fn();
    const { container } = render(Bubble, {
      props: { text: "t", ttlMs: 500, onclick },
    });

    fireEvent.click(bubbleEl(container));
    expect(onclick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    await tick();
    expect(container.querySelector(".orbitkit-bubble")).toBeNull();
  });

  it("exposes its logical rect via onrectchange so fitWindow can cover it", async () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        left: 10,
        top: 20,
        width: 30,
        height: 40,
      } as unknown as DOMRect);

    const changes: (LogicalRect | null)[] = [];
    const { rerender } = render(Bubble, {
      props: {
        text: "first",
        onrectchange: (r: LogicalRect | null) => changes.push(r),
      },
    });
    await tick();

    expect(changes).toEqual([{ x: 10, y: 20, width: 30, height: 40 }]);

    // K9: the exposed rect is a plain LogicalRect consumable by fitWindow.
    const rect = changes[0]!;
    expect(fitWindow([rect], 2)).toEqual({
      w: 60,
      h: 80,
      offset: { x: 20, y: 40 },
    });

    // Content resize re-measures: same size → no duplicate; changed size → new rect.
    rectSpy.mockReturnValue({
      left: 50,
      top: 20,
      width: 10,
      height: 5,
    } as unknown as DOMRect);
    await rerender({ props: { text: "second", onrectchange: (r: LogicalRect | null) => changes.push(r) } });
    await tick();
    expect(changes).toEqual([
      { x: 10, y: 20, width: 30, height: 40 },
      { x: 50, y: 20, width: 10, height: 5 },
    ]);
    expect(fitWindow([changes[0]!, changes[1]!], 1)).toEqual({
      w: 50,
      h: 40, // union spans y 20..60 (rect A bottom), not rect B's bottom 25
      offset: { x: 10, y: 20 },
    });
  });

  it("clears the rect to null on expiry", async () => {
    vi.useFakeTimers();
    const changes: (LogicalRect | null)[] = [];
    render(Bubble, {
      props: {
        text: "t",
        ttlMs: 100,
        onrectchange: (r: LogicalRect | null) => changes.push(r),
      },
    });

    vi.advanceTimersByTime(100);
    await tick();
    expect(changes[changes.length - 1]).toBeNull();
  });
});
