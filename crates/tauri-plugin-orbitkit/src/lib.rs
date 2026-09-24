use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub mod commands;
pub mod config;
pub mod error;
pub mod jni_bridge;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

pub use config::{MascotWindowConfig, OrbitKitConfig, PopupConfig};
pub use error::{Error, ErrorCode, Result};
pub use jni_bridge::MenuAction;

#[cfg(desktop)]
pub use desktop::{
    calculate_overlay_position, calculate_overlay_size, resolve_mascot_window,
    MonitorBounds, Orbitkit, ResolvedMascotWindow,
};

/// Looks up a popup by id in the configured popups list.
pub fn lookup_popup<'a>(
    popups: &'a [PopupConfig],
    id: &str,
) -> Result<&'a PopupConfig> {
    popups
        .iter()
        .find(|p| p.id == id)
        .ok_or_else(|| Error::not_found(format!("popup with id '{}' not found in config", id)))
}

/// Builds the orbitkit://popup-open event payload from a PopupConfig.
pub fn popup_open_payload(popup: &PopupConfig) -> serde_json::Value {
    serde_json::json!({
        "id": popup.id,
        "title": popup.title,
        "url": popup.url,
        "width": popup.width,
        "height": popup.height,
    })
}
#[cfg(mobile)]
pub use mobile::Orbitkit;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OverlayPermissionResponse {
    pub granted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShowOverlayMascotArgs {
    pub size: Option<f64>,
}

pub trait OrbitkitExt<R: Runtime> {
    fn orbitkit(&self) -> &Orbitkit<R>;
    fn on_menu_action<F: Fn(&MenuAction) + Send + Sync + 'static>(&self, handler: F) {
        jni_bridge::register_menu_action_handler(handler);
    }
}

impl<R: Runtime, T: Manager<R>> OrbitkitExt<R> for T {
    fn orbitkit(&self) -> &Orbitkit<R> {
        self.state::<Orbitkit<R>>().inner()
    }
}

pub fn init<R: Runtime>(config: OrbitKitConfig) -> TauriPlugin<R> {
    Builder::<R>::new("orbitkit")
        .invoke_handler(tauri::generate_handler![
            commands::overlay_permission,
            commands::request_overlay_permission,
            commands::show_overlay,
            commands::hide_overlay,
            commands::open_popup,
            commands::close_popup,
            commands::set_mascot_state,
            commands::emit_menu_action,
        ])
        .setup(move |app, _api| {
            #[cfg(mobile)]
            {
                let orbitkit = mobile::init(app, _api, config)?;
                app.manage(orbitkit);
            }
            #[cfg(desktop)]
            {
                let orbitkit = Orbitkit::new(app.clone(), config);
                app.manage(orbitkit);
            }
            Ok(())
        })
        .build()
}

pub fn init_default<R: Runtime>() -> TauriPlugin<R> {
    init(OrbitKitConfig::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_popup_open_payload_builder() {
        let popup = PopupConfig {
            id: "settings".to_string(),
            url: "settings.html".to_string(),
            title: "Settings Window".to_string(),
            width: 400.0,
            height: 300.0,
            resizable: Some(true),
            always_on_top: Some(false),
        };

        let payload = popup_open_payload(&popup);
        assert_eq!(
            payload,
            serde_json::json!({
                "id": "settings",
                "title": "Settings Window",
                "url": "settings.html",
                "width": 400.0,
                "height": 300.0,
            })
        );
    }

    #[test]
    fn test_lookup_popup_found_and_not_found() {
        let popups = vec![
            PopupConfig {
                id: "chat".to_string(),
                url: "chat.html".to_string(),
                title: "Chat".to_string(),
                width: 320.0,
                height: 480.0,
                resizable: None,
                always_on_top: None,
            },
            PopupConfig {
                id: "quick-note".to_string(),
                url: "note.html".to_string(),
                title: "Quick Note".to_string(),
                width: 250.0,
                height: 200.0,
                resizable: Some(false),
                always_on_top: Some(true),
            },
        ];

        let found = lookup_popup(&popups, "chat").expect("chat popup should be found");
        assert_eq!(found.id, "chat");
        assert_eq!(found.title, "Chat");
        assert_eq!(found.width, 320.0);
        assert_eq!(found.height, 480.0);

        let not_found_err = lookup_popup(&popups, "unknown_id").unwrap_err();
        assert_eq!(not_found_err.code, ErrorCode::NotFound);
        assert!(not_found_err.message.contains("unknown_id"));

        let empty_popups: Vec<PopupConfig> = vec![];
        let empty_err = lookup_popup(&empty_popups, "chat").unwrap_err();
        assert_eq!(empty_err.code, ErrorCode::NotFound);
    }
}
