<script lang="ts">
  import { untrack } from "svelte";
  import type { MenuConfig } from "./config";
  import { layoutItems, resolveMenuAngles } from "./geometry";
  import {
    type MenuAnimPhase,
    getItemAnimationStyle,
    getTotalAnimationDuration,
  } from "./menuAnimation";

  interface Props {
    config: MenuConfig;
    open: boolean;
    onselect: (id: string) => void;
    onclose: () => void;
  }

  let { config, open, onselect, onclose }: Props = $props();

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

  function checkReducedMotion(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  let isMounted = $state(false);
  let animPhase = $state<MenuAnimPhase>("closed");

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
              const duration = getTotalAnimationDuration(itemsCount, "open");
              openTimer = setTimeout(() => {
                animPhase = "open";
                openTimer = null;
              }, duration);
            });
          });
        }
      } else {
        if (!isMounted) {
          animPhase = "closed";
          return;
        }
        if (isAnimDisabled || itemsCount === 0) {
          isMounted = false;
          animPhase = "closed";
        } else {
          animPhase = "closing";
          const duration = getTotalAnimationDuration(itemsCount, "close");
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
    if (disabled) return;
    if (
      animPhase !== "open" &&
      config.animation !== "none" &&
      !checkReducedMotion()
    ) {
      return;
    }
    onselect(itemId);
  }

  function handleItemMouseEnter(itemId: string, disabled?: boolean) {
    if (
      animPhase !== "open" &&
      config.animation !== "none" &&
      !checkReducedMotion()
    ) {
      return;
    }
    if (config.trigger === "hover" && !disabled) {
      onselect(itemId);
    }
  }

  function handleItemAnimationEnd(e: AnimationEvent, index: number) {
    if (e.target !== e.currentTarget) return;
    if (animPhase === "closing") {
      if (index === 0) {
        isMounted = false;
        animPhase = "closed";
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = null;
        }
      }
    } else if (animPhase === "opening") {
      if (index === config.items.length - 1) {
        animPhase = "open";
        if (openTimer) {
          clearTimeout(openTimer);
          openTimer = null;
        }
      }
    }
  }

  function handleItemTransitionEnd(e: TransitionEvent, index: number) {
    if (e.target !== e.currentTarget) return;
    if (animPhase === "closing") {
      if (index === 0) {
        isMounted = false;
        animPhase = "closed";
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = null;
        }
      }
    } else if (animPhase === "opening") {
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
    style={config.animation === "none"
      ? "animation: none !important; transition: none !important;"
      : undefined}
    role="menu"
    tabindex="-1"
    aria-label="Radial Menu"
  >
    {#each config.items as item, i (item.id)}
      {@const pos = positions[i] ?? { x: 0, y: 0, angle: 0 }}
      {@const animStyle = getItemAnimationStyle(
        i,
        config.items.length,
        animPhase,
        pos,
        config.animation
      )}
      <button
        type="button"
        role="menuitem"
        class="orbitkit-radial-item"
        class:animating={animPhase !== "open" && config.animation !== "none"}
        disabled={item.disabled}
        aria-disabled={item.disabled}
        aria-label={item.label}
        title={item.label}
        style="left: {pos.x}px; top: {pos.y}px; width: {itemSize}px; height: {itemSize}px;{animStyle ? ` ${animStyle};` : ''}"
        onclick={() => handleItemClick(item.id, item.disabled)}
        onmouseenter={() => handleItemMouseEnter(item.id, item.disabled)}
        onanimationend={(e) => handleItemAnimationEnd(e, i)}
        ontransitionend={(e) => handleItemTransitionEnd(e, i)}
      >
        {#if item.icon}
          {#if isUrl(item.icon)}
            <img src={item.icon} alt="" class="orbitkit-radial-icon-img" />
          {:else}
            <span class="orbitkit-radial-icon-text" aria-hidden="true"
              >{item.icon}</span
            >
          {/if}
        {/if}
        <span class="orbitkit-radial-label">{item.label}</span>
      </button>
    {/each}
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
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
    pointer-events: none;
  }

  .orbitkit-radial-label {
    font-size: 9px;
    font-weight: 500;
    line-height: 1.1;
    max-width: 90%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
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
    .orbitkit-radial-item:hover:not(:disabled),
    .orbitkit-radial-item:focus-visible:not(:disabled) {
      transform: translate(-50%, -50%) !important;
    }
  }
</style>
