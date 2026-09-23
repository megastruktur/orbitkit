# macOS Platform Guide

This guide covers macOS-specific configuration, window transparency settings, and entitlements for OrbitKit applications.

---

## 1. Window Transparency & `macOSPrivateApi`

To achieve seamless, borderless transparency for the floating mascot window on macOS, Tauri requires private WebKit/AppKit APIs:

In `src-tauri/tauri.conf.json`:

```json
{
  "app": {
    "macOSPrivateApi": true
  }
}
```

### Why This Is Required
By default, macOS `NSWindow` imposes window borders and backgrounds on WebKit webviews. Enabling `macOSPrivateApi: true` allows Tauri to clear the window backing store and render genuine alpha transparency without visual artifacts.

### Mac App Store Considerations
Apple's automated Mac App Store ingestion scans may flag private AppKit symbols associated with `macOSPrivateApi: true`. For Mac App Store builds, consider whether standard window styling or non-private APIs are required.

---

## 2. Window Shadow & Leveling

### Shadow Cutout
Frameless transparent windows can cast a rectangular drop-shadow matching the window bounding box rather than the mascot contour.
- `tauri-plugin-orbitkit` explicitly initializes the `orbitkit-mascot` window with `.shadow(false)` on desktop platforms to prevent rectangular window shadows.

### Floating Window Level
The mascot window is initialized with `.always_on_top(true)`. On macOS, this sets the window level to floating, keeping the mascot positioned above standard application windows.

---

## 3. Entitlements & Permissions

### Core Plugin
Core OrbitKit requires **no special macOS permissions or entitlements**. It does not request Accessibility, Screen Capture, or Microphone access.

### Extensions
The bundled `tauri-plugin-orbitkit-recorder` extension implements real microphone capture and foreground services exclusively on Android. Its desktop implementation is an in-memory mock (`crates/tauri-plugin-orbitkit-recorder/src/desktop.rs`) that does not interface with host audio hardware or require macOS audio entitlements.
---

## 4. Multi-Monitor & Spaces

OrbitKit retrieves primary monitor dimensions via `app.primary_monitor()` to calculate bottom-right coordinates for the mascot. On multi-monitor setups, the mascot anchors to the display designated as primary in macOS System Settings.
