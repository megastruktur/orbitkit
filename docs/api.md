# OrbitKit API Reference

This reference covers all public APIs across the TypeScript package (`@orbitkit/ui`), the Rust plugin crate (`tauri-plugin-orbitkit`), Tauri IPC commands, events, and error codes.

---

## 1. TypeScript API (`@orbitkit/ui`)

### 1.1 Components

#### `<Mascot />`

Svelte 5 component rendering the interactive mascot (supports SVG markup encoded to data URLs, external image URLs, and animated CSS sprite sheets).

```svelte
<script lang="ts">
  import { Mascot } from "@orbitkit/ui";
</script>

<Mascot
  {config}
  state="idle"
  onclick={() => console.log("Clicked mascot")}
/>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `config` | `MascotConfig` | *Required* | Mascot configuration object. |
| `state` | `MascotStateName` | `config.initialState ?? "idle"` | Currently displayed state. |
| `onclick` | `((e: MouseEvent) => void) \| (() => void)` | `undefined` | Click event callback. |
| `onpointerdown` | `((e: PointerEvent) => void) \| (() => void)` | `undefined` | Pointer down callback. |
| `ariaLabel` | `string` | `"OrbitKit mascot"` | Accessible label for screen readers. |
| `reducedMotion` | `boolean` | `false` | When `true`, disables sprite animations. Falls back to OS `prefers-reduced-motion`. |
| `class` | `string` | `""` | Additional CSS class for the root button element. |

---

#### `<RadialMenu />`

Svelte 5 component rendering a circular or arc menu arranged geometrically around a center point.

```svelte
<script lang="ts">
  import { RadialMenu } from "@orbitkit/ui";
</script>

<RadialMenu
  config={config.menu}
  open={isOpen}
  onselect={(id) => handleSelect(id)}
  onclose={() => (isOpen = false)}
/>
```

**Props:**

| Prop | Type | Description |
|---|---|---|
| `config` | `MenuConfig` | Menu configuration containing items, radius, startAngle, endAngle, trigger. |
| `open` | `boolean` | Controls visibility of the radial menu. |
| `onselect` | `(id: string) => void` | Invoked when an enabled menu item is clicked or hovered (depending on `trigger`). |
| `onclose` | `() => void` | Invoked when user presses Escape or clicks outside the menu. |


---

#### `<PopupSheet />`

Svelte 5 component rendering an in-app popup sheet dialog for mobile (Android) platforms, replacing multi-window popups with an in-app glass sheet.

```svelte
<script lang="ts">
  import { PopupSheet } from "@orbitkit/ui";
  import NotesPopup from "./views/NotesPopup.svelte";
  import SettingsPopup from "./views/SettingsPopup.svelte";
  import UnknownPopup from "./views/UnknownPopup.svelte";
</script>

<PopupSheet
  components={{ notes: NotesPopup, settings: SettingsPopup }}
  fallback={UnknownPopup}
/>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `components` | `Record<string, Component<any>>` | *Required* | Map of popup identifiers to view components. |
| `fallback` | `Component<any>` | `undefined` | Optional fallback component for unknown popup ids (receives `{ id }`). |
| `reducedMotion`| `boolean` | `false` | When `true`, disables intro/outro animation transitions. Defaults to `prefers-reduced-motion`. |
| `class` | `string` | `""` | Optional CSS class applied to the backdrop. |
---

### 1.2 Geometry Calculations

#### `layoutItems(n, radius, startDeg, endDeg): ItemPosition[]`

Calculates circular and arc placement for $n$ items.

```ts
import { layoutItems, type ItemPosition } from "@orbitkit/ui";

const positions: ItemPosition[] = layoutItems(5, 96, -90, 270);
```

- **Parameters:**
  - `n: number`: Number of items to place.
  - `radius: number`: Radius in pixels from center.
  - `startDeg: number`: Starting angle in degrees (0 = right, 90 = down).
  - `endDeg: number`: Ending angle in degrees.
- **Returns:**
  - `ItemPosition[]`: Array of `{ x: number, y: number, angle: number }` rounded to 2 decimal places.

---

### 1.3 Configuration Utilities

- `defineConfig(c: OrbitKitConfig): OrbitKitConfig`: Identity type helper.
- `withDefaults(c: DeepPartial<OrbitKitConfig>): OrbitKitConfig`: Fills in default values for optional properties.
- `validateConfig(c: unknown): ValidationResult`: Validates input and returns `{ ok: true, config }` or `{ ok: false, errors: string[] }`.
- `MENU_ITEM_ID_REGEX`: Regular expression `^[a-z0-9][a-z0-9_-]{0,31}$`.

---

### 1.4 IPC Bridge Functions

All bridge functions safely verify whether Tauri is available via `isTauri()`. When called outside a Tauri context (such as standard web browsers or Vitest), they safely no-op or throw an `OrbitKitError` with code `unsupported`.

```ts
import {
  showOverlay,
  hideOverlay,
  openPopup,
  closePopup,
  setMascotState,
  emitMenuAction,
  overlayPermission,
  requestOverlayPermission,
  onMenuAction,
  onMascotState,
  isTauri,
  startMascotDrag,
  createDragGesture
} from "@orbitkit/ui";
```

#### `isTauri(): boolean`
Returns `true` if running inside a Tauri webview environment (`window.__TAURI_INTERNALS__` present).

#### `overlayPermission(): Promise<boolean>`
Checks if the application has system overlay permissions (`SYSTEM_ALERT_WINDOW` on Android). Always resolves `true` on desktop platforms.

#### `requestOverlayPermission(): Promise<void>`
Requests system overlay permission. On Android, navigates user to the "Display over other apps" settings screen. No-op on desktop platforms.

#### `showOverlay(options: ShowOverlayOptions): Promise<void>`
- **Desktop**: Shows the frameless transparent mascot window (`orbitkit-mascot`).
- **Android**: Displays the native system overlay view with mascot bubble and radial menu.

#### `hideOverlay(): Promise<void>`
Hides the mascot window on desktop or removes the overlay view on Android.

#### `openPopup(id: string): Promise<void>`
Opens or focuses the popup window configured with matching `id` in `windows.popups`. Returns error code `unsupported` on Android.

#### `closePopup(id: string): Promise<void>`
Closes the popup window with matching `id`. Returns error code `unsupported` on Android.

#### `setMascotState(state: string): Promise<void>`
Updates the mascot state across webviews and Android native overlay, emitting an `orbitkit://mascot-state` event.

#### `emitMenuAction(id: string): Promise<void>`
Dispatches a menu action for `id` through the unified action pipeline, triggering Rust native handlers and broadcasting `orbitkit://menu-action`.

#### `startMascotDrag(): Promise<void>`
Initiates native window dragging on desktop for the `orbitkit-mascot` window via Tauri's `start_dragging()`. Resolves as a no-op on Android where overlay dragging is handled natively.

#### `createDragGesture(options?: DragGestureOptions): DragGestureHandlers`
Creates a pure gesture handler for mascot dragging and menu toggle disambiguation.
- Moves <= 4 px trigger `onToggle` on click.
- Moves > 4 px collapse open menus instantly and trigger native dragging via `onDragStart`.
- Optional `dragClearDelay` (default 400 ms) auto-clears the `dragged` state on drag end (armed on window focus, pointerup/cancel while dragged, or subsequent pointerdown) to ensure the first subsequent click always toggles the menu even if native window dragging swallows the terminating release event.
#### `onMenuAction(handler: (action: MenuActionPayload) => void): Promise<UnlistenFn>`
Listens for `orbitkit://menu-action` events:
```ts
const unlisten = await onMenuAction((action) => {
  console.log("Action ID:", action.id);
  console.log("Source:", action.source); // "webview" | "overlay"
});
```

#### `onMascotState(handler: (payload: MascotStatePayload) => void): Promise<UnlistenFn>`
Listens for `orbitkit://mascot-state` events:
```ts
const unlisten = await onMascotState((payload) => {
  console.log("New state:", payload.state);
});
```

#### `onPopupOpen(handler: (payload: PopupOpenPayload) => void): Promise<UnlistenFn>`
Listens for `orbitkit://popup-open` events (emitted when an in-app popup sheet should be displayed):
```ts
const unlisten = await onPopupOpen((payload) => {
  console.log("Open popup:", payload.id, payload.title, payload.width, payload.height);
});
```

#### `onPopupClose(handler: (payload: PopupClosePayload) => void): Promise<UnlistenFn>`
Listens for `orbitkit://popup-close` events:
```ts
const unlisten = await onPopupClose((payload) => {
  console.log("Close popup:", payload.id);
});
```

---

## 2. Rust API (`tauri-plugin-orbitkit`)

### 2.1 Plugin Registration

```rust
use tauri_plugin_orbitkit::{init, OrbitKitConfig, OrbitkitExt};

fn main() {
    let config: OrbitKitConfig = serde_json::from_str(include_str!("../orbitkit.config.json"))
        .expect("invalid config");

    tauri::Builder::default()
        .plugin(init(config))
        .setup(|app| {
            app.on_menu_action(|action| {
                println!("Action ID: {}", action.id);
                println!("Action source: {}", action.source);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

### 2.2 `OrbitkitExt` Trait

Available on `AppHandle`, `App`, and any type implementing `tauri::Manager<R>`:

```rust
pub trait OrbitkitExt<R: Runtime> {
    /// Returns a reference to the platform Orbitkit controller.
    fn orbitkit(&self) -> &Orbitkit<R>;

    /// Registers a global callback for menu actions triggered from either
    /// webviews or native Android overlays.
    fn on_menu_action<F: Fn(&MenuAction) + Send + Sync + 'static>(&self, handler: F);
}
```

### 2.3 JNI Bridge Types (`jni_bridge`)

```rust
pub struct MenuAction {
    pub id: String,
    pub source: String, // "webview" | "overlay"
}

pub struct JniActionRecord {
    pub receipt_id: u64,
    pub action: String,
    pub timestamp_millis: u64,
    pub rust_tag: String,
    pub webview_suspended: bool,
}
```

---

## 3. Tauri IPC Commands (K4 Surface)

Commands are registered under the plugin prefix `plugin:orbitkit|<cmd>`:

| Command | Arguments | Return Type | Desktop Behavior | Android Behavior |
|---|---|---|---|---|
| `overlay_permission` | *None* | `OverlayPermissionResponse { granted: bool }` | Always `{ granted: true }` | Checks `Settings.canDrawOverlays` |
| `request_overlay_permission` | *None* | `()` | No-op (returns Ok) | Opens Android SAW settings intent |
| `show_overlay` | `menu?: MenuConfig`, `mascot?: ShowOverlayMascotArgs` | `()` | Shows `orbitkit-mascot` window | Displays native overlay view |
| `hide_overlay` | *None* | `()` | Hides `orbitkit-mascot` window | Removes native overlay view |
| `open_popup` | `id: String` | `()` | Creates or focuses popup `WebviewWindow` | Returns error `unsupported` |
| `close_popup` | `id: String` | `()` | Closes popup window if open | Returns error `unsupported` |
| `set_mascot_state` | `state: String` | `()` | Emits `orbitkit://mascot-state` | Updates native overlay state & emits |
| `emit_menu_action` | `id: String` | `()` | Emits menu action event & calls Rust handlers | Emits menu action event & calls Rust handlers |

---

## 4. Tauri Events

| Event Name | Payload Format | Source | Description |
|---|---|---|---|
| `orbitkit://menu-action` | `{ id: string, source: "webview" \| "overlay" }` | Webview click or Android overlay tap | Emitted whenever a menu action is triggered. |
| `orbitkit://mascot-state` | `{ state: string }` | `set_mascot_state` call | Broadcast to all webviews when mascot state changes. |

---

## 5. Error Codes & Normalization

All IPC and bridge failures reject with structured error objects. In TypeScript, errors are instances of `OrbitKitError`. In Rust, errors are `tauri_plugin_orbitkit::Error`.

The error code is strictly one of four variants:

| Error Code | Description | Typical Cause |
|---|---|---|
| `"permission_denied"` | Required platform permission missing. | Overlay permission denied or disabled on Android. |
| `"unsupported"` | Operation not supported on current platform. | `open_popup` called on Android; unrecognized platform errors. |
| `"not_found"` | Requested resource does not exist. | Popup `id` not found in `windows.popups` configuration. |
| `"invalid_config"` | Configuration syntax or value invalid. | Deserialization failure in `OrbitKitConfig`. |

### TypeScript Error Handling Example

```ts
import { openPopup, OrbitKitError } from "@orbitkit/ui";

try {
  await openPopup("unknown-id");
} catch (err) {
  if (err instanceof OrbitKitError) {
    console.error("Code:", err.code); // "not_found" or "unsupported"
    console.error("Message:", err.message);
  }
}
```
