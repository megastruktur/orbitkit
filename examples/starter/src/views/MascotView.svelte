<script lang="ts">
  import { onMount } from "svelte";
  import {
    Mascot,
    RadialMenu,
    createDragGesture,
    emitMenuAction,
    mascotMonitor,
    onMascotState,
    startMascotDrag,
    startPassthrough,
    type AnchorRect,
    type MascotStateName,
    type MenuConfig,
    type PassthroughController,
    type RectEdges,
  } from "@orbitkit/ui";
  import {
    getCurrentWindow,
    LogicalPosition,
    LogicalSize,
  } from "@tauri-apps/api/window";
  import { demoWindowFit } from "../lib/windowFit";
  import config from "../orbitkit.config";

  // --- demo-b1 wiring --------------------------------------------------------
  const mascotWindowCfg = config.windows.mascotWindow;
  const passthroughEnabled = mascotWindowCfg?.passthrough === true;
  const fitContentEnabled = mascotWindowCfg?.fitContent === true;
  const mascotSize = config.mascot.size; // rendered box = frame * scale (96)
  const menuRadius = config.menu.radius;
  const menuItemSize = config.menu.itemSize ?? 44;
  const headGap = config.menu.arc?.headGap ?? 12;

  /** Horizontal idle padding: the content-fit window keeps transparent strips
   *  beside Glim so the K10 passthrough can be exercised next to the mascot. */
  const IDLE_PAD_X = 24;
  /** Padding grown above + beside the content union while the menu is open.
   *  Never below: the mascot stays exactly bottom-pinned in both states. */
  const MENU_PAD = 8;
  /** Shrink delay after an animated close: stagger closeMs + stepMs*(n-1) =
   *  180 + 40*5 = 380 ms for the 6-item menu. */
  const SHRINK_DELAY_MS = 480;

  let mascotState = $state<MascotStateName>(config.mascot.initialState ?? "idle");
  const isDebug = import.meta.env.VITE_ORBITKIT_DEBUG === "1";
  function debugLog(...args: unknown[]) {
    if (isDebug) {
      console.log(...args);
    }
  }

  let menuOpen = $state<boolean>(false);
  let activeMenuConfig = $state<MenuConfig>(config.menu);
  /** K7 arc-anchor: mascot bounds in window coordinates (post-fit). */
  let anchorRect = $state<AnchorRect | null>(null);
  /** Work-area-clamp compensation translate (logical px); zero unless the
   *  work area forces the window off its ideal position. */
  let contentShift = $state<{ x: number; y: number }>({ x: 0, y: 0 });

  let menuWrapEl: HTMLElement | undefined = $state();
  let mascotEl: HTMLElement | undefined = $state();

  let shrinkTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelShrink(): void {
    if (shrinkTimer) {
      clearTimeout(shrinkTimer);
      shrinkTimer = null;
    }
  }

  /**
   * K9 fitContent, single consistent model (see src/lib/windowFit.ts):
   * the mascot is bottom-centre-pinned by CSS, the window rect is computed so
   * the mascot's screen position never changes across idle/open transitions,
   * and only a work-area clamp produces a compensating content shift.
   */
  async function applyWindowFit(state: "idle" | "open"): Promise<void> {
    const win = getCurrentWindow();
    try {
      const [pos, inner, scale, monitor] = await Promise.all([
        win.outerPosition(),
        win.innerSize(),
        win.scaleFactor(),
        mascotMonitor(),
      ]);
      const wa = monitor.workArea;
      const fit = demoWindowFit(
        {
          window: {
            x: pos.x / scale,
            y: pos.y / scale,
            width: inner.width / scale,
            height: inner.height / scale,
          },
          workArea: {
            x: wa.x / monitor.scaleFactor,
            y: wa.y / monitor.scaleFactor,
            width: wa.width / monitor.scaleFactor,
            height: wa.height / monitor.scaleFactor,
          },
          mascot: mascotSize,
          headGap,
          radius: menuRadius,
          itemSize: menuItemSize,
          idlePadX: IDLE_PAD_X,
          menuPad: MENU_PAD,
        },
        state
      );
      await win.setSize(new LogicalSize(fit.window.width, fit.window.height));
      await win.setPosition(new LogicalPosition(fit.window.x, fit.window.y));
      contentShift = fit.shift;
      // AnchorRect in the NEW window coords (post-shift) so the arc hovers
      // above the mascot exactly as positioned.
      anchorRect = fit.anchor;
    } catch (err: unknown) {
      console.error("[MascotView] window fit failed:", err);
    }
  }

  function scheduleShrink(): void {
    if (!fitContentEnabled) return;
    cancelShrink();
    // Re-fit at the live window position: safe after drags.
    shrinkTimer = setTimeout(() => {
      shrinkTimer = null;
      void applyWindowFit("idle");
    }, SHRINK_DELAY_MS);
  }

  async function toggleMenu() {
    if (!menuOpen) {
      cancelShrink();
      // Fit BEFORE mounting the menu: anchorRect describes the new geometry,
      // so the arc opens in place and the mascot never jumps.
      if (fitContentEnabled) await applyWindowFit("open");
      activeMenuConfig = config.menu;
      menuOpen = true;
    } else {
      closeMenu(false);
    }
  }

  function closeMenu(instant: boolean) {
    if (!menuOpen) return;
    if (instant) {
      activeMenuConfig = { ...config.menu, animation: "none" };
      menuOpen = false;
      if (fitContentEnabled) void applyWindowFit("idle");
    } else {
      menuOpen = false;
      scheduleShrink();
    }
  }

  async function handleSelect(id: string) {
    closeMenu(false);
    try {
      await emitMenuAction(id);
    } catch (err: unknown) {
      console.error("[MascotView] Failed to emit menu action:", err);
    }
  }

  function handleClose() {
    closeMenu(false);
  }

  const gesture = createDragGesture({
    isMenuOpen: () => menuOpen,
    closeMenuInstant: () => closeMenu(true),
    onDragStart: async () => {
      await startMascotDrag();
    },
    onToggle: () => {
      void toggleMenu();
    },
  });

  let passthrough: PassthroughController | null = null;

  /** K10 hit region following the rendered menu discs; empty while closed.
   *  Returns the DOMRects directly: hit regions are RectEdges
   *  ({left,top,right,bottom}), NOT {x,y,width,height}. */
  function menuHitRegion(): RectEdges[] {
    const el = menuWrapEl;
    if (!el) return [];
    return Array.from(
      el.querySelectorAll<Element>(".orbitkit-radial-item")
    ).map((item) => item.getBoundingClientRect());
  }

  onMount(() => {
    if (fitContentEnabled) void applyWindowFit("idle");
    if (passthroughEnabled) {
      passthrough = startPassthrough({
        getWindow: () => getCurrentWindow(),
        isDragging: () => gesture.isDragged,
      });
      if (mascotEl) passthrough.registerHitRegion(mascotEl);
      passthrough.registerHitRegion(menuHitRegion);
    }

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
      passthrough?.stop();
      if (shrinkTimer) clearTimeout(shrinkTimer);
    };
  });
</script>

<svelte:window
  onfocus={() => {
    debugLog("[MascotView:window:focus]");
    gesture.onwindowfocus?.();
  }}
  onblur={() => {
    debugLog("[MascotView:window:blur]");
    // With K10 passthrough a click-away lands on the app underneath, so the
    // window blur is the signal that closes the menu (edges-first wave).
    if (menuOpen) closeMenu(false);
  }}
/>

<div class="mascot-window-root" data-testid="mascot-window">
  <!-- Bottom-centre pin point: the mascot's window-local position is a pure
       function of the window size (never re-centred on resize). The translate
       carries only the work-area clamp compensation. -->
  <div
    class="fit-shift"
    style:transform={`translate(${contentShift.x}px, ${contentShift.y}px)`}
  >
    <div class="mascot-center-anchor">
      <!-- Click mascot toggles menu -->
      <div
        class="mascot-clickable"
        role="button"
        tabindex="0"
        aria-label="OrbitKit Mascot"
        data-orbitkit-menu-toggle
        bind:this={mascotEl}
        onpointerdown={(e) => {
          debugLog("[MascotView:dom:pointerdown]", {
            button: e.button,
            clientX: e.clientX,
            clientY: e.clientY,
          });
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
        <Mascot config={config.mascot} state={mascotState} />
      </div>
    </div>
  </div>

  <!-- K7 arc-anchor: RadialMenu translates its container by the arc origin in
       window coordinates, so the wrapper sits at the window origin. It is
       OUTSIDE .fit-shift because fit.anchor already encodes the shift. -->
  <div class="radial-anchor" bind:this={menuWrapEl}>
    <RadialMenu
      config={activeMenuConfig}
      open={menuOpen}
      {anchorRect}
      onselect={handleSelect}
      onclose={handleClose}
    />
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
    position: relative;
    user-select: none;
    -webkit-user-select: none;
  }

  /* Bottom-centre pin point (see src/lib/windowFit.ts): 0x0 at (50%, 100%);
     the translate is the clamp compensation only. */
  .fit-shift {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 0;
    height: 0;
  }

  .mascot-center-anchor {
    position: absolute;
    bottom: 0;
    left: 0;
    transform: translateX(-50%);
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  /* No hover/active scaling: Glim is an integer-upscaled sprite sheet and any
     interpolation blur is a smoke failure (pixel-crisp idle). */
  .mascot-clickable {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    outline: none;
  }

  .radial-anchor {
    position: fixed;
    top: 0;
    left: 0;
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
