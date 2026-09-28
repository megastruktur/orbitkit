<script lang="ts">
  import type { MascotConfig, MascotStateName } from "./config";
  import { resolveSvgSrc } from "./mascot/svg";
  import { resolveSpriteMetrics } from "./mascot/sprite";
  import { frameAt, sheetFrameStyle, sheetGeometry } from "./mascot/sheets";

  interface Props {
    config: MascotConfig;
    state?: MascotStateName;
    /** K7 (kind="sheets"): sheet name to render. */
    sheet?: string;
    /** K7 (kind="sheets"): horizontal velocity; negative mirrors when faceByVelocity. */
    velocityX?: number;
    onclick?: ((e: MouseEvent) => void) | (() => void);
    onpointerdown?: ((e: PointerEvent) => void) | (() => void);
    ariaLabel?: string;
    reducedMotion?: boolean;
    class?: string;
  }

  let {
    config,
    // Aliased: a scoped `state` binding would shadow the `$state` rune
    // (compiled as a store auto-subscription and rejected at runtime).
    state: stateProp,
    sheet,
    velocityX,
    onclick,
    onpointerdown,
    ariaLabel,
    reducedMotion = false,
    class: customClass = "",
    ...restProps
  }: Props & Record<string, any> = $props();

  // Resolved state: explicit prop -> config.initialState -> "idle"
  const currentState = $derived(stateProp ?? config?.initialState ?? "idle");

  // Effective aria-label
  const effectiveAriaLabel = $derived(
    ariaLabel ?? (restProps["aria-label"] as string | undefined) ?? "OrbitKit mascot"
  );

  // Reduced motion detection
  const prefersReducedMotion = $derived(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const isReducedMotion = $derived(Boolean(reducedMotion || prefersReducedMotion));

  // Resolved size
  const mascotSize = $derived(config?.size ?? 96);
  const rootStyle = $derived(
    `width: ${mascotSize}px; height: ${mascotSize}px; --mascot-size: ${mascotSize}px;`
  );

  // SVG resolution (K3-A3: markup is encoded as data: URL and rendered exclusively in <img>)
  const resolvedSvgSrc = $derived.by(() => {
    if (!config) return "";
    const stateDef = config.states?.[currentState];
    const raw = (stateDef && "src" in stateDef && typeof stateDef.src === "string")
      ? stateDef.src
      : (config.src ?? "");
    return resolveSvgSrc(raw);
  });
  // Image resolution
  const resolvedImgSrc = $derived.by(() => {
    if (!config) return "";
    const stateDef = config.states?.[currentState];
    if (stateDef && "src" in stateDef && typeof stateDef.src === "string") {
      return stateDef.src;
    }
    return config.src ?? "";
  });

  // Sprite resolution
  const spriteMetrics = $derived.by(() => {
    if (!config || config.kind !== "sprite") return null;
    return resolveSpriteMetrics(config, currentState);
  });

  // Sheets resolution (K7 kind="sheets"): named sheet -> first sheet fallback.
  const sheetNames = $derived(
    config?.kind === "sheets" ? Object.keys(config.sheets ?? {}) : [],
  );
  const firstSheet = $derived(sheetNames[0] ?? "");
  const activeSheet = $derived.by(() => {
    if (config?.kind !== "sheets") return "";
    if (!sheet) return firstSheet;
    return sheetNames.includes(sheet) ? sheet : firstSheet;
  });
  const sheetDef = $derived(
    config?.kind === "sheets" && activeSheet ? config.sheets?.[activeSheet] : undefined,
  );
  const sheetGeo = $derived(
    sheetDef ? sheetGeometry(sheetDef, config?.scale, config?.anchor) : undefined,
  );

  $effect(() => {
    if (config?.kind === "sheets" && sheet && !sheetNames.includes(sheet)) {
      console.error(
        `[orbitkit] Mascot: unknown sheet "${sheet}", falling back to "${firstSheet}".`,
      );
    }
  });

  // Hard frame swap driven by frameAt; frozen on frame 0 under reduced motion.
  let sheetFrame = $state(0);
  $effect(() => {
    const def = sheetDef;
    if (!def) return;
    sheetFrame = 0;
    if (isReducedMotion) return;
    const fps = typeof def.fps === "number" && def.fps > 0 ? def.fps : 1;
    const stepMs = Math.max(1, Math.round(1000 / fps));
    let ticks = 0;
    const id = setInterval(() => {
      ticks += 1;
      sheetFrame = frameAt(def, ticks * stepMs);
    }, stepMs);
    return () => clearInterval(id);
  });

  // Horizontal facing: mirror on vx < 0, unmirror on vx > 0, retain otherwise.
  let faceLeft = $state(false);
  $effect(() => {
    if (!config?.faceByVelocity || velocityX == null) return;
    if (velocityX < 0) faceLeft = true;
    else if (velocityX > 0) faceLeft = false;
  });
  const sheetMirrored = $derived(Boolean(config?.faceByVelocity) && faceLeft);
  const sheetStyle = $derived(
    sheetDef && sheetGeo
      ? sheetFrameStyle(sheetDef, sheetGeo, sheetFrame, sheetMirrored)
      : "",
  );

</script>

<button
  type="button"
  class="orbitkit-mascot {isReducedMotion ? 'reduced-motion orbitkit-mascot--reduced-motion' : ''} {customClass}"
  data-state={currentState}
  aria-label={effectiveAriaLabel}
  style={rootStyle}
  {onclick}
  {onpointerdown}
  {...restProps}
>
  {#if config?.kind === "svg"}
    <img
      class="orbitkit-mascot-img orbitkit-mascot__img"
      src={resolvedSvgSrc}
      alt=""
      draggable="false"
    />
  {:else if config?.kind === "image"}
    <img
      class="orbitkit-mascot-img orbitkit-mascot__img"
      src={resolvedImgSrc}
      alt={effectiveAriaLabel}
      draggable="false"
    />
  {:else if config?.kind === "sprite" && spriteMetrics}
    <div
      class="orbitkit-mascot-sprite"
      style={spriteMetrics.style}
      role="presentation"
    ></div>
  {:else if config?.kind === "sheets" && sheetStyle}
    <div
      class="orbitkit-mascot-sheet"
      style={sheetStyle}
      role="presentation"
    ></div>
  {/if}
</button>

<style>
  @keyframes orbitkit-sprite-step {
    from {
      background-position-x: 0px;
    }
    to {
      background-position-x: calc(-1 * var(--frames, var(--sprite-frames, 1)) * var(--frame-width, var(--sprite-frame-width, 100%)));
    }
  }

  .orbitkit-mascot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    user-select: none;
    overflow: hidden;
    position: relative;
    box-sizing: border-box;
    line-height: 0;
  }

  .orbitkit-mascot:focus-visible {
    outline: 2px solid #4f7cff;
    outline-offset: 2px;
  }

  .orbitkit-mascot-img,
  .orbitkit-mascot__img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    pointer-events: none;
  }
  .orbitkit-mascot-sprite {
    width: 100%;
    height: 100%;
    background-repeat: no-repeat;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    animation-name: orbitkit-sprite-step;
    animation-duration: var(--duration, var(--sprite-duration, 1s));
    animation-timing-function: steps(var(--frames, var(--sprite-frames, 1)));
    animation-iteration-count: var(--sprite-loop, infinite);
    animation-fill-mode: var(--sprite-fill-mode, forwards);
    pointer-events: none;
  }

  .orbitkit-mascot-sheet {
    background-repeat: no-repeat;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    pointer-events: none;
  }

  /* prefers-reduced-motion support */
  @media (prefers-reduced-motion: reduce) {
    :global(.orbitkit-mascot),
    .orbitkit-mascot,
    .orbitkit-mascot * {
      animation: none !important;
      transition: none !important;
    }
  }

  .orbitkit-mascot.reduced-motion,
  .orbitkit-mascot.reduced-motion * {
    animation: none !important;
    transition: none !important;
  }
</style>
