use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
use crate::config::{MascotWindowConfig, MenuConfig, OrbitKitConfig, PopupConfig};
use crate::error::{Error, Result};
use crate::jni_bridge::{notify_menu_action, MenuAction};
use crate::{OverlayPermissionResponse, ShowOverlayMascotArgs};

/// Calculates the square dimension of the mascot overlay window.
/// Formula: max(mascot_size, 2 * (menu_radius + menu_item_size)) + 16
pub fn calculate_overlay_size(
    mascot_size: f64,
    menu_radius: f64,
    menu_item_size: f64,
) -> f64 {
    let menu_span = 2.0 * (menu_radius + menu_item_size);
    mascot_size.max(menu_span) + 16.0
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MonitorBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl MonitorBounds {
    pub fn new(x: f64, y: f64, width: f64, height: f64) -> Self {
        Self { x, y, width, height }
    }
}

/// Calculates the (x, y) position of the mascot overlay window.
/// If explicit (x, y) coordinates are provided in config, they are used.
/// Otherwise, positions at the bottom-right of the primary monitor with the specified margin (default 24px).
pub fn calculate_overlay_position(
    monitor: MonitorBounds,
    window_size: f64,
    margin: f64,
    config_x: Option<f64>,
    config_y: Option<f64>,
) -> (f64, f64) {
    let default_x = monitor.x + monitor.width - window_size - margin;
    let default_y = monitor.y + monitor.height - window_size - margin;
    (config_x.unwrap_or(default_x), config_y.unwrap_or(default_y))
}

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
#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedMascotWindow {
    pub transparent: bool,
    pub decorations: bool,
    pub always_on_top: bool,
    pub skip_taskbar: bool,
    pub shadow: bool,
    pub x: Option<f64>,
    pub y: Option<f64>,
}

/// Resolves mascot window defaults per K4 contracts:
/// transparent = true, decorations = false, always_on_top = true, skip_taskbar = true, shadow = false.
pub fn resolve_mascot_window(config: Option<&MascotWindowConfig>) -> ResolvedMascotWindow {
    match config {
        Some(mw) => ResolvedMascotWindow {
            transparent: mw.transparent,
            decorations: mw.decorations,
            always_on_top: mw.always_on_top,
            skip_taskbar: true,
            shadow: false,
            x: mw.x,
            y: mw.y,
        },
        None => ResolvedMascotWindow {
            transparent: true,
            decorations: false,
            always_on_top: true,
            skip_taskbar: true,
            shadow: false,
            x: None,
            y: None,
        },
    }
}


#[cfg(debug_assertions)]
fn should_run_selftest() -> bool {
    std::env::var("ORBITKIT_SELFTEST")
        .map(|v| v == "1")
        .unwrap_or(false)
}

pub struct Orbitkit<R: Runtime> {
    app: AppHandle<R>,
    pub config: OrbitKitConfig,
}

impl<R: Runtime> Orbitkit<R> {
    /// Creates a new `Orbitkit` plugin state instance.
    ///
    /// # Development Environment Variables (Debug builds only)
    /// - `ORBITKIT_SELFTEST`: When set to `"1"`, triggers an automated selftest routine
    ///   after startup, displaying the mascot overlay window and opening any configured popup.
    /// - `ORBITKIT_SELFTEST_CONFIG`: Path to a JSON configuration file overriding the plugin
    ///   configuration. Honored ONLY when `should_run_selftest()` is true (`ORBITKIT_SELFTEST == "1"`).
    ///   Panics with a clear error message if the file cannot be read or parsed.
    pub fn new(app: AppHandle<R>, config: OrbitKitConfig) -> Self {
        #[cfg(debug_assertions)]
        let config = if should_run_selftest() {
            if let Ok(path) = std::env::var("ORBITKIT_SELFTEST_CONFIG") {
                let content = std::fs::read_to_string(&path).unwrap_or_else(|e| {
                    panic!(
                        "Failed to read ORBITKIT_SELFTEST_CONFIG file '{}': {}",
                        path, e
                    )
                });
                serde_json::from_str::<OrbitKitConfig>(&content).unwrap_or_else(|e| {
                    panic!(
                        "Failed to parse ORBITKIT_SELFTEST_CONFIG file '{}': {}",
                        path, e
                    )
                })
            } else {
                config
            }
        } else {
            config
        };

        let orbitkit = Self { app, config };
        #[cfg(debug_assertions)]
        orbitkit.spawn_selftest_if_enabled();

        orbitkit
    }

    #[cfg(debug_assertions)]
    fn spawn_selftest_if_enabled(&self) {
        if !should_run_selftest() {
            return;
        }
        let app_handle = self.app.clone();
        let popup_id = self.config.windows.popups.first().map(|p| p.id.clone());
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(2));
            let app_clone = app_handle.clone();
            let _ = app_handle.run_on_main_thread(move || {
                let orbitkit = app_clone.state::<Orbitkit<R>>();
                let _ = orbitkit.show_overlay(None, None);
                if let Some(id) = popup_id {
                    let _ = orbitkit.open_popup(id);
                }
            });
        });
    }

    pub fn overlay_permission(&self) -> Result<OverlayPermissionResponse> {
        Ok(OverlayPermissionResponse { granted: true })
    }

    pub fn request_overlay_permission(&self) -> Result<()> {
        Ok(())
    }

    fn get_primary_monitor_geometry(&self) -> MonitorBounds {
        if let Ok(Some(monitor)) = self.app.primary_monitor() {
            let scale = monitor.scale_factor();
            let pos = monitor.position();
            let size = monitor.size();
            let x = pos.x as f64 / scale;
            let y = pos.y as f64 / scale;
            let width = size.width as f64 / scale;
            let height = size.height as f64 / scale;
            MonitorBounds::new(x, y, width, height)
        } else {
            // Default fallback if no monitor detected (e.g. headless/mock)
            MonitorBounds::new(0.0, 0.0, 1280.0, 800.0)
        }
    }

    pub fn show_overlay(
        &self,
        menu: Option<MenuConfig>,
        mascot: Option<ShowOverlayMascotArgs>,
    ) -> Result<()> {
        let mascot_size = mascot
            .as_ref()
            .and_then(|m| m.size)
            .unwrap_or(self.config.mascot.size as f64);

        let (menu_radius, menu_item_size) = match &menu {
            Some(m) => (m.radius, m.item_size),
            None => (self.config.menu.radius, self.config.menu.item_size),
        };

        let size = calculate_overlay_size(mascot_size, menu_radius, menu_item_size);

        let resolved = resolve_mascot_window(self.config.windows.mascot_window.as_ref());

        let monitor = self.get_primary_monitor_geometry();
        let (pos_x, pos_y) = calculate_overlay_position(
            monitor,
            size,
            24.0,
            resolved.x,
            resolved.y,
        );

        if let Some(window) = self.app.get_webview_window("orbitkit-mascot") {
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(size, size)));
            let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(pos_x, pos_y)));
            window.show().map_err(|e| Error::unsupported(e.to_string()))?;
            let _ = window.set_focus();
            return Ok(());
        }

        let _window = WebviewWindowBuilder::new(
            &self.app,
            "orbitkit-mascot",
            WebviewUrl::App("index.html?orbitkit=mascot".into()),
        )
        .title("orbitkit-mascot")
        .inner_size(size, size)
        .position(pos_x, pos_y)
            .transparent(resolved.transparent)
            .decorations(resolved.decorations)
            .always_on_top(resolved.always_on_top)
            .skip_taskbar(resolved.skip_taskbar)
            .shadow(resolved.shadow)
        .build()
        .map_err(|e| Error::unsupported(e.to_string()))?;

        Ok(())
    }

    pub fn hide_overlay(&self) -> Result<()> {
        if let Some(window) = self.app.get_webview_window("orbitkit-mascot") {
            window.hide().map_err(|e| Error::unsupported(e.to_string()))?;
        }
        Ok(())
    }

    pub fn open_popup(&self, id: String) -> Result<()> {
        let popup = lookup_popup(&self.config.windows.popups, &id)?;
        let label = format!("orbitkit-popup-{}", popup.id);
        if let Some(window) = self.app.get_webview_window(&label) {
            window.show().map_err(|e| Error::unsupported(e.to_string()))?;
            let _ = window.set_focus();
            return Ok(());
        }

        let url = if popup.url.starts_with("http://") || popup.url.starts_with("https://") {
            let parsed = popup
                .url
                .parse::<tauri::Url>()
                .map_err(|e| Error::invalid_config(e.to_string()))?;
            WebviewUrl::External(parsed)
        } else {
            WebviewUrl::App(popup.url.clone().into())
        };

        let resizable = popup.resizable.unwrap_or(true);
        let always_on_top = popup.always_on_top.unwrap_or(false);

        let _window = WebviewWindowBuilder::new(&self.app, &label, url)
            .title(&popup.title)
            .inner_size(popup.width, popup.height)
            .resizable(resizable)
            .always_on_top(always_on_top)
            .build()
            .map_err(|e| Error::unsupported(e.to_string()))?;

        Ok(())
    }

    pub fn close_popup(&self, id: String) -> Result<()> {
        let label = format!("orbitkit-popup-{}", id);
        if let Some(window) = self.app.get_webview_window(&label) {
            window.close().map_err(|e| Error::unsupported(e.to_string()))?;
        }
        Ok(())
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
