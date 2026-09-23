# `@orbitkit/ui`

Svelte 5 + TypeScript frontend library for [OrbitKit](../../README.md), providing the interactive floating mascot component, configurable radial action menu, geometry calculations, and typed Tauri v2 IPC bridge.

---

## Installation

```bash
pnpm add @orbitkit/ui
```

### Peer Dependencies
- `svelte`: `^5.0.0`
- `@tauri-apps/api`: `2.11.1`

---

## Features

- **`<Mascot />`**: Svelte 5 component supporting SVG markup (securely sandboxed via `<img>` data URLs per K3-A3), static image assets, and animated CSS sprite sheets.
- **`<RadialMenu />`**: Svelte 5 radial action menu positioned along mathematical arcs with click or hover triggers.
- **`layoutItems` & `ItemPosition`**: Pure geometry function calculating circular and arc item coordinates.
- **Typed Config**: `defineConfig`, `validateConfig`, and `withDefaults` enforcing the K2 schema.
- **Typed IPC Bridge**: Non-Tauri safe wrappers around Tauri v2 commands (`showOverlay`, `hideOverlay`, `openPopup`, `closePopup`, `setMascotState`, `emitMenuAction`, `overlayPermission`, `requestOverlayPermission`).
- **Events**: `onMenuAction` and `onMascotState` listener subscriptions with unlisten handles.
- **Assets**: Bundled default planet mascot graphic at `@orbitkit/ui/assets/default-mascot.svg`.

---

## Quick Example

```svelte
<script lang="ts">
  import {
    Mascot,
    RadialMenu,
    showOverlay,
    openPopup,
    onMenuAction,
    defineConfig,
    type OrbitKitConfig
  } from "@orbitkit/ui";

  const config: OrbitKitConfig = defineConfig({
    mascot: {
      kind: "svg",
      src: "<svg width=\"160\" height=\"160\" viewBox=\"0 0 160 160\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"80\" cy=\"80\" r=\"56\" fill=\"#4f7cff\" /></svg>",
      size: 96,
      initialState: "idle"
    },
    menu: {
      items: [
        { "id": "notes", "label": "Notes" },
        { "id": "quit", "label": "Quit" }
      ],
      radius: 96,
      startAngle: -90,
      endAngle: 270,
      itemSize: 44,
      trigger: "click"
    },
    windows: {
      popups: [
        {
          "id": "notes",
          "url": "index.html?popup=notes",
          "title": "Notes",
          "width": 320,
          "height": 420
        }
      ]
    }
  });

  let menuOpen = $state(false);

  onMenuAction((action) => {
    if (action.id === "notes") {
      openPopup("notes");
    }
  });
</script>

<div class="container">
  <Mascot
    {config}
    state="idle"
    onclick={() => (menuOpen = !menuOpen)}
  />

  <RadialMenu
    config={config.menu}
    open={menuOpen}
    onselect={(id) => {
      menuOpen = false;
    }}
    onclose={() => (menuOpen = false)}
  />
</div>
```

---

## Documentation

For full details, see the project documentation:
- [API Reference](../../docs/api.md)
- [Configuration Reference](../../docs/configuration.md)
- [Getting Started Guide](../../docs/getting-started.md)
