use tauri::{command, AppHandle, Runtime};
use crate::config::MenuConfig;
use crate::error::Result;
use crate::{OrbitkitExt, OverlayPermissionResponse, ShowOverlayMascotArgs};

#[command]
pub(crate) async fn overlay_permission<R: Runtime>(
    app: AppHandle<R>,
) -> Result<OverlayPermissionResponse> {
    app.orbitkit().overlay_permission()
}

#[command]
pub(crate) async fn request_overlay_permission<R: Runtime>(
    app: AppHandle<R>,
) -> Result<()> {
    app.orbitkit().request_overlay_permission()
}

#[command]
pub(crate) async fn show_overlay<R: Runtime>(
    app: AppHandle<R>,
    menu: Option<MenuConfig>,
    mascot: Option<ShowOverlayMascotArgs>,
) -> Result<()> {
    app.orbitkit().show_overlay(menu, mascot)
}

#[command]
pub(crate) async fn hide_overlay<R: Runtime>(
    app: AppHandle<R>,
) -> Result<()> {
    app.orbitkit().hide_overlay()
}

#[command]
pub(crate) async fn open_popup<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<()> {
    app.orbitkit().open_popup(id)
}

#[command]
pub(crate) async fn close_popup<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<()> {
    app.orbitkit().close_popup(id)
}

#[command]
pub(crate) async fn set_mascot_state<R: Runtime>(
    app: AppHandle<R>,
    state: String,
) -> Result<()> {
    app.orbitkit().set_mascot_state(state)
}

#[command]
pub(crate) async fn emit_menu_action<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<()> {
    app.orbitkit().emit_menu_action(id)
}

#[command]
pub(crate) async fn start_mascot_drag<R: Runtime>(
    app: AppHandle<R>,
) -> Result<()> {
    app.orbitkit().start_mascot_drag()
}
