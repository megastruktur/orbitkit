# OrbitKit Configuration Reference

OrbitKit uses a unified configuration schema (`OrbitKitConfig`, defined in Contract K2) shared between the TypeScript frontend (`@orbitkit/ui`) and the Rust plugin (`tauri-plugin-orbitkit`).

---

## 1. Top-Level Structure

`OrbitKitConfig` comprises four top-level sections:

```ts
export interface OrbitKitConfig {
  mascot: MascotConfig;
  menu: MenuConfig;
  windows: WindowsConfig;
  app?: AppConfig;
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
| `kind` | `"svg" \| "image" \| "sprite" \| "sheets"` | `"svg"` | **Yes** | Must be one of the four literal kinds. `"sheets"` is the K7 pixel-art sheet mode (below). |
| `src` | `string` | `""` | **Yes** | Non-empty string. For `"svg"`, can be inline `<svg>...</svg>` markup or an image URL. For `"image"`, `"sprite"`, and `"sheets"`, must be a path or URL. |
| `size` | `number` | `96` | **Yes** | Positive number (pixels). Bounding size for width and height. |
| `frameWidth` | `number` | `undefined` | Required if `kind === "sprite"` | Positive number (pixels). Width of an individual frame in the sprite sheet. |
| `frameHeight` | `number` | `undefined` | Required if `kind === "sprite"` | Positive number (pixels). Height of an individual frame in the sprite sheet. |
| `initialState` | `string` | `"idle"` | No | Initial state name when the mascot mounts. |
| `states` | `Record<string, MascotSpriteState \| { src: string }>` | `undefined` | No | Map of state names to state definitions (see below). |
| `sheets` | `Record<string, MascotSheetDef>` | `undefined` | Required if `kind === "sheets"` | K7: named sheet definitions (see below). |
| `scale` | `number` | `1` | No | K7 (`"sheets"`): integer upscale factor (`image-rendering: pixelated`). |
| `anchor` | `"bottom-center" \| "center"` | `"bottom-center"` | No | K7 (`"sheets"`): which sheet point sits at the window anchor. |
| `faceByVelocity` | `boolean` | `false` | No | K7 (`"sheets"`): mirror sheets horizontally when horizontal velocity `vx < 0`. |

#### Sheet Definitions (`mascot.sheets`, K7, `kind: "sheets"`)

| Field | Type | Default | Description |
|---|---|---|---|
| `src` | `string` | *Required* | Sheet image path/URL. |
| `frameWidth` / `frameHeight` | `number` | *Required* | Positive frame size in px. |
| `frames` | `number` | *Required* | Frame count in the strip; must be > 0. |
| `fps` | `number` | *Required* | Playback rate; must be > 0. |
| `loop` | `boolean` | `true` | Loop the strip; `false` halts on the last frame. |

#### State Pools (`mascot.states`, K7, `kind: "sheets"`)

`mascot.states` may alternatively map a state name to `{ pool, priority?, ttlMs? }`:

| Field | Type | Default | Description |
|---|---|---|---|
| `pool` | `string[]` | *Required* | Sheet names (keys of `mascot.sheets`); a random member is picked when the state is entered. |
| `priority` | `number` | `0` | Higher-priority states win arbitration. |
| `ttlMs` | `number` | *Sticky* | Auto-return to the previous state after this delay; absent = sticky. |

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
| `layout` | `"orbit" \| "arc" \| "arc-anchor"` | `"orbit"` | No | Layout geometry: `"orbit"` (full ring or manual angles), `"arc"` (side arc), `"arc-anchor"` (K7: top-centred arc anchored `headGap` px above the mascot's top edge). |
| `arc` | `MenuArcConfig` | `{ position: "top", span: 180 }` | No | Configures arc side, span, and `headGap`. |
| `animation` | `"spawn" \| "none"` | `"spawn"` | No | Animation behavior: `"spawn"` (grow from/collapse into mascot) or `"none"` (instant show/hide; more may be added). |
| `stagger` | `MenuStaggerConfig` | `{ openMs: 260, closeMs: 180, stepMs: 40 }` | No | K7 per-item open/close stagger: `openMs`/`closeMs` total wave duration, `stepMs` per-item delay. Order centre→edges on open, reversed (edges→centre) on close. |
| `caption` | `boolean` | `false` | No | Hovered-item caption. When `true`, the menu container renders exactly one additional child `<span class="orbitkit-caption" aria-hidden="true">` (excluded from the `role="menu"` content semantics) whose visible text mirrors the label of the item currently hovered (pointer) or keyboard-focused: keyboard focus wins over a simultaneous hover, moving the pointer onto a disabled item does not change the caption, and the caption is empty when nothing is hovered or focused (it also clears as soon as the menu closes). The text is supplied by the `data-caption` attribute and rendered with CSS (`content: attr(data-caption)`); while the caption is on, the per-item `::after` tooltips are suppressed so labels never appear twice. The span sits inside the container at the arc's inner centre — bottom-centre for `arc.position: "top"`, top-centre for `"bottom"`, plain centred for other layouts — using pure CSS only, and is never rendered outside the container bounds. Consumers can restyle it via the `.orbitkit-caption` class (dark-slate defaults matching the item styling). `false` (or omitted) keeps the rendered menu DOM byte-identical. Must be a boolean. |

> **Note on `layout: "arc-anchor"` (K7):**
> Same top-centred arc angles as `layout: "arc"` with `position: "top"`, but the arc's centre point is placed in window coordinates via `resolveMenuOrigin(anchorRect, headGap)`: horizontally centred on the mascot, `headGap` px (from `menu.arc.headGap`, default 12) above the mascot's **top edge** (not its centre).

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
| `id` | `string` | **Yes** | Must match `MENU_ITEM_ID_REGEX`: `^[a-z0-9][a-z0-9_.:-]{0,63}$` (K7 — dots, colons, hyphens allowed; identical in TS and Rust). Unique across all items. |
| `label` | `string` | **Yes** | Non-empty string. Displayed in accessibility labels (`aria-label` and `title`) and shown on hover or keyboard focus — as a per-item `::after` tooltip by default, or in the single container caption when `menu.caption` is `true`. |
| `icon` | `string \| { svg: string }` | No | Emoji character (e.g. `"📝"`), image/SVG URL, **or** K7 inline-SVG object `{ svg: "<svg …/></svg>" }` (sanitized via `sanitizeMenuIconSvg` (K12 allowlist), rendered as a data-URL `<img>` sized at 50% of `menu.itemSize`). |
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
| `passthrough` | `boolean` | No | K10 (default `false`): enables click-through outside registered hit regions (≤10 Hz cursor polling, default 150 ms; interactive iff cursor is inside a hit region or a drag is active). |
| `fitContent` | `boolean` | No | K9 (default `false`): size the mascot window to its content via `fitWindow` and keep it inside the monitor work area via `clampToWorkArea` (content stays visually fixed via `compensation {dx,dy}`). |
| `label` | `string` | No | K7: window label, default `"orbitkit-mascot"`. |
| `url` | `string` | No | K7: window URL, default `"index.html?orbitkit=mascot"`. |
| `roam` | `MascotRoamConfig` | No | K7/K8: roam behaviour — `{ width, height, margin, corner: "bottom-right" \| "bottom-left" \| "top-right" \| "top-left", speed }`; the mascot roams inside this work-area-corner zone and faces its walking direction. |

#### Popup Window (`windows.popups[]`)

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | **Yes** | Unique non-empty identifier (e.g. `"notes"`). Used by `open_popup(id)`. |
| `url` | `string` | **Yes** | URL or route to load (e.g. `"index.html?popup=notes"`). May contain `{param}` placeholders substituted URL-encoded from `openPopup(id, { params })`; unknown placeholders → `invalid_config`. |
| `title` | `string` | **Yes** | Title bar text. |
| `width` | `number` | **Yes** | Window width in pixels (> 0). |
| `height` | `number` | **Yes** | Window height in pixels (> 0). |
| `resizable` | `boolean` | No | Allows user resizing (default `true` in desktop windowing). |
| `alwaysOnTop`| `boolean` | No | Keeps popup above other windows. |
| `anchor` | `"mascot" \| "center" \| "none"` | No | K11 (default `"none"`): `"mascot"` places the popup next to the mascot via Rust `place_popup` (prefers above-right, flips at work-area edges, final clamp); `"center"` centres it in the mascot's monitor work area. |
| `decorations` | `boolean` | No | K11: toggles the popup's native title bar/borders. |
| `transparent` | `boolean` | No | K11: enables the popup window's background transparency. |
| `skipTaskbar` | `boolean` | No | K11: hides the popup from the taskbar. |
| `minWidth` / `minHeight` | `number` | No | K11: minimum window size in px. |

#### App (`app`, K11)

| Field | Type | Required | Description |
|---|---|---|---|
| `allowedOrigins` | `string[]` | No | K11: additionally allowed `https://` origins for popup URLs. Loopback `http(s)://127.0.0.1\|localhost:<port>` and app-relative URLs are always allowed; anything else → `invalid_config`. |

> **Popup placement note:** the K11 contract text specifies a preference for above-**left**;
> the shipped implementation (CuteCare port of `geometry.rs`) prefers above-**right**
> (right-aligned to the mascot's right edge). See `docs/api.md` §1.2.
> On mixed-DPI Windows, placement of newly created popups vs. re-opened ones may be off by
> the scale ratio (different coordinate units between monitor scale factors) — a known limitation.

---

### 2.1 Coordinate Spaces (K8/K9 note)

Mascot/popup geometry is computed in **physical px**. On macOS and Linux the OS reports
window coordinates directly in physical px, while on Windows the underlying coordinate
space switches between logical and physical units across API surfaces; the exact switch
point has no single authoritative source. If a position looks offset by the scale factor
on Windows, this is the likely cause (see Known limitations in `CHANGELOG.md`).

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
- `menu.animation`: `"spawn"`
- `menu.caption`: `false`
- `menu.stagger`: `{ openMs: 260, closeMs: 180, stepMs: 40 }` (K7 `DEFAULT_STAGGER`)
- `menu.arc.headGap`: `12` (K7 `DEFAULT_ARC_HEAD_GAP`, when `arc`/`arc-anchor` present)
- `mascot.scale`: `1` (K7 `DEFAULT_MASCOT_SCALE`)
- `mascot.anchor`: `"bottom-center"` (K7 `DEFAULT_MASCOT_ANCHOR`)
- `mascot.faceByVelocity`: `false` (K7 `DEFAULT_FACE_BY_VELOCITY`)
- `windows.mascotWindow.label`: `"orbitkit-mascot"` (`DEFAULT_MASCOT_WINDOW_LABEL`)
- `windows.mascotWindow.url`: `"index.html?orbitkit=mascot"` (`DEFAULT_MASCOT_WINDOW_URL`)
- `windows.mascotWindow.passthrough`: `false` (K10 `DEFAULT_PASSTHROUGH`)
- `windows.mascotWindow.fitContent`: `false` (K9 `DEFAULT_FIT_CONTENT`)
- `windows.popups[].anchor`: `"none"` (K11 `DEFAULT_POPUP_ANCHOR`)

### `validateConfig(config: unknown): ValidationResult`
Performs comprehensive runtime validation against K2 rules and returns:

```ts
export type ValidationResult =
  | { ok: true; config: OrbitKitConfig }
  | { ok: false; errors: string[] };
```

Validation guarantees:
1. `mascot.kind` is `"svg"`, `"image"`, `"sprite"`, or `"sheets"` (K7).
2. `mascot.size` is a positive number.
3. If `mascot.kind === "sprite"`, `frameWidth` and `frameHeight` are positive numbers.
4. `menu.items` has between 1 and 12 items.
5. Every `menu.items[i].id` is unique and matches `MENU_ITEM_ID_REGEX`: `^[a-z0-9][a-z0-9_.:-]{0,63}$` (K7).
6. Every `windows.popups[i].id` is unique and non-empty.
7. Geometry fields (`radius`, `width`, `height`, etc.) are positive numbers.
8. `menu.caption`, when present, is a boolean.

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

---

## 5. Environment Variables & Diagnostics

| Variable | Values | Description |
|---|---|---|
| `VITE_ORBITKIT_DEBUG` | `"1"` | Enables frontend gesture telemetry in the starter, forwarding `console` logs to Tauri via `log_telemetry`. |

Setting `VITE_ORBITKIT_DEBUG="1"` at frontend build or development time enables verbose gesture diagnostics in the starter example. When set, `main.ts` forwards console messages (`log`, `warn`, `error`) to the Tauri backend via `log_telemetry`, and `MascotView` logs window focus/blur and pointer/click events to aid in automated headless testing. In production builds or when unset, this telemetry is completely disabled and console output is not forwarded.
```
