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

pub use config::OrbitKitConfig;
pub use error::{Error, ErrorCode, Result};
pub use jni_bridge::MenuAction;

#[cfg(desktop)]
pub use desktop::Orbitkit;
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
