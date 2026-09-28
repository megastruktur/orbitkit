<script lang="ts">
  import { onBadge } from "./bridge";

  interface Props {
    /** Unread count; hidden at 0, capped display at `max` with a "+" suffix. */
    count?: number;
    /** Cap before the "+" suffix (default 99). */
    max?: number;
    /**
     * Also subscribe to `orbitkit://badge {count}` events; whichever source
     * changed last wins (a `count` prop change resets prior event counts).
     */
    listen?: boolean;
    /** Override for the default aria-label (the raw count). */
    ariaLabel?: string;
    class?: string;
  }

  let {
    count = 0,
    max = 99,
    listen = false,
    ariaLabel,
    class: customClass = "",
  }: Props = $props();

  // Latest event-delivered count; null while prop-driven.
  let eventCount: number | null = $state(null);

  $effect(() => {
    if (!listen) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    onBadge((payload) => {
      if (!disposed) eventCount = payload.count;
    })
      .then((un) => {
        if (disposed) un();
        else unlisten = un;
      })
      .catch((err) => {
        console.error("[orbitkit] Badge: onBadge subscription failed.", err);
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  });

  // A `count` prop change supersedes any earlier event count ("latest wins").
  $effect(() => {
    void count;
    eventCount = null;
  });

  const effective = $derived(eventCount ?? count);
  const shown = $derived(effective > 0);
  const label = $derived(effective > max ? `${max}+` : String(effective));
  const aria = $derived(ariaLabel ?? String(effective));
</script>

{#if shown}
  <span class="orbitkit-badge {customClass}" aria-label={aria}>{label}</span>
{/if}

<style>
  .orbitkit-badge {
    display: inline-block;
    min-width: 16px;
    padding: 1px 5px;
    border-radius: 999px;
    font: bold 11px/1.3 system-ui, sans-serif;
    text-align: center;
    background: var(--orbitkit-badge-bg, #e5484d);
    color: var(--orbitkit-badge-fg, #ffffff);
  }
</style>
