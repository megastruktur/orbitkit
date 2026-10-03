import { mount, tick } from "svelte";
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
  // K14: single caption label instead of per-item ::after tooltips.
  caption: true,
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
  // K14: single caption label instead of per-item ::after tooltips.
  caption: true,
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

// K14 RT-1 capture hooks: ?only=ring|arc isolates one menu for the 360x640
// screenshots; ?hover=<id> / ?focus=<id> set the caption source
// programmatically (the headless shell has no real pointer or keyboard).
const captureParams = new URLSearchParams(window.location.search);
const captureHoverId = captureParams.get("hover");
const captureFocusId = captureParams.get("focus");

if (captureParams.get("only") === "ring" && arcEl) {
  (arcEl.closest(".demo-card") as HTMLElement | null)?.style.setProperty(
    "display",
    "none"
  );
} else if (captureParams.get("only") === "arc" && fullEl) {
  (fullEl.closest(".demo-card") as HTMLElement | null)?.style.setProperty(
    "display",
    "none"
  );
}

function driveCaption(
  root: HTMLElement | null,
  hoverId: string | null,
  focusId: string | null
): void {
  if (!root || (!hoverId && !focusId)) return;
  if (hoverId) {
    root
      .querySelector(`[data-orbitkit-radial-item="${hoverId}"]`)
      ?.dispatchEvent(new PointerEvent("pointerenter"));
  }
  if (focusId) {
    root
      .querySelector<HTMLElement>(`[data-orbitkit-radial-item="${focusId}"]`)
      ?.focus();
  }
}

// Items land in the DOM only after mount's first flush — wait for it,
// then drive the caption sources.
await tick();
driveCaption(fullEl, captureHoverId, captureFocusId);
driveCaption(arcEl, captureHoverId, captureFocusId);
