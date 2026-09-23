# OrbitKit Configuration Reference

OrbitKit uses a unified configuration schema (`OrbitKitConfig`, defined in Contract K2) shared between the TypeScript frontend (`@orbitkit/ui`) and the Rust plugin (`tauri-plugin-orbitkit`).

---

## 1. Top-Level Structure

`OrbitKitConfig` comprises three top-level sections:

```ts
export interface OrbitKitConfig {
  mascot: MascotConfig;
  menu: MenuConfig;
  windows: WindowsConfig;
}
```

```json
{
  "mascot": { ... },
  "menu": { ... },
  "windows": { ... }
}
```

---

## 2. Field Specifications

### 2.1 Mascot Configuration (`mascot`)

Configures visual representation, dimensions, and state-driven animations for the floating mascot.

| Field | Type | Default | Required | Validation & Description |
|---|---|---|---|---|
| `kind` | `"svg" \| "image" \| "sprite"` | `"svg"` | **Yes** | Must be one of the three literal kinds. |
| `src` | `string` | `""` | **Yes** | Non-empty string. For `"svg"`, can be inline `<svg>...</svg>` markup or an image URL. For `"image"` and `"sprite"`, must be a path or URL. |
| `size` | `number` | `96` | **Yes** | Positive number (pixels). Bounding size for width and height. |
| `frameWidth` | `number` | `undefined` | Required if `kind === "sprite"` | Positive number (pixels). Width of an individual frame in the sprite sheet. |
| `frameHeight` | `number` | `undefined` | Required if `kind === "sprite"` | Positive number (pixels). Height of an individual frame in the sprite sheet. |
| `initialState` | `string` | `"idle"` | No | Initial state name when the mascot mounts. |
| `states` | `Record<string, MascotSpriteState \| { src: string }>` | `undefined` | No | Map of state names to state definitions (see below). |

#### State Definitions (`mascot.states`)

- **For `"svg"` or `"image"` kinds**:
  `{ src: string }` overrides the source image/markup when that state is active.
- **For `"sprite"` kind** (`MascotSpriteState`):
  | Field | Type | Default | Description |
  |---|---|---|---|
  | `frames` | `number` | `1` | Total frame count in the horizontal strip for this state. |
  | `fps` | `number` | `1` | Frames per second playback rate. Must be > 0. |
  | `loop` | `boolean` | `true` | When `true`, loops indefinitely. When `false`, halts on the final frame. |
  | `row` | `number` | `0` | Zero-indexed row number on a multi-row sprite sheet. |

---

### 2.2 Menu Configuration (`menu`)

Configures the radial or arc action menu that appears around the mascot.

| Field | Type | Default | Required | Validation & Description |
|---|---|---|---|---|
| `items` | `MenuItem[]` | `[]` | **Yes** | Array of 1 to 12 menu items. Item IDs must be unique. |
| `radius` | `number` | `96` | **Yes** | Positive number (pixels). Distance from mascot center to menu items. |
| `startAngle` | `number` | `-90` | **Yes** | Angle in degrees (0 = right, 90 = bottom, clockwise screen coordinates). Default `-90` is top. |
| `endAngle` | `number` | `270` | **Yes** | Ending angle in degrees. `-90` to `270` produces a complete 360-degree circle. |
| `itemSize` | `number` | `44` | No | Positive number (pixels). Width and height of each radial button. |
| `trigger` | `"click" \| "hover"` | `"click"` | No | Interaction model that activates a menu item. |
| `layout` | `"orbit" \| "arc"` | `"orbit"` | No | Layout geometry: `"orbit"` (full ring or manual angles) or `"arc"` (side arc). |
| `arc` | `MenuArcConfig` | `{ position: "top", span: 180 }` | No | Configures arc side and span when `layout: "arc"`. |
| `animation` | `"spawn" \| "none"` | `"spawn"` | No | Animation behavior: `"spawn"` (grow from/collapse into mascot) or `"none"` (instant show/hide; more may be added). |

> **Note on `layout: "arc"` (Contract Amendment K2-A1):**
> When `layout` is set to `"arc"`, OrbitKit computes `startAngle = centre - span / 2` and `endAngle = centre + span / 2` using the mascot centre angles (top = -90°, right = 0°, bottom = 90°, left = 180°). The resolved angles supersede any manually configured `startAngle` and `endAngle`. If `arc` is specified without `layout: "arc"`, it is allowed but ignored during angle resolution.

#### Menu Arc Configuration (`menu.arc`)

| Field | Type | Default | Required | Validation & Description |
|---|---|---|---|---|
| `position` | `"top" \| "bottom" \| "left" \| "right"` | `"top"` | No | Side of the mascot the arc sits on. |
| `span` | `number` | `180` | No | Arc width in degrees. Must be between 30 and 300. |

#### Menu Item (`menu.items[]`)

| Field | Type | Required | Validation & Description |
|---|---|---|---|
| `id` | `string` | **Yes** | Must match regex `^[a-z0-9][a-z0-9_-]{0,31}$`. Unique across all items. |
| `label` | `string` | **Yes** | Non-empty string. Displayed in tooltips and accessibility labels. |
| `icon` | `string` | No | Emoji character (e.g. `"📝"`) or image/SVG URL. |
| `disabled`| `boolean` | No | When `true`, item is visually dimmed and non-interactive. |

---

### 2.3 Windows Configuration (`windows`)

Configures desktop multi-window properties and popup definitions.

| Field | Type | Required | Description |
|---|---|---|---|
| `mascotWindow` | `MascotWindowConfig` | No | Desktop window properties for the mascot (`orbitkit-mascot`). |
| `popups` | `PopupConfig[]` | **Yes** | Array of auxiliary popup window specifications. |

#### Mascot Window (`windows.mascotWindow`)

| Field | Type | Required | Description |
|---|---|---|---|
| `transparent` | `boolean` | **Yes** | Enables window background transparency. |
| `alwaysOnTop` | `boolean` | **Yes** | Keeps mascot floating above standard desktop windows. |
| `decorations` | `boolean` | **Yes** | Toggles window title bar and borders (`false` for frameless bubble). |
| `x` | `number` | No | Explicit initial horizontal window coordinate. |
| `y` | `number` | No | Explicit initial vertical window coordinate. |

#### Popup Window (`windows.popups[]`)

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | **Yes** | Unique non-empty identifier (e.g. `"notes"`). Used by `open_popup(id)`. |
| `url` | `string` | **Yes** | URL or route to load (e.g. `"index.html?popup=notes"`). |
| `title` | `string` | **Yes** | Title bar text. |
| `width` | `number` | **Yes** | Window width in pixels (> 0). |
| `height` | `number` | **Yes** | Window height in pixels (> 0). |
| `resizable` | `boolean` | No | Allows user resizing (default `true` in desktop windowing). |
| `alwaysOnTop`| `boolean` | No | Keeps popup above other windows. |

---

## 3. Helper Functions

`@orbitkit/ui` exports three configuration utilities:

### `defineConfig(config: OrbitKitConfig): OrbitKitConfig`
Identity function providing strict TypeScript typechecking and IDE autocompletion when drafting configuration in `.ts` files.

### `withDefaults(partial: DeepPartial<OrbitKitConfig>): OrbitKitConfig`
Applies default values to omitted optional fields:
- `mascot.kind`: `"svg"`
- `mascot.size`: `96`
- `mascot.initialState`: `"idle"`
- `menu.radius`: `96`
- `menu.startAngle`: `-90`
- `menu.endAngle`: `270`
- `menu.itemSize`: `44`
- `menu.trigger`: `"click"`

### `validateConfig(config: unknown): ValidationResult`
Performs comprehensive runtime validation against K2 rules and returns:

```ts
export type ValidationResult =
  | { ok: true; config: OrbitKitConfig }
  | { ok: false; errors: string[] };
```

Validation guarantees:
1. `mascot.kind` is `"svg"`, `"image"`, or `"sprite"`.
2. `mascot.size` is a positive number.
3. If `mascot.kind === "sprite"`, `frameWidth` and `frameHeight` are positive numbers.
4. `menu.items` has between 1 and 12 items.
5. Every `menu.items[i].id` is unique and matches `^[a-z0-9][a-z0-9_-]{0,31}$`.
6. Every `windows.popups[i].id` is unique and non-empty.
7. Geometry fields (`radius`, `width`, `height`, etc.) are positive numbers.

---

## 4. Configuration Examples

### Example 1: Static SVG Mascot with Full Radial Menu

```json
{
  "mascot": {
    "kind": "svg",
    "src": "<svg width=\"160\" height=\"160\" viewBox=\"0 0 160 160\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"80\" cy=\"80\" r=\"56\" fill=\"#4f7cff\" /><ellipse cx=\"80\" cy=\"80\" rx=\"70\" ry=\"22\" fill=\"none\" stroke=\"#9db4ff\" stroke-width=\"4\" transform=\"rotate(-20 80 80)\" /><circle cx=\"60\" cy=\"68\" r=\"10\" fill=\"#ffffff\" /><circle cx=\"100\" cy=\"68\" r=\"10\" fill=\"#ffffff\" /><circle cx=\"62\" cy=\"70\" r=\"4\" fill=\"#10141a\" /><circle cx=\"102\" cy=\"70\" r=\"4\" fill=\"#10141a\" /></svg>",
    "size": 96,
    "initialState": "idle",
    "states": {
      "idle": {
        "src": "<svg width=\"160\" height=\"160\" viewBox=\"0 0 160 160\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"80\" cy=\"80\" r=\"56\" fill=\"#4f7cff\" /></svg>"
      },
      "busy": {
        "src": "<svg width=\"160\" height=\"160\" viewBox=\"0 0 160 160\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"80\" cy=\"80\" r=\"56\" fill=\"#f59e0b\" /></svg>"
      }
    }
  },
  "menu": {
    "items": [
      { "id": "notes", "label": "Notes" },
      { "id": "timer", "label": "Timer" },
      { "id": "settings", "label": "Settings" },
      { "id": "about", "label": "About" },
      { "id": "quit", "label": "Quit" }
    ],
    "radius": 96,
    "startAngle": -90,
    "endAngle": 270,
    "itemSize": 44,
    "trigger": "click"
  },
  "windows": {
    "mascotWindow": {
      "transparent": true,
      "alwaysOnTop": true,
      "decorations": false
    },
    "popups": [
      {
        "id": "notes",
        "url": "index.html?popup=notes",
        "title": "Notes",
        "width": 320,
        "height": 420
      },
      {
        "id": "settings",
        "url": "index.html?popup=settings",
        "title": "Settings",
        "width": 360,
        "height": 300
      }
    ]
  }
}
```

### Example 2: Animated Sprite Sheet Mascot

For game-style or pixel-art character animations:

```json
{
  "mascot": {
    "kind": "sprite",
    "src": "/assets/mascot-spritesheet.png",
    "size": 128,
    "frameWidth": 128,
    "frameHeight": 128,
    "initialState": "idle",
    "states": {
      "idle": {
        "frames": 6,
        "fps": 8,
        "row": 0,
        "loop": true
      },
      "active": {
        "frames": 8,
        "fps": 12,
        "row": 1,
        "loop": true
      },
      "busy": {
        "frames": 4,
        "fps": 6,
        "row": 2,
        "loop": true
      },
      "attention": {
        "frames": 4,
        "fps": 10,
        "row": 3,
        "loop": false
      }
    }
  },
  "menu": {
    "items": [
      { "id": "action_play", "label": "Play" },
      { "id": "action_pause", "label": "Pause" },
      { "id": "action_stop", "label": "Stop" }
    ],
    "radius": 110,
    "startAngle": 0,
    "endAngle": 180,
    "itemSize": 48,
    "trigger": "click"
  },
  "windows": {
    "mascotWindow": {
      "transparent": true,
      "alwaysOnTop": true,
      "decorations": false
    },
    "popups": []
  }
}
```

### Example 3: Arc Menu Layout (K2-A1)

To place radial buttons along a 180-degree half-circle arc above the mascot using `layout: "arc"`:

```json
{
  "menu": {
    "items": [
      { "id": "copy", "label": "Copy" },
      { "id": "paste", "label": "Paste" },
      { "id": "cut", "label": "Cut" }
    ],
    "radius": 80,
    "layout": "arc",
    "arc": {
      "position": "top",
      "span": 180
    },
    "itemSize": 40,
    "trigger": "hover"
  }
}
```
