import { defineConfig, validateConfig } from "@orbitkit/ui";

export const config = defineConfig({
  mascot: {
    kind: "svg",
    src: "<svg viewBox='0 0 96 96'></svg>",
    size: 96,
    initialState: "idle",
  },
  menu: {
    items: [
      { id: "chat", label: "Chat" },
      { id: "settings", label: "Settings" },
    ],
    radius: 96,
    startAngle: -90,
    endAngle: 270,
    itemSize: 44,
    trigger: "click",
  },
  windows: {
    popups: [],
  },
});

export const validation = validateConfig(config);
