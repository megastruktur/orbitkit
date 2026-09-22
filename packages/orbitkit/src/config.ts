// K2 typed config schema and helpers

export type MascotStateName = "idle" | "active" | "busy" | "attention" | string;

export interface MascotSpriteState {
  frames: number;
  fps: number;
  loop?: boolean;
  row?: number;
}

export interface MascotConfig {
  kind: "svg" | "image" | "sprite";
  src: string;
  size: number;
  frameWidth?: number;
  frameHeight?: number;
  states?: Record<MascotStateName, MascotSpriteState | { src: string }>;
  initialState?: MascotStateName;
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

export interface MenuConfig {
  items: MenuItem[];
  radius: number;
  startAngle: number;
  endAngle: number;
  itemSize?: number;
  trigger?: "click" | "hover";
}

export interface PopupConfig {
  id: string;
  url: string;
  title: string;
  width: number;
  height: number;
  resizable?: boolean;
  alwaysOnTop?: boolean;
}

export interface WindowsConfig {
  mascotWindow?: {
    transparent: boolean;
    alwaysOnTop: boolean;
    decorations: boolean;
    x?: number;
    y?: number;
  };
  popups: PopupConfig[];
}

export interface OrbitKitConfig {
  mascot: MascotConfig;
  menu: MenuConfig;
  windows: WindowsConfig;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

export const MENU_ITEM_ID_REGEX = /^[a-z0-9][a-z0-9_-]{0,31}$/;

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
  };

  const menu: MenuConfig = {
    items: menuInput?.items ? (menuInput.items as MenuItem[]).map((item) => ({ ...item })) : [],
    radius: menuInput?.radius ?? 96,
    startAngle: menuInput?.startAngle ?? -90,
    endAngle: menuInput?.endAngle ?? 270,
    itemSize: menuInput?.itemSize ?? 44,
    trigger: menuInput?.trigger ?? "click",
  };

  const windows: WindowsConfig = {
    popups: windowsInput?.popups ? (windowsInput.popups as PopupConfig[]).map((popup) => ({ ...popup })) : [],
    ...(windowsInput?.mascotWindow
      ? { mascotWindow: { ...(windowsInput.mascotWindow as NonNullable<WindowsConfig["mascotWindow"]>) } }
      : {}),
  };

  return { mascot, menu, windows };
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

    if (mascot.kind !== "svg" && mascot.kind !== "image" && mascot.kind !== "sprite") {
      errors.push("mascot.kind: must be 'svg', 'image', or 'sprite'");
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

    if (mascot.initialState !== undefined && typeof mascot.initialState !== "string") {
      errors.push("mascot.initialState: must be a string");
    }

    if (
      mascot.states !== undefined &&
      (typeof mascot.states !== "object" || mascot.states === null || Array.isArray(mascot.states))
    ) {
      errors.push("mascot.states: must be an object");
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
            errors.push(`menu.items[${index}].id: must match ^[a-z0-9][a-z0-9_-]{0,31}$`);
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

        if (rawItem.icon !== undefined && typeof rawItem.icon !== "string") {
          errors.push(`menu.items[${index}].icon: must be a string`);
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
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, config: c as OrbitKitConfig };
}
