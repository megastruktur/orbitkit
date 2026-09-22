<!-- // STUB owned by oks-radial-comp -->
<script lang="ts">
  import type { MenuConfig } from "./config";

  interface Props {
    config: MenuConfig;
    open: boolean;
    onselect?: (id: string) => void;
    onclose?: () => void;
  }

  let { config, open, onselect, onclose }: Props = $props();
</script>

{#if open}
  <div class="orbitkit-radial-menu-stub" role="menu">
    <!-- STUB owned by oks-radial-comp -->
    {#each config.items as item (item.id)}
      <button
        type="button"
        role="menuitem"
        disabled={item.disabled}
        onclick={() => onselect?.(item.id)}
      >
        {item.label}
      </button>
    {/each}
    <button type="button" onclick={() => onclose?.()}>Close</button>
  </div>
{/if}
