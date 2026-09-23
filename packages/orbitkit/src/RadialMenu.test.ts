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

    const firstItem = screen.getByRole("menuitem", { name: "First" });
    await fireEvent.mouseEnter(firstItem);

    expect(onselect).toHaveBeenCalledWith("item-1");

    // Disabled item should not trigger onselect on hover
    const disabledItem = screen.getByRole("menuitem", { name: "Disabled" });
    await fireEvent.mouseEnter(disabledItem);

    expect(onselect).toHaveBeenCalledTimes(1);
  });
});
