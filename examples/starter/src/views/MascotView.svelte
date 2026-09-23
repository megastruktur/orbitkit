<script lang="ts">
  import { onMount } from "svelte";
  import {
    Mascot,
    RadialMenu,
    emitMenuAction,
    onMascotState,
    type MascotStateName,
  } from "@orbitkit/ui";
  import config from "../orbitkit.config";

  let mascotState = $state<MascotStateName>(config.mascot.initialState ?? "idle");
  let menuOpen = $state<boolean>(false);

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

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

<div class="mascot-window-root" data-testid="mascot-window">
  <div class="mascot-center-anchor">
    <!-- Click mascot toggles menu -->
    <div class="mascot-clickable">
      <Mascot
        config={config.mascot}
        state={mascotState}
        onclick={toggleMenu}
      />
    </div>

    <!-- Radial menu anchored to the center of the mascot -->
    <div class="radial-anchor">
      <RadialMenu
        config={config.menu}
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
    transition: transform 0.15s ease;
  }

  .mascot-clickable:hover {
    transform: scale(1.05);
  }

  .mascot-clickable:active {
    transform: scale(0.95);
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
</style>
