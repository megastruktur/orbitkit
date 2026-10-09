# Changelog

All notable changes to the OrbitKit workspace are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

Nothing yet.

## [0.3.0] — 2026-10-09

### Added

- **`Mascot` (`kind: "sheets"`) canvas renderer** — opt-in `renderer: "canvas"` blits the active sheet frame with an integer `drawImage` (`sx = frame * frameWidth`) onto a `<canvas aria-hidden="true">` whose bitmap is scaled by `devicePixelRatio` (CSS size stays logical), with `imageSmoothingEnabled = false` for crisp pixel-art upscale and `faceByVelocity` mirroring via `translate`/`scale(-1, 1)`. Default `renderer: "css"` keeps the existing background-position div rendering untouched.
- **`RoamController.resume(at?, heading?)`** — optional direction vector: the loop walks at `speed` along `heading` instead of aiming at the zone centre, so a host scheduler can choose the walk direction (and with `faceByVelocity`, the facing). A zero heading falls back to the centre aim.
- **Roam axis lock (`roam.axis: MascotRoamAxis`)** — `"2d"` (default) roams and bounces in both axes, `"horizontal"` pins the motion to the X axis (`vy = 0` for the loop's whole life — floor pets), `"vertical"` pins it to the Y axis (`vx = 0` — wall crawlers). Accepted on `MascotRoamConfig.axis` (forwarded by `createRoam`) and `StartRoamOptions.axis`; `aimRoamVelocity` takes the axis as a 4th argument and forces the matching lock on a degenerate zone (zero height ⇒ horizontal, zero width ⇒ vertical). `resume(at, heading)` keeps the locked component at 0.
- **`menu.trigger: "right-click"`** — the radial/arc menu opens on the right mouse button (default stays `"click"`; `"hover"` unchanged). The `MenuTrigger` union grows to `"click" | "hover" | "right-click"`; the Rust `MenuTrigger` mirror moved to `#[serde(rename_all = "kebab-case")]` so `RightClick` serializes as `"right-click"` while the historical `"click"`/`"hover"` spellings are byte-identical. Drag-gesture disambiguation treats the right button the same as the left (drag vs. click-toggle threshold).
- **Hovered-item caption (K14, `menu.caption: boolean`)** — when `true`, the menu container renders exactly ONE `.orbitkit-caption` span mirroring the hovered/keyboard-focused enabled item's label and suppresses the per-item `::after` tooltips. Default `false` — absent keeps the rendered DOM byte-identical. Documented in `docs/api.md` / `docs/configuration.md`.
- **CSS theming tokens for radial items and captions** — item background/border/color/hover states and the caption are styled through custom properties (`--orbitkit-item-bg`, `--orbitkit-item-border`, `--orbitkit-item-color`, `--orbitkit-item-hover-*`, `--orbitkit-caption-bg/color`) with the previous visuals as fallback defaults, so hosts can re-theme the menu without overriding component CSS.
- **Horizontal arc captions & origin (K14 follow-up)** — `AnchorRect.position` ("top" | "bottom" | "left" | "right") now steers `resolveMenuOrigin`: left/right arcs anchor beside the mascot's vertical midpoint and captions get `orbitkit-caption-arc-left/-right` placement so they sit beside the items instead of colliding with the mascot.
- **`<Mascot />` `children` snippet slot** — hosts can render extra overlay elements (badges, effects) inside the mascot root, inheriting its positioning.
- **`prepare` script on `@orbitkit/ui`** (`"prepare": "pnpm build"`) — installing the package from a git URL builds `dist/` automatically.
- **Canvas sheets demo (starter)** — the starter demo renders the sheets mascot through the canvas engine and ships an updated showcase video.

### Fixed

- **`Mascot` (`kind: "sheets"`) clipped frames wider/taller than `size`** — the `overflow: hidden` root was a fixed `size`×`size` square; it now wraps the active frame (`frameWidth/Height × scale`), so wide run/jump strips render whole and the hit box follows the pose. `--mascot-size` still reflects `size`.
- **`Mascot` (`kind: "sheets"`) root no longer clips** — `overflow: visible` for sheets, set inline and by `.orbitkit-mascot--sheets` (so neither a consumer class nor a consumer `style` prop restores clipping); fractional-DPI rounding can no longer shave an edge column off a frame. Other kinds keep the stylesheet `overflow: hidden`, overridable by a class.
- **`sheetGeometry` snaps fractional `frameWidth`/`frameHeight` to whole pixels** (minimum 1; non-finite → 1) — off-grid frame steps bled a neighbouring frame's column in or cut an edge one.
- **`RadialMenu` ignores `::after` pseudo-element `transitionend`/`animationend`** when sequencing the open/close wave.

### Changed

- **`@orbitkit/ui` → `0.3.0`, `tauri-plugin-orbitkit` → `0.3.0`** — packages versioned in lockstep for the 0.3.0 release.
- **`RadialMenu` items are icon-only** — the label is never drawn inside the 44 px circle (it overflowed); it stays as `aria-label` and `title`, and a styled tooltip (`::after`, `content: attr(aria-label)`) shows it on `:hover` / `:focus-visible`, placed just outside the circle along the item's outward direction (`--orbitkit-radial-tip-x/y`, set inline). Items without a renderable icon draw an empty circle. The `.orbitkit-radial-label` class is gone.

## [0.2.0] — 2026-09-29

### Added

- **Sprite-sheet mascot (`mascot.kind: "sheets"`, K7)** — pixel-art sheet definitions (`sheets: Record<string, { src, frameWidth, frameHeight, frames, fps, loop? }>`) with integer `scale` (pixelated upscale), `anchor` (`bottom-center` | `center`), `faceByVelocity` mirroring, and state pools (`states: { pool, priority?, ttlMs? }`) driven by the pure `createMachine`/`hint`/`tick` mascot machine.
- **`menu.layout: "arc-anchor"` (K7)** — top-centred arc whose origin is resolved by `resolveMenuOrigin` at `menu.arc.headGap` px (default 12) above the mascot's top edge; per-item open/close stagger via `menu.stagger` (defaults 260/180/40 ms, centre→edges on open, edges→centre on close).
- **Inline SVG menu icons (K7)** — `MenuItem.icon` accepts `{ svg: string }`, sanitized via `sanitizeMenuIconSvg`.
- **Menu layout `"orbit" | "arc"` (K2-A1)** — optional `menu.layout: "arc"` with `menu.arc { position: "top" | "bottom" | "left" | "right", span 30..300 }`, pure `resolveMenuAngles` angle resolver (canonical vectors codified in `arc-vectors.json`), and `menu.animation: "spawn" | "none"` where `"none"` disables menu transitions; validated in `validateConfig` with a Rust config mirror.
- **Window fit & monitor work area (K9)** — `fitWindow` / `clampToWorkArea` (with `compensation {dx,dy}`) and the `mascot_monitor` command returning `{ workArea, scaleFactor }` for the monitor containing the mascot window centre; opt-in `windows.mascotWindow.fitContent`.
- **Click-through passthrough (K10)** — opt-in `windows.mascotWindow.passthrough` with `registerHitRegion`, ≤10 Hz cursor polling (default 150 ms), polling suspended while parked.
- **Anchored, parameterised popups (K11)** — `openPopup(id, { params, instanceKey })` with `{param}` URL-encoded substitution, `instanceKey` multi-instance labels `orbitkit-popup-{id}[-{instanceKey}]`, idempotent show+focus+re-anchor, `anchor: "mascot" | "center"`, URL allow-list (`app.allowedOrigins`), Rust `place_popup` pure placement, and `orbitkit://popup-shown`/`popup-closed` events.
- **Roam & drag-resume** — `startRoam`/`createRoam`/`createRoamDrag`: roaming inside a work-area corner zone, facing by horizontal velocity, drag pauses roaming and resumes around the drop point; hands setPosition only integer physical px.
- **Android in-app popups (K4/K5)** — `open_popup`/`close_popup` on Android drive an in-app popup sheet: shared `lookup_popup` (unknown id → `not_found`), native `bringToFront` reorders the activity to front and collapses the overlay menu, and `orbitkit://popup-open`/`popup-close` events reach the in-app webview; desktop unchanged.
- **Mascot window dragging & gesture state machine** — `startMascotDrag()` bridge helper calling the plugin `start_mascot_drag` command (native `window.start_dragging()` on desktop, no-op on mobile) and pure `createDragGesture` state machine disambiguating drag (> 4 px threshold) from click toggle, suppressing clicks during drag and collapsing open menus on drag start.
- **Park / do-not-disturb** — `setParked`/`onPark` (`orbitkit://park`), park-to-corner placement via `parkCornerPosition`/`createPark`.
- **Bubble & badge** — `<Bubble />` speech bubble and `<Badge />` unread-count components; `setBadge`/`onBadge` (`orbitkit://badge`).
- Starter example covering the full B1+B2 demo surface (sheets mascot, arc-anchor menu, roam, drag-resume, note/settings popups with anchors, bubble, badge, park).

### Changed

- `MENU_ITEM_ID_REGEX` widened to `^[a-z0-9][a-z0-9_.:-]{0,63}$` (K7, TS + Rust identical).
- Radial menu items animate with per-item stagger (centre→edges on open, edges→centre on close); the mascot window keeps a single fixed size across open/close (no native resize, no mascot jump).
- `@orbitkit/ui` and `tauri-plugin-orbitkit` versioned `0.2.0`.
- **Breaking**: `close_popup` takes the window `label` (K11 `orbitkit-popup-{id}` or `orbitkit-popup-{id}-{instanceKey}`, as reported by `listPopups` and the `orbitkit://popup-shown {label}` event) — 0.1.0 took the popup `id`; on desktop a bare popup id returns `not_found`; the Android arm still accepts a bare id (it adds the `orbitkit-popup-` prefix). `open_popup` takes `{id, params?, instanceKey?}` (K11 label-based popups).

### Fixed

- Mascot window re-clamps at monitor edges after roam/drag without native resize flicker (Design B fixed-size window).
- Roam `setPosition` rounding: only integer physical px are handed to the window; internal state stays fractional.

### Known limitations

- **Popup placement prefers above-RIGHT** (K11 contract text says above-LEFT). The CuteCare-port behaviour is documented in `docs/api.md` §1.2 and covered by unit tests.
- **Mixed-DPI Windows placement**: popup placement on Windows may be off by the scale ratio (newly created popups vs. re-opened ones use different coordinate units).
- **Coordinate-space switch**: macOS/Linux vs. Windows differ in where physical/logical coordinate spaces switch; there is no single authoritative unit source. This is documented in `docs/configuration.md` §2.1 but has **no unit test**.
- **Roam re-clamp delay**: at very slow roam speeds, a drop outside the roam zone can take up to ~5 ticks (~170 ms) before the first re-clamp.
- **Park vs. sleep race (narrow)**: a state hint arriving between the forced sleep and `parked = true` can replace the sleep state.
- **App-relative popup URLs reject `:` anywhere in the string**, not only in the scheme position, so a path containing a colon (e.g. `index.html?a=b:c`) is rejected as `invalid_config`.

---

## [0.1.0] - 2026-09-23

Initial release of the OrbitKit SDK.

### Added

#### Frontend (`@orbitkit/ui`)
- **`<Mascot />` Svelte 5 Component**:
  - Secure SVG rendering using data URLs (`data:image/svg+xml;charset=utf-8,...`) via `<img>` (K3-A3) to prevent script execution, DOM clobbering, and mXSS.
  - Frame-based CSS sprite sheet animations with configurable FPS, looping, row indexing, and OS reduced-motion detection.
  - Static image support (PNG, WebP, SVG).
- **`<RadialMenu />` Svelte 5 Component**:
  - Math-driven item positioning (`layoutItems`) supporting full 360-degree circles or custom angle arcs.
  - Configurable interaction triggers: `"click"` or `"hover"`.
  - Accessible keyboard navigation and outside-click dismissal.
- **Typed Configuration (Contract K2)**:
  - `defineConfig`: Identity helper providing TypeScript autocompletion.
  - `validateConfig`: Runtime validation enforcing item limits (1..12), regex identifier constraints (`^[a-z0-9][a-z0-9_-]{0,31}$`), and positive geometry dimensions.
  - `withDefaults`: Populates fallback values for optional configuration parameters.
- **Typed IPC Bridge**:
  - Non-Tauri safe wrappers: `showOverlay`, `hideOverlay`, `openPopup`, `closePopup`, `setMascotState`, `emitMenuAction`, `overlayPermission`, `requestOverlayPermission`, `isTauri`.
  - Event listeners: `onMenuAction` (`orbitkit://menu-action`) and `onMascotState` (`orbitkit://mascot-state`).
  - Structured error handling: `OrbitKitError` mapped strictly to four codes (`permission_denied`, `unsupported`, `not_found`, `invalid_config`).
- **Assets**:
  - Bundled default planet mascot asset exported at `@orbitkit/ui/assets/default-mascot.svg`.

#### Plugin (`tauri-plugin-orbitkit`)
- **Desktop Multi-Window Engine**:
  - Frameless, transparent mascot window (`orbitkit-mascot`) loaded at `index.html?orbitkit=mascot`.
  - Dynamic sizing calculation: $\max(\text{mascotSize}, 2 \times (\text{radius} + \text{itemSize})) + 16\text{ px}$.
  - Auxiliary popup window lifecycle management (`orbitkit-popup-*`).
  - Automated debug selftest hooks (`ORBITKIT_SELFTEST=1` and `ORBITKIT_SELFTEST_CONFIG=<json>`).
- **Android Native Overlay**:
  - Floating `WindowManager` view (`TYPE_APPLICATION_OVERLAY`) using `android.permission.SYSTEM_ALERT_WINDOW`.
  - Native Kotlin touch handling and radial button expansion.
  - Direct JNI bridge (`OrbitkitJniBridge`) delivering actions to Rust even when the Chromium WebView is throttled or suspended in the background.
  - Rust `OrbitkitExt` trait exposing `app.on_menu_action(...)` and `app.orbitkit()`.

#### Extension (`tauri-plugin-orbitkit-recorder`)
- Modular audio recording plugin illustrating the extension pattern with zero permission footprint on core OrbitKit.
- Android `OrbitkitRecorderService` microphone foreground service.
- Disk-backed atomic state persistence (`OrbitkitStatePersistence`) ensuring spool files survive OS Low Memory Killer (LMK) process termination.

#### Starter Example (`examples/starter`)
- End-to-end runnable Tauri v2 + Svelte 5 application.
- Demonstrates mascot state transitions (`idle` to `busy`), Notes and Settings popups, and native quit action.

#### Build Tools & CI
- `scripts/linux-desktop.sh`: Containerized Linux desktop compiler, Xvfb headless runner, screenshot capture, and automated scenario runner.
- Multi-platform GitHub Actions CI matrix for Linux, Windows, macOS, and Android.
