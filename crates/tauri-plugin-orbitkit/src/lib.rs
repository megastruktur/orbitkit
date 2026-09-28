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
#[cfg(any(mobile, test))]
mod mobile;

pub use config::{
    AppConfig, MascotAnchor, MascotPoolState, MascotRoamConfig, MascotRoamCorner, MascotSheetDef,
    MascotWindowConfig, MenuItemIcon, MenuStaggerConfig, OrbitKitConfig, PopupAnchor, PopupConfig,
};
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

/// Physical-pixel rectangle in global screen space (K9).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PhysRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl PhysRect {
    /// True if the physical point lies inside the rect (right/bottom edges exclusive).
    pub fn contains(&self, x: i32, y: i32) -> bool {
        let px = i64::from(x);
        let py = i64::from(y);
        let right = i64::from(self.x) + i64::from(self.width);
        let bottom = i64::from(self.y) + i64::from(self.height);
        px >= i64::from(self.x) && px < right && py >= i64::from(self.y) && py < bottom
    }
}

/// Monitor snapshot for pure monitor-selection math (K9). All fields are
/// physical px. Selection uses the full monitor bounds so a centre over the
/// menu bar/dock/taskbar still selects the right monitor; the reported
/// geometry remains the work area.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MonitorInfo {
    /// Full monitor bounds — used for selection.
    pub bounds: PhysRect,
    /// Work area (bounds minus menu bar/dock/taskbar) — reported geometry.
    pub work_area: PhysRect,
    pub scale_factor: f64,
}

/// Returns the index of the first monitor whose full bounds contain `point`
/// (physical px) (K9).
pub fn monitor_for_point(monitors: &[MonitorInfo], point: (i32, i32)) -> Option<usize> {
    monitors
        .iter()
        .position(|m| m.bounds.contains(point.0, point.1))
}

/// Builds pure-selector inputs in one consistent coordinate space (K9).
///
/// tao reports monitor `position`/`size` as logical points multiplied by EACH
/// monitor's own scale on macOS and Linux, so per-monitor "physical" rects
/// overlap or gap on mixed-scale layouts; window `outer_position`/`outer_size`
/// are the window's logical geometry multiplied by the window's scale. With
/// `logical_space = true` (macOS/Linux) every monitor rect and the window
/// centre are divided back into the shared logical space before selection.
/// With `logical_space = false` (Windows: true physical virtual-screen
/// coordinates) the inputs pass through unchanged.
///
/// The returned `MonitorInfo` values are for SELECTION only; the reported
/// work area still comes from the chosen `tauri::Monitor` (raw values).
pub fn selector_inputs(
    monitors: &[(i32, i32, u32, u32, f64)],
    win_pos: (i32, i32),
    win_size: (u32, u32),
    win_scale: f64,
    logical_space: bool,
) -> (Vec<MonitorInfo>, (i32, i32)) {
    let div = |v: f64, scale: f64| if logical_space { v / scale } else { v };

    let infos = monitors
        .iter()
        .map(|(x, y, w, h, scale)| {
            let rect = PhysRect {
                x: div(f64::from(*x), *scale).round() as i32,
                y: div(f64::from(*y), *scale).round() as i32,
                width: div(f64::from(*w), *scale).round() as u32,
                height: div(f64::from(*h), *scale).round() as u32,
            };
            MonitorInfo {
                bounds: rect,
                work_area: rect,
                scale_factor: *scale,
            }
        })
        .collect();

    let centre = (
        div(f64::from(win_pos.0) + f64::from(win_size.0) / 2.0, win_scale).round() as i32,
        div(f64::from(win_pos.1) + f64::from(win_size.1) / 2.0, win_scale).round() as i32,
    );

    (infos, centre)
}

/// Response payload of the `mascot_monitor` command (K9): work area and scale
/// factor of the monitor containing the mascot window centre.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MascotMonitorResponse {
    pub work_area: PhysRect,
    pub scale_factor: f64,
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
            commands::start_mascot_drag,
            commands::mascot_monitor,
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
            anchor: None,
            decorations: None,
            transparent: None,
            skip_taskbar: None,
            min_width: None,
            min_height: None,
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
                anchor: None,
                decorations: None,
                transparent: None,
                skip_taskbar: None,
                min_width: None,
                min_height: None,
            },
            PopupConfig {
                id: "quick-note".to_string(),
                url: "note.html".to_string(),
                title: "Quick Note".to_string(),
                width: 250.0,
                height: 200.0,
                resizable: Some(false),
                always_on_top: Some(true),
                anchor: None,
                decorations: None,
                transparent: None,
                skip_taskbar: None,
                min_width: None,
                min_height: None,
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
