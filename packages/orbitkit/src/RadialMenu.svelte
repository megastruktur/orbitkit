<script lang="ts">
  import type { MenuConfig } from "./config";
  import { layoutItems } from "./geometry";

  interface Props {
    config: MenuConfig;
    open: boolean;
    onselect: (id: string) => void;
    onclose: () => void;
  }

  let { config, open, onselect, onclose }: Props = $props();

  let menuEl: HTMLElement | null = $state(null);
  let itemSize = $derived(config.itemSize ?? 44);
  let positions = $derived(
    layoutItems(
      config.items.length,
      config.radius,
      config.startAngle,
      config.endAngle
    )
  );

  function isUrl(icon?: string): boolean {
    if (!icon) return false;
    return (
      /^(https?:\/\/|\/|\.\.?\/|data:image\/)/i.test(icon) ||
      /\.(svg|png|jpg|jpeg|webp|gif|ico)$/i.test(icon)
    );
  }

  function handleItemClick(itemId: string, disabled?: boolean) {
    if (disabled) return;
    onselect(itemId);
  }

  function handleItemMouseEnter(itemId: string, disabled?: boolean) {
    if (config.trigger === "hover" && !disabled) {
      onselect(itemId);
    }
  }


  $effect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (menuEl && target && !menuEl.contains(target)) {
        onclose();
      }
    }

    const t = setTimeout(() => {
      window.addEventListener("pointerdown", handlePointerDown, true);
    });

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

{#if open}
  <div
    bind:this={menuEl}
    class="orbitkit-radial-menu"
    role="menu"
    tabindex="-1"
    aria-label="Radial Menu"
  >
    {#each config.items as item, i (item.id)}
      {@const pos = positions[i] ?? { x: 0, y: 0, angle: 0 }}
      <button
        type="button"
        role="menuitem"
        class="orbitkit-radial-item"
        disabled={item.disabled}
        aria-disabled={item.disabled}
        aria-label={item.label}
        title={item.label}
        style="left: {pos.x}px; top: {pos.y}px; width: {itemSize}px; height: {itemSize}px;"
        onclick={() => handleItemClick(item.id, item.disabled)}
        onmouseenter={() => handleItemMouseEnter(item.id, item.disabled)}
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
    transition:
      opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    animation: orbitkit-radial-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes orbitkit-radial-enter {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
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

  .orbitkit-radial-item:hover:not(:disabled),
  .orbitkit-radial-item:focus-visible:not(:disabled) {
    background: rgba(45, 55, 72, 1);
    border-color: rgba(99, 179, 237, 0.8);
    box-shadow: 0 0 10px rgba(99, 179, 237, 0.5);
    transform: translate(-50%, -50%) scale(1.08);
    outline: none;
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
      transition: none !important;
    }
    .orbitkit-radial-item:hover:not(:disabled),
    .orbitkit-radial-item:focus-visible:not(:disabled) {
      transform: translate(-50%, -50%) !important;
    }
  }
</style>
