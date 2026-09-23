use serde::de::DeserializeOwned;
use serde::Serialize;
use tauri::plugin::{PluginApi, PluginHandle};
use tauri::{AppHandle, Emitter, Runtime};
use crate::config::{MenuConfig, OrbitKitConfig};
use crate::error::{Error, Result};
use crate::jni_bridge::{notify_menu_action, MenuAction};
use crate::{OverlayPermissionResponse, ShowOverlayMascotArgs};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "dev.orbitkit.native";

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
    config: OrbitKitConfig,
) -> Result<Orbitkit<R>> {
    #[cfg(target_os = "android")]
    {
        let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "OrbitkitNativePlugin")?;
        Ok(Orbitkit {
            handle,
            _config: config,
        })
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (api, config);
        Err(Error::unsupported("mobile is only supported on android"))
    }
}

pub struct Orbitkit<R: Runtime> {
    handle: PluginHandle<R>,
    _config: OrbitKitConfig,
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
        _menu: Option<MenuConfig>,
        _mascot: Option<ShowOverlayMascotArgs>,
    ) -> Result<()> {
        self.handle
            .run_mobile_plugin::<()>("overlayShow", ())
            .map_err(Into::into)
    }

    pub fn hide_overlay(&self) -> Result<()> {
        self.handle
            .run_mobile_plugin::<()>("overlayHide", ())
            .map_err(Into::into)
    }

    pub fn open_popup(&self, _id: String) -> Result<()> {
        Err(Error::unsupported("open_popup is unsupported on android"))
    }

    pub fn close_popup(&self, _id: String) -> Result<()> {
        Err(Error::unsupported("close_popup is unsupported on android"))
    }

    pub fn set_mascot_state(&self, state: String) -> Result<()> {
        let payload = serde_json::json!({ "state": state });
        let _ = self.handle.app().emit("orbitkit://mascot-state", payload);
        Ok(())
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
