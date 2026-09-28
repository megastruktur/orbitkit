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
  import { demoWindowFit, clampFixedWindow } from "../lib/windowFit";
  import config from "../orbitkit.config";

  // --- demo-b1 wiring --------------------------------------------------------
  const mascotWindowCfg = config.windows.mascotWindow;
  const passthroughEnabled = mascotWindowCfg?.passthrough === true;
  const fitContentEnabled = mascotWindowCfg?.fitContent === true;
  const mascotSize = config.mascot.size; // rendered box = frame * scale (96)
  const menuRadius = config.menu.radius;
  const menuItemSize = config.menu.itemSize ?? 44;
  const headGap = config.menu.arc?.headGap ?? 12;

  /** Padding grown above + beside the open-menu content union; the fixed
   *  Design-B window is sized once from this union. Never below: the mascot
   *  stays exactly bottom-pinned inside the fixed window. */
  const MENU_PAD = 8;
  /** Settle delay before a post-drag/monitor-change one-shot re-clamp. Must
   *  exceed the gesture's dragClearDelay (400 ms) so a native drag is fully
   *  finished (and not merely paused) before the clamp may move the window. */
  const SETTLE_DELAY_MS = 500;

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

  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelSettle(): void {
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
  }

  /**
   * K9 fitContent under Design B (see src/lib/windowFit.ts): applied ONCE at
   * boot. Sizes and positions the window to the fixed open-menu content rect
   * (mascot screen position preserved), records the work-area clamp
   * compensation and the — from then on constant — arc anchor. Menu
   * open/close never calls this: transitions are content-only.
   */
  async function applyFixedWindowFit(): Promise<void> {
    const win = getCurrentWindow();
    try {
      const [pos, inner, scale, monitor] = await Promise.all([
        win.outerPosition(),
        win.innerSize(),
        win.scaleFactor(),
        mascotMonitor(),
      ]);
      const wa = monitor.workArea;
      const fit = demoWindowFit({
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
        menuPad: MENU_PAD,
      });
      await win.setSize(new LogicalSize(fit.window.width, fit.window.height));
      await win.setPosition(new LogicalPosition(fit.window.x, fit.window.y));
      contentShift = fit.shift;
      // AnchorRect in the fixed window coords (post-shift); constant across
      // open/close because the window never changes again.
      anchorRect = fit.anchor;
    } catch (err: unknown) {
      console.error("[MascotView] fixed window fit failed:", err);
    }
  }

  /**
   * One-shot work-area re-clamp after a native drag or a monitor/scale
   * change (never on menu open/close, and skipped while the menu is open):
   * moves the WINDOW (setPosition only) so the fixed rect is fully inside
   * the work area. The mascot is pinned at its constant window-local
   * position and moves with the window — the accepted behaviour near edges.
   * contentShift/anchorRect are boot-constant and are deliberately NOT
   * touched here (a shift update desyncs the arc anchor from the mascot and
   * accumulates across drags).
   */
  async function reClampWindow(): Promise<void> {
    if (menuOpen) return;
    const win = getCurrentWindow();
    try {
      const [pos, inner, scale, monitor] = await Promise.all([
        win.outerPosition(),
        win.innerSize(),
        win.scaleFactor(),
        mascotMonitor(),
      ]);
      const wa = monitor.workArea;
      const clamped = clampFixedWindow(
        {
          x: pos.x / scale,
          y: pos.y / scale,
          width: inner.width / scale,
          height: inner.height / scale,
        },
        {
          x: wa.x / monitor.scaleFactor,
          y: wa.y / monitor.scaleFactor,
          width: wa.width / monitor.scaleFactor,
          height: wa.height / monitor.scaleFactor,
        }
      );
      if (clamped.x === pos.x / scale && clamped.y === pos.y / scale) return;
      await win.setPosition(new LogicalPosition(clamped.x, clamped.y));
    } catch (err: unknown) {
      console.error("[MascotView] window re-clamp failed:", err);
    }
  }

  /** Debounced settle: resets on every window move/scale event, so during a
   *  native drag (continuous moves) it only fires after the LAST move — the
   *  drop. A mid-drag pause is skipped via the gesture's dragged flag. */
  function scheduleReClamp(): void {
    if (!fitContentEnabled) return;
    cancelSettle();
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (gesture.isDragged) return;
      void reClampWindow();
    }, SETTLE_DELAY_MS);
  }

  async function toggleMenu() {
    // Design B: content-only transition. The fixed window already fits the
    // open menu; no setSize/setPosition on either path (no compositor
    // size/origin race, no mascot blink).
    if (!menuOpen) {
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
    }
    // The RadialMenu plays its close wave inside the fixed transparent
    // window; the window itself never moves or resizes.
    menuOpen = false;
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
    const unlisteners: Array<() => void> = [];
    if (fitContentEnabled) {
      void applyFixedWindowFit();
      const win = getCurrentWindow();
      // Post-drag / monitor-change one-shot re-clamp (Design B: clamped ONCE
      // at a settle point, never per menu toggle).
      void win.onMoved(() => scheduleReClamp()).then((fn) => unlisteners.push(fn));
      void win.onScaleChanged(() => scheduleReClamp()).then((fn) => unlisteners.push(fn));
    }
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
      for (const fn of unlisteners) {
        try {
          fn();
        } catch {
          // window may already be gone during teardown
        }
      }
      if (unlisten) unlisten();
      passthrough?.stop();
      cancelSettle();
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
          // Native drag can swallow the terminating events; on pointerup we
          // can still schedule the one-shot settle re-clamp.
          scheduleReClamp();
        }}
        onpointercancel={() => {
          debugLog("[MascotView:dom:pointercancel]");
          gesture.onpointercancel();
          scheduleReClamp();
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

  /* No hover/active scaling: the planet is an integer-upscaled sprite sheet and any
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
