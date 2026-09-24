#![cfg_attr(not(target_os = "android"), allow(dead_code))]
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
        #[cfg(target_os = "android")]
        {
            self.handle
                .run_mobile_plugin(method, payload)
                .map_err(Into::into)
        }
        #[cfg(not(target_os = "android"))]
        {
            let _ = (method, payload);
            Err(Error::unsupported("mobile is only supported on android"))
        }
    }

    pub fn overlay_permission(&self) -> Result<OverlayPermissionResponse> {
        #[derive(serde::Deserialize)]
        struct Status {
            granted: bool,
        }

        self.run_mobile_plugin::<bool>("isOverlayPermissionGranted", ())
            .map(|granted| OverlayPermissionResponse { granted })
            .or_else(|_| {
                self.run_mobile_plugin::<Status>("isOverlayPermissionGranted", ())
                    .map(|s| OverlayPermissionResponse { granted: s.granted })
            })
    }

    pub fn request_overlay_permission(&self) -> Result<()> {
        self.run_mobile_plugin::<()>("requestOverlayPermission", ())
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
        let payload = build_overlay_payload(&menu_config, &mascot, &self.config.mascot);
        self.run_mobile_plugin::<()>("overlayShow", payload)
    }

    pub fn hide_overlay(&self) -> Result<()> {
        self.run_mobile_plugin::<()>("overlayHide", ())
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
        self.run_mobile_plugin::<()>("setMascotState", serde_json::json!({ "state": state }))
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

pub(crate) fn build_overlay_payload(
    menu_config: &MenuConfig,
    mascot: &Option<ShowOverlayMascotArgs>,
    base_mascot_config: &crate::config::MascotConfig,
) -> serde_json::Value {
    let mut mascot_config = base_mascot_config.clone();
    if let Some(s) = mascot.as_ref().and_then(|m| m.size) {
        mascot_config.size = s.round() as u32;
    }
    serde_json::json!({
        "menu": menu_config,
        "mascot": mascot,
        "mascotConfig": mascot_config,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{MascotConfig, MascotKind, MascotStateDefinition, MenuConfig};
    use std::collections::HashMap;

    #[test]
    fn test_build_overlay_payload_mascot_config_camel_case_and_states() {
        let mut states = HashMap::new();
        states.insert(
            "idle".to_string(),
            MascotStateDefinition::Source {
                src: "<svg id=\"idle\"></svg>".to_string(),
            },
        );
        states.insert(
            "busy".to_string(),
            MascotStateDefinition::Source {
                src: "<svg id=\"busy\"></svg>".to_string(),
            },
        );

        let base_mascot = MascotConfig {
            kind: MascotKind::Svg,
            src: "<svg id=\"default\"></svg>".to_string(),
            size: 96,
            frame_width: None,
            frame_height: None,
            states: Some(states),
            initial_state: "idle".to_string(),
        };

        let menu = MenuConfig::default();
        let mascot_args = Some(ShowOverlayMascotArgs { size: Some(64.0) });

        let payload = build_overlay_payload(&menu, &mascot_args, &base_mascot);

        // Verify mascotConfig is present
        assert!(payload.get("mascotConfig").is_some());
        let mc = &payload["mascotConfig"];

        // Verify camelCase fields
        assert_eq!(mc["kind"], "svg");
        assert_eq!(mc["src"], "<svg id=\"default\"></svg>");
        assert_eq!(mc["size"], 64);
        assert_eq!(mc["initialState"], "idle");

        // Verify states.busy.src is present
        assert!(mc.get("states").is_some());
        let states_val = &mc["states"];
        assert_eq!(states_val["busy"]["src"], "<svg id=\"busy\"></svg>");
        assert_eq!(states_val["idle"]["src"], "<svg id=\"idle\"></svg>");

        // Verify legacy mascot key is kept for compatibility
        assert!(payload.get("mascot").is_some());
        assert_eq!(payload["mascot"]["size"], 64.0);

        // Verify without mascot size override
        let payload_no_override = build_overlay_payload(&menu, &None, &base_mascot);
        assert_eq!(payload_no_override["mascotConfig"]["size"], 96);
    }
}
