<script lang="ts">
  import { onMount } from "svelte";
  import {
    Badge,
    Bubble,
    Mascot,
    RadialMenu,
    createDragGesture,
    createMachine,
    createPark,
    createRoam,
    emitMenuAction,
    mascotMonitor,
    onBadge,
    onMascotState,
    onPark,
    roamBounds,
    setBadge,
    startMascotDrag,
    startPassthrough,
    type AnchorRect,
    type MascotStateName,
    type MenuConfig,
    type PassthroughController,
    type ParkHandle,
    type RectEdges,
    type RoamHandle,
  } from "@orbitkit/ui";
  import {
    getCurrentWindow,
    LogicalPosition,
    LogicalSize,
    PhysicalPosition,
  } from "@tauri-apps/api/window";
  import { demoWindowFit, clampFixedWindow } from "../lib/windowFit";
  import {
    gatedMascotState,
    nextBadgeCount,
    parkMenuLabel,
  } from "../lib/demoB2";
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

  // --- demo-b2 wiring --------------------------------------------------------
  const roamCfg = mascotWindowCfg?.roam;
  /** Latest roam velocity (physical px/s); feeds K7 faceByVelocity mirroring. */
  let velocityX = $state(0);
  let bubbleVisible = $state(false);
  let badgeCount = $state(0);
  let parked = $state(false);
  /** Fixed demo bubble copy; every show is a fresh Bubble instance. */
  const BUBBLE_TEXT = "B2 demo: hello from the bubble!";
  let roamHandle: RoamHandle | null = null;
  let parkHandle: ParkHandle | null = null;
  /** K9 monitor payload cache: roam zone + park corner read it synchronously. */
  let monitorCache: Awaited<ReturnType<typeof mascotMonitor>> | null = null;
  /** Mascot window size in physical px, cached once (fixed Design-B window). */
  let physSize = { width: 0, height: 0 };
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
      // demo-b2: the park item label follows the parked state.
      activeMenuConfig = withParkLabel(parked);
      menuOpen = true;
    } else {
      closeMenu(false);
    }
  }

  /** demo-b2: menu copy with the park item label flipped to the live state. */
  function withParkLabel(parkedNow: boolean): MenuConfig {
    return {
      ...config.menu,
      items: config.menu.items.map((item) =>
        item.id === "app.park"
          ? { ...item, label: parkMenuLabel(parkedNow) }
          : item,
      ),
    };
  }

  /** demo-b2: park/unpark toggle through the K8-gated park handle. */
  async function togglePark(): Promise<void> {
    if (!parkHandle) return;
    if (parkHandle.parked) {
      await parkHandle.unpark();
    } else {
      await parkHandle.park();
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
      // demo-b2: demo-side features first; the backend only logs these ids.
      if (id === "app.park") {
        await togglePark();
      } else if (id === "app.bubble") {
        if (parked && parkHandle) {
          // B2.7: while parked the bubble is suppressed and counted into the
          // badge (K8 park gate); the returned boolean is `false` here.
          parkHandle.notify(BUBBLE_TEXT);
        } else {
          bubbleVisible = !bubbleVisible;
        }
      } else if (id === "app.badge") {
        badgeCount = nextBadgeCount(badgeCount);
        await setBadge(badgeCount);
      }
      await emitMenuAction(id);
    } catch (err: unknown) {
      console.error("[MascotView] Failed to emit menu action:", err);
    }
  }

  function handleClose() {
    closeMenu(false);
  }

  // demo-b1 fallback drag model (plain native drag + click-toggle). With the
  // demo-b2 roam block configured, onMount swaps `gesture` for the roam drag
  // binding: the same handler surface but pausing/resuming + re-basing roam
  // around every drag. Handlers read `gesture` at call time.
  let gesture = createDragGesture({
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
    // demo-b2: the roam/park boot must observe the POST-fit window (size and
    // position), so the fit is captured as a promise and awaited below.
    let fitPromise: Promise<void> = Promise.resolve();
    if (fitContentEnabled) {
      fitPromise = applyFixedWindowFit();
      void fitPromise;
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

    // --- demo-b2: roam + drag + park (async boot) ---------------------------
  /**
   * demo-b2: physical-px window adapter shared by roam and park. Coordinates
   * are rounded to integers: Tauri's set_position rejects fractional
   * physical px, which silently froze every roam step (r2 root cause).
   */
  function physWindowAdapter(): {
    outerPosition: () => Promise<{ x: number; y: number }>;
    setPosition: (pos: { x: number; y: number }) => Promise<void>;
  } {
    const win = getCurrentWindow();
    return {
      outerPosition: () => win.outerPosition(),
      setPosition: (pos) =>
        win.setPosition(
          new PhysicalPosition(Math.round(pos.x), Math.round(pos.y)),
        ),
    };
  }


    void (async () => {
      const win = getCurrentWindow();
      // Read monitor + window size only AFTER the one-shot fit so the fixed
      // window's real size (not the pre-fit default) constrains the roam
      // zone and the park corner.
      await fitPromise;
      try {
        const [monitor, size] = await Promise.all([mascotMonitor(), win.outerSize()]);
        monitorCache = monitor;
        physSize = { width: size.width, height: size.height };
      } catch (err: unknown) {
        console.error("[MascotView] demo-b2 monitor/size boot failed:", err);
        return; // no monitor data → no roam zone, no park corner
      }

      if (roamCfg) {
        // Place the window into the roam zone's corner origin BEFORE the
        // loop starts: startRoam adopts the current position, and a position
        // outside the zone (e.g. the boot spot in another corner) would be
        // reflected across the screen by the first stepRoam tick.
        try {
          const zone = roamBounds(
            monitorCache!.workArea,
            monitorCache!.scaleFactor,
            roamCfg,
            physSize,
          );
          await win.setPosition(new PhysicalPosition(zone.x, zone.y));
        } catch (err: unknown) {
          console.error("[MascotView] demo-b2 roam placement failed:", err);
        }
        roamHandle = createRoam({
          getWindow: physWindowAdapter,
          monitor: () => ({
            workArea: monitorCache!.workArea,
            scaleFactor: monitorCache!.scaleFactor,
          }),
          roam: roamCfg,
          windowSize: () => physSize,
          onVelocity: (v) => {
            velocityX = v.x;
          },
          onToggle: () => {
            void toggleMenu();
          },
          onDragStart: async () => {
            await startMascotDrag();
          },
        });
        // Swap the fallback drag model for the roam drag binding: same
        // handler surface, but roam pauses during drags and re-bases the
        // zone around the drop point (K7/K10). The machine for park's K8
        // surface shares the config states.
        gesture = roamHandle.drag.handlers;
        void win
          .onScaleChanged(async () => {
            try {
              monitorCache = await mascotMonitor();
            } catch {
              // keep the previous cache on a failed refresh
            }
          })
          .then((fn) => unlisteners.push(fn));
      }

      parkHandle = createPark({
        roam: roamHandle?.roam ?? { pause() {}, resume() {} },
        // Park's default pauses cursor polling AND forces the window
        // non-interactive — the parked mascot could never be clicked again
        // (no unpark, no gated bubble). The demo overrides the pause only:
        // polling keeps running, the corner-parked mascot stays clickable,
        // and unpark re-enables a paused controller no-op-safe.
        passthrough: {
          setPaused: (value: boolean) => {
            if (!value) passthrough?.setPaused(false);
          },
        },
        machine: createMachine(config.mascot.states ?? {}),
        sleepState: "sleep",
        corner: "bottom-right",
        workArea: () => monitorCache?.workArea ?? { x: 0, y: 0, width: 0, height: 0 },
        getWindow: physWindowAdapter,
        windowSize: () => physSize,
      });
    })();
    // --- demo-b2 boot end ---

    // demo-b2: mirror park's machine forces onto the prop-driven Mascot and
    // flip the park item label (park()/unpark() broadcast orbitkit://park).
    void onPark((payload) => {
      parked = payload.parked;
      mascotState = parked ? "sleep" : "idle";
    }).then((fn) => unlisteners.push(fn));

    // demo-b2 r2: keep the local count in sync with orbitkit://badge so a
    // parked bubble's park-counted badge is honoured by the next "badge +1"
    // (park.ts counts on top of the last observed badge event).
    void onBadge((payload) => {
      badgeCount = payload.count;
    }).then((fn) => unlisteners.push(fn));

    let unlisten: (() => void) | undefined;
    onMascotState((payload) => {
      if (payload && payload.state) {
        // demo-b2 K8 gate: state requests are ignored while parked.
        const next = gatedMascotState(parked, payload.state);
        if (next === null) {
          debugLog("[MascotView] state request ignored while parked:", payload.state);
          return;
        }
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
      roamHandle?.roam.stop();
      void parkHandle?.dispose();
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
        onkeydown={(e) => gesture.onkeydown?.(e)}
      >
        <Mascot config={config.mascot} state={mascotState} velocityX={velocityX} />
      </div>
    </div>

    <!-- demo-b2: speech bubble (menu "bubble" toggles), anchored above the
         mascot; badge (menu "badge +1") at the mascot's top-right. Both sit
         inside .fit-shift so the clamp compensation applies. -->
    {#if bubbleVisible}
      <div class="bubble-anchor">
        <Bubble text={BUBBLE_TEXT} ttlMs={4000} onexpire={() => (bubbleVisible = false)} />
      </div>
    {/if}
    <div class="badge-anchor">
      <Badge listen count={badgeCount} />
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

  /* demo-b2: bubble sits headGap above the mascot's top edge (mascot 96 px
     tall → bottom 96 + 8). Left 0 at the fit-shift pin point (centre). */
  .bubble-anchor {
    position: absolute;
    bottom: 104px;
    left: 0;
    transform: translateX(-50%);
  }

  /* demo-b2: badge pinned to the mascot's top-right corner (half-width 48). */
  .badge-anchor {
    position: absolute;
    bottom: 84px;
    left: 28px;
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
