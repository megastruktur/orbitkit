# Windows Platform Guide

This guide covers Windows-specific window management, transparency configuration, and Microsoft WebView2 considerations for OrbitKit applications.

---

## 1. Transparency & Frameless Windowing

On Windows (Windows 10 and Windows 11), OrbitKit creates the mascot overlay window using borderless transparency:

```rust
WebviewWindowBuilder::new(&app, "orbitkit-mascot", WebviewUrl::App("index.html?orbitkit=mascot".into()))
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
```

### Key Behaviors
- **Transparency**: Windows supports alpha transparency through WebView2. Background pixels with `rgba(0, 0, 0, 0)` render fully transparent visually.
- **Frameless (`decorations: false`)**: Strips the standard Windows title bar, minimize/maximize boxes, and system window border.
- **Taskbar Isolation (`skip_taskbar: true`)**: The mascot overlay does not generate an independent icon in the Windows taskbar, leaving only the primary application window in taskbar management and Alt+Tab cycling.
- **Z-Order (`always_on_top: true`)**: Windows applies `HWND_TOPMOST` to the mascot window, keeping it pinned above standard application windows.

---

## 2. Microsoft Edge WebView2 Runtime

Tauri v2 on Windows relies on Microsoft Edge WebView2 (Chromium engine) for webview rendering:

- **Availability**: Pre-installed as an OS component on all versions of Windows 11 and updated installations of Windows 10.
- **Evergreen Distribution**: Tauri defaults to the Evergreen WebView2 distribution, which receives automatic updates alongside Microsoft Edge security releases.
- **Bundle Options**: If targeting air-gapped or legacy Windows environments, Tauri's `bundle.windows.webviewInstallMode` in `tauri.conf.json` can be configured to embed the standalone WebView2 installer or download it via bootstrapper.

---

## 3. High-DPI Display Scaling

Windows widely uses fractional scaling (such as 125%, 150%, or 175%) on high-resolution displays.

OrbitKit's window manager handles fractional DPI scaling automatically:
1. Queries `monitor.scale_factor()`.
2. Converts physical monitor boundaries (`monitor.position()` and `monitor.size()`) into logical pixel space.
3. Positions the mascot overlay window at:
   $$x = \text{monitorWidth} - \text{windowSize} - 24\text{ px}$$
   $$y = \text{monitorHeight} - \text{windowSize} - 24\text{ px}$$
This ensures the mascot remains properly anchored to the bottom-right corner without being shifted offscreen or cropped across different display scales.

---

## 4. Console Window in Debug Builds

<a id="console-window-in-debug-builds"></a>

When running or compiling debug binaries (`tauri build --debug` or `tauri dev`), Windows displays an attached console window alongside the application. This is expected behavior: it carries the application's stdout/stderr log output during development.

Production release builds (`pnpm tauri build`) do not display a console window because `examples/starter/src-tauri/src/main.rs` includes the Windows subsystem attribute:

```rust
// Prevents an additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
```

Applications built on OrbitKit should keep this attribute in their own `src-tauri/src/main.rs` to ensure the console window is suppressed in release builds while remaining available for debugging.
