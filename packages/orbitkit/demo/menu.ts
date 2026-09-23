import { mount } from "svelte";
import RadialMenu from "../src/RadialMenu.svelte";
import type { MenuConfig } from "../src/config";

const fullRingConfig: MenuConfig = {
  items: [
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "settings", label: "Settings", icon: "⚙️" },
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "alerts", label: "Alerts", icon: "🔔" },
    { id: "search", label: "Search", icon: "🔍" },
    { id: "help", label: "Help", icon: "❓" },
  ],
  radius: 110,
  startAngle: -90,
  endAngle: 270,
  itemSize: 52,
  trigger: "click",
};

const halfArcConfig: MenuConfig = {
  items: [
    { id: "cut", label: "Cut", icon: "✂️" },
    { id: "copy", label: "Copy", icon: "📋" },
    { id: "paste", label: "Paste", icon: "📄" },
    { id: "delete", label: "Delete", icon: "🗑️", disabled: true },
  ],
  radius: 110,
  startAngle: -90,
  endAngle: 90,
  itemSize: 52,
  trigger: "click",
};

const fullStatusEl = document.getElementById("full-status");
const fullEl = document.getElementById("full-ring-target");
if (fullEl) {
  mount(RadialMenu, {
    target: fullEl,
    props: {
      config: fullRingConfig,
      open: true,
      onselect: (id: string) => {
        if (fullStatusEl) fullStatusEl.textContent = `Selected: ${id}`;
      },
      onclose: () => {
        if (fullStatusEl) fullStatusEl.textContent = "Closed";
      },
    },
  });
}

const arcStatusEl = document.getElementById("arc-status");
const arcEl = document.getElementById("half-arc-target");
if (arcEl) {
  mount(RadialMenu, {
    target: arcEl,
    props: {
      config: halfArcConfig,
      open: true,
      onselect: (id: string) => {
        if (arcStatusEl) arcStatusEl.textContent = `Selected: ${id}`;
      },
      onclose: () => {
        if (arcStatusEl) arcStatusEl.textContent = "Closed";
      },
    },
  });
}
