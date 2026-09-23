import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import Mascot from "./Mascot.svelte";
import type { MascotConfig } from "./config";


describe("Mascot Component", () => {
  const inlineSvgConfig: MascotConfig = {
    kind: "svg",
    src: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#4f7cff" /></svg>`,
    size: 96,
  };

  const svgUrlConfig: MascotConfig = {
    kind: "svg",
    src: "/assets/mascot.svg",
    size: 96,
  };

  const imageConfig: MascotConfig = {
    kind: "image",
    src: "/assets/cat-idle.png",
    size: 120,
    states: {
      active: { src: "/assets/cat-active.png" },
      busy: { src: "/assets/cat-busy.png" },
    },
  };

  const spriteConfig: MascotConfig = {
    kind: "sprite",
    src: "/assets/mascot-sheet.png",
    size: 96,
    frameWidth: 96,
    frameHeight: 96,
    initialState: "idle",
    states: {
      idle: { frames: 4, fps: 8, loop: true, row: 0 },
      active: { frames: 8, fps: 16, loop: true, row: 1 },
      attention: { frames: 2, fps: 4, loop: false, row: 2 },
    },
  };

  // Test 1: Root element accessibility & class
  it("renders a button with orbitkit-mascot class, type=button, and aria-label", () => {
    const { container } = render(Mascot, {
      props: {
        config: inlineSvgConfig,
        ariaLabel: "Test mascot button",
      },
    });

    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    expect(button?.classList.contains("orbitkit-mascot")).toBe(true);
    expect(button?.getAttribute("type")).toBe("button");
    expect(button?.getAttribute("aria-label")).toBe("Test mascot button");
  });

  // Test 2: Renders inline SVG as img with data URL
  it("renders inline svg kind as an img element with data:image/svg+xml src and no inline svg in DOM", () => {
    const { container } = render(Mascot, {
      props: { config: inlineSvgConfig },
    });

    const img = container.querySelector("img.orbitkit-mascot-img");
    expect(img).toBeTruthy();
    const src = img?.getAttribute("src") ?? "";
    expect(src.startsWith("data:image/svg+xml")).toBe(true);
    expect(src).toBe(
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(inlineSvgConfig.src)
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  // Test 3: Renders SVG URL as img
  it("renders svg URL kind as an img element with correct src", () => {
    const { container } = render(Mascot, {
      props: { config: svgUrlConfig },
    });

    const img = container.querySelector("img.orbitkit-mascot-img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("/assets/mascot.svg");
  });

  // Test 4: Renders image kind
  it("renders image kind as an img element with initial src", () => {
    const { container } = render(Mascot, {
      props: { config: imageConfig },
    });

    const img = container.querySelector("img.orbitkit-mascot-img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("/assets/cat-idle.png");
  });

  // Test 5: Image state change swaps src
  it("swaps image src when state changes", async () => {
    const { container, rerender } = render(Mascot, {
      props: { config: imageConfig, state: "idle" },
    });

    let img = container.querySelector("img.orbitkit-mascot-img");
    expect(img?.getAttribute("src")).toBe("/assets/cat-idle.png");

    await rerender({ config: imageConfig, state: "active" });
    img = container.querySelector("img.orbitkit-mascot-img");
    expect(img?.getAttribute("src")).toBe("/assets/cat-active.png");

    await rerender({ config: imageConfig, state: "busy" });
    img = container.querySelector("img.orbitkit-mascot-img");
    expect(img?.getAttribute("src")).toBe("/assets/cat-busy.png");
  });

  // Test 6: Renders sprite kind with initial CSS animation vars and position
  it("renders sprite kind with background-image and animation vars", () => {
    const { container } = render(Mascot, {
      props: { config: spriteConfig, state: "idle" },
    });

    const sprite = container.querySelector(".orbitkit-mascot-sprite") as HTMLElement;
    expect(sprite).toBeTruthy();
    expect(sprite.style.backgroundImage).toContain("/assets/mascot-sheet.png");
    expect(sprite.style.backgroundPositionY).toBe("0px");
    expect(sprite.style.getPropertyValue("--frames")).toBe("4");
    expect(sprite.style.getPropertyValue("--fps")).toBe("8");
    expect(sprite.style.getPropertyValue("--row")).toBe("0");
    expect(sprite.style.getPropertyValue("--duration")).toBe("0.5s");
    expect(sprite.style.getPropertyValue("--sprite-loop")).toBe("infinite");
  });

  // Test 7: Sprite state change swaps animation vars and row offset
  it("swaps sprite animation vars and background-position-y on state change", async () => {
    const { container, rerender } = render(Mascot, {
      props: { config: spriteConfig, state: "idle" },
    });

    let sprite = container.querySelector(".orbitkit-mascot-sprite") as HTMLElement;
    expect(sprite.style.getPropertyValue("--frames")).toBe("4");
    expect(sprite.style.getPropertyValue("--row")).toBe("0");
    expect(sprite.style.backgroundPositionY).toBe("0px");

    await rerender({ config: spriteConfig, state: "active" });
    sprite = container.querySelector(".orbitkit-mascot-sprite") as HTMLElement;
    expect(sprite.style.getPropertyValue("--frames")).toBe("8");
    expect(sprite.style.getPropertyValue("--fps")).toBe("16");
    expect(sprite.style.getPropertyValue("--row")).toBe("1");
    expect(sprite.style.getPropertyValue("--bg-y")).toBe("-96px");
    expect(sprite.style.backgroundPositionY).toBe("-96px");
    expect(sprite.style.getPropertyValue("--duration")).toBe("0.5s");

    await rerender({ config: spriteConfig, state: "attention" });
    sprite = container.querySelector(".orbitkit-mascot-sprite") as HTMLElement;
    expect(sprite.style.getPropertyValue("--frames")).toBe("2");
    expect(sprite.style.getPropertyValue("--fps")).toBe("4");
    expect(sprite.style.getPropertyValue("--row")).toBe("2");
    expect(sprite.style.backgroundPositionY).toBe("-192px");
    expect(sprite.style.getPropertyValue("--sprite-loop")).toBe("1");
  });

  // Test 8: SVG markup rendering encodes into img src and prevents DOM injection
  it("renders svg markup into img src and prevents DOM injection of script/tags", () => {
    const maliciousSvg = `<svg viewBox="0 0 100 100"><script>alert('pwned')</script><foreignObject><script>alert('inner')</script></foreignObject><circle cx="50" cy="50" r="40" /></svg>`;
    const config: MascotConfig = {
      kind: "svg",
      src: maliciousSvg,
      size: 96,
    };

    const { container } = render(Mascot, { props: { config } });
    const img = container.querySelector("img.orbitkit-mascot-img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")?.startsWith("data:image/svg+xml")).toBe(true);
    expect(container.querySelectorAll("svg, script, foreignObject").length).toBe(0);
  });

  // Test 9: SVG markup with event handlers and links renders as img without DOM attributes
  it("renders svg markup with event handlers and links as img data URL without DOM attributes", () => {
    const maliciousSvg = `<svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" onclick="alert('click')" onload="alert('load')" onerror="alert('err')" onmouseover="steal()" />
      <a href="javascript:alert('xss')"><text>Click</text></a>
    </svg>`;

    const config: MascotConfig = {
      kind: "svg",
      src: maliciousSvg,
      size: 96,
    };
    const { container } = render(Mascot, { props: { config } });
    const img = container.querySelector("img.orbitkit-mascot-img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")?.startsWith("data:image/svg+xml")).toBe(true);
    expect(
      container.querySelectorAll("svg, circle, a, [onclick], [onload], [onerror], [onmouseover]").length
    ).toBe(0);
  });

  // Test 9b: All gate t_48ecebdf and remediation vectors: zero DOM injection
  it("safely handles all gate and remediation payloads with zero DOM injection", () => {
    const payloads = [
      // Gate t_48ecebdf payloads
      `<svg><?x ><img src=x onerror=alert(1)>?></svg>`,
      `<svg></svg><math><mtext><table><mglyph><style><img src=x onerror=alert(1)>`,
      `<svg><p/><form action="javascript:alert(1)"><button>x</button></form></svg>`,
      `<svg onload=alert(1)>`,
      `<svg><image href="x"/onerror="alert(1)">`,
      // Round 1 and Round 2 vectors
      `<svg><image href="https://example.com/pic.png"/onerror="alert(1)"></svg>`,
      `<svg><a href="jav&#x61;script:alert(1)">link</a></svg>`,
      `<svg><image xlink:href="jav&#x61;script:alert(1)" /></svg>`,
      `<svg><a href="java\tscript:alert(1)">link</a></svg>`,
      `<svg><image href="java&#x09;script:alert(1)" /></svg>`,
      `<svg><a href="java\r\nscript:alert(1)">link</a></svg>`,
      `<svg/onload=alert(1)><circle r="10"/></svg>`,
      `<svg><animate attributeName="href" values="javascript:alert(1)" /><circle r="5"/></svg>`,
      `<svg><set attributeName="xlink:href" to="javascript:alert(1)" /><circle r="5"/></svg>`,
      `<svg><animate attributeName="onload" values="1" /><circle r="5"/></svg>`,
    ];

    for (const payload of payloads) {
      const { container } = render(Mascot, {
        props: { config: { kind: "svg", src: payload, size: 96 } },
      });

      const img = container.querySelector("img");
      expect(img).toBeTruthy();
      expect(img?.getAttribute("src")?.startsWith("data:image/svg+xml")).toBe(true);

      // BRIEF mandate: assert container.querySelectorAll('[onerror],[onload],script,form,math').length === 0
      expect(
        container.querySelectorAll("[onerror],[onload],script,form,math").length,
        `Found forbidden elements/attributes for payload: ${payload}`
      ).toBe(0);

      // Verify no SVG or foreign elements in component DOM
      expect(container.querySelectorAll("svg").length).toBe(0);

      // Assert no on* attributes anywhere on any element in the container
      for (const el of Array.from(container.querySelectorAll("*"))) {
        for (const attr of Array.from(el.attributes)) {
          expect(attr.name.toLowerCase().startsWith("on")).toBe(false);
        }
      }
    }
  });

  // Test 9c: SVG state change swaps src
  it("swaps svg src when state changes", async () => {
    const svgStateConfig: MascotConfig = {
      kind: "svg",
      src: "<svg><circle r='10' /></svg>",
      size: 96,
      states: {
        active: { src: "<svg><rect width='10' height='10' /></svg>" },
        external: { src: "/assets/active.svg" },
      },
    };

    const { container, rerender } = render(Mascot, {
      props: { config: svgStateConfig, state: "idle" },
    });

    let img = container.querySelector("img");
    expect(img?.getAttribute("src")?.startsWith("data:image/svg+xml")).toBe(true);
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("<svg><circle r='10' /></svg>"));

    await rerender({ config: svgStateConfig, state: "active" });
    img = container.querySelector("img");
    expect(img?.getAttribute("src")?.startsWith("data:image/svg+xml")).toBe(true);
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("<svg><rect width='10' height='10' /></svg>"));

    await rerender({ config: svgStateConfig, state: "external" });
    img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/assets/active.svg");
  });

  // Test 10: Click fires onclick handler
  it("fires onclick handler when clicked", async () => {
    const handleClick = vi.fn();
    const { container } = render(Mascot, {
      props: { config: inlineSvgConfig, onclick: handleClick },
    });

    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    await fireEvent.click(button!);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // Test 11: Enter key does not duplicate activation; native button click activates onclick
  it("does not call onclick on Enter keydown and fires exactly once on native activation", async () => {
    const handleClick = vi.fn();
    const { container } = render(Mascot, {
      props: { config: inlineSvgConfig, onclick: handleClick },
    });

    const button = container.querySelector("button");
    expect(button).toBeTruthy();

    // Assert component has no custom keydown handler calling onclick (F2 remediation)
    await fireEvent.keyDown(button!, { key: "Enter", code: "Enter" });
    expect(handleClick).not.toHaveBeenCalled();

    // Native activation (e.g. click event) fires onclick exactly once
    button!.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // Test 12: Pointerdown fires onpointerdown handler
  it("fires onpointerdown handler on pointer interaction", async () => {
    const handlePointerDown = vi.fn();
    const { container } = render(Mascot, {
      props: { config: inlineSvgConfig, onpointerdown: handlePointerDown },
    });

    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    await fireEvent.pointerDown(button!);
    expect(handlePointerDown).toHaveBeenCalledTimes(1);
  });

  // Test 13: data-state attribute
  it("sets data-state attribute according to config and state prop", async () => {
    const { container, rerender } = render(Mascot, {
      props: { config: spriteConfig, state: "idle" },
    });

    const button = container.querySelector("button");
    expect(button?.getAttribute("data-state")).toBe("idle");

    await rerender({ config: spriteConfig, state: "attention" });
    expect(button?.getAttribute("data-state")).toBe("attention");
  });

  // Test 14: reduced-motion class
  it("adds reduced-motion class and disables animations when reducedMotion prop is set", () => {
    const { container } = render(Mascot, {
      props: { config: spriteConfig, reducedMotion: true },
    });

    const button = container.querySelector("button");
    expect(button?.classList.contains("reduced-motion")).toBe(true);
    expect(button?.classList.contains("orbitkit-mascot--reduced-motion")).toBe(true);
  });

  // Test 15: Size from config
  it("applies width, height, and CSS variable from config size", () => {
    const { container } = render(Mascot, {
      props: { config: imageConfig }, // size: 120
    });

    const button = container.querySelector("button") as HTMLElement;
    expect(button.style.width).toBe("120px");
    expect(button.style.height).toBe("120px");
    expect(button.style.getPropertyValue("--mascot-size")).toBe("120px");
  });
});
