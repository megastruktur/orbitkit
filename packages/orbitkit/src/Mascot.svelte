<script lang="ts">
  import type { MascotConfig, MascotStateName } from "./config";
  import { resolveSvgSrc } from "./mascot/svg";
  import { resolveSpriteMetrics } from "./mascot/sprite";

  interface Props {
    config: MascotConfig;
    state?: MascotStateName;
    onclick?: ((e: MouseEvent) => void) | (() => void);
    onpointerdown?: ((e: PointerEvent) => void) | (() => void);
    ariaLabel?: string;
    reducedMotion?: boolean;
    class?: string;
  }

  let {
    config,
    state,
    onclick,
    onpointerdown,
    ariaLabel,
    reducedMotion = false,
    class: customClass = "",
    ...restProps
  }: Props & Record<string, any> = $props();

  // Resolved state: explicit prop -> config.initialState -> "idle"
  const currentState = $derived(state ?? config?.initialState ?? "idle");

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
