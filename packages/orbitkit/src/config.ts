import { resolveMenuAngles } from "./geometry.js";

// K2 typed config schema and helpers

export type MascotStateName = "idle" | "active" | "busy" | "attention" | string;

export interface MascotSpriteState {
  frames: number;
  fps: number;
  loop?: boolean;
  row?: number;
}

export type MascotKind = "svg" | "image" | "sprite" | "sheets";

/** K7: one sprite-sheet animation definition (kind="sheets"). */
export interface MascotSheetDef {
  src: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  fps: number;
  loop?: boolean;
}

/** K7: anchor within the mascot window (sheets kind). */
export type MascotAnchor = "bottom-center" | "center";

/** K7 (kind="sheets"): state pool definition. */
export interface MascotPoolState {
  pool: string[];
  priority?: number;
  ttlMs?: number;
}

export type MascotStateDefinition =
  | MascotSpriteState
  | { src: string }
  | MascotPoolState;

export interface MascotConfig {
  kind: MascotKind;
  src: string;
  size: number;
  frameWidth?: number;
  frameHeight?: number;
  states?: Record<MascotStateName, MascotStateDefinition>;
  initialState?: MascotStateName;
  /** K7 (kind="sheets"): sheet definitions by name. */
  sheets?: Record<string, MascotSheetDef>;
  /** K7 (kind="sheets"): integer upscale factor, default 1. */
  scale?: number;
  /** K7 (kind="sheets"): default "bottom-center". */
  anchor?: MascotAnchor;
  /** K7 (kind="sheets"): mirror sheet horizontally when vx < 0, default false. */
  faceByVelocity?: boolean;
  /**
   * kind="sheets" render engine: "css" (default) draws the active frame as a
   * background-position div; "canvas" blits it with integer `drawImage` calls
   * on a device-pixel-ratio-scaled `<canvas>`.
   */
  renderer?: "canvas" | "css";
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: string | MenuItemIconSvg;
  disabled?: boolean;
}

/** K7: inline SVG icon variant. */
export interface MenuItemIconSvg {
  svg: string;
}

export type MenuLayout = "orbit" | "arc" | "arc-anchor";
export type MenuArcPosition = "top" | "bottom" | "left" | "right";
export type MenuAnimation = "spawn" | "none";

export interface MenuArcConfig {
  position?: MenuArcPosition;
  span?: number;
  /** K7 (layout "arc-anchor"): gap in px above mascot's top edge, default 12. */
  headGap?: number;
}

/** K7: per-item open/close stagger timing. */
export interface MenuStaggerConfig {
  openMs: number;
  closeMs: number;
  stepMs: number;
}

export interface MenuConfig {
  items: MenuItem[];
  radius: number;
  startAngle: number;
  endAngle: number;
  itemSize?: number;
  trigger?: "click" | "hover";
  layout?: MenuLayout;
  arc?: MenuArcConfig;
  animation?: MenuAnimation;
  /** K7: defaults 260/180/40. */
  stagger?: MenuStaggerConfig;
}

export type PopupAnchor = "mascot" | "center" | "none";

export interface PopupConfig {
  id: string;
  url: string;
  title: string;
  width: number;
  height: number;
  resizable?: boolean;
  alwaysOnTop?: boolean;
  /** K11: popup placement anchor, default "none". */
  anchor?: PopupAnchor;
  decorations?: boolean;
  transparent?: boolean;
  skipTaskbar?: boolean;
  minWidth?: number;
  minHeight?: number;
}

/** K7: mascot window roam behaviour. */
export type MascotRoamCorner =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

/**
 * K7: roam motion constraint. `"2d"` (default) roams and bounces in both
 * axes; `"horizontal"` locks the motion to the X axis (`vy = 0`, floor
 * pets); `"vertical"` locks it to the Y axis (`vx = 0`, wall crawlers).
 */
export type MascotRoamAxis = "2d" | "horizontal" | "vertical";

export interface MascotRoamConfig {
  width: number;
  height: number;
  margin: number;
  corner: MascotRoamCorner;
  speed: number;
  /** Motion constraint, default `"2d"`. */
  axis?: MascotRoamAxis;
}

export interface MascotWindowConfig {
  transparent: boolean;
  alwaysOnTop: boolean;
  decorations: boolean;
  x?: number;
  y?: number;
  /** K7: window label, default "orbitkit-mascot". */
  label?: string;
  /** K7: window URL, default "index.html?orbitkit=mascot". */
  url?: string;
  /** K10: click-through outside hit regions, default false. */
  passthrough?: boolean;
  /** K7: roam behaviour. */
  roam?: MascotRoamConfig;
  /** K7: size window to content, default false. */
  fitContent?: boolean;
}

/** K11: app-level popup/origin settings. */
export interface AppConfig {
  allowedOrigins?: string[];
}

export interface WindowsConfig {
  mascotWindow?: MascotWindowConfig;
  popups: PopupConfig[];
}

export interface OrbitKitConfig {
  mascot: MascotConfig;
  menu: MenuConfig;
  windows: WindowsConfig;
  /** K11: app-level settings. */
  app?: AppConfig;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

/** K7: menu item id pattern — identical in TS and Rust (config.rs). */
export const MENU_ITEM_ID_REGEX = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;

// K7 defaults (frozen contract values; consumed by feature tasks).
export const DEFAULT_MASCOT_SCALE = 1;
export const DEFAULT_MASCOT_ANCHOR: MascotAnchor = "bottom-center";
export const DEFAULT_FACE_BY_VELOCITY = false;
export const DEFAULT_ARC_HEAD_GAP = 12;
export const DEFAULT_STAGGER: MenuStaggerConfig = {
  openMs: 260,
  closeMs: 180,
  stepMs: 40,
};
export const DEFAULT_MASCOT_WINDOW_LABEL = "orbitkit-mascot";
export const DEFAULT_MASCOT_WINDOW_URL = "index.html?orbitkit=mascot";
export const DEFAULT_PASSTHROUGH = false;
export const DEFAULT_FIT_CONTENT = false;
export const DEFAULT_POPUP_ANCHOR: PopupAnchor = "none";

export function defineConfig(c: OrbitKitConfig): OrbitKitConfig {
  return c;
}

export function withDefaults(c: DeepPartial<OrbitKitConfig>): OrbitKitConfig {
  const mascotInput = c?.mascot;
  const menuInput = c?.menu;
  const windowsInput = c?.windows;

  const mascot: MascotConfig = {
    kind: (mascotInput?.kind as MascotConfig["kind"]) ?? "svg",
    src: mascotInput?.src ?? "",
    size: mascotInput?.size ?? 96,
    initialState: mascotInput?.initialState ?? "idle",
    ...(mascotInput?.frameWidth !== undefined ? { frameWidth: mascotInput.frameWidth } : {}),
    ...(mascotInput?.frameHeight !== undefined ? { frameHeight: mascotInput.frameHeight } : {}),
    ...(mascotInput?.states !== undefined ? { states: mascotInput.states as MascotConfig["states"] } : {}),
    ...(mascotInput?.sheets !== undefined
      ? { sheets: mascotInput.sheets as MascotConfig["sheets"] }
      : {}),
    scale: mascotInput?.scale ?? DEFAULT_MASCOT_SCALE,
    anchor: mascotInput?.anchor ?? DEFAULT_MASCOT_ANCHOR,
    faceByVelocity: mascotInput?.faceByVelocity ?? DEFAULT_FACE_BY_VELOCITY,
  };

  const layout = menuInput?.layout ?? "orbit";
  let startAngle = menuInput?.startAngle ?? -90;
  let endAngle = menuInput?.endAngle ?? 270;
  let arc: MenuArcConfig | undefined = undefined;

  if (menuInput?.arc !== undefined) {
    arc = {
      position: (menuInput.arc.position as MenuArcPosition) ?? "top",
      span: menuInput.arc.span ?? 180,
      headGap: menuInput.arc.headGap ?? DEFAULT_ARC_HEAD_GAP,
    };
  } else if (layout === "arc") {
    arc = {
      position: "top",
      span: 180,
      headGap: DEFAULT_ARC_HEAD_GAP,
    };
  } else if (layout === "arc-anchor") {
    arc = {
      headGap: DEFAULT_ARC_HEAD_GAP,
    };
  }

  if (layout === "arc") {
    const resolved = resolveMenuAngles({ layout: "arc", arc });
    startAngle = resolved.startAngle;
    endAngle = resolved.endAngle;
  }

  const menu: MenuConfig = {
    items: menuInput?.items ? (menuInput.items as MenuItem[]).map((item) => ({ ...item })) : [],
    radius: menuInput?.radius ?? 96,
    startAngle,
    endAngle,
    itemSize: menuInput?.itemSize ?? 44,
    trigger: menuInput?.trigger ?? "click",
    animation: (menuInput?.animation as MenuAnimation) ?? "spawn",
    stagger: {
      openMs: menuInput?.stagger?.openMs ?? DEFAULT_STAGGER.openMs,
      closeMs: menuInput?.stagger?.closeMs ?? DEFAULT_STAGGER.closeMs,
      stepMs: menuInput?.stagger?.stepMs ?? DEFAULT_STAGGER.stepMs,
    },
    ...(menuInput?.layout !== undefined ? { layout: menuInput.layout as MenuConfig["layout"] } : {}),
    ...(arc !== undefined ? { arc } : {}),
  };

  const windows: WindowsConfig = {
    popups: windowsInput?.popups
      ? (windowsInput.popups as PopupConfig[]).map((popup) => ({
          ...popup,
          anchor: popup.anchor ?? DEFAULT_POPUP_ANCHOR,
        }))
      : [],
    ...(windowsInput?.mascotWindow
      ? {
          mascotWindow: {
            ...(windowsInput.mascotWindow as NonNullable<WindowsConfig["mascotWindow"]>),
            label:
              (windowsInput.mascotWindow as NonNullable<WindowsConfig["mascotWindow"]>).label ??
              DEFAULT_MASCOT_WINDOW_LABEL,
            url:
              (windowsInput.mascotWindow as NonNullable<WindowsConfig["mascotWindow"]>).url ??
              DEFAULT_MASCOT_WINDOW_URL,
            passthrough:
              (windowsInput.mascotWindow as NonNullable<WindowsConfig["mascotWindow"]>)
                .passthrough ?? DEFAULT_PASSTHROUGH,
            fitContent:
              (windowsInput.mascotWindow as NonNullable<WindowsConfig["mascotWindow"]>)
                .fitContent ?? DEFAULT_FIT_CONTENT,
          },
        }
      : {}),
  };

  return {
    mascot,
    menu,
    windows,
    ...(c?.app !== undefined
      ? { app: { ...(c.app?.allowedOrigins !== undefined ? { allowedOrigins: [...(c.app.allowedOrigins as string[])] } : {}) } }
      : {}),
  };
}

export type ValidationResult =
  | { ok: true; config: OrbitKitConfig }
  | { ok: false; errors: string[] };

export function validateConfig(c: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof c !== "object" || c === null || Array.isArray(c)) {
    return { ok: false, errors: ["config: must be an object"] };
  }

  const raw = c as Record<string, unknown>;

  // Mascot validation
  if (typeof raw.mascot !== "object" || raw.mascot === null || Array.isArray(raw.mascot)) {
    errors.push("mascot: is required and must be an object");
  } else {
    const mascot = raw.mascot as Record<string, unknown>;

    if (mascot.kind !== "svg" && mascot.kind !== "image" && mascot.kind !== "sprite" && mascot.kind !== "sheets") {
      errors.push("mascot.kind: must be 'svg', 'image', 'sprite', or 'sheets'");
    }

    if (typeof mascot.src !== "string" || mascot.src.trim() === "") {
      errors.push("mascot.src: must be a non-empty string");
    }

    if (typeof mascot.size !== "number" || Number.isNaN(mascot.size) || mascot.size <= 0) {
      errors.push("mascot.size: must be a positive number");
    }

    if (mascot.kind === "sprite") {
      if (typeof mascot.frameWidth !== "number" || Number.isNaN(mascot.frameWidth) || mascot.frameWidth <= 0) {
        errors.push("mascot.frameWidth: required positive number for sprite kind");
      }
      if (typeof mascot.frameHeight !== "number" || Number.isNaN(mascot.frameHeight) || mascot.frameHeight <= 0) {
        errors.push("mascot.frameHeight: required positive number for sprite kind");
      }
    }

    // K7: sheets-kind mascot
    if (mascot.kind === "sheets") {
      if (typeof mascot.sheets !== "object" || mascot.sheets === null || Array.isArray(mascot.sheets)) {
        errors.push("mascot.sheets: required object when kind is 'sheets'");
      } else {
        for (const [name, sheet] of Object.entries(mascot.sheets as Record<string, unknown>)) {
          if (typeof sheet !== "object" || sheet === null || Array.isArray(sheet)) {
            errors.push(`mascot.sheets['${name}']: must be an object`);
            continue;
          }
          const s = sheet as Record<string, unknown>;
          if (typeof s.src !== "string" || s.src.trim() === "") {
            errors.push(`mascot.sheets['${name}'].src: must be a non-empty string`);
          }
          for (const dim of ["frameWidth", "frameHeight", "frames"] as const) {
            if (typeof s[dim] !== "number" || Number.isNaN(s[dim]) || s[dim] <= 0) {
              errors.push(`mascot.sheets['${name}'].${dim}: must be a positive number`);
            }
          }
          if (typeof s.fps !== "number" || Number.isNaN(s.fps) || s.fps <= 0) {
            errors.push(`mascot.sheets['${name}'].fps: must be a positive number`);
          }
          if (s.loop !== undefined && typeof s.loop !== "boolean") {
            errors.push(`mascot.sheets['${name}'].loop: must be a boolean`);
          }
        }
      }
    }

    if (
      mascot.scale !== undefined &&
      (typeof mascot.scale !== "number" || !Number.isInteger(mascot.scale) || mascot.scale < 1)
    ) {
      errors.push("mascot.scale: must be an integer >= 1");
    }

    if (mascot.anchor !== undefined && mascot.anchor !== "bottom-center" && mascot.anchor !== "center") {
      errors.push("mascot.anchor: must be 'bottom-center' or 'center'");
    }

    if (mascot.faceByVelocity !== undefined && typeof mascot.faceByVelocity !== "boolean") {
      errors.push("mascot.faceByVelocity: must be a boolean");
    }

    if (mascot.initialState !== undefined && typeof mascot.initialState !== "string") {
      errors.push("mascot.initialState: must be a string");
    }

    if (
      mascot.states !== undefined &&
      (typeof mascot.states !== "object" || mascot.states === null || Array.isArray(mascot.states))
    ) {
      errors.push("mascot.states: must be an object");
    } else if (mascot.states !== undefined) {
      for (const [name, state] of Object.entries(mascot.states as Record<string, unknown>)) {
        if (typeof state !== "object" || state === null || Array.isArray(state)) {
          errors.push(`mascot.states['${name}']: must be an object`);
          continue;
        }
        const st = state as Record<string, unknown>;
        // K7: pool variant (kind="sheets")
        if (st.pool !== undefined) {
          if (
            !Array.isArray(st.pool) ||
            st.pool.length === 0 ||
            st.pool.some((p) => typeof p !== "string" || p.trim() === "")
          ) {
            errors.push(`mascot.states['${name}'].pool: must be a non-empty array of non-empty strings`);
          }
          if (st.priority !== undefined && (typeof st.priority !== "number" || Number.isNaN(st.priority))) {
            errors.push(`mascot.states['${name}'].priority: must be a number`);
          }
          if (
            st.ttlMs !== undefined &&
            (typeof st.ttlMs !== "number" || Number.isNaN(st.ttlMs) || st.ttlMs <= 0)
          ) {
            errors.push(`mascot.states['${name}'].ttlMs: must be a positive number`);
          }
        }
      }
    }
  }

  // Menu validation
  if (typeof raw.menu !== "object" || raw.menu === null || Array.isArray(raw.menu)) {
    errors.push("menu: is required and must be an object");
  } else {
    const menu = raw.menu as Record<string, unknown>;

    if (!Array.isArray(menu.items)) {
      errors.push("menu.items: must be an array");
    } else {
      if (menu.items.length < 1 || menu.items.length > 12) {
        errors.push(`menu.items: item count must be between 1 and 12 (got ${menu.items.length})`);
      }

      const seenItemIds = new Set<string>();
      menu.items.forEach((item, index) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          errors.push(`menu.items[${index}]: must be an object`);
          return;
        }

        const rawItem = item as Record<string, unknown>;

        if (typeof rawItem.id !== "string") {
          errors.push(`menu.items[${index}].id: must be a string`);
        } else {
          if (!MENU_ITEM_ID_REGEX.test(rawItem.id)) {
            errors.push(`menu.items[${index}].id: must match ^[a-z0-9][a-z0-9_.:-]{0,63}$`);
          }
          if (seenItemIds.has(rawItem.id)) {
            errors.push(`menu.items[${index}].id: duplicate id '${rawItem.id}'`);
          } else {
            seenItemIds.add(rawItem.id);
          }
        }

        if (typeof rawItem.label !== "string" || rawItem.label.trim() === "") {
          errors.push(`menu.items[${index}].label: must be a non-empty string`);
        }

        // K7: icon may be a URL/data-URL string or inline { svg: string }
        if (rawItem.icon !== undefined) {
          const isValidIcon =
            typeof rawItem.icon === "string" ||
            (typeof rawItem.icon === "object" &&
              rawItem.icon !== null &&
              !Array.isArray(rawItem.icon) &&
              typeof (rawItem.icon as Record<string, unknown>).svg === "string" &&
              ((rawItem.icon as Record<string, unknown>).svg as string).trim() !== "");
          if (!isValidIcon) {
            errors.push(`menu.items[${index}].icon: must be a string or { svg: string }`);
          }
        }

        if (rawItem.disabled !== undefined && typeof rawItem.disabled !== "boolean") {
          errors.push(`menu.items[${index}].disabled: must be a boolean`);
        }
      });
    }

    if (typeof menu.radius !== "number" || Number.isNaN(menu.radius) || menu.radius <= 0) {
      errors.push("menu.radius: must be a positive number");
    }

    if (typeof menu.startAngle !== "number" || Number.isNaN(menu.startAngle)) {
      errors.push("menu.startAngle: must be a number");
    }

    if (typeof menu.endAngle !== "number" || Number.isNaN(menu.endAngle)) {
      errors.push("menu.endAngle: must be a number");
    }

    if (
      menu.itemSize !== undefined &&
      (typeof menu.itemSize !== "number" || Number.isNaN(menu.itemSize) || menu.itemSize <= 0)
    ) {
      errors.push("menu.itemSize: must be a positive number");
    }

    if (menu.trigger !== undefined && menu.trigger !== "click" && menu.trigger !== "hover") {
      errors.push("menu.trigger: must be 'click' or 'hover'");
    }

    if (
      menu.layout !== undefined &&
      menu.layout !== "orbit" &&
      menu.layout !== "arc" &&
      menu.layout !== "arc-anchor"
    ) {
      errors.push("menu.layout: must be 'orbit', 'arc', or 'arc-anchor'");
    }

    if (menu.arc !== undefined) {
      if (typeof menu.arc !== "object" || menu.arc === null || Array.isArray(menu.arc)) {
        errors.push("menu.arc: must be an object");
      } else {
        const arc = menu.arc as Record<string, unknown>;
        if (
          arc.position !== undefined &&
          arc.position !== "top" &&
          arc.position !== "bottom" &&
          arc.position !== "left" &&
          arc.position !== "right"
        ) {
          errors.push("menu.arc.position: must be 'top', 'bottom', 'left', or 'right'");
        }
        if (
          arc.span !== undefined &&
          (typeof arc.span !== "number" || Number.isNaN(arc.span) || arc.span < 30 || arc.span > 300)
        ) {
          errors.push("menu.arc.span: must be between 30 and 300");
        }
        // K7 (layout "arc-anchor")
        if (
          arc.headGap !== undefined &&
          (typeof arc.headGap !== "number" || Number.isNaN(arc.headGap) || arc.headGap < 0)
        ) {
          errors.push("menu.arc.headGap: must be a number >= 0");
        }
      }
    }

    // K7: stagger timing
    if (menu.stagger !== undefined) {
      if (typeof menu.stagger !== "object" || menu.stagger === null || Array.isArray(menu.stagger)) {
        errors.push("menu.stagger: must be an object");
      } else {
        const stagger = menu.stagger as Record<string, unknown>;
        for (const field of ["openMs", "closeMs", "stepMs"] as const) {
          if (
            typeof stagger[field] !== "number" ||
            Number.isNaN(stagger[field]) ||
            stagger[field] < 0
          ) {
            errors.push(`menu.stagger.${field}: must be a number >= 0`);
          }
        }
      }
    }

    if (menu.animation !== undefined && menu.animation !== "spawn" && menu.animation !== "none") {
      errors.push("menu.animation: must be one of spawn, none");
    }
  }

  // Windows validation
  if (typeof raw.windows !== "object" || raw.windows === null || Array.isArray(raw.windows)) {
    errors.push("windows: is required and must be an object");
  } else {
    const windows = raw.windows as Record<string, unknown>;

    if (!Array.isArray(windows.popups)) {
      errors.push("windows.popups: must be an array");
    } else {
      const seenPopupIds = new Set<string>();
      windows.popups.forEach((popup, index) => {
        if (typeof popup !== "object" || popup === null || Array.isArray(popup)) {
          errors.push(`windows.popups[${index}]: must be an object`);
          return;
        }

        const rawPopup = popup as Record<string, unknown>;

        if (typeof rawPopup.id !== "string" || rawPopup.id.trim() === "") {
          errors.push(`windows.popups[${index}].id: must be a non-empty string`);
        } else {
          if (seenPopupIds.has(rawPopup.id)) {
            errors.push(`windows.popups[${index}].id: duplicate id '${rawPopup.id}'`);
          } else {
            seenPopupIds.add(rawPopup.id);
          }
        }

        if (typeof rawPopup.url !== "string" || rawPopup.url.trim() === "") {
          errors.push(`windows.popups[${index}].url: must be a non-empty string`);
        }

        if (typeof rawPopup.title !== "string") {
          errors.push(`windows.popups[${index}].title: must be a string`);
        }

        if (typeof rawPopup.width !== "number" || Number.isNaN(rawPopup.width) || rawPopup.width <= 0) {
          errors.push(`windows.popups[${index}].width: must be a positive number`);
        }

        if (typeof rawPopup.height !== "number" || Number.isNaN(rawPopup.height) || rawPopup.height <= 0) {
          errors.push(`windows.popups[${index}].height: must be a positive number`);
        }

        if (rawPopup.resizable !== undefined && typeof rawPopup.resizable !== "boolean") {
          errors.push(`windows.popups[${index}].resizable: must be a boolean`);
        }

        if (rawPopup.alwaysOnTop !== undefined && typeof rawPopup.alwaysOnTop !== "boolean") {
          errors.push(`windows.popups[${index}].alwaysOnTop: must be a boolean`);
        }

        // K11: popup anchor
        if (
          rawPopup.anchor !== undefined &&
          rawPopup.anchor !== "mascot" &&
          rawPopup.anchor !== "center" &&
          rawPopup.anchor !== "none"
        ) {
          errors.push(`windows.popups[${index}].anchor: must be 'mascot', 'center', or 'none'`);
        }

        for (const flag of ["decorations", "transparent", "skipTaskbar"] as const) {
          if (rawPopup[flag] !== undefined && typeof rawPopup[flag] !== "boolean") {
            errors.push(`windows.popups[${index}].${flag}: must be a boolean`);
          }
        }

        for (const dim of ["minWidth", "minHeight"] as const) {
          if (
            rawPopup[dim] !== undefined &&
            (typeof rawPopup[dim] !== "number" || Number.isNaN(rawPopup[dim]) || rawPopup[dim] <= 0)
          ) {
            errors.push(`windows.popups[${index}].${dim}: must be a positive number`);
          }
        }
      });
    }

    if (windows.mascotWindow !== undefined) {
      if (
        typeof windows.mascotWindow !== "object" ||
        windows.mascotWindow === null ||
        Array.isArray(windows.mascotWindow)
      ) {
        errors.push("windows.mascotWindow: must be an object");
      } else {
        const mw = windows.mascotWindow as Record<string, unknown>;
        if (typeof mw.transparent !== "boolean") {
          errors.push("windows.mascotWindow.transparent: must be a boolean");
        }
        if (typeof mw.alwaysOnTop !== "boolean") {
          errors.push("windows.mascotWindow.alwaysOnTop: must be a boolean");
        }
        if (typeof mw.decorations !== "boolean") {
          errors.push("windows.mascotWindow.decorations: must be a boolean");
        }
        if (mw.x !== undefined && (typeof mw.x !== "number" || Number.isNaN(mw.x))) {
          errors.push("windows.mascotWindow.x: must be a number");
        }
        if (mw.y !== undefined && (typeof mw.y !== "number" || Number.isNaN(mw.y))) {
          errors.push("windows.mascotWindow.y: must be a number");
        }
        // K7: window identity defaults
        if (mw.label !== undefined && (typeof mw.label !== "string" || mw.label.trim() === "")) {
          errors.push("windows.mascotWindow.label: must be a non-empty string");
        }
        if (mw.url !== undefined && (typeof mw.url !== "string" || mw.url.trim() === "")) {
          errors.push("windows.mascotWindow.url: must be a non-empty string");
        }
        // K10: passthrough
        if (mw.passthrough !== undefined && typeof mw.passthrough !== "boolean") {
          errors.push("windows.mascotWindow.passthrough: must be a boolean");
        }
        if (mw.fitContent !== undefined && typeof mw.fitContent !== "boolean") {
          errors.push("windows.mascotWindow.fitContent: must be a boolean");
        }
        // K7: roam behaviour
        if (mw.roam !== undefined) {
          if (typeof mw.roam !== "object" || mw.roam === null || Array.isArray(mw.roam)) {
            errors.push("windows.mascotWindow.roam: must be an object");
          } else {
            const roam = mw.roam as Record<string, unknown>;
            for (const dim of ["width", "height", "margin", "speed"] as const) {
              if (
                typeof roam[dim] !== "number" ||
                Number.isNaN(roam[dim]) ||
                roam[dim] <= 0
              ) {
                errors.push(`windows.mascotWindow.roam.${dim}: must be a positive number`);
              }
            }
            if (
              roam.corner !== "bottom-right" &&
              roam.corner !== "bottom-left" &&
              roam.corner !== "top-right" &&
              roam.corner !== "top-left"
            ) {
              errors.push(
                "windows.mascotWindow.roam.corner: must be 'bottom-right', 'bottom-left', 'top-right', or 'top-left'"
              );
            }
          }
        }
      }
    }
  }

  // K11: app-level settings
  if (raw.app !== undefined) {
    if (typeof raw.app !== "object" || raw.app === null || Array.isArray(raw.app)) {
      errors.push("app: must be an object");
    } else {
      const app = raw.app as Record<string, unknown>;
      if (app.allowedOrigins !== undefined) {
        if (!Array.isArray(app.allowedOrigins)) {
          errors.push("app.allowedOrigins: must be an array of strings");
        } else if (app.allowedOrigins.some((o) => typeof o !== "string" || o.trim() === "")) {
          errors.push("app.allowedOrigins: must be an array of non-empty strings");
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, config: c as OrbitKitConfig };
}
