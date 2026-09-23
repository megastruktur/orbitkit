use tauri::{AppHandle, Emitter, Manager, Runtime};
use crate::config::{MenuConfig, OrbitKitConfig};
use crate::error::{Error, Result};
use crate::jni_bridge::{notify_menu_action, MenuAction};
use crate::{OverlayPermissionResponse, ShowOverlayMascotArgs};

pub struct Orbitkit<R: Runtime> {
    app: AppHandle<R>,
    pub _config: OrbitKitConfig,
}

impl<R: Runtime> Orbitkit<R> {
    pub fn new(app: AppHandle<R>, config: OrbitKitConfig) -> Self {
        Self { app, _config: config }
    }

    pub fn overlay_permission(&self) -> Result<OverlayPermissionResponse> {
        Ok(OverlayPermissionResponse { granted: true })
    }

    pub fn request_overlay_permission(&self) -> Result<()> {
        Ok(())
    }

    pub fn show_overlay(
        &self,
        _menu: Option<MenuConfig>,
        _mascot: Option<ShowOverlayMascotArgs>,
    ) -> Result<()> {
        if let Some(window) = self.app.get_webview_window("orbitkit-mascot") {
            let _ = window.show();
        }
        Ok(())
    }

    pub fn hide_overlay(&self) -> Result<()> {
        if let Some(window) = self.app.get_webview_window("orbitkit-mascot") {
            let _ = window.hide();
        }
        Ok(())
    }

    pub fn open_popup(&self, _id: String) -> Result<()> {
        Err(Error::unsupported(
            "open_popup is not yet implemented on desktop (T08)",
        ))
    }

    pub fn close_popup(&self, _id: String) -> Result<()> {
        Err(Error::unsupported(
            "close_popup is not yet implemented on desktop (T08)",
        ))
    }

    pub fn set_mascot_state(&self, state: String) -> Result<()> {
        let payload = serde_json::json!({ "state": state });
        let _ = self.app.emit("orbitkit://mascot-state", payload);
        Ok(())
    }

    pub fn emit_menu_action(&self, id: String) -> Result<()> {
        let action = MenuAction {
            id: id.clone(),
            source: "webview".to_string(),
        };
        notify_menu_action(&action);
        let payload = serde_json::json!({ "id": id, "source": "webview" });
        let _ = self.app.emit("orbitkit://menu-action", payload);
        Ok(())
    }
}
