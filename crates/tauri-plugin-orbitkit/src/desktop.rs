use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use crate::config::{MascotWindowConfig, MenuConfig, OrbitKitConfig};
use crate::error::{Error, Result};
use crate::jni_bridge::{notify_menu_action, MenuAction};
use crate::{
    lookup_popup, monitor_for_point, popup_label, resolve_popup_spec, resolve_popup_url,
    selector_inputs, substitute_popup_params, MascotMonitorResponse, OverlayPermissionResponse,
    PhysRect, POPUP_LABEL_PREFIX, ResolvedPopupUrl, ShowOverlayMascotArgs,
};

/// tao on Windows reports true physical virtual-screen coordinates; on
/// macOS/Linux the reported monitor rects are per-monitor-scaled logical
/// points, so selection runs in the shared logical space there (see
/// `selector_inputs`).
#[cfg(windows)]
const SELECTION_LOGICAL_SPACE: bool = false;
#[cfg(not(windows))]
const SELECTION_LOGICAL_SPACE: bool = true;

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
    /// Labels whose `popup-closed` event was already emitted by `close_popup`;
    /// consumed by the window `Destroyed` handler to avoid double emission.
    pending_close: Arc<Mutex<HashSet<String>>>,
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

        let orbitkit = Self {
            app,
            config,
            pending_close: Arc::new(Mutex::new(HashSet::new())),
        };
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
                    let _ = orbitkit.open_popup(id, None, None);
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

    /// K11: opens the configured popup `id`, optionally substituting `{param}`
    /// placeholders with URL-encoded `params` values and keying the window by
    /// `instance_key` (`orbitkit-popup-{id}-{instanceKey}`). Idempotent: an
    /// existing label is shown + focused, never duplicated. Emits
    /// `orbitkit://popup-shown {label}` on create and re-show.
    pub fn open_popup(
        &self,
        id: String,
        params: Option<HashMap<String, String>>,
        instance_key: Option<String>,
    ) -> Result<()> {
        let popup = lookup_popup(&self.config.windows.popups, &id)?;
        let label = popup_label(&popup.id, instance_key.as_deref())?;

        if let Some(window) = self.app.get_webview_window(&label) {
            window.show().map_err(|e| Error::unsupported(e.to_string()))?;
            let _ = window.set_focus();
            let _ = self
                .app
                .emit("orbitkit://popup-shown", serde_json::json!({ "label": label }));
            return Ok(());
        }

        let template = substitute_popup_params(&popup.url, params.as_ref())?;
        let allowed_origins = self
            .config
            .app
            .as_ref()
            .map(|app| app.allowed_origins.as_slice())
            .unwrap_or(&[]);
        let resolved_url = resolve_popup_url(&template, allowed_origins)?;
        let spec = resolve_popup_spec(popup);

        let url = match resolved_url {
            ResolvedPopupUrl::App(path) => WebviewUrl::App(path.into()),
            ResolvedPopupUrl::External(url) => WebviewUrl::External(url),
        };

        let mut builder = WebviewWindowBuilder::new(&self.app, &label, url)
            .title(&spec.title)
            .inner_size(spec.width, spec.height)
            .resizable(spec.resizable)
            .always_on_top(spec.always_on_top)
            .decorations(spec.decorations)
            .transparent(spec.transparent)
            .skip_taskbar(spec.skip_taskbar);

        if spec.min_width.is_some() || spec.min_height.is_some() {
            builder = builder.min_inner_size(
                spec.min_width.unwrap_or(0.0),
                spec.min_height.unwrap_or(0.0),
            );
        }

        let window = builder
            .build()
            .map_err(|e| Error::unsupported(e.to_string()))?;

        // User-initiated closes (title-bar X, WM close) emit `popup-closed`
        // too; `pending_close` dedupes against `close_popup`'s direct emission.
        let app = self.app.clone();
        let pending_close = Arc::clone(&self.pending_close);
        let destroyed_label = label.clone();
        window.on_window_event(move |event| {
            if matches!(event, WindowEvent::Destroyed) {
                let already_emitted = pending_close
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner())
                    .remove(&destroyed_label);
                if !already_emitted {
                    let _ = app.emit(
                        "orbitkit://popup-closed",
                        serde_json::json!({ "label": destroyed_label }),
                    );
                }
            }
        });

        let _ = self
            .app
            .emit("orbitkit://popup-shown", serde_json::json!({ "label": label }));
        Ok(())
    }

    /// K11: closes the popup window with the full `label`. Only OrbitKit
    /// popup labels are accepted (unknown prefix is `not_found`); closing an
    /// already-closed popup label is a no-op. Emits
    /// `orbitkit://popup-closed {label}` once.
    pub fn close_popup(&self, label: String) -> Result<()> {
        if !label.starts_with(POPUP_LABEL_PREFIX) {
            return Err(Error::not_found(format!(
                "no orbitkit popup with label '{label}'"
            )));
        }
        if let Some(window) = self.app.get_webview_window(&label) {
            self.pending_close
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .insert(label.clone());
            if let Err(e) = window.close() {
                self.pending_close
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner())
                    .remove(&label);
                return Err(Error::unsupported(e.to_string()));
            }
            let _ = self
                .app
                .emit("orbitkit://popup-closed", serde_json::json!({ "label": label }));
        }
        Ok(())
    }

    /// K11: labels of all currently open OrbitKit popup windows, sorted.
    /// `Result` so the desktop and mobile (`unsupported`) arms share one
    /// command signature (K13).
    pub fn list_popups(&self) -> Result<Vec<String>> {
        let mut labels: Vec<String> = self
            .app
            .webview_windows()
            .into_keys()
            .filter(|label| label.starts_with(POPUP_LABEL_PREFIX))
            .collect();
        labels.sort();
        Ok(labels)
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

    pub fn start_mascot_drag(&self) -> Result<()> {
        let window = self
            .app
            .get_webview_window("orbitkit-mascot")
            .ok_or_else(|| Error::not_found("Mascot window not found"))?;
        window
            .start_dragging()
            .map_err(|e| Error::unsupported(e.to_string()))?;
        Ok(())
    }

    /// K9: work area + scale factor of the monitor containing the mascot window
    /// centre. Selection runs in one consistent coordinate space via the
    /// unit-tested pure `selector_inputs` + `monitor_for_point` pair, falling
    /// back to the primary monitor.
    pub fn mascot_monitor(&self) -> Result<MascotMonitorResponse> {
        let window = self
            .app
            .get_webview_window("orbitkit-mascot")
            .and_then(|window| {
                let pos = window.outer_position().ok()?;
                let size = window.outer_size().ok()?;
                let scale = window.scale_factor().ok()?;
                Some(((pos.x, pos.y), (size.width, size.height), scale))
            });

        let selected = window.and_then(|(win_pos, win_size, win_scale)| {
            let mut monitors = self.app.available_monitors().ok()?;
            let tuples: Vec<(i32, i32, u32, u32, f64)> = monitors
                .iter()
                .map(|m| {
                    (
                        m.position().x,
                        m.position().y,
                        m.size().width,
                        m.size().height,
                        m.scale_factor(),
                    )
                })
                .collect();
            let (infos, centre) = selector_inputs(
                &tuples,
                win_pos,
                win_size,
                win_scale,
                SELECTION_LOGICAL_SPACE,
            );
            let idx = monitor_for_point(&infos, centre)?;
            Some(monitors.swap_remove(idx))
        });

        let response = match selected {
            Some(monitor) => Self::monitor_response(&monitor),
            None => self
                .app
                .primary_monitor()
                .ok()
                .flatten()
                .as_ref()
                .map(Self::monitor_response)
                .unwrap_or_else(Self::headless_response),
        };
        Ok(response)
    }

    fn monitor_response(monitor: &tauri::Monitor) -> MascotMonitorResponse {
        let work = monitor.work_area();
        MascotMonitorResponse {
            work_area: PhysRect {
                x: work.position.x,
                y: work.position.y,
                width: work.size.width,
                height: work.size.height,
            },
            scale_factor: monitor.scale_factor(),
        }
    }

    fn headless_response() -> MascotMonitorResponse {
        MascotMonitorResponse {
            work_area: PhysRect {
                x: 0,
                y: 0,
                width: 1280,
                height: 800,
            },
            scale_factor: 1.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::config::WindowsConfig;
    use crate::error::ErrorCode;
    use crate::{
        monitor_for_point, selector_inputs, OrbitKitConfig, Orbitkit, PopupConfig, MonitorInfo,
        PhysRect,
    };
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};
    use tauri::test::MockRuntime;
    use tauri::{test, Listener, Manager};

    /// Rule rs-parking-lot compliance without a new dependency: never unwrap
    /// lock results — recover from poisoning instead.
    fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
        mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn popup(id: &str, url: &str) -> PopupConfig {
        PopupConfig {
            id: id.to_string(),
            url: url.to_string(),
            title: format!("Title {id}"),
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
        }
    }

    fn app_with_popups(popups: Vec<PopupConfig>) -> tauri::App<MockRuntime> {
        let app = test::mock_app();
        let config = OrbitKitConfig {
            windows: WindowsConfig {
                mascot_window: None,
                popups,
            },
            ..Default::default()
        };
        app.manage(Orbitkit::new(app.handle().clone(), config));
        app
    }

    fn popup_labels(app: &tauri::App<MockRuntime>) -> Vec<String> {
        let mut labels: Vec<String> = app
            .webview_windows()
            .into_keys()
            .filter(|label| label.starts_with(crate::POPUP_LABEL_PREFIX))
            .collect();
        labels.sort();
        labels
    }

    /// K11 AC1: `open_popup` creates exactly one window per label; a second
    /// call with the same label takes the show+focus path instead of
    /// duplicating (mutation-sensitive: pre-change code duplicated nothing
    /// because it had no instance keys, but a regression to "always build"
    /// fails this assertion via the duplicate window).
    #[test]
    fn test_open_popup_creates_window_idempotently() {
        let app = app_with_popups(vec![popup("chat", "chat.html")]);
        let ok = app.state::<Orbitkit<MockRuntime>>();

        ok.open_popup("chat".into(), None, None).unwrap();
        ok.open_popup("chat".into(), None, None).unwrap();

        assert_eq!(
            popup_labels(&app),
            vec!["orbitkit-popup-chat".to_string()]
        );
    }

    /// K11 AC1: instance keys give one window per key with exact labels
    /// `orbitkit-popup-{id}-{instanceKey}` (mirrors one-popup-per-chat).
    #[test]
    fn test_open_popup_instance_keys_create_distinct_windows() {
        let app = app_with_popups(vec![popup("chat", "chat.html")]);
        let ok = app.state::<Orbitkit<MockRuntime>>();

        ok.open_popup("chat".into(), None, Some("chat-1".into()))
            .unwrap();
        ok.open_popup("chat".into(), None, Some("chat_2".into()))
            .unwrap();
        ok.open_popup("chat".into(), None, Some("chat-1".into()))
            .unwrap();

        assert_eq!(
            popup_labels(&app),
            vec![
                "orbitkit-popup-chat-chat-1".to_string(),
                "orbitkit-popup-chat-chat_2".to_string(),
            ]
        );
    }

    /// K11 AC2/AC3: unknown id is `not_found`; bad instanceKey, unknown
    /// `{param}` and disallowed URL schemes are `invalid_config` — and none
    /// of them leave a window behind.
    #[test]
    fn test_open_popup_rejects_invalid_requests() {
        let app = app_with_popups(vec![
            popup("chat", "chat.html?q={q}"),
            popup("evil", "javascript:alert(1)"),
        ]);
        let ok = app.state::<Orbitkit<MockRuntime>>();

        assert_eq!(
            ok.open_popup("nope".into(), None, None)
                .unwrap_err()
                .code,
            ErrorCode::NotFound
        );
        assert_eq!(
            ok.open_popup("chat".into(), None, Some("BAD".into()))
                .unwrap_err()
                .code,
            ErrorCode::InvalidConfig
        );
        let mut wrong_param = HashMap::new();
        wrong_param.insert("other".to_string(), "1".to_string());
        assert_eq!(
            ok.open_popup("chat".into(), Some(wrong_param), None)
                .unwrap_err()
                .code,
            ErrorCode::InvalidConfig
        );
        assert_eq!(
            ok.open_popup("evil".into(), None, None).unwrap_err().code,
            ErrorCode::InvalidConfig
        );

        assert!(popup_labels(&app).is_empty());
    }

    /// K11 AC5: `popup-shown`/`popup-closed` carry the full label;
    /// `list_popups` reports open popup labels; `close_popup` takes the full
    /// label and refuses non-popup labels (mutation-sensitive: pre-change
    /// code emitted no lifecycle events at all).
    #[test]
    fn test_popup_events_and_list() {
        let app = app_with_popups(vec![popup("chat", "chat.html")]);

        let shown: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
        let closed: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
        let shown_listener = Arc::clone(&shown);
        let closed_listener = Arc::clone(&closed);
        app.listen("orbitkit://popup-shown", move |event| {
            lock(&shown_listener).push(event.payload().to_string());
        });
        app.listen("orbitkit://popup-closed", move |event| {
            lock(&closed_listener).push(event.payload().to_string());
        });

        let ok = app.state::<Orbitkit<MockRuntime>>();
        ok.open_popup("chat".into(), None, None).unwrap();

        assert_eq!(
            *lock(&shown),
            vec![r#"{"label":"orbitkit-popup-chat"}"#.to_string()]
        );
        assert_eq!(
            ok.list_popups().unwrap(),
            vec!["orbitkit-popup-chat".to_string()]
        );

        ok.close_popup("orbitkit-popup-chat".into()).unwrap();
        assert_eq!(
            *lock(&closed),
            vec![r#"{"label":"orbitkit-popup-chat"}"#.to_string()]
        );

        // Already-closed label: no error (idempotent close).
        ok.close_popup("orbitkit-popup-chat".into()).unwrap();
        // Non-popup labels are refused outright.
        assert_eq!(
            ok.close_popup("orbitkit-mascot".into()).unwrap_err().code,
            ErrorCode::NotFound
        );
        assert_eq!(
            ok.close_popup("main".into()).unwrap_err().code,
            ErrorCode::NotFound
        );
    }

    fn monitor(x: i32, y: i32, width: u32, height: u32, scale_factor: f64) -> MonitorInfo {
        let rect = PhysRect {
            x,
            y,
            width,
            height,
        };
        MonitorInfo {
            bounds: rect,
            work_area: rect,
            scale_factor,
        }
    }

    /// K9 AC3: three-monitor fixture including negative coordinates.
    /// Left: -1920..0, Main: 0..2560, Right: 2560..3640.
    fn fixture() -> Vec<MonitorInfo> {
        vec![
            monitor(-1920, 0, 1920, 1080, 1.0),
            monitor(0, 0, 2560, 1440, 1.5),
            monitor(2560, 0, 1080, 1920, 2.0),
        ]
    }

    #[test]
    fn test_monitor_for_point_selects_monitor_containing_point() {
        let monitors = fixture();
        assert_eq!(monitor_for_point(&monitors, (-1000, 500)), Some(0));
        assert_eq!(monitor_for_point(&monitors, (1280, 720)), Some(1));
        assert_eq!(monitor_for_point(&monitors, (3000, 1500)), Some(2));
    }

    #[test]
    fn test_monitor_for_point_edges_and_boundaries() {
        let monitors = fixture();
        // Top-left corner and bottom-right corner of the left monitor.
        assert_eq!(monitor_for_point(&monitors, (-1920, 0)), Some(0));
        assert_eq!(monitor_for_point(&monitors, (-1, 1079)), Some(0));
        // Left monitor's bottom-right boundary is exclusive.
        assert_eq!(monitor_for_point(&monitors, (0, 1080)), Some(1));
        // Main/right boundary at x = 2560 belongs to the right monitor.
        assert_eq!(monitor_for_point(&monitors, (2560, 0)), Some(2));
        assert_eq!(monitor_for_point(&monitors, (3639, 1919)), Some(2));
    }

    #[test]
    fn test_monitor_for_point_outside_returns_none() {
        let monitors = fixture();
        assert_eq!(monitor_for_point(&monitors, (5000, 0)), None);
        assert_eq!(monitor_for_point(&monitors, (-1920, -1)), None);
        assert_eq!(monitor_for_point(&monitors, (-5000, 20000)), None);
    }

    /// F2 (a): macOS mixed-scale layout exactly as tao reports it — Retina
    /// 1512x982pt @2x + external 1920x1080pt @1x placed at pt x=1512. The
    /// per-monitor-scaled rects OVERLAP (primary 0..3024, external
    /// 1512..3432); only dividing back into logical space makes the mascot on
    /// the external select the external.
    #[test]
    fn test_selector_inputs_logical_space_macos_mixed_scale() {
        let monitors = [(0, 0, 3024, 1964, 2.0), (1512, 0, 1920, 1080, 1.0)];
        let (infos, centre) = selector_inputs(&monitors, (2300, 300), (200, 200), 1.0, true);
        assert_eq!(centre, (2400, 400));
        assert_eq!(monitor_for_point(&infos, centre), Some(1));
    }

    /// F2 (b): same layout, window on the primary at pt (1300,300) 100x100
    /// with win_scale 2.0 — tauri reports pos (2600,600) size (200,200); the
    /// centre must be divided by the WINDOW's scale, not a monitor's.
    #[test]
    fn test_selector_inputs_logical_space_primary_window() {
        let monitors = [(0, 0, 3024, 1964, 2.0), (1512, 0, 1920, 1080, 1.0)];
        let (infos, centre) = selector_inputs(&monitors, (2600, 600), (200, 200), 2.0, true);
        assert_eq!(centre, (1350, 350));
        assert_eq!(monitor_for_point(&infos, centre), Some(0));
    }

    /// F2 (c): Linux mixed-scale layout as tao reports it — 3840x2160 @2x +
    /// 1920x1080 @1x at reported x=1920 (rects overlap: primary 0..3840).
    #[test]
    fn test_selector_inputs_logical_space_linux_layout() {
        let monitors = [(0, 0, 3840, 2160, 2.0), (1920, 0, 1920, 1080, 1.0)];
        let (infos, centre) = selector_inputs(&monitors, (2600, 300), (100, 100), 1.0, true);
        assert_eq!(centre, (2650, 350));
        assert_eq!(monitor_for_point(&infos, centre), Some(1));
    }

    /// F2 (d): Windows-style true physical virtual-screen coordinates pass
    /// through unchanged (no division of monitors or of the window centre).
    #[test]
    fn test_selector_inputs_physical_space_passthrough() {
        let monitors = [(0, 0, 3840, 2160, 2.0), (3840, 0, 1920, 1080, 1.0)];
        let (infos, centre) = selector_inputs(&monitors, (3840, 0), (200, 200), 1.5, false);
        assert_eq!(centre, (3940, 100));
        assert_eq!(infos[0].bounds, PhysRect { x: 0, y: 0, width: 3840, height: 2160 });
        assert_eq!(infos[1].bounds, PhysRect { x: 3840, y: 0, width: 1920, height: 1080 });
        assert_eq!(monitor_for_point(&infos, centre), Some(1));
    }

    /// R2: selection uses full monitor bounds, not the work area — a centre
    /// over the menu bar (top) or dock (bottom) must still select that monitor.
    #[test]
    fn test_monitor_for_point_selects_on_bounds_not_work_area() {
        let mut primary = monitor(0, 0, 2560, 1440, 2.0);
        primary.work_area = PhysRect {
            x: 0,
            y: 74,
            width: 2560,
            height: 1366,
        };
        let mut secondary = monitor(2560, 0, 1920, 1080, 1.0);
        secondary.work_area = PhysRect {
            x: 2560,
            y: 0,
            width: 1920,
            height: 1042,
        };
        let monitors = vec![primary, secondary];
        // Above the menu bar: inside bounds, outside the work area.
        assert_eq!(monitor_for_point(&monitors, (1280, 40)), Some(0));
        // Over the dock: inside bounds, below the work area bottom (1042).
        assert_eq!(monitor_for_point(&monitors, (3000, 1060)), Some(1));
    }

    #[test]
    fn test_monitor_for_point_first_match_wins_on_overlap() {
        let monitors = vec![
            monitor(0, 0, 1920, 1080, 1.0),
            monitor(0, 0, 3840, 2160, 2.0),
        ];
        assert_eq!(monitor_for_point(&monitors, (100, 100)), Some(0));
    }

    #[test]
    fn test_phys_rect_contains_excludes_right_bottom_edges() {
        let rect = PhysRect {
            x: -10,
            y: -20,
            width: 30,
            height: 40,
        };
        assert!(rect.contains(-10, -20));
        assert!(rect.contains(19, 19));
        assert!(!rect.contains(20, 0));
        assert!(!rect.contains(0, 20));
        assert!(!rect.contains(-11, 0));
        assert!(!rect.contains(0, -21));
    }
}
