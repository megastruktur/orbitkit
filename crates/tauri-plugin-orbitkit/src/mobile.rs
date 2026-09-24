use serde::de::DeserializeOwned;
use serde::Serialize;
use tauri::plugin::{PluginApi, PluginHandle};
use tauri::{AppHandle, Emitter, Runtime};
use crate::config::{MenuConfig, OrbitKitConfig};
use crate::error::{Error, Result};
use crate::jni_bridge::{notify_menu_action, MenuAction};
use crate::{lookup_popup, popup_open_payload, OverlayPermissionResponse, ShowOverlayMascotArgs};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "dev.orbitkit.native";

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    api: PluginApi<R, C>,
    config: OrbitKitConfig,
) -> Result<Orbitkit<R>> {
    #[cfg(target_os = "android")]
    {
        let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "OrbitkitNativePlugin")?;
        let app_handle = app.clone();
        crate::jni_bridge::register_event_emitter(move |event, payload| {
            let _ = app_handle.emit(event, payload);
        });
        Ok(Orbitkit {
            handle,
            config,
        })
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, api, config);
        Err(Error::unsupported("mobile is only supported on android"))
    }
}

pub struct Orbitkit<R: Runtime> {
    handle: PluginHandle<R>,
    pub(crate) config: OrbitKitConfig,
}

impl<R: Runtime> Orbitkit<R> {
    pub fn run_mobile_plugin<T: DeserializeOwned>(
        &self,
        method: &str,
        payload: impl Serialize,
    ) -> Result<T> {
        self.handle
            .run_mobile_plugin(method, payload)
            .map_err(Into::into)
    }

    pub fn overlay_permission(&self) -> Result<OverlayPermissionResponse> {
        #[derive(serde::Deserialize)]
        struct Status {
            granted: bool,
        }

        self.handle
            .run_mobile_plugin::<bool>("isOverlayPermissionGranted", ())
            .map(|granted| OverlayPermissionResponse { granted })
            .or_else(|_| {
                self.handle
                    .run_mobile_plugin::<Status>("isOverlayPermissionGranted", ())
                    .map(|s| OverlayPermissionResponse { granted: s.granted })
            })
            .map_err(Into::into)
    }

    pub fn request_overlay_permission(&self) -> Result<()> {
        self.handle
            .run_mobile_plugin::<()>("requestOverlayPermission", ())
            .map_err(Into::into)
    }

    pub fn show_overlay(
        &self,
        menu: Option<MenuConfig>,
        mascot: Option<ShowOverlayMascotArgs>,
    ) -> Result<()> {
        let menu_config = menu.unwrap_or_else(|| self.config.menu.clone());
        if menu_config.items.is_empty() || menu_config.items.len() > 12 {
            return Err(Error::invalid_config(format!(
                "menu items count must be between 1 and 12 (got {})",
                menu_config.items.len()
            )));
        }
        let payload = serde_json::json!({
            "menu": menu_config,
            "mascot": mascot,
        });
        self.handle
            .run_mobile_plugin::<()>("overlayShow", payload)
            .map_err(Into::into)
    }

    pub fn hide_overlay(&self) -> Result<()> {
        self.handle
            .run_mobile_plugin::<()>("overlayHide", ())
            .map_err(Into::into)
    }

    pub fn open_popup(&self, id: String) -> Result<()> {
        let popup = lookup_popup(&self.config.windows.popups, &id)?;
        let payload = popup_open_payload(popup);
        self.run_mobile_plugin::<()>("bringToFront", ())?;
        let _ = self.handle.app().emit("orbitkit://popup-open", payload);
        Ok(())
    }

    pub fn close_popup(&self, id: String) -> Result<()> {
        let payload = serde_json::json!({ "id": id });
        let _ = self.handle.app().emit("orbitkit://popup-close", payload);
        Ok(())
    }

    pub fn set_mascot_state(&self, state: String) -> Result<()> {
        let payload = serde_json::json!({ "state": state.clone() });
        let _ = self.handle.app().emit("orbitkit://mascot-state", payload);
        self.handle
            .run_mobile_plugin::<()>("setMascotState", serde_json::json!({ "state": state }))
            .map_err(Into::into)
    }

    pub fn emit_menu_action(&self, id: String) -> Result<()> {
        let action = MenuAction {
            id: id.clone(),
            source: "webview".to_string(),
        };
        notify_menu_action(&action);
        let payload = serde_json::json!({ "id": id, "source": "webview" });
        let _ = self.handle.app().emit("orbitkit://menu-action", payload);
        Ok(())
    }
}
