import { describe, expect, it } from "vitest";
import {
  defineConfig,
  validateConfig,
  withDefaults,
  type MenuConfig,
  type OrbitKitConfig,
} from "./config";

describe("defineConfig", () => {
  it("returns the exact same configuration object passed in", () => {
    const config: OrbitKitConfig = {
      mascot: {
        kind: "svg",
        src: "<svg></svg>",
        size: 96,
        initialState: "idle",
      },
      menu: {
        items: [{ id: "item1", label: "Item 1" }],
        radius: 96,
        startAngle: -90,
        endAngle: 270,
        itemSize: 44,
        trigger: "click",
      },
      windows: {
        popups: [],
      },
    };
    expect(defineConfig(config)).toBe(config);
  });
});

describe("withDefaults", () => {
  it("populates all default values when minimal partial config is provided", () => {
    const defaulted = withDefaults({
      mascot: {
        kind: "svg",
        src: "<svg></svg>",
      },
      menu: {
        items: [{ id: "item1", label: "Item 1" }],
      },
    });

    expect(defaulted.mascot.size).toBe(96);
    expect(defaulted.mascot.initialState).toBe("idle");
    expect(defaulted.mascot.kind).toBe("svg");
    expect(defaulted.mascot.src).toBe("<svg></svg>");

    expect(defaulted.menu.radius).toBe(96);
    expect(defaulted.menu.startAngle).toBe(-90);
    expect(defaulted.menu.endAngle).toBe(270);
    expect(defaulted.menu.itemSize).toBe(44);
    expect(defaulted.menu.trigger).toBe("click");
    expect(defaulted.menu.items).toEqual([{ id: "item1", label: "Item 1" }]);

    expect(defaulted.windows.popups).toEqual([]);
    expect(defaulted.windows.mascotWindow).toBeUndefined();
  });

  it("preserves explicitly provided non-default values", () => {
    const custom = withDefaults({
      mascot: {
        kind: "image",
        src: "https://example.com/mascot.png",
        size: 128,
        initialState: "active",
      },
      menu: {
        items: [{ id: "opt1", label: "Option 1" }],
        radius: 120,
        startAngle: 0,
        endAngle: 180,
        itemSize: 50,
        trigger: "hover",
      },
      windows: {
        mascotWindow: {
          transparent: true,
          alwaysOnTop: true,
          decorations: false,
          x: 100,
          y: 200,
        },
        popups: [
          {
            id: "popup1",
            url: "/popup.html",
            title: "Popup 1",
            width: 400,
            height: 300,
          },
        ],
      },
    });

    expect(custom.mascot.size).toBe(128);
    expect(custom.mascot.initialState).toBe("active");
    expect(custom.menu.radius).toBe(120);
    expect(custom.menu.startAngle).toBe(0);
    expect(custom.menu.endAngle).toBe(180);
    expect(custom.menu.itemSize).toBe(50);
    expect(custom.menu.trigger).toBe("hover");
    expect(custom.windows.popups).toHaveLength(1);
    expect(custom.windows.mascotWindow?.transparent).toBe(true);
  });

  it("handles completely empty input by providing fallback defaults", () => {
    const defaulted = withDefaults({});
    expect(defaulted.mascot.size).toBe(96);
    expect(defaulted.mascot.initialState).toBe("idle");
    expect(defaulted.menu.radius).toBe(96);
    expect(defaulted.menu.items).toEqual([]);
    expect(defaulted.windows.popups).toEqual([]);
  });
});

describe("validateConfig", () => {
  const validBaseConfig: OrbitKitConfig = {
    mascot: {
      kind: "svg",
      src: "<svg viewBox='0 0 100 100'></svg>",
      size: 96,
      initialState: "idle",
    },
    menu: {
      items: [
        { id: "home", label: "Home" },
        { id: "settings", label: "Settings" },
      ],
      radius: 96,
      startAngle: -90,
      endAngle: 270,
      itemSize: 44,
      trigger: "click",
    },
    windows: {
      popups: [
        {
          id: "help-popup",
          url: "help.html",
          title: "Help",
          width: 300,
          height: 200,
        },
      ],
    },
  };

  it("happy path: validates a complete valid OrbitKitConfig", () => {
    const res = validateConfig(validBaseConfig);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.config).toEqual(validBaseConfig);
    }
  });

  it("happy path: validates config with withDefaults applied", () => {
    const defaulted = withDefaults({
      mascot: { kind: "svg", src: "<svg></svg>" },
      menu: { items: [{ id: "action", label: "Action" }] },
    });
    const res = validateConfig(defaulted);
    expect(res.ok).toBe(true);
  });

  it("rejects non-object root config", () => {
    expect(validateConfig(null).ok).toBe(false);
    expect(validateConfig(undefined).ok).toBe(false);
    expect(validateConfig("config").ok).toBe(false);
    expect(validateConfig(123).ok).toBe(false);
    expect(validateConfig([]).ok).toBe(false);
  });

  it("rejects missing or invalid mascot object", () => {
    const res = validateConfig({ ...validBaseConfig, mascot: null });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.startsWith("mascot:"))).toBe(true);
    }
  });

  it("validates mascot kind: accepts svg, image, sprite; rejects invalid kind", () => {
    const invalidKindRes = validateConfig({
      ...validBaseConfig,
      mascot: { ...validBaseConfig.mascot, kind: "video" },
    });
    expect(invalidKindRes.ok).toBe(false);
    if (!invalidKindRes.ok) {
      expect(
        invalidKindRes.errors.some((e) => e.startsWith("mascot.kind:"))
      ).toBe(true);
    }
  });

  it("validates mascot src: rejects non-string or empty string", () => {
    const emptySrcRes = validateConfig({
      ...validBaseConfig,
      mascot: { ...validBaseConfig.mascot, src: "" },
    });
    expect(emptySrcRes.ok).toBe(false);
    if (!emptySrcRes.ok) {
      expect(
        emptySrcRes.errors.some((e) => e.startsWith("mascot.src:"))
      ).toBe(true);
    }
  });

  it("validates mascot size: rejects non-positive or non-number size", () => {
    const zeroSizeRes = validateConfig({
      ...validBaseConfig,
      mascot: { ...validBaseConfig.mascot, size: 0 },
    });
    expect(zeroSizeRes.ok).toBe(false);
    if (!zeroSizeRes.ok) {
      expect(
        zeroSizeRes.errors.some((e) => e.startsWith("mascot.size:"))
      ).toBe(true);
    }

    const negSizeRes = validateConfig({
      ...validBaseConfig,
      mascot: { ...validBaseConfig.mascot, size: -10 },
    });
    expect(negSizeRes.ok).toBe(false);
  });

  it("validates sprite mascot requires frameWidth and frameHeight", () => {
    const missingDimsRes = validateConfig({
      ...validBaseConfig,
      mascot: {
        kind: "sprite",
        src: "spritesheet.png",
        size: 96,
      },
    });
    expect(missingDimsRes.ok).toBe(false);
    if (!missingDimsRes.ok) {
      expect(
        missingDimsRes.errors.some((e) => e.includes("mascot.frameWidth"))
      ).toBe(true);
      expect(
        missingDimsRes.errors.some((e) => e.includes("mascot.frameHeight"))
      ).toBe(true);
    }

    const validSpriteRes = validateConfig({
      ...validBaseConfig,
      mascot: {
        kind: "sprite",
        src: "spritesheet.png",
        size: 96,
        frameWidth: 32,
        frameHeight: 32,
      },
    });
    expect(validSpriteRes.ok).toBe(true);
  });

  it("rejects missing or invalid menu object", () => {
    const res = validateConfig({ ...validBaseConfig, menu: "not-an-object" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.startsWith("menu:"))).toBe(true);
    }
  });

  it("validates menu items count: requires 1..12 items", () => {
    const emptyItemsRes = validateConfig({
      ...validBaseConfig,
      menu: { ...validBaseConfig.menu, items: [] },
    });
    expect(emptyItemsRes.ok).toBe(false);
    if (!emptyItemsRes.ok) {
      expect(
        emptyItemsRes.errors.some((e) => e.includes("menu.items: item count"))
      ).toBe(true);
    }

    const thirteenItems = Array.from({ length: 13 }, (_, i) => ({
      id: `item-${i}`,
      label: `Item ${i}`,
    }));
    const tooManyRes = validateConfig({
      ...validBaseConfig,
      menu: { ...validBaseConfig.menu, items: thirteenItems },
    });
    expect(tooManyRes.ok).toBe(false);
    if (!tooManyRes.ok) {
      expect(
        tooManyRes.errors.some((e) => e.includes("menu.items: item count"))
      ).toBe(true);
    }
  });

  it("validates menu item id pattern ^[a-z0-9][a-z0-9_-]{0,31}$", () => {
    const invalidIdRes = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        items: [
          { id: "valid_id", label: "Valid" },
          { id: "invalid id with spaces", label: "Invalid Space" },
          { id: "INVALID_UPPERCASE", label: "Invalid Upper" },
        ],
      },
    });
    expect(invalidIdRes.ok).toBe(false);
    if (!invalidIdRes.ok) {
      expect(
        invalidIdRes.errors.some((e) =>
          e.includes("menu.items[1].id: must match ^[a-z0-9]")
        )
      ).toBe(true);
      expect(
        invalidIdRes.errors.some((e) =>
          e.includes("menu.items[2].id: must match ^[a-z0-9]")
        )
      ).toBe(true);
    }
  });

  it("validates menu items unique IDs", () => {
    const dupRes = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        items: [
          { id: "same-id", label: "First" },
          { id: "same-id", label: "Second" },
        ],
      },
    });
    expect(dupRes.ok).toBe(false);
    if (!dupRes.ok) {
      expect(
        dupRes.errors.some(
          (e) => e.includes("menu.items[1].id:") && e.includes("duplicate id")
        )
      ).toBe(true);
    }
  });

  it("validates menu trigger must be click or hover", () => {
    const invalidTriggerRes = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        trigger: "double-click" as unknown as MenuConfig["trigger"],
      },
    });
    expect(invalidTriggerRes.ok).toBe(false);
    if (!invalidTriggerRes.ok) {
      expect(
        invalidTriggerRes.errors.some((e) => e.startsWith("menu.trigger:"))
      ).toBe(true);
    }
  });

  it("validates menu geometry: radius, startAngle, endAngle", () => {
    const invalidGeoRes = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        radius: -10,
        startAngle: "abc" as unknown as number,
      },
    });
    expect(invalidGeoRes.ok).toBe(false);
    if (!invalidGeoRes.ok) {
      expect(
        invalidGeoRes.errors.some((e) => e.startsWith("menu.radius:"))
      ).toBe(true);
      expect(
        invalidGeoRes.errors.some((e) => e.startsWith("menu.startAngle:"))
      ).toBe(true);
    }
  });

  it("rejects missing or invalid windows object", () => {
    const res = validateConfig({ ...validBaseConfig, windows: null });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.startsWith("windows:"))).toBe(true);
    }
  });

  it("validates windows popup unique IDs", () => {
    const dupPopupRes = validateConfig({
      ...validBaseConfig,
      windows: {
        popups: [
          {
            id: "popup-a",
            url: "a.html",
            title: "A",
            width: 100,
            height: 100,
          },
          {
            id: "popup-a",
            url: "b.html",
            title: "B",
            width: 200,
            height: 200,
          },
        ],
      },
    });
    expect(dupPopupRes.ok).toBe(false);
    if (!dupPopupRes.ok) {
      expect(
        dupPopupRes.errors.some(
          (e) =>
            e.includes("windows.popups[1].id:") && e.includes("duplicate id")
        )
      ).toBe(true);
    }
  });

  it("validates windows popup width and height must be positive numbers", () => {
    const invalidDimsRes = validateConfig({
      ...validBaseConfig,
      windows: {
        popups: [
          {
            id: "popup-a",
            url: "a.html",
            title: "A",
            width: 0,
            height: -50,
          },
        ],
      },
    });
    expect(invalidDimsRes.ok).toBe(false);
    if (!invalidDimsRes.ok) {
      expect(
        invalidDimsRes.errors.some((e) => e.includes("windows.popups[0].width"))
      ).toBe(true);
      expect(
        invalidDimsRes.errors.some((e) =>
          e.includes("windows.popups[0].height")
        )
      ).toBe(true);
    }
  });

  it("validates menu layout must be orbit or arc", () => {
    const res = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        layout: "linear" as unknown as MenuConfig["layout"],
      },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContain("menu.layout: must be 'orbit' or 'arc'");
    }
  });

  it("validates menu arc position must be one of the four", () => {
    const res = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        layout: "arc",
        arc: {
          position: "middle" as unknown as "top",
        },
      },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContain(
        "menu.arc.position: must be 'top', 'bottom', 'left', or 'right'"
      );
    }
  });

  it("validates menu arc span must be between 30 and 300", () => {
    const tooSmall = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        layout: "arc",
        arc: { position: "top", span: 15 },
      },
    });
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) {
      expect(tooSmall.errors).toContain("menu.arc.span: must be between 30 and 300");
    }

    const tooLarge = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        layout: "arc",
        arc: { position: "top", span: 350 },
      },
    });
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) {
      expect(tooLarge.errors).toContain("menu.arc.span: must be between 30 and 300");
    }
  });

  it("validates valid arc config passes validation", () => {
    const res = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        layout: "arc",
        arc: { position: "top", span: 180 },
      },
    });
    expect(res.ok).toBe(true);
  });

  it("allows arc without layout arc", () => {
    const res = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        layout: "orbit",
        arc: { position: "top", span: 180 },
      },
    });
    expect(res.ok).toBe(true);
  });

  it("withDefaults resolves arc layout angles and populates default arc config", () => {
    const def = withDefaults({
      ...validBaseConfig,
      menu: {
        items: validBaseConfig.menu.items,
        layout: "arc",
      },
    });
    expect(def.menu.layout).toBe("arc");
    expect(def.menu.arc).toEqual({ position: "top", span: 180 });
    expect(def.menu.startAngle).toBe(-180);
    expect(def.menu.endAngle).toBe(0);
  });

  it("withDefaults defaults menu.animation to spawn", () => {
    const def = withDefaults({
      ...validBaseConfig,
    });
    expect(def.menu.animation).toBe("spawn");
  });

  it("validates menu.animation accepts spawn and none", () => {
    const spawnRes = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        animation: "spawn",
      },
    });
    expect(spawnRes.ok).toBe(true);

    const noneRes = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        animation: "none",
      },
    });
    expect(noneRes.ok).toBe(true);
  });

  it("validates menu.animation rejects invalid value", () => {
    const invalidRes = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        animation: "zoom" as unknown as "spawn",
      },
    });
    expect(invalidRes.ok).toBe(false);
    if (!invalidRes.ok) {
      expect(invalidRes.errors).toContain("menu.animation: must be one of spawn, none");
    }
  });
});
