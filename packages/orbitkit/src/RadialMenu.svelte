<script lang="ts">
  import { untrack } from "svelte";
  import type { MenuConfig, MenuItem } from "./config";
  import {
    DEFAULT_ARC_HEAD_GAP,
    DEFAULT_STAGGER,
    validateConfig,
  } from "./config";
  import {
    type AnchorRect,
    layoutItems,
    resolveMenuAngles,
    resolveMenuOrigin,
  } from "./geometry";
  import {
    type MenuAnimPhase,
    type MenuStaggerSpec,
    getItemAnimationStyle,
    getItemDelay,
    getMaxItemDelay,
    getTotalAnimationDuration,
  } from "./menuAnimation";
  import { sanitizeMenuIconToDataUrl } from "./iconSanitize";

  interface Props {
    config: MenuConfig;
    open: boolean;
    onselect: (id: string) => void;
    onclose: () => void;
    label?: string;
    /** K7 arc-anchor: mascot window bounds the arc hovers above. */
    anchorRect?: AnchorRect | null;
  }

  let { config, open, onselect, onclose, label, anchorRect = null }: Props =
    $props();

  let menuEl: HTMLElement | null = $state(null);
  let itemSize = $derived(config.itemSize ?? 44);
  let angles = $derived(resolveMenuAngles(config));
  let positions = $derived(
    layoutItems(
      config.items.length,
      config.radius,
      angles.startAngle,
      angles.endAngle
    )
  );

  // K7 stagger engages only for layout "arc-anchor"; legacy orbit/arc keeps
  // the un-parameterized index-linear timing (0/20/40 ms, 220/180 ms).
  let stagger = $derived<MenuStaggerSpec | undefined>(
    config.layout === "arc-anchor"
      ? {
          openMs: config.stagger?.openMs ?? DEFAULT_STAGGER.openMs,
          closeMs: config.stagger?.closeMs ?? DEFAULT_STAGGER.closeMs,
          stepMs: config.stagger?.stepMs ?? DEFAULT_STAGGER.stepMs,
        }
      : undefined
  );

  // K7 arc-anchor: shift the container so the arc centre sits headGap px above
  // the mascot's top edge, centred on the mascot bounds.
  let origin = $derived(
    config.layout === "arc-anchor"
      ? resolveMenuOrigin(
          anchorRect,
          config.arc?.headGap ?? DEFAULT_ARC_HEAD_GAP
        )
      : { x: 0, y: 0 }
  );

  let containerStyle = $derived(
    `${origin.x !== 0 || origin.y !== 0 ? `transform: translate(${origin.x}px, ${origin.y}px); ` : ""}${config.animation === "none" ? "animation: none !important; transition: none !important;" : ""}`
  );

  type IconRender = { kind: "img"; src: string } | { kind: "text"; text: string };

  function resolveIcon(icon: MenuItem["icon"]): IconRender | null {
    if (!icon) return null;
    if (typeof icon === "object") {
      // K12: { svg } icons pass through the allowlist sanitizer and render as
      // a data-URL <img>; unsanitizable markup renders nothing.
      const src = sanitizeMenuIconToDataUrl(icon.svg);
      return src ? { kind: "img", src } : null;
    }
    if (isUrl(icon)) {
      return { kind: "img", src: icon };
    }
    return { kind: "text", text: icon };
  }

  let icons = $derived(config.items.map((item) => resolveIcon(item.icon)));

  // K14 hovered-item caption: ONE label mirror inside the container. Keyboard
  // focus wins over hover; disabled items never set it; empty when neither;
  // tracking resets the moment the menu closes.
  let captionHoverId = $state<string | null>(null);
  let captionFocusId = $state<string | null>(null);

  let captionOn = $derived(config.caption === true);

  let captionText = $derived.by(() => {
    if (!captionOn) return "";
    // Keyboard-first: a focused enabled item beats a hovered one.
    for (const id of [captionFocusId, captionHoverId]) {
      if (!id) continue;
      const item = config.items.find((it) => it.id === id);
      if (item && !item.disabled) return item.label;
    }
    return "";
  });

  // K14: pure-CSS placement — bottom-centre for a top arc, top-centre for a
  // bottom arc, plain centred otherwise (arc-anchor is always a top arc).
  let captionArcClass = $derived.by(() => {
    if (!captionOn) return "";
    const pos = config.layout === "arc-anchor" ? "top" : config.arc?.position;
    if (pos === "top") return "orbitkit-caption-arc-top";
    if (pos === "bottom") return "orbitkit-caption-arc-bottom";
    return "orbitkit-caption-center";
  });

  function handleCaptionPointerEnter(itemId: string, disabled?: boolean) {
    // Disabled items are not caption sources; the previous label survives
    // until the pointer leaves the menu container.
    if (!captionOn || disabled) return;
    captionHoverId = itemId;
  }

  function handleCaptionPointerLeave() {
    captionHoverId = null;
  }

  function handleCaptionFocusIn(e: FocusEvent) {
    if (!captionOn) return;
    const id = (e.target as HTMLElement | null)?.getAttribute?.(
      "data-orbitkit-radial-item"
    );
    if (!id) return;
    const item = config.items.find((it) => it.id === id);
    if (!item || item.disabled) return;
    captionFocusId = id;
  }

  function handleCaptionFocusOut() {
    captionFocusId = null;
  }

  function checkReducedMotion(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  let isMounted = $state(false);
  let animPhase = $state<MenuAnimPhase>("closed");

  // K7: dev-only config validation — report invalid item configs without throwing.
  $effect(() => {
    if (import.meta.env?.DEV) {
      const result = validateConfig({
        mascot: { kind: "svg", src: "orbitkit-dev-stub", size: 1 },
        menu: config,
        windows: { popups: [] },
      });
      if (!result.ok) {
        console.error("[orbitkit] RadialMenu config invalid:", result.errors);
      }
    }
  });

  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let rafId1: number | null = null;
  let rafId2: number | null = null;

  function cancelPendingRafs() {
    if (rafId1 !== null) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId1);
      } else {
        clearTimeout(rafId1);
      }
      rafId1 = null;
    }
    if (rafId2 !== null) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId2);
      } else {
        clearTimeout(rafId2);
      }
      rafId2 = null;
    }
  }

  function scheduleRaf(cb: () => void): number {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(cb);
    }
    return setTimeout(cb, 16) as unknown as number;
  }

  $effect(() => {
    const shouldBeOpen = open;

    untrack(() => {
      const isAnimDisabled =
        config.animation === "none" || checkReducedMotion();
      const itemsCount = config.items.length;

      if (openTimer) {
        clearTimeout(openTimer);
        openTimer = null;
      }
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      cancelPendingRafs();

      if (shouldBeOpen) {
        isMounted = true;
        if (isAnimDisabled || itemsCount === 0) {
          animPhase = "open";
        } else {
          // Mount with the start state (scale 0, at the mascot centre, opacity 0)
          animPhase = "closed";
          rafId1 = scheduleRaf(() => {
            rafId1 = null;
            rafId2 = scheduleRaf(() => {
              rafId2 = null;
              if (!open) return;
              animPhase = "opening";
              const duration = getTotalAnimationDuration(
                itemsCount,
                "open",
                stagger
              );
              openTimer = setTimeout(() => {
                animPhase = "open";
                openTimer = null;
              }, duration);
            });
          });
        }
      } else {
        // K14: caption tracking dies with the menu — no stale label on the
        // closing frame or on the next open.
        captionHoverId = null;
        captionFocusId = null;
        if (!isMounted) {
          animPhase = "closed";
          return;
        }
        if (isAnimDisabled || itemsCount === 0) {
          isMounted = false;
          animPhase = "closed";
        } else {
          animPhase = "closing";
          const duration = getTotalAnimationDuration(
            itemsCount,
            "close",
            stagger
          );
          closeTimer = setTimeout(() => {
            isMounted = false;
            animPhase = "closed";
            closeTimer = null;
          }, duration);
        }
      }
    });

    return () => {
      if (openTimer) {
        clearTimeout(openTimer);
        openTimer = null;
      }
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      cancelPendingRafs();
    };
  });

  function isUrl(icon?: string): boolean {
    if (!icon) return false;
    return (
      /^(https?:\/\/|\/|\.\.?\/|data:image\/)/i.test(icon) ||
      /\.(svg|png|jpg|jpeg|webp|gif|ico)$/i.test(icon)
    );
  }

  function handleItemClick(itemId: string, disabled?: boolean) {
    // Items are not interactive until the open animation completes (K2/K7;
    // restored guard — regression from 098f969 removed the pre-open check).
    if (disabled || animPhase !== "open") return;
    onselect(itemId);
  }

  function handleItemMouseEnter(itemId: string, disabled?: boolean) {
    if (disabled || animPhase !== "open") return;
    if (config.trigger === "hover") {
      onselect(itemId);
    }
  }

  function finishItemAnimation(e: AnimationEvent | TransitionEvent, index: number) {
    // Only the item's own open/close motion counts: descendants and the
    // ::after tooltip fade dispatch on/through the button too.
    if (e.target !== e.currentTarget || e.pseudoElement) return;
    if (animPhase === "closing") {
      // The closing wave must finish before the menu unmounts: only the item
      // (or centre pair) scheduled last may complete the close.
      const total = config.items.length;
      if (
        getItemDelay(index, total, "close", stagger) ===
        getMaxItemDelay(total, "close", stagger)
      ) {
        isMounted = false;
        animPhase = "closed";
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = null;
        }
      }
      return;
    }
    if (animPhase === "opening") {
      if (index === config.items.length - 1) {
        animPhase = "open";
        if (openTimer) {
          clearTimeout(openTimer);
          openTimer = null;
        }
      }
    }
  }

  $effect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (!target) return;

      if (
        typeof target.closest === "function" &&
        target.closest("[data-orbitkit-menu-toggle]")
      ) {
        return;
      }

      if (menuEl && !menuEl.contains(target)) {
        onclose();
      }
    }

    const t = setTimeout(() => {
      window.addEventListener("pointerdown", handlePointerDown, true);
    }, 0);

    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (!open) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onclose();
      return;
    }

    if (
      [
        "ArrowDown",
        "ArrowRight",
        "ArrowUp",
        "ArrowLeft",
        "Home",
        "End",
      ].includes(e.key)
    ) {
      if (!menuEl) return;
      const buttons = Array.from(
        menuEl.querySelectorAll<HTMLButtonElement>(
          'button[role="menuitem"]:not(:disabled)'
        )
      );
      if (buttons.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      const activeEl = document.activeElement as HTMLButtonElement | null;
      const currentIndex = activeEl ? buttons.indexOf(activeEl) : -1;

      let nextIndex = 0;
      if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = buttons.length - 1;
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        nextIndex =
          currentIndex === -1 ? 0 : (currentIndex + 1) % buttons.length;
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        nextIndex =
          currentIndex === -1
            ? buttons.length - 1
            : (currentIndex - 1 + buttons.length) % buttons.length;
      }

      buttons[nextIndex]?.focus();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isMounted}
  <div
    bind:this={menuEl}
    class="orbitkit-radial-menu"
    class:no-animation={config.animation === "none"}
    class:animating={animPhase !== "open" && config.animation !== "none"}
    style={containerStyle}
    role="menu"
    tabindex="-1"
    aria-label={label ?? "Radial Menu"}
    data-caption={captionOn ? captionText : undefined}
    onpointerleave={handleCaptionPointerLeave}
    onfocusin={handleCaptionFocusIn}
    onfocusout={handleCaptionFocusOut}
  >
    {#each config.items as item, i (item.id)}
      {@const pos = positions[i] ?? { x: 0, y: 0, angle: 0 }}
      {@const icon = icons[i]}
      {@const tipRad = (pos.angle * Math.PI) / 180}
      {@const animStyle = getItemAnimationStyle(
        i,
        config.items.length,
        animPhase,
        pos,
        config.animation,
        stagger
      )}
      <button
        type="button"
        role="menuitem"
        data-radial-sector={i}
        data-orbitkit-radial-item={item.id}
        class="orbitkit-radial-item"
        class:animating={animPhase !== "open" && config.animation !== "none"}
        disabled={item.disabled}
        aria-disabled={item.disabled}
        aria-label={item.label}
        title={item.label}
        style="left: {pos.x}px; top: {pos.y}px; width: {itemSize}px; height: {itemSize}px; --orbitkit-radial-tip-x: {Math.cos(tipRad).toFixed(3)}; --orbitkit-radial-tip-y: {Math.sin(tipRad).toFixed(3)};{animStyle ? ` ${animStyle};` : ''}"
        onclick={() => handleItemClick(item.id, item.disabled)}
        onmouseenter={() => handleItemMouseEnter(item.id, item.disabled)}
        onpointerenter={() => handleCaptionPointerEnter(item.id, item.disabled)}
        onanimationend={(e) => finishItemAnimation(e, i)}
        ontransitionend={(e) => finishItemAnimation(e, i)}
      >
        <!-- Icon only: a label squeezed into a 44px circle overflowed. The
             label is the button's aria-label (screen readers) and title, and
             the ::after tooltip (content: attr(aria-label)) shows it on
             hover/focus-visible just outside the circle, pointing away from
             the menu centre. -->
        {#if icon}
          {#if icon.kind === "img"}
            <img src={icon.src} alt="" class="orbitkit-radial-icon-img" />
          {:else}
            <span class="orbitkit-radial-icon-text" aria-hidden="true"
              >{icon.text}</span
            >
          {/if}
        {/if}
      </button>
    {/each}
    {#if captionOn}
      <!-- K14: the ONE caption mirror. The span stays empty in the DOM — the
           visible text comes from data-caption via CSS content, and
           aria-hidden keeps it out of role=menu content semantics. -->
      <span
        class="orbitkit-caption {captionArcClass}"
        aria-hidden="true"
        data-caption={captionText}
      ></span>
    {/if}
  </div>
{/if}

<style>
  .orbitkit-radial-menu {
    position: relative;
    width: 0;
    height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  .orbitkit-radial-menu.no-animation {
    animation: none !important;
    transition: none !important;
  }

  .orbitkit-radial-menu.no-animation .orbitkit-radial-item {
    animation: none !important;
    transition: none !important;
  }

  @keyframes -global-orbitkit-radial-item-open {
    0% {
      opacity: 0;
      scale: 0;
      translate: var(--spawn-tx, 0px) var(--spawn-ty, 0px);
    }
    100% {
      opacity: 1;
      scale: 1;
      translate: 0px 0px;
    }
  }

  @keyframes -global-orbitkit-radial-item-close {
    0% {
      opacity: 1;
      scale: 1;
      translate: 0px 0px;
    }
    100% {
      opacity: 0;
      scale: 0;
      translate: var(--spawn-tx, 0px) var(--spawn-ty, 0px);
    }
  }



  .orbitkit-radial-item {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(26, 32, 44, 0.95);
    color: #e2e8f0;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    cursor: pointer;
    user-select: none;
    padding: 2px;
    margin: 0;
    transform: translate(-50%, -50%);
    transition:
      transform 0.15s ease,
      background 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;
    box-sizing: border-box;
  }

  .orbitkit-radial-item.animating {
    pointer-events: none !important;
  }

  .orbitkit-radial-item:hover:not(:disabled),
  .orbitkit-radial-item:focus-visible:not(:disabled) {
    background: rgba(45, 55, 72, 1);
    border-color: rgba(99, 179, 237, 0.8);
    box-shadow: 0 0 10px rgba(99, 179, 237, 0.5);
    transform: translate(-50%, -50%) scale(1.08);
    outline: none;
  }

  .orbitkit-radial-item:active:not(:disabled) {
    transform: translate(-50%, -50%) scale(0.95);
  }

  .orbitkit-radial-item:disabled {
    opacity: 0.38;
    cursor: not-allowed;
  }

  .orbitkit-radial-icon-text {
    font-size: 1.15em;
    line-height: 1;
  }

  .orbitkit-radial-icon-img {
    width: 50%;
    height: 50%;
    object-fit: contain;
    display: block;
    pointer-events: none;
  }

  /* Label tooltip: anchored `gap` outside the circle along the item's
     outward direction (--orbitkit-radial-tip-x/y = cos/sin of its angle,
     set inline), and shifted by the same unit vector × 50% of its own size
     so its near side — not its centre — touches the anchor point. */
  .orbitkit-radial-item::after {
    --orbitkit-radial-tip-gap: 6px;
    content: attr(aria-label);
    position: absolute;
    left: calc(50% + var(--orbitkit-radial-tip-x, 0) * (50% + var(--orbitkit-radial-tip-gap)));
    top: calc(50% + var(--orbitkit-radial-tip-y, -1) * (50% + var(--orbitkit-radial-tip-gap)));
    transform: translate(
      calc(-50% + var(--orbitkit-radial-tip-x, 0) * 50%),
      calc(-50% + var(--orbitkit-radial-tip-y, -1) * 50%)
    );
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(26, 32, 44, 0.95);
    color: #e2e8f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.3;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.12s ease;
  }

  .orbitkit-radial-item:hover::after,
  .orbitkit-radial-item:focus-visible::after {
    opacity: 1;
  }

  /* Lift the active item so its tooltip paints over later siblings. */
  .orbitkit-radial-item:hover,
  .orbitkit-radial-item:focus-visible {
    z-index: 1;
  }

  /* K14: the single caption label — same dark-slate surface as the items.
     Consumer-overridable via .orbitkit-caption; position variants only move
     it (pure CSS, never rendered outside the container). Base placement is
     dead-centre. */
  .orbitkit-caption {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(26, 32, 44, 0.95);
    color: #e2e8f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.3;
    white-space: nowrap;
    pointer-events: none;
    z-index: 2;
  }

  /* K14: the visible text is attr(data-caption) — the span itself stays
     empty so the caption contributes no text content to role=menu. */
  .orbitkit-caption::after {
    content: attr(data-caption);
  }

  /* Top arc: caption below the chord (bottom-centre); bottom arc: mirrored
     above it (top-centre). The 8px offset clears the chord/item rings. */
  .orbitkit-caption-arc-top {
    transform: translate(-50%, 8px);
  }

  .orbitkit-caption-arc-bottom {
    transform: translate(-50%, calc(-100% - 8px));
  }

  /* K14: caption on ⇒ the per-item ::after tooltips are suppressed. The
     container's data-caption attribute (always present when the feature is
     on, empty string included) is the CSS flag. */
  .orbitkit-radial-menu[data-caption] .orbitkit-radial-item::after {
    content: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .orbitkit-radial-menu {
      animation: none !important;
      transition: none !important;
    }
    .orbitkit-radial-item {
      animation: none !important;
      transition: none !important;
    }
    .orbitkit-radial-item::after {
      transition: none !important;
    }
    .orbitkit-radial-item:hover:not(:disabled),
    .orbitkit-radial-item:focus-visible:not(:disabled) {
      transform: translate(-50%, -50%) !important;
    }
  }
</style>
