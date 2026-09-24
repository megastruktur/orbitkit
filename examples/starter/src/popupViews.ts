import type { Component } from "svelte";
import NotesPopup from "./views/NotesPopup.svelte";
import SettingsPopup from "./views/SettingsPopup.svelte";
import UnknownPopup from "./views/UnknownPopup.svelte";

export const popupComponents: Record<string, Component<any>> = {
  notes: NotesPopup,
  settings: SettingsPopup,
};

export const popupFallback: Component<any> = UnknownPopup;
