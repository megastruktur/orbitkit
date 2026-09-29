# Changelog

All notable changes to the OrbitKit workspace are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] — 2026-09-29

### Added

- **Sprite-sheet mascot (`mascot.kind: "sheets"`, K7)** — pixel-art sheet definitions (`sheets: Record<string, { src, frameWidth, frameHeight, frames, fps, loop? }>`) with integer `scale` (pixelated upscale), `anchor` (`bottom-center` | `center`), `faceByVelocity` mirroring, and state pools (`states: { pool, priority?, ttlMs? }`) driven by the pure `createMachine`/`hint`/`tick` mascot machine.
- **`menu.layout: "arc-anchor"` (K7)** — top-centred arc whose origin is resolved by `resolveMenuOrigin` at `menu.arc.headGap` px (default 12) above the mascot's top edge; per-item open/close stagger via `menu.stagger` (defaults 260/180/40 ms, centre→edges on open, edges→centre on close).
- **Inline SVG menu icons (K7)** — `MenuItem.icon` accepts `{ svg: string }`, sanitized via `sanitizeMenuIconSvg`.
- **Window fit & monitor work area (K9)** — `fitWindow` / `clampToWorkArea` (with `compensation {dx,dy}`) and the `mascot_monitor` command returning `{ workArea, scaleFactor }` for the monitor containing the mascot window centre; opt-in `windows.mascotWindow.fitContent`.
- **Click-through passthrough (K10)** — opt-in `windows.mascotWindow.passthrough` with `registerHitRegion`, ≤10 Hz cursor polling (default 150 ms), polling suspended while parked.
- **Anchored, parameterised popups (K11)** — `openPopup(id, { params, instanceKey })` with `{param}` URL-encoded substitution, `instanceKey` multi-instance labels `orbitkit-popup-{id}[-{instanceKey}]`, idempotent show+focus+re-anchor, `anchor: "mascot" | "center"`, URL allow-list (`app.allowedOrigins`), Rust `place_popup` pure placement, and `orbitkit://popup-shown`/`popup-closed` events.
- **Roam & drag-resume** — `startRoam`/`createRoam`/`createRoamDrag`: roaming inside a work-area corner zone, facing by horizontal velocity, drag pauses roaming and resumes around the drop point; hands setPosition only integer physical px.
- **Park / do-not-disturb** — `setParked`/`onPark` (`orbitkit://park`), park-to-corner placement via `parkCornerPosition`/`createPark`.
- **Bubble & badge** — `<Bubble />` speech bubble and `<Badge />` unread-count components; `setBadge`/`onBadge` (`orbitkit://badge`).
- Starter example covering the full B1+B2 demo surface (sheets mascot, arc-anchor menu, roam, drag-resume, note/settings popups with anchors, bubble, badge, park).

### Changed

- `MENU_ITEM_ID_REGEX` widened to `^[a-z0-9][a-z0-9_.:-]{0,63}$` (K7, TS + Rust identical).
- Radial menu items animate with per-item stagger (centre→edges on open, edges→centre on close); the mascot window keeps a single fixed size across open/close (no native resize, no mascot jump).
- `@orbitkit/ui` and `tauri-plugin-orbitkit` versioned `0.2.0`.

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
