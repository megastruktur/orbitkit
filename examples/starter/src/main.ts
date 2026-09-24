import { invoke } from "@tauri-apps/api/core";

if (import.meta.env.VITE_ORBITKIT_DEBUG === "1") {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  const forward = (level: string, ...args: unknown[]) => {
    try {
      const text = args
        .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
      invoke("log_telemetry", { msg: `[${level}] ${text}` }).catch(() => {});
    } catch {}
  };

  console.log = (...args: unknown[]) => {
    origLog(...args);
    forward("console.log", ...args);
  };
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    forward("console.warn", ...args);
  };
  console.error = (...args: unknown[]) => {
    origError(...args);
    forward("console.error", ...args);
  };
}

import { mount, type Component } from "svelte";
import MainView from "./views/MainView.svelte";
import MascotView from "./views/MascotView.svelte";
import { popupComponents, popupFallback } from "./popupViews";

const params = new URLSearchParams(window.location.search);

let ActiveView: Component<any> = MainView;
let viewProps: Record<string, any> = {};

if (params.get("orbitkit") === "mascot") {
  ActiveView = MascotView;
} else if (params.has("popup")) {
  document.body.classList.add("orbitkit-popup-window");
  const popupId = params.get("popup") ?? "";
  if (popupId in popupComponents) {
    ActiveView = popupComponents[popupId];
  } else {
    ActiveView = popupFallback;
    viewProps = { id: popupId };
  }
}

const app = mount(ActiveView, {
  target: document.getElementById("app")!,
  props: viewProps,
});

export default app;
