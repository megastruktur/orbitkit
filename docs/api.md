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
| `sheet` | `string` | `undefined` | K7 (`kind: "sheets"`): sheet name to render (a key of `mascot.sheets`). |
| `velocityX` | `number` | `undefined` | K7 (`kind: "sheets"`): horizontal velocity; negative values mirror the sheet when `mascot.faceByVelocity` is set — the component cannot mirror without it. |
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
| `config` | `MenuConfig` | Menu configuration containing items, radius, startAngle, endAngle, trigger, and the optional `caption` flag (see the hovered-item caption note below). |
| `open` | `boolean` | Controls visibility of the radial menu. |
| `onselect` | `(id: string) => void` | Invoked when an enabled menu item is clicked or hovered (depending on `trigger`). |
| `onclose` | `() => void` | Invoked when user presses Escape or clicks outside the menu. |
| `label` | `string` | Optional accessible label for the menu container. |
| `anchorRect` | `AnchorRect \| null` | K7 `layout: "arc-anchor"`: mascot window bounds the arc hovers above — the arc centre is resolved via `resolveMenuOrigin(anchorRect, headGap)`; without it arc-anchor falls back to window-centred geometry. |

**Hovered-item caption (`config.caption`):**

With `caption: true` in the menu config, the menu container renders exactly one
additional child `<span class="orbitkit-caption" aria-hidden="true">` (excluded
from the `role="menu"` content semantics) whose visible text mirrors the label of
the item currently hovered (pointer) or keyboard-focused: keyboard focus wins over
a simultaneous hover, moving the pointer onto a disabled item does not change the
caption, and the caption is empty when nothing is hovered or focused — it also
clears as soon as the menu closes. The text is supplied by the `data-caption`
attribute and rendered with CSS (`content: attr(data-caption)`); while the caption
is on, the per-item `::after` tooltips are suppressed so labels never appear twice.
The span sits inside the container at the arc's inner centre — bottom-centre for
`arc.position: "top"`, top-centre for `"bottom"`, plain centred for other layouts —
using pure CSS only, and is never rendered outside the container bounds. Consumers
can restyle it via the `.orbitkit-caption` class (dark-slate defaults matching the
item styling). Default `caption: false`: omitting it keeps the rendered menu DOM
byte-identical.

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

#### `<Bubble />`

Svelte 5 speech-bubble component anchored to the mascot. Renders a text
message next to the mascot with an auto-sizing tail.

```svelte
<script lang="ts">
  import { Bubble } from "@orbitkit/ui";
</script>

<Bubble text="Hello!" onclosed={() => (message = undefined)} />
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | *Required* | Notification text (all copy comes from the consumer; i18n is theirs). A `text` change re-shows a hidden bubble. |
| `severity` | `BubbleSeverity` | `"info"` | Visual severity variant. |
| `ttlMs` | `number` | *Sticky* | Time-to-live in ms. Omitted = sticky bubble that only closes on re-render. |
| `onclick` | `(e: MouseEvent) => void` | `undefined` | Click handler on the bubble. |
| `onexpire` | `() => void` | `undefined` | Fired once when the bubble expires after `ttlMs` (hover-paused, not click). |
| `rect` | `LogicalRect \| null` (bindable) | `null` | Bindable window-local logical rect so callers can feed `fitWindow` alongside the mascot rect; `null` while hidden. |
| `onrectchange` | `(rect: LogicalRect \| null) => void` | `undefined` | Alternative to `bind:rect` (null = bubble hidden). |
| `class` | `string` | `""` | Optional CSS class. |

```svelte
<Bubble text="Saved!" ttlMs={4000} bind:rect={bubbleRect} />
```

#### `<Badge />`

Svelte 5 unread-count badge rendered on the mascot's corner. Count is
delivered via the `orbitkit://badge` event (see §4).

```svelte
<script lang="ts">
  import { Badge } from "@orbitkit/ui";
</script>

<Badge count={3} max={99} />
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `count` | `number` | `0` | Current unread count. `0` hides the badge. |
| `max` | `number` | `99` | Display cap; larger counts render as `99+`. |
| `listen` | `boolean` | `false` | Also subscribe to `orbitkit://badge {count}` events; whichever source changed last wins (a `count` prop change resets prior event counts). |
| `ariaLabel` | `string` | raw count | Accessibility label override. |
| `class` | `string` | `""` | Optional CSS class. |

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

#### Menu helpers (`geometry.ts`)

- `layoutItems(n, radius, startDeg, endDeg)` — math-driven radial item positioning (`ItemPosition[]`).
- `resolveMenuAngles(menu?)` — K2-A1/K7 angle resolution for `layout: "arc" | "arc-anchor"` (arc-anchor forces `position: "top"`).
- `resolveMenuOrigin(anchorRect, headGap)` — K7 `arc-anchor`: window-coordinate centre point of the arc, `headGap` px (from `menu.arc.headGap`, default 12) above the mascot's top edge, horizontally centred.

#### Window fitting (`windowFit.ts`, K9)

- `fitWindow(rects, scale, padding?) → FitWindowResult` — smallest physical window `{ w, h, offset }` containing all content rects given in logical px (`scale` = device scale factor).
- `clampToWorkArea(rect, workArea) → ClampResult` — nudges a physical rect fully inside the work area, preserving size; returns `compensation {dx, dy}` so inner content shifted by `(-dx, -dy)` stays visually fixed.

#### Popup placement (Rust `placement.rs`, K11)

- `place_popup(anchor: PhysRect, size: PhysSize, work: PhysRect, gap: i32) → PhysPos` — pure placement: prefers **above the mascot, right-aligned to its right edge** (above-RIGHT), flips horizontally/vertically when the popup would leave the work area, final clamp inside the work area. `place_popup_with_pad(...)` adds extra padding for testing.
- `center` anchors place the popup centred in the mascot's monitor work area.

> **Behaviour note (contract deviation):** the K11 contract text says popups prefer
> *above-LEFT*; the shipped CuteCare port prefers *above-RIGHT* (documented behaviour,
> covered by unit tests). Reviewers should expect right-edge alignment, not left.

---

### 1.3 Configuration Utilities

- `defineConfig(c: OrbitKitConfig): OrbitKitConfig`: Identity type helper.
- `withDefaults(c: DeepPartial<OrbitKitConfig>): OrbitKitConfig`: Fills in default values for optional properties (now including the K7 defaults: `scale: 1`, `anchor: "bottom-center"`, `faceByVelocity: false`, `arc.headGap: 12`, `stagger: { openMs: 260, closeMs: 180, stepMs: 40 }`, `passthrough: false`, `fitContent: false`, `caption: false`, `anchor: "none"`).
- `validateConfig(c: unknown): ValidationResult`: Validates input and returns `{ ok: true, config }` or `{ ok: false, errors: string[] }`.
- `MENU_ITEM_ID_REGEX`: Regular expression `^[a-z0-9][a-z0-9_.:-]{0,63}$` (K7; identical in TS and Rust `config.rs`).

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

#### `openPopup(id: string, options?: OpenPopupOptions): Promise<void>`
K11: opens (or focuses — idempotent, no duplicates) the popup configured with matching `id`. Options:
- `params?: Record<string, string>` — `{param}` placeholder values, substituted URL-encoded into the popup URL. Unknown placeholder → error code `invalid_config`.
- `instanceKey?: string` — opens multiple instances of one popup kind; must match `^[a-z0-9_-]{1,32}$`; window label becomes `orbitkit-popup-{id}-{instanceKey}` (without key: `orbitkit-popup-{id}`). Already-open label → show + focus + re-anchor.

Returns error code `not_found` for an unknown `id`; `invalid_config` for an unknown `{param}` placeholder or a disallowed URL. On Android the popup sheet is brought to front and `orbitkit://popup-shown` (+ legacy `orbitkit://popup-open`) is emitted — no error.

#### `closePopup(label: string): Promise<void>`
K11: closes the popup window by **full window label** (e.g. `"orbitkit-popup-notes"` or `"orbitkit-popup-notes-note-2"`). On Android it emits `orbitkit://popup-closed {label}` (+ legacy `orbitkit://popup-close {id}`) — no error.

#### `listPopups(): Promise<string[]>`
K11: full window labels of all currently open OrbitKit popup windows (e.g. `["orbitkit-popup-notes-note-2"]` — `orbitkit-popup-<id>[-<instanceKey>]`).

#### `mascotMonitor(): Promise<MascotMonitorPayload>`
K9: returns `{ workArea: PhysRect, scaleFactor: number }` for the **monitor containing the mascot window centre** (not the primary monitor). Unsupported on mobile (`unsupported`).

#### `setMascotState(state: string): Promise<void>`
Updates the mascot state across webviews and Android native overlay, emitting an `orbitkit://mascot-state` event.

#### `setBadge(count: number): Promise<void>` / `onBadge(cb): Promise<UnlistenFn>`
Bubble-badge: broadcasts `orbitkit://badge { count }` (badge listeners, including the badge UI itself, update); `onBadge` subscribes to those events.

#### `setParked(parked: boolean): Promise<void>` / `onPark(cb): Promise<UnlistenFn>`
Broadcast only: emits `orbitkit://park { parked }` to every listener (including the emitting webview); outside Tauri, resolves without emitting. It does not move the window and does not pause roam or passthrough — that lifecycle belongs to `createPark` (see Roam & park below).

#### `startPassthrough(options): PassthroughController` / `registerHitRegion(...)` (K10)
Opt-in click-through for the mascot window (`windows.mascotWindow.passthrough: true`):
- Polls `cursorPosition()` at most 10 Hz (`DEFAULT_PASSTHROUGH_INTERVAL_MS = 150` ms, floor `MIN_PASSTHROUGH_INTERVAL_MS = 100` ms).
- `registerHitRegion(el | () => DOMRect[])` registers an element or rect provider and returns an unregister function.
- The window is interactive iff the cursor is inside any registered hit region **or** a drag is active; otherwise `setIgnoreCursorEvents(true)`.
- Polling stops while park is sleeping and when `controller.stop()` is called. Default off → 0.1.0 behaviour unchanged.

#### Mascot helpers (K7/K8)
- `createMachine(states, options?) → MascotMachine` / `hint(machine, state, now) / tick(machine, now)` — pure sheets mascot state machine (state pools with `priority`/`ttlMs`, velocity hinting; rooted at its base state `idle` when defined); `MascotMachineSnapshot` is the read model.
- `frameAt(sheet, elapsedMs) / sheetGeometry(sheet, scale?, anchor?) / sheetFrameStyle(...)` — sprite-sheet frame math and CSS style for `mascot.kind: "sheets"` (`scale` = integer upscale, floored ≥ 1; `anchor` = `"bottom-center"` (default) or `"center"`; returns `SheetGeometry`).

#### Roam & park
- `startRoam(options) → RoamController`, `createRoam(options) → RoamHandle`, `createRoamDrag(options)` — roam within a work-area-corner zone (`roamBounds`, `stepRoam`, `aimRoamVelocity`, `rebaseRoamBounds`); facing follows horizontal velocity; hands `setPosition` only integer physical px (fractional state preserved internally).
- `parkCornerPosition(corner, workArea, windowSize) → PhysicalPoint` — window top-left for `corner` of `workArea`, clamped into the work area via `clampToWorkArea`.
- `createPark(options) → ParkHandle` drives the park/unpark lifecycle: `park()` pauses roam + passthrough polling, moves the window into the configured work-area corner (`parkCornerPosition`, clamped via `clampToWorkArea`) and forces the configured `sleepState` on the mascot machine; `unpark()` restores the pre-park position (roam resumes from the saved point) and resumes passthrough. Both transitions emit `orbitkit://park { parked }`.

#### Menu icon sanitization (K12)
- `MenuItem.icon: { svg }` inline SVG is sanitized by an allowlist before render: tags `svg, g, path, circle, rect, line, polyline, polygon, ellipse`; attributes `d, viewBox, fill, stroke*, cx, cy, r, x, y, width, height, points, transform, opacity`. Script, `foreignObject`, `on*` handlers, and `href` are stripped; the result renders as a data-URL `<img>` (keeps K3-A3 icon safety).
- Menu labels are reactive (i18n changes re-render without reopening); keyboard nav (←/→, Enter), Esc, and click-away behaviour are unchanged from K3.

#### Platform arms (K13)
- `list_popups` and `mascot_monitor` have `mobile.rs` arms returning `Error::unsupported` (desktop-native window labels/monitors do not exist on mobile); the TS bridge maps them to `OrbitKitError` with code `"unsupported"`.
- `open_popup` / `close_popup` **are supported on mobile**: they drive the in-app popup sheet (`bringToFront`) and emit `orbitkit://popup-shown`/`popup-closed` (+ legacy `orbitkit://popup-open`/`popup-close`) instead of creating native windows.
- No new Android code. All new commands are added to the plugin permission set `default` (desktop).

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
| `open_popup` | `id: String`, `params?: Record<string,string>`, `instanceKey?: string` | `()` | Creates/focuses popup `WebviewWindow` (`orbitkit-popup-{id}[-{instanceKey}]`); `{param}` URL-encoded substitution, loopback/allowedOrigins URL policy, emits `orbitkit://popup-shown {label}` | Brings popup sheet to front; emits `orbitkit://popup-shown {label}` + legacy `orbitkit://popup-open` |
| `close_popup` | `label: String` | `()` | Closes popup window by full label; emits `orbitkit://popup-closed {label}` | Emits `orbitkit://popup-closed {label}` + legacy `orbitkit://popup-close {id}` |
| `list_popups` | *None* | `string[]` | Labels of open popup windows | Returns error `unsupported` |
| `set_mascot_state` | `state: String` | `()` | Emits `orbitkit://mascot-state` | Updates native overlay state & emits |
| `emit_menu_action` | `id: String` | `()` | Emits menu action event & calls Rust handlers | Emits menu action event & calls Rust handlers |
| `start_mascot_drag` | *None* | `()` | Native drag via `window.start_dragging()` on `orbitkit-mascot` | Native touch drag |
| `mascot_monitor` | *None* | `MascotMonitorResponse { workArea: PhysRect, scaleFactor: f64 }` | Work area + scale of the monitor containing the mascot window centre (K9) | Returns error `unsupported` |

All 11 commands are declared in `crates/tauri-plugin-orbitkit/build.rs` `COMMANDS`.

---

## 4. Tauri Events

| Event Name | Payload Format | Source | Description |
|---|---|---|---|
| `orbitkit://menu-action` | `{ id: string, source: "webview" \| "overlay" }` | Webview click or Android overlay tap | Emitted whenever a menu action is triggered. |
| `orbitkit://mascot-state` | `{ state: string }` | `set_mascot_state` call | Broadcast to all webviews when mascot state changes. |
| `orbitkit://popup-shown` | `{ label: string }` | `open_popup` (create **and** re-show) | K11 popup window created or re-focused/re-anchored. |
| `orbitkit://popup-closed` | `{ label: string }` | `close_popup` / window close | K11 popup window closed. |
| `orbitkit://badge` | `{ count: number }` | `setBadge` | Unread-badge count broadcast. |
| `orbitkit://park` | `{ parked: boolean }` | `setParked` | Park (do-not-disturb) state broadcast. |
| `orbitkit://popup-open` / `orbitkit://popup-close` | `{ id, title, url, width, height }` / `{ id }` | Android PopupSheet flow | Legacy Android bottom-sheet events (`onPopupOpen` / `onPopupClose`). |
| `orbitkit://menu-action` / `orbitkit://mascot-state` | see above | — | Also received by the Android native overlay. |

---

## 5. Error Codes & Normalization

All IPC and bridge failures reject with structured error objects. In TypeScript, errors are instances of `OrbitKitError`. In Rust, errors are `tauri_plugin_orbitkit::Error`.

The error code is strictly one of four variants:

| Error Code | Description | Typical Cause |
|---|---|---|
| `"permission_denied"` | Required platform permission missing. | Overlay permission denied or disabled on Android. |
| `"unsupported"` | Operation not supported on current platform. | `list_popups` or `mascot_monitor` called on mobile; unrecognized platform errors. |
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

---

## 6. Exported Symbol Index (`@orbitkit/ui`)

Every public symbol re-exported from `packages/orbitkit/src/index.ts`:

| Symbol | Kind | Source module | Since |
|---|---|---|---|
| `Mascot`, `RadialMenu`, `PopupSheet`, `Bubble`, `Badge` | Svelte 5 components | `Mascot.svelte`, `RadialMenu.svelte`, `PopupSheet.svelte`, `Bubble.svelte`, `Badge.svelte` | 0.1.0 / 0.2.0 (Bubble, Badge) |
| `layoutItems`, `resolveMenuAngles`, `resolveMenuOrigin` | functions | `geometry.ts` | 0.1.0 / 0.2.0 |
| `ItemPosition`, `AnchorRect`, `MenuOrigin` | types | `geometry.ts` | 0.1.0 / 0.2.0 |
| `fitWindow`, `clampToWorkArea`, `FitWindowResult`, `ClampResult`, `ClampCompensation`, `LogicalRect`, `PhysicalPoint`, `PhysicalRect` | functions/types | `windowFit.ts` | 0.2.0 |
| `MENU_ITEM_ID_REGEX`, `defineConfig`, `withDefaults`, `validateConfig` + config types (`OrbitKitConfig`, `AppConfig`, `MascotConfig`, `MenuConfig`, `MenuStaggerConfig`, `MenuItem`, `MenuItemIconSvg`, `PopupConfig`, `WindowsConfig`, `MascotSheetDef`, `MascotAnchor`, …) and K7 defaults (`DEFAULT_MASCOT_SCALE`, `DEFAULT_MASCOT_ANCHOR`, `DEFAULT_FACE_BY_VELOCITY`, `DEFAULT_ARC_HEAD_GAP`, `DEFAULT_STAGGER`, `DEFAULT_POPUP_ANCHOR`, `DEFAULT_PASSTHROUGH`, `DEFAULT_FIT_CONTENT`, `DEFAULT_MASCOT_WINDOW_LABEL`, `DEFAULT_MASCOT_WINDOW_URL`) | config API | `config.ts` | 0.1.0 / 0.2.0 |
| `sanitizeMenuIconSvg`, `sanitizeMenuIconToDataUrl` | functions | `iconSanitize.ts` | 0.1.0 |
| `MenuStaggerSpec` | type | `menuAnimation.ts` | 0.2.0 |
| `isTauri`, `OrbitKitError`, `normalizeError`, `showOverlay`, `hideOverlay`, `openPopup`, `closePopup`, `listPopups`, `setMascotState`, `emitMenuAction`, `overlayPermission`, `requestOverlayPermission`, `startMascotDrag`, `mascotMonitor`, `setBadge`, `onBadge`, `setParked`, `onPark`, `onPopupOpen`, `onPopupClose`, `onPopupShown`, `onPopupClosed`, `onMenuAction`, `onMascotState`, `onScaleChange` + payload/callback types (`ShowOverlayOptions`, `OpenPopupOptions`, `MenuActionPayload`, `MascotStatePayload`, `PopupLifecyclePayload`, `PopupOpenPayload`, `PopupClosePayload`, `BadgePayload`, `ParkPayload`, `ScaleChangePayload`, `MascotMonitorPayload`, `PhysRect`, `OrbitKitErrorCode`, `MenuActionCallback`, `MascotStateCallback`, `PopupLifecycleCallback`, `PopupOpenCallback`, `PopupCloseCallback`, `BadgeCallback`, `ParkCallback`, `ScaleChangeCallback`, `UnlistenFn`) | bridge | `bridge.ts` | 0.1.0 / 0.2.0 |
| `createDragGesture`, `DRAG_THRESHOLD`, `DEFAULT_DRAG_CLEAR_DELAY` + drag types (`DragGestureOptions`, `DragGesture`, …) | gesture FSM | `dragGesture.ts` | 0.2.0 |
| `startPassthrough`, `toLogical`, `rectContains`, `MIN_PASSTHROUGH_INTERVAL_MS`, `DEFAULT_PASSTHROUGH_INTERVAL_MS` + control/types (`PassthroughController`, `PassthroughOptions`, `PassthroughWindow`, `HitRegion`, `RectEdges`, `PhysicalPositionLike`) | passthrough | `passthrough.ts` | 0.2.0 |
| `frameAt`, `sheetFrameStyle`, `sheetGeometry`, `SheetGeometry` | sheets math | `mascot/sheets.ts` | 0.2.0 |
| `createMachine`, `hint`, `tick`, `MascotMachine`, `MascotMachineOptions`, `MascotMachineSnapshot`, `MascotRnd` | mascot FSM | `mascotMachine.ts` | 0.2.0 |
| `MAX_STEP_MS`, `MIN_ROAM_INTERVAL_MS`, `aimRoamVelocity`, `createRoam`, `createRoamDrag`, `rebaseRoamBounds`, `roamBounds`, `startRoam`, `stepRoam` + roam types (`StartRoamOptions`, `RoamController`, `RoamHandle`, `RoamState`, `RoamWindow`, `RoamWindowSize`, `RoamWindowSizeSource`, `CreateRoamOptions`, `RoamDragOptions`, `RoamDragBinding`) | roam | `roam.ts` | 0.2.0 |
| `createPark`, `parkCornerPosition` + park types (`CreateParkOptions`, `ParkHandle`, `ParkCorner`, `ParkWindow`, `ParkWindowSize`, `ParkWindowSizeSource`) | park | `park.ts` | 0.2.0 |
| `DeepPartial`, `MascotStateName`, `MascotSpriteState`, `MascotPoolState`, `MascotStateDefinition`, `MascotKind`, `MenuLayout`, `MenuArcPosition`, `MenuAnimation`, `MenuArcConfig`, `PopupAnchor`, `MascotRoamCorner`, `MascotRoamConfig`, `MascotWindowConfig` | types | `config.ts` / `windowFit.ts` | 0.1.0 / 0.2.0 |

Rust plugin commands (declared in `crates/tauri-plugin-orbitkit/build.rs`): `overlay_permission`, `request_overlay_permission`, `show_overlay`, `hide_overlay`, `open_popup`, `close_popup`, `list_popups`, `set_mascot_state`, `emit_menu_action`, `start_mascot_drag`, `mascot_monitor`. Pure Rust helpers: `place_popup` / `place_popup_with_pad` (`src/placement.rs`).
