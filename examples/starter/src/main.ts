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
