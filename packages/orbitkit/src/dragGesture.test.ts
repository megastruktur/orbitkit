import { describe, expect, it, vi } from "vitest";
import { createDragGesture } from "./dragGesture";

describe("createDragGesture", () => {
  it("click below threshold toggles menu", () => {
    const onToggle = vi.fn();
    const onDragStart = vi.fn();
    const gesture = createDragGesture({ onToggle, onDragStart });

    gesture.onpointerdown({ button: 0, clientX: 100, clientY: 100 });
    expect(gesture.isPending).toBe(true);

    // Movement is only 2px (threshold is 4)
    gesture.onpointermove({ clientX: 102, clientY: 100 });
    expect(gesture.isPending).toBe(true);
    expect(gesture.isDragged).toBe(false);
    expect(onDragStart).not.toHaveBeenCalled();

    gesture.onpointerup();
    expect(gesture.isPending).toBe(false);

    gesture.onclick();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("movement above threshold starts drag and suppresses subsequent click", () => {
    const onToggle = vi.fn();
    const onDragStart = vi.fn();
    const gesture = createDragGesture({ onToggle, onDragStart });

    gesture.onpointerdown({ button: 0, clientX: 100, clientY: 100 });

    // Move by 5px (dx = 3, dy = 4 -> hypot = 5 > 4)
    gesture.onpointermove({ clientX: 103, clientY: 104 });
    expect(gesture.isPending).toBe(false);
    expect(gesture.isDragged).toBe(true);
    expect(onDragStart).toHaveBeenCalledTimes(1);

    // Subsequent movement while already dragged should not trigger onDragStart again
    gesture.onpointermove({ clientX: 110, clientY: 110 });
    expect(onDragStart).toHaveBeenCalledTimes(1);

    gesture.onpointerup();

    // Click should be suppressed and reset dragged flag
    gesture.onclick();
    expect(onToggle).not.toHaveBeenCalled();
    expect(gesture.isDragged).toBe(false);

    // Next plain click should toggle normally
    gesture.onclick();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("drag while menu is open closes menu instantly before starting drag", () => {
    let menuOpen = true;
    const closeMenuInstant = vi.fn(() => {
      menuOpen = false;
    });
    const onDragStart = vi.fn();
    const gesture = createDragGesture({
      isMenuOpen: () => menuOpen,
      closeMenuInstant,
      onDragStart,
    });

    gesture.onpointerdown({ button: 0, clientX: 200, clientY: 200 });
    gesture.onpointermove({ clientX: 210, clientY: 200 });

    expect(closeMenuInstant).toHaveBeenCalledTimes(1);
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(gesture.isDragged).toBe(true);
  });

  it("non-primary mouse buttons are ignored", () => {
    const onToggle = vi.fn();
    const onDragStart = vi.fn();
    const gesture = createDragGesture({ onToggle, onDragStart });

    // Right-click or middle-click
    gesture.onpointerdown({ button: 2, clientX: 50, clientY: 50 });
    expect(gesture.isPending).toBe(false);

    gesture.onpointermove({ clientX: 100, clientY: 100 });
    expect(gesture.isDragged).toBe(false);
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("pointerup and pointercancel reset pending state", () => {
    const onDragStart = vi.fn();
    const gesture = createDragGesture({ onDragStart });

    gesture.onpointerdown({ button: 0, clientX: 10, clientY: 10 });
    expect(gesture.isPending).toBe(true);
    gesture.onpointerup();
    expect(gesture.isPending).toBe(false);

    // Further move does not start drag
    gesture.onpointermove({ clientX: 50, clientY: 50 });
    expect(onDragStart).not.toHaveBeenCalled();

    gesture.onpointerdown({ button: 0, clientX: 10, clientY: 10 });
    expect(gesture.isPending).toBe(true);
    gesture.onpointercancel();
    expect(gesture.isPending).toBe(false);
  });

  it("keyboard activation (Enter and Space) toggles menu", () => {
    const onToggle = vi.fn();
    const gesture = createDragGesture({ onToggle });

    const enterEvent = { key: "Enter", preventDefault: vi.fn() };
    gesture.onkeydown(enterEvent);
    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledTimes(1);

    const spaceEvent = { key: " ", preventDefault: vi.fn() };
    gesture.onkeydown(spaceEvent);
    expect(spaceEvent.preventDefault).toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledTimes(2);

    const otherEvent = { key: "Tab", preventDefault: vi.fn() };
    gesture.onkeydown(otherEvent);
    expect(otherEvent.preventDefault).not.toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("falls through to click if onDragStart rejects or throws", async () => {
    const onToggle = vi.fn();
    const onDragStart = vi.fn().mockRejectedValue(new Error("native drag grab failed"));
    const gesture = createDragGesture({ onToggle, onDragStart });

    gesture.onpointerdown({ button: 0, clientX: 10, clientY: 10 });
    gesture.onpointermove({ clientX: 20, clientY: 10 });

    expect(onDragStart).toHaveBeenCalledTimes(1);

    // Wait microtask tick for promise rejection handler
    await Promise.resolve();

    expect(gesture.isDragged).toBe(false);

    gesture.onclick();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("click event never delivered after drag -> next pointerdown+click toggles", () => {
    vi.useFakeTimers();
    try {
      const onToggle = vi.fn();
      const onDragStart = vi.fn();
      const gesture = createDragGesture({ onToggle, onDragStart, dragClearDelay: 400 });

      // Drag gesture: pointerdown -> move -> pointerup
      gesture.onpointerdown({ button: 0, clientX: 100, clientY: 100 });
      gesture.onpointermove({ clientX: 110, clientY: 110 });
      gesture.onpointerup();
      // Native drag swallows terminating click: onclick() is NOT fired.
      expect(gesture.isDragged).toBe(true);

      // Advance timer past dragClearDelay so swallowed click window clears
      vi.advanceTimersByTime(400);
      expect(gesture.isDragged).toBe(false);

      // Next independent click gesture: pointerdown resets/keeps dragged=false and toggles
      gesture.onpointerdown({ button: 0, clientX: 200, clientY: 200 });
      expect(gesture.isDragged).toBe(false);
      gesture.onpointerup();
      gesture.onclick();

      expect(onToggle).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("drag with swallowed click auto-clears dragged flag after timer delay", () => {
    vi.useFakeTimers();
    try {
      const onToggle = vi.fn();
      const onDragStart = vi.fn();
      const gesture = createDragGesture({ onToggle, onDragStart, dragClearDelay: 400 });

      gesture.onpointerdown({ button: 0, clientX: 100, clientY: 100 });
      gesture.onpointermove({ clientX: 110, clientY: 110 });
      expect(gesture.isDragged).toBe(true);

      // Drag end signal arrives via window focus
      gesture.onwindowfocus();
      expect(gesture.isDragged).toBe(true);

      // Advance past dragClearDelay
      vi.advanceTimersByTime(400);
      expect(gesture.isDragged).toBe(false);

      // Simulates WebKitGTK behavior where pointerdown was swallowed by GTK grab state
      // and the first post-drag click only delivers pointerup + onclick
      gesture.onpointerup({ button: 0 });
      gesture.onclick();
      expect(onToggle).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a long drag (more than 1 s) followed by a DELIVERED trailing click stays suppressed and does not toggle", () => {
    vi.useFakeTimers();
    try {
      const onToggle = vi.fn();
      const onDragStart = vi.fn();
      const gesture = createDragGesture({ onToggle, onDragStart, dragClearDelay: 400 });

      gesture.onpointerdown({ button: 0, clientX: 100, clientY: 100 });
      gesture.onpointermove({ clientX: 110, clientY: 110 });
      expect(gesture.isDragged).toBe(true);

      // Long drag: more than 1 second passes during the drag
      vi.advanceTimersByTime(1500);
      // Still dragged because drag has not ended (timer not armed at start)
      expect(gesture.isDragged).toBe(true);

      // Drag end signal arrives (e.g. pointerup / window focus)
      gesture.onpointerup({ button: 0 });
      expect(gesture.isDragged).toBe(true);

      // Delivered trailing click arrives immediately
      gesture.onclick();

      // Trailing click is suppressed and does not toggle
      expect(onToggle).not.toHaveBeenCalled();
      expect(gesture.isDragged).toBe(false);

      // Next real click toggles normally
      gesture.onpointerdown({ button: 0, clientX: 100, clientY: 100 });
      gesture.onpointerup({ button: 0 });
      gesture.onclick();
      expect(onToggle).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a swallowed trailing click, where the next real click toggles", () => {
    vi.useFakeTimers();
    try {
      const onToggle = vi.fn();
      const onDragStart = vi.fn();
      const gesture = createDragGesture({ onToggle, onDragStart, dragClearDelay: 400 });

      gesture.onpointerdown({ button: 0, clientX: 100, clientY: 100 });
      gesture.onpointermove({ clientX: 110, clientY: 110 });
      expect(gesture.isDragged).toBe(true);

      // Drag ends: window focus signal arrives
      gesture.onwindowfocus();
      expect(gesture.isDragged).toBe(true);

      // Trailing click swallowed; advance past dragClearDelay so auto-clear timer expires
      vi.advanceTimersByTime(400);
      expect(gesture.isDragged).toBe(false);

      // Next real click toggles the menu
      gesture.onpointerdown({ button: 0, clientX: 200, clientY: 200 });
      gesture.onpointerup({ button: 0 });
      gesture.onclick();

      expect(onToggle).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
