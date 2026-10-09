import { describe, expect, it } from "vitest";
// JSON loaded via vite's native JSON import.
import starterConfigJson from "./test-fixtures/starter-0.1.0.json";
import k7FullJson from "./test-fixtures/k7-full.json";
import {
  MENU_ITEM_ID_REGEX,
  defineConfig,
  validateConfig,
  withDefaults,
  type MascotConfig,
  type MenuConfig,
  type MenuItem,
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

  it("accepts menu.trigger 'right-click'", () => {
    const res = validateConfig({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        trigger: "right-click",
      },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.config.menu.trigger).toBe("right-click");
    }
  });

  it("withDefaults passes menu.trigger 'right-click' through and keeps 'click' default", () => {
    const rightClick = withDefaults({
      ...validBaseConfig,
      menu: {
        ...validBaseConfig.menu,
        trigger: "right-click",
      },
    });
    expect(rightClick.menu.trigger).toBe("right-click");

    const defaulted = withDefaults({
      ...validBaseConfig,
      menu: { ...validBaseConfig.menu, trigger: undefined },
    });
    expect(defaulted.menu.trigger).toBe("click");
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
      expect(res.errors).toContain("menu.layout: must be 'orbit', 'arc', or 'arc-anchor'");
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
    expect(def.menu.arc).toEqual({ position: "top", span: 180, headGap: 12 });
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

const k7Base: OrbitKitConfig = {
  mascot: { kind: "svg", src: "<svg viewBox='0 0 100 100'></svg>", size: 96, initialState: "idle" },
  menu: {
    items: [{ id: "item1", label: "Item 1" }],
    radius: 96,
    startAngle: -90,
    endAngle: 270,
    itemSize: 44,
    trigger: "click",
  },
  windows: { popups: [] },
};

describe("MENU_ITEM_ID_REGEX (K7/AC2)", () => {
  it("accepts K7 ids with dot, colon, dash, underscore", () => {
    expect(MENU_ITEM_ID_REGEX.test("chat.new")).toBe(true);
    expect(MENU_ITEM_ID_REGEX.test("page.open:settings")).toBe(true);
    expect(MENU_ITEM_ID_REGEX.test("menu-item_2")).toBe(true);
    expect(MENU_ITEM_ID_REGEX.test("a")).toBe(true);
    expect(MENU_ITEM_ID_REGEX.test("a".repeat(64))).toBe(true);
  });

  it("rejects leading dot, uppercase, 65-char and empty ids", () => {
    expect(MENU_ITEM_ID_REGEX.test(".x")).toBe(false);
    expect(MENU_ITEM_ID_REGEX.test("A")).toBe(false);
    expect(MENU_ITEM_ID_REGEX.test("a".repeat(65))).toBe(false);
    expect(MENU_ITEM_ID_REGEX.test("")).toBe(false);
    expect(MENU_ITEM_ID_REGEX.test(":lead")).toBe(false);
  });

  it("validateConfig error message reflects the K7 pattern", () => {
    const res = validateConfig({
      ...k7Base,
      menu: { ...k7Base.menu, items: [{ id: ".x", label: "Bad" }] },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContain(
        "menu.items[0].id: must match ^[a-z0-9][a-z0-9_.:-]{0,63}$"
      );
    }
  });
});

describe("validateConfig K7 additions", () => {
  it("accepts a sheets-kind mascot with pools", () => {
    const res = validateConfig({
      ...k7Base,
      mascot: {
        kind: "sheets",
        src: "mascot.png",
        size: 64,
        sheets: {
          walk: { src: "walk.png", frameWidth: 32, frameHeight: 32, frames: 6, fps: 10, loop: true },
        },
        scale: 2,
        anchor: "center",
        faceByVelocity: true,
        states: { idle: { pool: ["walk"], priority: 1, ttlMs: 5000 } },
      },
    });
    expect(res.ok).toBe(true);
  });

  it("rejects sheets kind without sheets record and bad sheet fields", () => {
    const missing = validateConfig({
      ...k7Base,
      mascot: { kind: "sheets", src: "mascot.png", size: 64 },
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errors).toContain("mascot.sheets: required object when kind is 'sheets'");
    }

    const badSheet = validateConfig({
      ...k7Base,
      mascot: {
        kind: "sheets",
        src: "mascot.png",
        size: 64,
        sheets: { walk: { src: "", frameWidth: 0, frameHeight: 32, frames: 6, fps: 10 } },
      },
    });
    expect(badSheet.ok).toBe(false);
    if (!badSheet.ok) {
      expect(badSheet.errors).toContain("mascot.sheets['walk'].src: must be a non-empty string");
      expect(badSheet.errors).toContain("mascot.sheets['walk'].frameWidth: must be a positive number");
    }
  });

  it("rejects invalid scale, anchor, faceByVelocity", () => {
    for (const mascot of [
      { ...k7Base.mascot, scale: 0 },
      { ...k7Base.mascot, scale: 1.5 },
      { ...k7Base.mascot, anchor: "top" },
      { ...k7Base.mascot, faceByVelocity: "yes" },
    ] as MascotConfig[]) {
      const res = validateConfig({ ...k7Base, mascot });
      expect(res.ok).toBe(false);
    }
  });

  it("rejects empty pool, bad priority and ttlMs", () => {
    for (const states of [
      { idle: { pool: [] } },
      { idle: { pool: [""] } },
      { idle: { pool: ["walk"], priority: "high" } },
      { idle: { pool: ["walk"], ttlMs: 0 } },
    ] as MascotConfig["states"][]) {
      const res = validateConfig({
        ...k7Base,
        mascot: { ...k7Base.mascot, states },
      });
      expect(res.ok).toBe(false);
    }
  });

  it("accepts arc-anchor layout, headGap and stagger", () => {
    const res = validateConfig({
      ...k7Base,
      menu: {
        ...k7Base.menu,
        layout: "arc-anchor",
        arc: { position: "top", span: 180, headGap: 16 },
        stagger: { openMs: 200, closeMs: 120, stepMs: 30 },
      },
    });
    expect(res.ok).toBe(true);
  });

  it("rejects bad headGap and stagger", () => {
    const badGap = validateConfig({
      ...k7Base,
      menu: {
        ...k7Base.menu,
        layout: "arc-anchor",
        arc: { position: "top", span: 180, headGap: -1 },
      },
    });
    expect(badGap.ok).toBe(false);
    if (!badGap.ok) {
      expect(badGap.errors).toContain("menu.arc.headGap: must be a number >= 0");
    }

    const badStagger = validateConfig({
      ...k7Base,
      menu: {
        ...k7Base.menu,
        stagger: { openMs: -5, closeMs: 180, stepMs: 40 },
      },
    });
    expect(badStagger.ok).toBe(false);
    if (!badStagger.ok) {
      expect(badStagger.errors).toContain("menu.stagger.openMs: must be a number >= 0");
    }
  });

  it("accepts inline svg icon and rejects malformed icon", () => {
    const ok = validateConfig({
      ...k7Base,
      menu: {
        ...k7Base.menu,
        items: [{ id: "chat.new", label: "Chat", icon: { svg: "<svg></svg>" } }],
      },
    });
    expect(ok.ok).toBe(true);

    for (const icon of [{}, { svg: "" }, { nope: 1 }, 42] as unknown[]) {
      const res = validateConfig({
        ...k7Base,
        menu: {
          ...k7Base.menu,
          items: [{ id: "chat.new", label: "Chat", icon } as MenuItem],
        },
      });
      expect(res.ok).toBe(false);
    }
  });

  it("accepts K7/K11 mascotWindow and popup fields, rejects invalid ones", () => {
    const ok = validateConfig({
      ...k7Base,
      windows: {
        mascotWindow: {
          transparent: true,
          alwaysOnTop: true,
          decorations: false,
          label: "my-mascot",
          url: "index.html?orbitkit=mascot",
          passthrough: true,
          fitContent: true,
          roam: { width: 64, height: 64, margin: 24, corner: "bottom-right", speed: 2.5 },
        },
        popups: [
          {
            id: "notes",
            url: "index.html?popup=notes&ref={ref}",
            title: "Notes",
            width: 360,
            height: 420,
            anchor: "mascot",
            decorations: false,
            transparent: true,
            skipTaskbar: true,
            minWidth: 200,
            minHeight: 160,
          },
        ],
      },
    });
    expect(ok.ok).toBe(true);

    const badMw = validateConfig({
      ...k7Base,
      windows: {
        popups: [],
        mascotWindow: {
          transparent: true,
          alwaysOnTop: true,
          decorations: false,
          label: "",
          passthrough: "yes",
          roam: { width: 0, height: 64, margin: 24, corner: "middle", speed: 2.5 },
        },
      },
    });
    expect(badMw.ok).toBe(false);
    if (!badMw.ok) {
      expect(badMw.errors).toContain("windows.mascotWindow.label: must be a non-empty string");
      expect(badMw.errors).toContain("windows.mascotWindow.passthrough: must be a boolean");
      expect(badMw.errors).toContain("windows.mascotWindow.roam.width: must be a positive number");
      expect(badMw.errors).toContain(
        "windows.mascotWindow.roam.corner: must be 'bottom-right', 'bottom-left', 'top-right', or 'top-left'"
      );
    }

    const badPopup = validateConfig({
      ...k7Base,
      windows: {
        popups: [
          {
            id: "notes",
            url: "index.html",
            title: "Notes",
            width: 360,
            height: 420,
            anchor: "diagonal",
            skipTaskbar: "no",
            minWidth: 0,
          },
        ],
      },
    });
    expect(badPopup.ok).toBe(false);
    if (!badPopup.ok) {
      expect(badPopup.errors).toContain(
        "windows.popups[0].anchor: must be 'mascot', 'center', or 'none'"
      );
      expect(badPopup.errors).toContain("windows.popups[0].skipTaskbar: must be a boolean");
      expect(badPopup.errors).toContain("windows.popups[0].minWidth: must be a positive number");
    }
  });

  it("accepts app.allowedOrigins and rejects invalid ones", () => {
    const ok = validateConfig({
      ...k7Base,
      app: { allowedOrigins: ["https://example.com"] },
    });
    expect(ok.ok).toBe(true);

    for (const app of [
      { allowedOrigins: "https://example.com" },
      { allowedOrigins: [42] },
      { allowedOrigins: [""] },
      "nope",
    ] as unknown[]) {
      const res = validateConfig({ ...k7Base, app });
      expect(res.ok).toBe(false);
    }
  });
});

describe("K7 withDefaults (AC1)", () => {
  it("fills sheets defaults on mascot", () => {
    const def = withDefaults({
      mascot: { kind: "svg", src: "<svg></svg>" },
    });
    expect(def.mascot.scale).toBe(1);
    expect(def.mascot.anchor).toBe("bottom-center");
    expect(def.mascot.faceByVelocity).toBe(false);
  });

  it("fills stagger, arc headGap and layout defaults", () => {
    const def = withDefaults({
      mascot: { kind: "svg", src: "<svg></svg>" },
      menu: {
        items: [{ id: "act", label: "Act" }],
        layout: "arc-anchor",
      },
    });
    expect(def.menu.stagger).toEqual({ openMs: 260, closeMs: 180, stepMs: 40 });
    expect(def.menu.arc).toEqual({ headGap: 12 });

    const custom = withDefaults({
      mascot: { kind: "svg", src: "<svg></svg>" },
      menu: {
        items: [{ id: "act", label: "Act" }],
        layout: "arc-anchor",
        arc: { position: "top", span: 180, headGap: 24 },
        stagger: { openMs: 100, closeMs: 90, stepMs: 10 },
      },
    });
    expect(custom.menu.arc?.headGap).toBe(24);
    expect(custom.menu.stagger).toEqual({ openMs: 100, closeMs: 90, stepMs: 10 });
  });

  it("fills mascotWindow and popup defaults", () => {
    const def = withDefaults({
      mascot: { kind: "svg", src: "<svg></svg>" },
      menu: { items: [{ id: "act", label: "Act" }] },
      windows: {
        mascotWindow: { transparent: true, alwaysOnTop: true, decorations: false },
        popups: [{ id: "notes", url: "index.html", title: "Notes", width: 320, height: 420 }],
      },
    });
    expect(def.windows.mascotWindow?.label).toBe("orbitkit-mascot");
    expect(def.windows.mascotWindow?.url).toBe("index.html?orbitkit=mascot");
    expect(def.windows.mascotWindow?.passthrough).toBe(false);
    expect(def.windows.mascotWindow?.fitContent).toBe(false);
    expect(def.windows.popups[0]?.anchor).toBe("none");
  });

  it("copies app.allowedOrigins", () => {
    const def = withDefaults({
      mascot: { kind: "svg", src: "<svg></svg>" },
      menu: { items: [{ id: "act", label: "Act" }] },
      app: { allowedOrigins: ["https://example.com"] },
    });
    expect(def.app?.allowedOrigins).toEqual(["https://example.com"]);
    expect(def.app?.allowedOrigins).not.toBe(def.windows); // new array, not aliased
  });
});

describe("compat: 0.1.0 starter config (AC3)", () => {
  const starterConfig = starterConfigJson as OrbitKitConfig;

  it("validates the starter config unchanged", () => {
    const res = validateConfig(starterConfig);
    expect(res.ok).toBe(true);
  });

  it("survives withDefaults round-trip validation", () => {
    const res = validateConfig(withDefaults(starterConfig));
    expect(res.ok).toBe(true);
  });
});

describe("K7 full fixture (AC4)", () => {
  const fixture: any = k7FullJson;

  it("validates the full K7 config", () => {
    const res = validateConfig(fixture);
    expect(res.ok).toBe(true);
  });

  it("parses every K7 field value", () => {
    expect(fixture.mascot.kind).toBe("sheets");
    expect(fixture.mascot.scale).toBe(2);
    expect(fixture.mascot.anchor).toBe("center");
    expect(fixture.mascot.faceByVelocity).toBe(true);
    expect(fixture.mascot.sheets?.walk).toEqual({
      src: "walk.png",
      frameWidth: 32,
      frameHeight: 32,
      frames: 6,
      fps: 10,
      loop: true,
    });
    expect(fixture.mascot.states?.idle).toEqual({ pool: ["walk"], priority: 2, ttlMs: 5000 });
    expect(fixture.menu.items[0]?.icon).toEqual({ svg: "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>" });
    expect(fixture.menu.layout).toBe("arc-anchor");
    expect(fixture.menu.arc?.headGap).toBe(16);
    expect(fixture.menu.stagger).toEqual({ openMs: 200, closeMs: 120, stepMs: 30 });
    expect(fixture.windows.mascotWindow?.label).toBe("my-mascot");
    expect(fixture.windows.mascotWindow?.passthrough).toBe(true);
    expect(fixture.windows.mascotWindow?.roam).toEqual({
      width: 64,
      height: 64,
      margin: 24,
      corner: "bottom-right",
      speed: 2.5,
    });
    expect(fixture.windows.popups[0]?.anchor).toBe("mascot");
    expect(fixture.windows.popups[0]?.skipTaskbar).toBe(true);
    expect(fixture.app?.allowedOrigins).toEqual(["https://example.com", "http://localhost:1420"]);
  });
});

describe("K14 caption config", () => {
  it("withDefaults defaults caption to false (back-compat)", () => {
    const def = withDefaults({
      mascot: { kind: "svg", src: "<svg></svg>" },
      menu: { items: [{ id: "act", label: "Act" }] },
    });
    expect(def.menu.caption).toBe(false);
  });

  it("withDefaults preserves an explicit caption", () => {
    const def = withDefaults({
      mascot: { kind: "svg", src: "<svg></svg>" },
      menu: { items: [{ id: "act", label: "Act" }], caption: true },
    });
    expect(def.menu.caption).toBe(true);
  });

  it("validates caption true and false without new errors", () => {
    for (const caption of [false, true]) {
      const res = validateConfig({
        ...k7Base,
        menu: { ...k7Base.menu, caption },
      });
      expect(res.ok).toBe(true);
    }
  });

  it("rejects a non-boolean caption", () => {
    const res = validateConfig({
      ...k7Base,
      menu: { ...k7Base.menu, caption: "yes" as unknown as boolean },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.includes("menu.caption"))).toBe(true);
    }
  });
});
