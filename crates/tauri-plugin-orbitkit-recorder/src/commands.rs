use tauri::{command, AppHandle, Runtime};
use crate::error::Result;
use crate::{OrbitkitRecorderExt, RecorderStateResponse};

#[command]
pub(crate) async fn start_foreground<R: Runtime>(
    app: AppHandle<R>,
) -> Result<()> {
    app.orbitkit_recorder().start_foreground()
}

#[command]
pub(crate) async fn pause<R: Runtime>(
    app: AppHandle<R>,
) -> Result<()> {
    app.orbitkit_recorder().pause()
}

#[command]
pub(crate) async fn resume<R: Runtime>(
    app: AppHandle<R>,
) -> Result<()> {
    app.orbitkit_recorder().resume()
}

#[command]
pub(crate) async fn stop<R: Runtime>(
    app: AppHandle<R>,
) -> Result<()> {
    app.orbitkit_recorder().stop()
}

#[command]
pub(crate) async fn state<R: Runtime>(
    app: AppHandle<R>,
) -> Result<RecorderStateResponse> {
    app.orbitkit_recorder().state()
}

#[command]
pub(crate) async fn post_standby_notification<R: Runtime>(
    app: AppHandle<R>,
) -> Result<()> {
    app.orbitkit_recorder().post_standby_notification()
}

#[command]
pub(crate) async fn get_persisted_state<R: Runtime>(
    app: AppHandle<R>,
) -> Result<serde_json::Value> {
    app.orbitkit_recorder().get_persisted_state()
}

#[command]
pub(crate) async fn recover_state<R: Runtime>(
    app: AppHandle<R>,
) -> Result<serde_json::Value> {
    app.orbitkit_recorder().recover_state()
}
