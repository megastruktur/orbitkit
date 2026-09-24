import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, fireEvent, screen } from "@testing-library/svelte";
import RadialMenu from "./RadialMenu.svelte";
import type { MenuConfig } from "./config";

const sampleConfig: MenuConfig = {
  items: [
    { id: "item-1", label: "First", icon: "⭐" },
    { id: "item-2", label: "Second", icon: "https://example.com/icon.svg" },
    { id: "item-3", label: "Disabled", disabled: true },
    { id: "item-4", label: "Fourth", icon: "/local-icon.png" },
  ],
  radius: 100,
  startAngle: -90,
  endAngle: 270,
  itemSize: 48,
  trigger: "click",
};

afterEach(() => {
  cleanup();
});
/**
 * Flushes macrotask queue for component effects that arm listeners on next tick.
 * Executor form is required here because tsconfig target library does not include ES2024 Promise.withResolvers.
 */
function flushMacrotask(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function flushDoubleRaf(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

async function openMenuComplete(): Promise<void> {
  await flushDoubleRaf();
  const items = screen.getAllByRole("menuitem");
  if (items.length > 0) {
    await fireEvent.animationEnd(items[items.length - 1]);
  }
}



describe("RadialMenu component", () => {
  it("renders n items with role='menuitem' and container with role='menu'", () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect,
        onclose,
      },
    });

    const menu = screen.getByRole("menu");
    expect(menu).toBeDefined();

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(4);

    expect(screen.getByText("First")).toBeDefined();
    expect(screen.getByText("Second")).toBeDefined();
    expect(screen.getByText("Disabled")).toBeDefined();
    expect(screen.getByText("Fourth")).toBeDefined();
  });

  it("closed renders nothing interactive in DOM", () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: false,
        onselect,
        onclose,
      },
    });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
    expect(screen.queryByText("First")).toBeNull();
  });

  it("calls onselect with id when an enabled item is clicked", async () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect,
        onclose,
      },
    });
    await openMenuComplete();
    const firstItem = screen.getByRole("menuitem", { name: "First" });
    await fireEvent.click(firstItem);
    expect(onselect).toHaveBeenCalledTimes(1);
    expect(onselect).toHaveBeenCalledWith("item-1");
    expect(onclose).not.toHaveBeenCalled();
  });

  it("ignores clicks on disabled items and does not call onselect", async () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect,
        onclose,
      },
    });
    await openMenuComplete();
    const disabledItem = screen.getByRole("menuitem", { name: "Disabled" });
    expect(disabledItem.hasAttribute("disabled")).toBe(true);
    expect(disabledItem.getAttribute("aria-disabled")).toBe("true");

    await fireEvent.click(disabledItem);

    expect(onselect).not.toHaveBeenCalled();
  });

  it("calls onclose when Escape key is pressed", async () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect,
        onclose,
      },
    });

    await fireEvent.keyDown(window, { key: "Escape" });

    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it("calls onclose when pointerdown occurs outside the menu", async () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect,
        onclose,
      },
    });

    await flushMacrotask();
    await fireEvent.pointerDown(document.body);

    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it("opening via external trigger button does not immediately close; outside pointerdown closes once; item pointerdown is not outside", async () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    const trigger = document.createElement("button");
    trigger.textContent = "Open Menu";
    document.body.appendChild(trigger);

    const { rerender } = render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: false,
        onselect,
        onclose,
      },
    });

    trigger.addEventListener("click", () => {
      rerender({ open: true });
    });

    // Click external trigger button to open menu
    await fireEvent.click(trigger);

    // Opening click must NOT call onclose, and items must be rendered
    expect(onclose).not.toHaveBeenCalled();
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(sampleConfig.items.length);

    // Wait for pointerdown listener arming
    await flushMacrotask();

    // Pointerdown on an item is NOT outside -> onclose not called
    await fireEvent.pointerDown(items[0]);
    expect(onclose).not.toHaveBeenCalled();

    // Later pointerdown outside -> onclose called exactly once
    await fireEvent.pointerDown(document.body);
    expect(onclose).toHaveBeenCalledTimes(1);

    trigger.remove();
  });

  it("gives exactly 1 onclose on a slow outside press (pointerdown followed by click)", async () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect,
        onclose,
      },
    });

    await flushMacrotask();

    // Slow press: pointerdown followed by pointerup and click
    await fireEvent.pointerDown(document.body);
    await fireEvent.pointerUp(document.body);
    await fireEvent.click(document.body);

    // Must be called exactly once (no duplicate on slow press)
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it("cycles focus using arrow keys among enabled items", async () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect,
        onclose,
      },
    });

    const firstItem = screen.getByRole("menuitem", { name: "First" });
    const secondItem = screen.getByRole("menuitem", { name: "Second" });
    const fourthItem = screen.getByRole("menuitem", { name: "Fourth" });

    // Focus first item manually
    firstItem.focus();
    expect(document.activeElement).toBe(firstItem);

    // ArrowDown should move to second item
    await fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(document.activeElement).toBe(secondItem);

    // ArrowDown should skip disabled item-3 and move to fourth item
    await fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(document.activeElement).toBe(fourthItem);

    // ArrowDown wraps around to first item
    await fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(document.activeElement).toBe(firstItem);

    // ArrowUp moves backward: from first to fourth item (wrap)
    await fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(document.activeElement).toBe(fourthItem);

    // ArrowLeft also moves backward: from fourth to second
    await fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(secondItem);
  });

  it("renders emoji text for emoji icons and <img> elements for URLs", () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    const { container } = render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect,
        onclose,
      },
    });

    // Emoji icon
    const emojiSpan = screen.getByText("⭐");
    expect(emojiSpan.className).toContain("orbitkit-radial-icon-text");
    expect(emojiSpan.getAttribute("aria-hidden")).toBe("true");

    // URL icons: item-2 has http URL, item-4 has relative url
    const imgs = container.querySelectorAll("img.orbitkit-radial-icon-img");
    expect(imgs.length).toBe(2);
    expect(imgs[0].getAttribute("src")).toBe("https://example.com/icon.svg");
    expect(imgs[1].getAttribute("src")).toBe("/local-icon.png");
  });

  it("supports trigger='hover' by firing onselect on mouseenter for enabled items", async () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    const hoverConfig: MenuConfig = {
      ...sampleConfig,
      trigger: "hover",
    };

    render(RadialMenu, {
      props: {
        config: hoverConfig,
        open: true,
        onselect,
        onclose,
      },
    });
    await openMenuComplete();
    const firstItem = screen.getByRole("menuitem", { name: "First" });
    await fireEvent.mouseEnter(firstItem);

    expect(onselect).toHaveBeenCalledWith("item-1");

    // Disabled item should not trigger onselect on hover
    const disabledItem = screen.getByRole("menuitem", { name: "Disabled" });
    await fireEvent.mouseEnter(disabledItem);

    expect(onselect).toHaveBeenCalledTimes(1);
  });

  it("renders with layout arc top where every item has y <= 0 (above the centre)", () => {
    const arcTopConfig: MenuConfig = {
      items: [
        { id: "act1", label: "Act 1" },
        { id: "act2", label: "Act 2" },
        { id: "act3", label: "Act 3" },
        { id: "act4", label: "Act 4" },
        { id: "act5", label: "Act 5" },
      ],
      radius: 96,
      startAngle: -90,
      endAngle: 270,
      layout: "arc",
      arc: {
        position: "top",
        span: 180,
      },
      itemSize: 44,
      trigger: "click",
    };

    render(RadialMenu, {
      props: {
        config: arcTopConfig,
        open: true,
        onselect: () => {},
        onclose: () => {},
      },
    });

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(5);
    for (const item of items) {
      const topPx = parseFloat(item.style.top);
      expect(topPx).toBeLessThanOrEqual(0);
    }
  });

  it("disables animation and transition when config.animation is 'none'", () => {
    const noAnimConfig: MenuConfig = {
      ...sampleConfig,
      animation: "none",
    };

    render(RadialMenu, {
      props: {
        config: noAnimConfig,
        open: true,
        onselect: () => {},
        onclose: () => {},
      },
    });

    const menu = screen.getByRole("menu");
    expect(menu.classList.contains("no-animation")).toBe(true);
    expect(menu.style.animation).toBe("none");
    expect(menu.style.transition).toBe("none");
  });

  it("open sequence gives items stagger delays 0, 20, 40, … ms", async () => {
    render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect: () => {},
        onclose: () => {},
      },
    });

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(4);
    expect(items[0].style.opacity).toBe("0");
    expect(items[0].style.scale).toBe("0");

    await flushDoubleRaf();
    expect(items[0].style.animationDelay).toBe("0ms");
    expect(items[1].style.animationDelay).toBe("20ms");
    expect(items[2].style.animationDelay).toBe("40ms");
    expect(items[3].style.animationDelay).toBe("60ms");
  });

  it("close DOM stays until animationend/transitionend (or timer fallback)", async () => {
    const { rerender } = render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect: () => {},
        onclose: () => {},
      },
    });

    await openMenuComplete();
    expect(screen.queryByRole("menu")).not.toBeNull();

    rerender({
      config: sampleConfig,
      open: false,
      onselect: () => {},
      onclose: () => {},
    });

    // Menu DOM stays mounted while closing animation plays
    expect(screen.queryByRole("menu")).not.toBeNull();
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(4);
    expect(items[3].style.animationDelay).toBe("0ms");
    expect(items[0].style.animationDelay).toBe("60ms");

    // Ending animation on an earlier item does not unmount the menu
    await fireEvent.animationEnd(items[3]);
    expect(screen.queryByRole("menu")).not.toBeNull();

    // Last item ending (item 0) unmounts menu
    await fireEvent.animationEnd(items[0]);
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("dispatches a bubbling animationend from item 0 and asserts the menu stays mounted", async () => {
    const onselect = vi.fn();
    const onclose = vi.fn();

    const { rerender } = render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect,
        onclose,
      },
    });

    // Wait for rAF to flip from start-state (closed) to opening
    await flushDoubleRaf();

    const menu = screen.getByRole("menu");
    expect(menu).not.toBeNull();

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(4);

    // On open: dispatch bubbling animationend from item 0 (earliest item to finish)
    // Bubbled event must not hit container and menu must stay mounted
    items[0].dispatchEvent(
      new CustomEvent("animationend", { bubbles: true, cancelable: true })
    );
    expect(screen.queryByRole("menu")).not.toBeNull();

    // Now trigger close
    rerender({
      config: sampleConfig,
      open: false,
      onselect,
      onclose,
    });

    expect(screen.queryByRole("menu")).not.toBeNull();

    // On close: dispatch bubbling animationend from item 3 (first item to finish)
    const closingItems = screen.getAllByRole("menuitem");
    closingItems[3].dispatchEvent(
      new CustomEvent("animationend", { bubbles: true, cancelable: true })
    );
    // Menu MUST stay mounted because item 0 is the last to finish
    expect(screen.queryByRole("menu")).not.toBeNull();
  });

  it("close DOM stays until timer fallback unmounts", async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(RadialMenu, {
        props: {
          config: sampleConfig,
          open: true,
          onselect: () => {},
          onclose: () => {},
        },
      });

      await vi.advanceTimersByTimeAsync(300);
      expect(screen.queryByRole("menu")).not.toBeNull();

      rerender({
        config: sampleConfig,
        open: false,
        onselect: () => {},
        onclose: () => {},
      });

      // Allow Svelte effect to register closeTimer
      await Promise.resolve();

      expect(screen.queryByRole("menu")).not.toBeNull();
      await vi.advanceTimersByTimeAsync(100);
      expect(screen.queryByRole("menu")).not.toBeNull();

      await vi.advanceTimersByTimeAsync(200);
      expect(screen.queryByRole("menu")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reversal mid-open cleanly transitions between phases without unmounting prematurely", async () => {
    const { rerender } = render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect: () => {},
        onclose: () => {},
      },
    });

    expect(screen.queryByRole("menu")).not.toBeNull();

    // Reversal mid-open: flip open to false while still opening
    rerender({
      config: sampleConfig,
      open: false,
      onselect: () => {},
      onclose: () => {},
    });

    // Stays mounted in closing phase
    expect(screen.queryByRole("menu")).not.toBeNull();
    const closingItems = screen.getAllByRole("menuitem");
    expect(closingItems[0].style.animationDelay).toBe("60ms");

    const onselect = vi.fn();
    // Reversal mid-close: flip open back to true
    rerender({
      config: sampleConfig,
      open: true,
      onselect,
      onclose: () => {},
    });
    expect(screen.queryByRole("menu")).not.toBeNull();
    await flushDoubleRaf();
    const openingItems = screen.getAllByRole("menuitem");
    expect(openingItems[0].style.animationDelay).toBe("0ms");

    await openMenuComplete();
    await fireEvent.click(screen.getByRole("menuitem", { name: "First" }));
    expect(onselect).toHaveBeenCalledWith("item-1");
  });

  it("animation: 'none' gives no animation style on items and unmounts immediately", () => {
    const noAnimConfig: MenuConfig = {
      ...sampleConfig,
      animation: "none",
    };

    const { rerender } = render(RadialMenu, {
      props: {
        config: noAnimConfig,
        open: true,
        onselect: () => {},
        onclose: () => {},
      },
    });

    const items = screen.getAllByRole("menuitem");
    for (const item of items) {
      expect(item.style.animation).toBe("");
      expect(item.style.animationDelay).toBe("");
      expect(item.style.getPropertyValue("--spawn-tx")).toBe("");
    }

    rerender({
      config: noAnimConfig,
      open: false,
      onselect: () => {},
      onclose: () => {},
    });

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("mascot-marker pointerdown does NOT call onclose, but an outside pointerdown does", async () => {
    const onclose = vi.fn();

    const mascotToggle = document.createElement("div");
    mascotToggle.setAttribute("data-orbitkit-menu-toggle", "");
    const mascotChild = document.createElement("span");
    mascotChild.textContent = "Inner Icon";
    mascotToggle.appendChild(mascotChild);
    document.body.appendChild(mascotToggle);

    const outsideEl = document.createElement("div");
    outsideEl.textContent = "Outside Target";
    document.body.appendChild(outsideEl);

    render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect: () => {},
        onclose,
      },
    });

    await flushMacrotask();

    // Pointerdown inside mascot toggle (child or root) does NOT call onclose
    await fireEvent.pointerDown(mascotChild);
    expect(onclose).not.toHaveBeenCalled();

    await fireEvent.pointerDown(mascotToggle);
    expect(onclose).not.toHaveBeenCalled();

    // Pointerdown outside does call onclose
    await fireEvent.pointerDown(outsideEl);
    expect(onclose).toHaveBeenCalledTimes(1);

    mascotToggle.remove();
    outsideEl.remove();
  });

  it("items not clickable while opening", async () => {
    const onselect = vi.fn();

    render(RadialMenu, {
      props: {
        config: sampleConfig,
        open: true,
        onselect,
        onclose: () => {},
      },
    });

    const firstItem = screen.getByRole("menuitem", { name: "First" });
    expect(firstItem.classList.contains("animating")).toBe(true);
    expect(firstItem.style.pointerEvents).toBe("none");

    // Clicking while opening must not trigger onselect
    await fireEvent.click(firstItem);
    expect(onselect).not.toHaveBeenCalled();

    // Finish open animation
    await openMenuComplete();
    expect(firstItem.classList.contains("animating")).toBe(false);
    expect(firstItem.style.pointerEvents).toBe("auto");

    await fireEvent.click(firstItem);
    expect(onselect).toHaveBeenCalledTimes(1);
    expect(onselect).toHaveBeenCalledWith("item-1");
  });
});
