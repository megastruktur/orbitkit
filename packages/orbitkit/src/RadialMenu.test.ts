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

    // Every item is reachable by its label (aria-label) and shows it on
    // hover (title), icon or not.
    for (const name of ["First", "Second", "Disabled", "Fourth"]) {
      const item = screen.getByRole("menuitem", { name });
      expect(item.getAttribute("title")).toBe(name);
    }
  });

  it("draws icon-only circles; buttons carry title and aria-label", () => {
    const { container } = render(RadialMenu, {
      props: { config: sampleConfig, open: true, onselect: vi.fn(), onclose: vi.fn() },
    });
    const labelOf = (id: string) =>
      container
        .querySelector(`[data-orbitkit-radial-item="${id}"]`)
        ?.querySelector(".orbitkit-radial-label");
    expect(labelOf("item-1")).toBeNull();
    expect(labelOf("item-2")).toBeNull();
    expect(labelOf("item-3")).toBeNull();
    expect(labelOf("item-4")).toBeNull();
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

describe("K7 arc-anchor menu", () => {
  const anchor = { x: 100, y: 200, width: 60, height: 80 };

  function anchorItems(n: number): MenuConfig["items"] {
    return Array.from({ length: n }, (_, i) => ({
      id: `act-${i + 1}`,
      label: `Act ${i + 1}`,
    }));
  }

  it("centres the arc headGap above anchorRect: container shifted, items symmetric with centre pair", () => {
    const config: MenuConfig = {
      items: anchorItems(6),
      radius: 50,
      startAngle: -180,
      endAngle: 0,
      layout: "arc-anchor",
      arc: { headGap: 12 },
      itemSize: 44,
      trigger: "click",
    };

    render(RadialMenu, {
      props: {
        config,
        open: true,
        anchorRect: anchor,
        onselect: () => {},
        onclose: () => {},
      },
    });

    // Arc centre: (100 + 60/2, 200 - 12) = (130, 188)
    const menu = screen.getByRole("menu");
    expect(menu.style.transform).toBe("translate(130px, 188px)");

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(6);

    // Whole arc renders above the arc centre point
    for (const item of items) {
      expect(parseFloat(item.style.top)).toBeLessThanOrEqual(0);
    }

    // Mirror symmetry about the arc centre vertical (item positions are
    // relative to the shifted container)
    const xs = items.map((el) => parseFloat(el.style.left));
    expect(xs[0] + xs[5]).toBeCloseTo(0, 5);
    expect(xs[1] + xs[4]).toBeCloseTo(0, 5);
    expect(xs[2] + xs[3]).toBeCloseTo(0, 5);

    // Centre PAIR (indices 2 and 3) straddles the arc centre
    expect(xs[2]).toBeLessThan(0);
    expect(xs[3]).toBeGreaterThan(0);

    const ys = items.map((el) => parseFloat(el.style.top));
    expect(ys[2]).toBe(ys[3]);
    expect(ys[2]).toBeLessThan(ys[1]);
  });

  it("ignores anchorRect for non-arc-anchor layouts", () => {
    const config: MenuConfig = {
      items: anchorItems(4),
      radius: 50,
      startAngle: -180,
      endAngle: 0,
      layout: "arc",
      arc: { position: "top", span: 180 },
      itemSize: 44,
      trigger: "click",
    };

    render(RadialMenu, {
      props: {
        config,
        open: true,
        anchorRect: anchor,
        onselect: () => {},
        onclose: () => {},
      },
    });

    expect(screen.getByRole("menu").style.transform).toBe("");
  });

  it("stagger delays run centre→edges with default stepMs 40 (5 items, no arc block)", async () => {
    const config: MenuConfig = {
      items: anchorItems(5),
      radius: 50,
      startAngle: -180,
      endAngle: 0,
      layout: "arc-anchor",
      itemSize: 44,
      trigger: "click",
    };

    render(RadialMenu, {
      props: { config, open: true, onselect: () => {}, onclose: () => {} },
    });

    await flushDoubleRaf();

    const items = screen.getAllByRole("menuitem");
    expect(items[0].style.animationDelay).toBe("80ms");
    expect(items[1].style.animationDelay).toBe("40ms");
    expect(items[2].style.animationDelay).toBe("0ms");
    expect(items[3].style.animationDelay).toBe("40ms");
    expect(items[4].style.animationDelay).toBe("80ms");
    expect(items[0].style.animation).toContain("260ms");
    expect(items[0].style.getPropertyValue("--stagger-delay")).toBe("80ms");
    expect(items[0].style.getPropertyValue("--stagger-duration")).toBe("260ms");
    expect(items[2].style.getPropertyValue("--stagger-delay")).toBe("0ms");
  });

  it("honours configured stagger values (stepMs 10, openMs 100)", async () => {
    const config: MenuConfig = {
      items: anchorItems(5),
      radius: 50,
      startAngle: -180,
      endAngle: 0,
      layout: "arc-anchor",
      stagger: { openMs: 100, closeMs: 90, stepMs: 10 },
      itemSize: 44,
      trigger: "click",
    };

    render(RadialMenu, {
      props: { config, open: true, onselect: () => {}, onclose: () => {} },
    });

    await flushDoubleRaf();

    const items = screen.getAllByRole("menuitem");
    expect(items[0].style.animationDelay).toBe("20ms");
    expect(items[1].style.animationDelay).toBe("10ms");
    expect(items[2].style.animationDelay).toBe("0ms");
    expect(items[3].style.animationDelay).toBe("10ms");
    expect(items[4].style.animationDelay).toBe("20ms");
    expect(items[0].style.animation).toContain("100ms");
  });

  it("items are not clickable until the open wave settles; the closing wave finishes before unmount", async () => {
    const onselect = vi.fn();
    const config: MenuConfig = {
      items: anchorItems(5),
      radius: 50,
      startAngle: -180,
      endAngle: 0,
      layout: "arc-anchor",
      itemSize: 44,
      trigger: "click",
    };

    const { rerender } = render(RadialMenu, {
      props: {
        config,
        open: true,
        anchorRect: anchor,
        onselect,
        onclose: () => {},
      },
    });

    // Centre item clicked mid-open wave: guard must hold
    const centre = screen.getByRole("menuitem", { name: "Act 3" });
    await fireEvent.click(centre);
    expect(onselect).not.toHaveBeenCalled();

    await openMenuComplete();
    await fireEvent.click(centre);
    expect(onselect).toHaveBeenCalledTimes(1);

    // Close: reversed wave — edges first (0ms), centre last (80ms)
    rerender({
      config,
      open: false,
      anchorRect: anchor,
      onselect,
      onclose: () => {},
    });

    const items = screen.getAllByRole("menuitem");
    expect(items[0].style.animationDelay).toBe("0ms");
    expect(items[2].style.animationDelay).toBe("80ms");

    // First-scheduled edge item finishing does NOT unmount the menu
    await fireEvent.animationEnd(items[0]);
    expect(screen.queryByRole("menu")).not.toBeNull();

    // Centre item (last scheduled) finishing completes the close
    await fireEvent.animationEnd(items[2]);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders {svg} icons through the K12 sanitizer as data-URL images", () => {
    const config: MenuConfig = {
      items: [
        {
          id: "clean",
          label: "Clean",
          icon: {
            svg: '<svg onload="alert(1)"><script>alert(2)</script>' +
              '<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><p>t</p></body></foreignObject>' +
              '<path d="M4 4h16" stroke="#fff" stroke-width="2"/>' +
              '<circle cx="12" cy="12" r="3" href="javascript:alert(3)"/></svg>',
          },
        },
      ],
      radius: 50,
      startAngle: -180,
      endAngle: 0,
      layout: "arc",
      itemSize: 44,
      trigger: "click",
    };

    const { container } = render(RadialMenu, {
      props: { config, open: true, onselect: () => {}, onclose: () => {} },
    });

    const img = container.querySelector("img.orbitkit-radial-icon-img");
    expect(img).not.toBeNull();
    const src = img!.getAttribute("src");
    const prefix = "data:image/svg+xml;charset=utf-8,";
    expect(src?.startsWith(prefix)).toBe(true);

    const decoded = decodeURIComponent(src!.slice(prefix.length));
    expect(decoded).toContain("<path");
    expect(decoded).toContain('d="M4 4h16"');
    expect(decoded).toContain("<circle");
    expect(decoded).not.toContain("<script");
    expect(decoded).not.toContain("script");
    expect(decoded).not.toContain("onload");
    expect(decoded).not.toContain("href");
    expect(decoded).not.toContain("foreignObject");
    expect(decoded).not.toContain("<p>");
    expect(decoded).not.toContain("<body");
  });

  it("renders no image for unsanitizable {svg} icons and falls back to the label", () => {
    const config: MenuConfig = {
      items: [{ id: "broken", label: "Broken", icon: { svg: "<svg><path</svg>" } }],
      radius: 50,
      startAngle: -180,
      endAngle: 0,
      layout: "arc",
      itemSize: 44,
      trigger: "click",
    };

    const { container } = render(RadialMenu, {
      props: { config, open: true, onselect: () => {}, onclose: () => {} },
    });

    expect(container.querySelector("img.orbitkit-radial-icon-img")).toBeNull();
    expect(container.querySelector(".orbitkit-radial-label")).toBeNull();
  });

  it("updates aria-label and title when an item label prop changes without reopening", () => {
    const config: MenuConfig = {
      items: [
        { id: "notes", label: "Notes" },
        { id: "quit", label: "Quit" },
      ],
      radius: 50,
      startAngle: -180,
      endAngle: 0,
      layout: "arc",
      animation: "none",
      itemSize: 44,
      trigger: "click",
    };

    const { rerender } = render(RadialMenu, {
      props: { config, open: true, onselect: () => {}, onclose: () => {} },
    });

    const menuBefore = screen.getByRole("menu");
    expect(screen.getByRole("menuitem", { name: "Notes" })).toBeDefined();

    const changed: MenuConfig = {
      ...config,
      items: [
        { id: "notes", label: "My Notes" },
        { id: "quit", label: "Quit" },
      ],
    };
    rerender({
      config: changed,
      open: true,
      onselect: () => {},
      onclose: () => {},
    });

    const renamed = screen.getByRole("menuitem", { name: "My Notes" });
    expect(renamed.getAttribute("title")).toBe("My Notes");
    expect(screen.queryByRole("menuitem", { name: "Notes" })).toBeNull();

    // Same mounted menu node: the label change did not reopen the menu
    expect(screen.getByRole("menu")).toBe(menuBefore);
  });
});
