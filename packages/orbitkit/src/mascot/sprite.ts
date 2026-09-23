import type { MascotConfig, MascotSpriteState, MascotStateName } from "../config";

export interface SpriteMetrics {
  src: string;
  frames: number;
  fps: number;
  row: number;
  loop: boolean;
  frameWidth: number;
  frameHeight: number;
  bgY: number;
  duration: number;
  iterationCount: string;
  fillMode: string;
  style: string;
}

/**
 * Resolves sprite animation properties and CSS variables for a given state.
 */
export function resolveSpriteMetrics(
  config: MascotConfig,
  state: MascotStateName
): SpriteMetrics {
  const stateDef = config.states?.[state];

  let src = config.src;
  if (stateDef && "src" in stateDef && typeof stateDef.src === "string") {
    src = stateDef.src;
  }

  const frameWidth = config.frameWidth ?? config.size ?? 96;
  const frameHeight = config.frameHeight ?? config.size ?? 96;

  let frames = 1;
  let fps = 1;
  let loop = true;
  let row = 0;

  if (stateDef && "frames" in stateDef && typeof stateDef.frames === "number") {
    const s = stateDef as MascotSpriteState;
    frames = Math.max(1, s.frames);
    fps = typeof s.fps === "number" && s.fps > 0 ? s.fps : 1;
    loop = s.loop !== false;
    row = typeof s.row === "number" ? s.row : 0;
  }

  const bgY = -row * frameHeight;
  const duration = frames / fps;
  const iterationCount = loop ? "infinite" : "1";
  const fillMode = loop ? "none" : "forwards";

  const styleParts = [
    `background-image: url('${src}')`,
    `background-position-x: 0px`,
    `background-position-y: ${bgY}px`,
    `--frames: ${frames}`,
    `--fps: ${fps}`,
    `--row: ${row}`,
    `--duration: ${duration}s`,
    `--bg-y: ${bgY}px`,
    `--frame-width: ${frameWidth}px`,
    `--frame-height: ${frameHeight}px`,
    `--sprite-frames: ${frames}`,
    `--sprite-fps: ${fps}`,
    `--sprite-row: ${row}`,
    `--sprite-duration: ${duration}s`,
    `--sprite-bg-y: ${bgY}px`,
    `--sprite-frame-width: ${frameWidth}px`,
    `--sprite-frame-height: ${frameHeight}px`,
    `--sprite-loop: ${iterationCount}`,
  ];

  return {
    src,
    frames,
    fps,
    row,
    loop,
    frameWidth,
    frameHeight,
    bgY,
    duration,
    iterationCount,
    fillMode,
    style: styleParts.join("; "),
  };
}
