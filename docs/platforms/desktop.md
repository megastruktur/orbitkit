# Desktop Platform Guide

OrbitKit on desktop platforms (Linux, macOS, and Windows) utilizes Tauri v2's multi-window capabilities to host the mascot and radial menu in a transparent, frameless window and launch auxiliary popups.

---

## 1. Multi-Window Desktop Model

On desktop platforms, OrbitKit manages three classes of windows:

```
+--------------------------------------------------------------------------+
| Desktop Display (Primary Monitor)                                        |
|                                                                          |
|   +----------------------------+                                         |
|   | Main Application Window    |                                         |
|   | label: "main"              |                                         |
|   | URL: "index.html"          |                                         |
|   +----------------------------+                                         |
|                                                                          |
|                   +---------------------------+                          |
|                   | Popup Window              |                          |
|                   | label: "orbitkit-popup-*" |                          |
|                   | URL: "index.html?popup=*" |                          |
|                   +---------------------------+                          |
|                                                                          |
|                                        +------------------------------+  |
|                                        | Mascot Overlay Window        |  |
|                                        | label: "orbitkit-mascot"     |  |
|                                        | URL: "?orbitkit=mascot"      |  |
|                                        | Frameless, Transparent       |  |
|                                        +------------------------------+  |
+--------------------------------------------------------------------------+
```

1. **Main Application Window**:
   Standard window (`main`) defined in `tauri.conf.json`.
2. **Mascot Window (`orbitkit-mascot`)**:
   Created dynamically when `show_overlay` is invoked (or via router if pre-opened).
   - Loads: `index.html?orbitkit=mascot`.
   - Window properties: `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `shadow: false`.
3. **Popup Windows (`orbitkit-popup-<id>`)**:
   Created dynamically when `open_popup(id)` is invoked.
   - Loads URL configured in `windows.popups` (e.g. `index.html?popup=notes`).
   - If already open, `open_popup(id)` restores focus.

---

## 2. Overlay Sizing & Positioning

### Overlay Window Sizing

The mascot overlay window must be large enough to contain both the mascot and the fully expanded radial menu without clipping:

$$\text{Overlay Size} = \max(\text{mascotSize}, 2 \times (\text{radius} + \text{itemSize})) + 16\text{ px}$$

- Calculated dynamically by `calculate_overlay_size()` in `tauri-plugin-orbitkit::desktop`.
- 16px of safety padding ensures radial drop-shadows and hover scales are not truncated.

### Positioning

- **Default**: Positioned at the bottom-right corner of the primary monitor with a 24px margin.
- **Explicit Override**: Configured via `windows.mascotWindow.x` and `windows.mascotWindow.y`.

---

## 3. Linux Compositor & Window Manager Notes

### Transparent Window Support

On Linux, window background transparency requires an active compositing window manager or Wayland compositor:
- **X11**: Requires a compositor such as `picom`, `compton`, `mutter` (GNOME), or `kwin` (KDE). In uncomposited environments (such as raw `Xvfb` or minimal window managers without compositors), transparent areas may render as solid black rectangles.
- **Wayland**: Supported natively across modern Wayland compositors (GNOME Shell, Sway, KDE Plasma).

### System Dependencies

Building and running Tauri desktop apps on Linux requires `webkit2gtk-4.1`, `gtk3`, and `libsoup-3.0`.

---

## 4. Containerized Linux Desktop Runner (`scripts/linux-desktop.sh`)

When working in environments without local WebKitGTK development packages, OrbitKit provides a containerized workflow using Docker and Xvfb.

```bash
# 1. Build or refresh container image
scripts/linux-desktop.sh image

# 2. Compile Tauri application inside container
scripts/linux-desktop.sh build examples/starter

# 3. Run application in headless Xvfb, capture screenshot, and dump log
scripts/linux-desktop.sh run-screenshot examples/starter /tmp/desktop.png 15

# 4. Run automated scenario script against live application
scripts/linux-desktop.sh run-scenario examples/starter evidence/sdk-v1/starter-example/run-desktop-flow.sh

# 5. Execute arbitrary command inside container with app running ($APP_PID exported)
scripts/linux-desktop.sh exec examples/starter -- xdotool search --name "orbitkit"
```

### Environment Variable Passthrough

`scripts/linux-desktop.sh` automatically captures and passes through any host environment variable prefixed with `ORBITKIT_*` into the container, allowing remote test control.

---

## 5. Development & Selftest Hooks (Debug Builds Only)

For automated end-to-end testing and CI pipelines, `tauri-plugin-orbitkit` includes non-intrusive selftest hooks compiled only under `cfg(debug_assertions)`:

- `ORBITKIT_SELFTEST=1`:
  Spawns a background thread on startup that waits 2 seconds, displays the mascot overlay window, and opens the first configured popup window.
- `ORBITKIT_SELFTEST_CONFIG=<path-to-json>`:
  Points to an alternate JSON configuration file, dynamically overriding the compiled `OrbitKitConfig` for that run.

In release builds, these hooks are completely compiled out.

---

## 6. Operating System Specific Guides

- [macOS Platform Guide](macos.md) — Transparency private API and entitlements.
- [Windows Platform Guide](windows.md) — WebView2 runtime and frameless window behavior.
