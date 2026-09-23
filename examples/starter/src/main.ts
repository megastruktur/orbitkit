import { mount, type Component } from "svelte";
import MainView from "./views/MainView.svelte";
import MascotView from "./views/MascotView.svelte";
import NotesPopup from "./views/NotesPopup.svelte";
import SettingsPopup from "./views/SettingsPopup.svelte";

const params = new URLSearchParams(window.location.search);

let ActiveView: Component = MainView;

if (params.get("orbitkit") === "mascot") {
  ActiveView = MascotView;
} else if (params.has("popup")) {
  const popupId = params.get("popup");
  if (popupId === "notes") {
    ActiveView = NotesPopup;
  } else if (popupId === "settings") {
    ActiveView = SettingsPopup;
  } else {
    ActiveView = NotesPopup;
  }
}

const app = mount(ActiveView, {
  target: document.getElementById("app")!,
});

export default app;
