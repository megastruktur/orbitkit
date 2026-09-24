<script lang="ts">
  import { onMount } from "svelte";
  import {
    Mascot,
    RadialMenu,
    createDragGesture,
    emitMenuAction,
    onMascotState,
    startMascotDrag,
    type MascotStateName,
    type MenuConfig,
  } from "@orbitkit/ui";
  import config from "../orbitkit.config";

  let mascotState = $state<MascotStateName>(config.mascot.initialState ?? "idle");
  const isDebug = import.meta.env.VITE_ORBITKIT_DEBUG === "1";
  function debugLog(...args: unknown[]) {
    if (isDebug) {
      console.log(...args);
    }
  }

  let menuOpen = $state<boolean>(false);
  let activeMenuConfig = $state<MenuConfig>(config.menu);

  function toggleMenu() {
    activeMenuConfig = config.menu;
    menuOpen = !menuOpen;
  }

  const gesture = createDragGesture({
    isMenuOpen: () => menuOpen,
    closeMenuInstant: () => {
      activeMenuConfig = { ...config.menu, animation: "none" };
      menuOpen = false;
    },
    onDragStart: async () => {
      await startMascotDrag();
    },
    onToggle: toggleMenu,
  });
  async function handleSelect(id: string) {
    menuOpen = false;
    try {
      await emitMenuAction(id);
    } catch (err: unknown) {
      console.error("[MascotView] Failed to emit menu action:", err);
    }
  }

  function handleClose() {
    menuOpen = false;
  }

  onMount(() => {
    let unlisten: (() => void) | undefined;
    onMascotState((payload) => {
      if (payload && payload.state) {
        mascotState = payload.state;
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  });
</script>
<svelte:window
  onfocus={() => {
    debugLog("[MascotView:window:focus]");
    gesture.onwindowfocus?.();
  }}
  onblur={() => debugLog("[MascotView:window:blur]")}
/>


<div class="mascot-window-root" data-testid="mascot-window">
  <div class="mascot-center-anchor">
    <!-- Click mascot toggles menu -->
    <div
      class="mascot-clickable"
      class:busy={mascotState === "busy"}
      role="button"
      tabindex="0"
      aria-label="OrbitKit Mascot"
      data-orbitkit-menu-toggle
      onpointerdown={(e) => {
        debugLog("[MascotView:dom:pointerdown]", { button: e.button, clientX: e.clientX, clientY: e.clientY });
        gesture.onpointerdown(e);
      }}
      onpointermove={gesture.onpointermove}
      onpointerup={(e) => {
        debugLog("[MascotView:dom:pointerup]", { button: e.button });
        gesture.onpointerup(e);
      }}
      onpointercancel={() => {
        debugLog("[MascotView:dom:pointercancel]");
        gesture.onpointercancel();
      }}
      onclick={(e) => {
        debugLog("[MascotView:dom:click]", { menuOpenBefore: menuOpen });
        gesture.onclick(e);
        debugLog("[MascotView:dom:click:done]", { menuOpenAfter: menuOpen });
      }}
      onkeydown={gesture.onkeydown}
    >
      <Mascot
        config={config.mascot}
        state={mascotState}
      />
    </div>

    <!-- Radial menu anchored to the center of the mascot -->
    <div class="radial-anchor">
      <RadialMenu
        config={activeMenuConfig}
        open={menuOpen}
        onselect={handleSelect}
        onclose={handleClose}
      />
    </div>
  </div>
</div>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent !important;
  }

  .mascot-window-root {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
  }

  .mascot-center-anchor {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mascot-clickable {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    outline: none;
  }

  .mascot-clickable :global(.orbitkit-mascot) {
    border-radius: 50%;
  }

  .mascot-clickable :global(.orbitkit-mascot-img) {
    border-radius: 50%;
    transition: filter 0.2s ease;
    filter: drop-shadow(0 0 14px rgba(56, 189, 248, 0.35));
  }

  .mascot-clickable.busy :global(.orbitkit-mascot-img) {
    filter: drop-shadow(0 0 14px rgba(245, 158, 11, 0.45));
  }

  .mascot-clickable:hover {
    transform: scale(1.06);
  }

  .mascot-clickable:hover :global(.orbitkit-mascot-img) {
    filter: drop-shadow(0 0 14px rgba(56, 189, 248, 0.65));
  }

  .mascot-clickable.busy:hover :global(.orbitkit-mascot-img) {
    filter: drop-shadow(0 0 14px rgba(245, 158, 11, 0.7));
  }

  .mascot-clickable:active {
    transform: scale(0.96);
  }

  .radial-anchor {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .radial-anchor :global(*) {
    pointer-events: auto;
  }

  /* Radial item discs: glass disc (#0E1433 @ 85%), cyan 1.5px ring, icon centred, hover/focus glow; tooltip = label (title attr) on desktop */
  :global(.orbitkit-radial-item) {
    background: rgba(14, 20, 51, 0.85) !important;
    border: 1.5px solid #38bdf8 !important;
    border-radius: 50% !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 10px rgba(56, 189, 248, 0.2) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    cursor: pointer !important;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 0.2s ease,
                border-color 0.2s ease,
                background-color 0.2s ease !important;
  }

  :global(.orbitkit-radial-item:hover:not(:disabled)),
  :global(.orbitkit-radial-item:focus-visible:not(:disabled)) {
    background: rgba(14, 20, 51, 0.95) !important;
    border-color: #38bdf8 !important;
    box-shadow: 0 0 20px rgba(56, 189, 248, 0.75), 0 0 8px #38bdf8 !important;
    transform: translate(-50%, -50%) scale(1.12) !important;
    outline: none !important;
  }

  :global(.orbitkit-radial-item:active:not(:disabled)) {
    transform: translate(-50%, -50%) scale(0.96) !important;
  }

  :global(.orbitkit-radial-icon-img) {
    width: 24px !important;
    height: 24px !important;
    object-fit: contain !important;
    display: block !important;
    margin: 0 auto !important;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  :global(.orbitkit-radial-label) {
    display: none !important; /* Hide text label; tooltip provided by title={item.label} */
  }
</style>
