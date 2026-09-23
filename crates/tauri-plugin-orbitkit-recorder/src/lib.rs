use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub mod commands;
pub mod error;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

pub use error::{Error, ErrorCode, Result};

#[cfg(desktop)]
pub use desktop::OrbitkitRecorder;
#[cfg(mobile)]
pub use mobile::OrbitkitRecorder;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecorderStateResponse {
    pub state: String,
    pub spool_path: String,
    pub bytes_recorded: u64,
    pub is_foreground: bool,
}

pub trait OrbitkitRecorderExt<R: Runtime> {
    fn orbitkit_recorder(&self) -> &OrbitkitRecorder<R>;
}

impl<R: Runtime, T: Manager<R>> OrbitkitRecorderExt<R> for T {
    fn orbitkit_recorder(&self) -> &OrbitkitRecorder<R> {
        self.state::<OrbitkitRecorder<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R>::new("orbitkit-recorder")
        .invoke_handler(tauri::generate_handler![
            commands::start_foreground,
            commands::pause,
            commands::resume,
            commands::stop,
            commands::state,
            commands::post_standby_notification,
            commands::get_persisted_state,
            commands::recover_state,
        ])
        .setup(move |app, _api| {
            #[cfg(mobile)]
            {
                let recorder = mobile::init(app, _api)?;
                app.manage(recorder);
            }
            #[cfg(desktop)]
            {
                let recorder = OrbitkitRecorder::new(app.clone());
                app.manage(recorder);
            }
            Ok(())
        })
        .build()
}
