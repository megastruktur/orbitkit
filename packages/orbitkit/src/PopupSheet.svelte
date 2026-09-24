<script lang="ts">
  import { tick, type Component } from "svelte";
  import { fade, fly } from "svelte/transition";
  import {
    closePopup,
    onPopupClose,
    onPopupOpen,
    type PopupClosePayload,
    type PopupOpenPayload,
  } from "./bridge";

  interface Props {
    components: Record<string, Component<any>>;
    fallback?: Component<any>;
    reducedMotion?: boolean;
    class?: string;
  }

  let {
    components,
    fallback,
    reducedMotion = false,
    class: customClass = "",
  }: Props = $props();

  let currentPopup = $state<PopupOpenPayload | null>(null);
  let sheetCardEl = $state<HTMLElement | null>(null);
  let previousActiveElement: HTMLElement | null = null;

  const prefersReducedMotion = $derived(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const isReducedMotion = $derived(Boolean(reducedMotion || prefersReducedMotion));
  const animationDuration = $derived(isReducedMotion ? 0 : 180);

  const ActiveComponent = $derived(
    currentPopup && currentPopup.id in components
      ? components[currentPopup.id]
      : null
  );

  function openSheet(payload: PopupOpenPayload) {
    const isReplacing = currentPopup !== null;
    if (!currentPopup && typeof document !== "undefined") {
      previousActiveElement = document.activeElement as HTMLElement | null;
    }

    currentPopup = payload;

    if (typeof window !== "undefined" && window.history) {
      if (isReplacing && typeof window.history.replaceState === "function") {
        window.history.replaceState({ orbitkitPopup: payload.id }, "");
      } else if (!isReplacing && typeof window.history.pushState === "function") {
        window.history.pushState({ orbitkitPopup: payload.id }, "");
      }
    }
    tick().then(() => {
      sheetCardEl?.focus();
    });
  }

  function closeSheet(fromPopState = false, notifyBridge = true) {
    if (!currentPopup) return;
    const id = currentPopup.id;

    if (!fromPopState && typeof window !== "undefined" && window.history) {
      if (
        window.history.state &&
        typeof window.history.state === "object" &&
        "orbitkitPopup" in window.history.state
      ) {
        window.history.back();
      }
    }

    if (notifyBridge) {
      closePopup(id).catch(() => {});
    }

    currentPopup = null;
    if (previousActiveElement && typeof previousActiveElement.focus === "function") {
      try {
        previousActiveElement.focus();
      } catch {
        // Ignore focus errors
      }
    }
    previousActiveElement = null;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeSheet(false, true);
    }
  }

  function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = 'a[href], button, input, select, textarea, [tabindex]';
    return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (el) =>
        !el.hasAttribute("disabled") &&
        el.getAttribute("aria-hidden") !== "true" &&
        el.tabIndex >= 0
    );
  }

  function handleTabKey(e: KeyboardEvent) {
    if (!sheetCardEl) return;
    const focusables = getFocusableElements(sheetCardEl);
    if (focusables.length === 0) {
      e.preventDefault();
      sheetCardEl.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    if (e.shiftKey) {
      if (
        active === first ||
        active === sheetCardEl ||
        !active ||
        !sheetCardEl.contains(active)
      ) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (
        active === last ||
        active === sheetCardEl ||
        !active ||
        !sheetCardEl.contains(active)
      ) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!currentPopup) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      closeSheet(false, true);
      return;
    }
    if (e.key === "Tab") {
      handleTabKey(e);
    }
  }

  $effect(() => {
    let active = true;
    let unlistenOpen: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;

    onPopupOpen((payload: PopupOpenPayload) => {
      if (!active) return;
      openSheet(payload);
    }).then((fn) => {
      if (!active) {
        fn();
      } else {
        unlistenOpen = fn;
      }
    });

    onPopupClose((payload: PopupClosePayload) => {
      if (!active) return;
      if (currentPopup && currentPopup.id === payload.id) {
        closeSheet(false, false);
      }
    });

    function handlePopState(_e: PopStateEvent) {
      if (!active) return;
      if (currentPopup) {
        closeSheet(true, true);
      }
    }

    function handleTestOpen(e: Event) {
      if (!active) return;
      const detail = (e as CustomEvent<PopupOpenPayload>).detail;
      if (detail) {
        openSheet(detail);
      }
    }

    function handleTestClose(e: Event) {
      if (!active) return;
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      if (!detail?.id || (currentPopup && currentPopup.id === detail.id)) {
        closeSheet(false, false);
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("popstate", handlePopState);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("orbitkit:test-popup-open", handleTestOpen);
      window.addEventListener("orbitkit:test-popup-close", handleTestClose);
    }

    return () => {
      active = false;
      unlistenOpen?.();
      unlistenClose?.();
      if (typeof window !== "undefined") {
        window.removeEventListener("popstate", handlePopState);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("orbitkit:test-popup-open", handleTestOpen);
        window.removeEventListener("orbitkit:test-popup-close", handleTestClose);
      }
    };
  });
</script>

{#if currentPopup}
  <div
    class="orbitkit-popup-sheet-backdrop {customClass}"
    transition:fade={{ duration: animationDuration }}
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      bind:this={sheetCardEl}
      class="orbitkit-popup-sheet-card"
      transition:fly={{ y: 20, duration: animationDuration }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="orbitkit-popup-sheet-title"
      tabindex="-1"
      style="width: min({currentPopup.width}px, calc(100vw - 24px)); height: min({currentPopup.height}px, 85vh);"
    >
      <header class="orbitkit-popup-sheet-header">
        <h2 id="orbitkit-popup-sheet-title" class="orbitkit-popup-sheet-title">
          {currentPopup.title}
        </h2>
        <button
          type="button"
          class="orbitkit-popup-sheet-close"
          aria-label="Close"
          onclick={() => closeSheet(false, true)}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      <div class="orbitkit-popup-sheet-content">
        {#if ActiveComponent}
          {@const Active = ActiveComponent}
          <Active />
        {:else if fallback}
          {@const Fallback = fallback}
          <Fallback id={currentPopup.id} />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .orbitkit-popup-sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(7, 11, 26, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    box-sizing: border-box;
  }

  .orbitkit-popup-sheet-card {
    position: relative;
    background: rgba(14, 20, 51, 0.92);
    border: 1.5px solid #38bdf8;
    border-radius: 16px;
    box-shadow:
      0 0 0 1px rgba(56, 189, 248, 0.25),
      0 20px 40px rgba(0, 0, 0, 0.7);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #e6f6ff;
    outline: none;
  }

  .orbitkit-popup-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid rgba(56, 189, 248, 0.2);
    background: rgba(14, 20, 51, 0.95);
    flex-shrink: 0;
  }

  .orbitkit-popup-sheet-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #e6f6ff;
    letter-spacing: 0.01em;
  }

  .orbitkit-popup-sheet-close {
    background: transparent;
    border: 1px solid rgba(56, 189, 248, 0.25);
    color: #9fb3d9;
    border-radius: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    cursor: pointer;
    transition:
      background 120ms ease,
      color 120ms ease,
      border-color 120ms ease;
    padding: 0;
    line-height: 1;
  }

  .orbitkit-popup-sheet-close:hover {
    background: rgba(56, 189, 248, 0.15);
    color: #e6f6ff;
    border-color: #38bdf8;
  }

  .orbitkit-popup-sheet-close:focus-visible {
    outline: 2px solid #38bdf8;
    outline-offset: 2px;
  }

  .orbitkit-popup-sheet-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  @media (prefers-reduced-motion: reduce) {
    .orbitkit-popup-sheet-backdrop,
    .orbitkit-popup-sheet-card {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
