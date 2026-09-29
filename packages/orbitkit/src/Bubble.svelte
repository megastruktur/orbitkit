<script module lang="ts">
  /** Notification severity; maps to `orbitkit-bubble--{severity}` CSS classes. */
  export type BubbleSeverity = "info" | "warning" | "error";
</script>

<script lang="ts">
  import type { LogicalRect } from "./windowFit";

  interface Props {
    /** Notification text (all copy comes from the consumer; i18n is theirs). */
    text: string;
    severity?: BubbleSeverity;
    /** Time-to-live in ms. Omit for a sticky bubble that only closes on re-render. */
    ttlMs?: number;
    onclick?: (e: MouseEvent) => void;
    /** Fired once when the bubble expires after `ttlMs` (hover-paused, not click). */
    onexpire?: () => void;
    /**
     * Bindable window-local logical rect (K9 `LogicalRect`, CSS px) so callers
     * can feed `fitWindow` alongside the mascot rect. `null` while hidden.
     */
    rect?: LogicalRect | null;
    /** Alternative to `bind:rect`: change callback (null = bubble hidden). */
    onrectchange?: (rect: LogicalRect | null) => void;
    class?: string;
  }

  let {
    text,
    severity = "info",
    ttlMs,
    onclick,
    onexpire,
    rect = $bindable(null),
    onrectchange,
    class: customClass = "",
  }: Props = $props();

  let bubbleEl: HTMLDivElement | null = $state(null);
  // Hidden permanently after expiry; a `text` change re-shows (new notification).
  let visible = $state(true);

  // Local dedupe copy: keeps the $effect below free of `rect` dependencies so
  // re-measuring cannot feed back into itself.
  let lastRect: LogicalRect | null = null;

  function publish(next: LogicalRect | null): void {
    rect = next;
    onrectchange?.(next);
  }

  function measure(): void {
    const el = bubbleEl;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const next: LogicalRect = {
      x: b.left,
      y: b.top,
      width: b.width,
      height: b.height,
    };
    const prev = lastRect;
    if (
      prev !== null &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.width === next.width &&
      prev.height === next.height
    ) {
      return;
    }
    lastRect = next;
    publish(next);
  }

  function hide(): void {
    visible = false;
    lastRect = null;
    publish(null);
  }

  // Measure on mount, on content change, and on size changes (ResizeObserver
  // where available; jsdom has none).
  $effect(() => {
    void text;
    const el = bubbleEl;
    if (!el) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  });

  function clearTimer(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function startTimer(ms: number): void {
    timerId = setTimeout(() => {
      timerId = null;
      hide();
      onexpire?.();
    }, ms);
  }

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let deadline = 0;
  let remaining = 0;

  // TTL restarts on mount and whenever `text` changes (a new notification gets
  // a full window). Hovering pauses; leaving resumes with the remainder.
  // Timer callbacks fire outside the effect, so no untrack is needed.
  $effect(() => {
    void text;
    const ttl = ttlMs;
    clearTimer();
    if (ttl == null) {
      remaining = 0;
      deadline = 0;
      visible = true;
      return;
    }
    visible = true;
    remaining = ttl;
    deadline = Date.now() + ttl;
    startTimer(ttl);
    return clearTimer;
  });

  function onPointerEnter(): void {
    if (ttlMs == null || timerId === null) return;
    clearTimer();
    remaining = Math.max(0, deadline - Date.now());
  }

  function onPointerLeave(): void {
    if (ttlMs == null || timerId !== null || !visible) return;
    deadline = Date.now() + remaining;
    startTimer(remaining);
  }
</script>

{#if visible}
  <div
    bind:this={bubbleEl}
    class="orbitkit-bubble orbitkit-bubble--{severity} {customClass}"
    role={severity === "error" ? "alert" : "status"}
    onclick={onclick}
    onpointerenter={onPointerEnter}
    onpointerleave={onPointerLeave}
  >
    {text}
  </div>
{/if}

<style>
  .orbitkit-bubble {
    box-sizing: border-box;
    padding: 6px 10px;
    border-radius: 10px;
    font: 13px/1.35 system-ui, sans-serif;
    background: var(--orbitkit-bubble-bg, #ffffff);
    color: var(--orbitkit-bubble-fg, #1f2430);
    border: 1px solid var(--orbitkit-bubble-border, #d6dbe3);
    box-shadow: 0 2px 10px rgb(0 0 0 / 0.18);
    max-width: 240px;
  }

  .orbitkit-bubble--info {
    --orbitkit-bubble-border: var(--orbitkit-info, #7ba7d7);
  }

  .orbitkit-bubble--warning {
    --orbitkit-bubble-border: var(--orbitkit-warning, #d7a24b);
  }

  .orbitkit-bubble--error {
    --orbitkit-bubble-border: var(--orbitkit-error, #d76c6c);
  }
</style>
