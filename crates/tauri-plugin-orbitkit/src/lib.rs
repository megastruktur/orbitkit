use std::collections::HashMap;
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
#[cfg(desktop)]
mod placement;
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

/// K11: prefix of every OrbitKit popup window label.
pub const POPUP_LABEL_PREFIX: &str = "orbitkit-popup-";

/// K11: builds the popup window label `orbitkit-popup-{id}` or, when an
/// instance key is given, `orbitkit-popup-{id}-{instanceKey}`. The instance
/// key must match `^[a-z0-9_-]{1,32}$`, otherwise `invalid_config`.
pub fn popup_label(id: &str, instance_key: Option<&str>) -> Result<String> {
    match instance_key {
        None => Ok(format!("{POPUP_LABEL_PREFIX}{id}")),
        Some(key) => {
            if !is_valid_instance_key(key) {
                return Err(Error::invalid_config(format!(
                    "invalid popup instanceKey '{key}' (must match ^[a-z0-9_-]{{1,32}}$)"
                )));
            }
            Ok(format!("{POPUP_LABEL_PREFIX}{id}-{key}"))
        }
    }
}

/// True if `s` matches `^[a-z0-9_-]{1,32}$` (all allowed chars are single
/// bytes, so a byte-level check is exact).
fn is_valid_instance_key(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 32
        && s.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_' || b == b'-')
}

/// K11: percent-encodes `value` (UTF-8) for `{param}` substitution, keeping
/// only RFC 3986 unreserved characters (`A-Z a-z 0-9 - . _ ~`).
pub fn percent_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(byte as char);
            }
            _ => {
                out.push('%');
                out.push_str(&format!("{byte:02X}"));
            }
        }
    }
    out
}

/// K11: substitutes `{param}` placeholders in a popup URL template with the
/// URL-encoded value of each named parameter. A placeholder without a matching
/// parameter is `invalid_config`. Text outside placeholders (including an
/// unclosed `{`) is kept verbatim.
pub fn substitute_popup_params(
    url: &str,
    params: Option<&HashMap<String, String>>,
) -> Result<String> {
    let no_params: HashMap<String, String> = HashMap::new();
    let params = params.unwrap_or(&no_params);

    let mut out = String::with_capacity(url.len());
    let mut rest = url;
    while let Some(start) = rest.find('{') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('}') {
            Some(end) => {
                let key = &after[..end];
                let value = params.get(key).ok_or_else(|| {
                    Error::invalid_config(format!(
                        "unknown popup URL placeholder '{{{key}}}'"
                    ))
                })?;
                out.push_str(&percent_encode(value));
                rest = &after[end + 1..];
            }
            None => {
                out.push('{');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    Ok(out)
}

/// K11: a popup URL resolved against the scheme policy — either an
/// app-relative asset path or an allowed external URL.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResolvedPopupUrl {
    App(String),
    External(tauri::Url),
}

/// True if `url` is a genuinely app-relative path: no backslash, no control
/// characters, no `:` before the first `/` (no smuggled scheme), not
/// scheme-relative (`//host/...` or `/\host\...` — `Url::parse` rejects those
/// but joining against the app base would swap the host), and non-empty.
/// A leading `/` must be followed by a character other than `/` or `\`.
fn is_safe_app_relative(url: &str) -> bool {
    if url.is_empty()
        || url.starts_with("//")
        || url.contains('\\')
        || url.chars().any(|c| c.is_control())
    {
        return false;
    }
    if let Some(first_slash) = url.find('/') {
        if url[..first_slash].contains(':') {
            return false;
        }
        if first_slash == 0 && (url.len() < 2 || url.as_bytes()[1] == b'/') {
            return false;
        }
    } else if url.contains(':') {
        return false;
    }
    true
}

/// K11 URL scheme policy: app-relative paths, `http(s)://127.0.0.1:<port>` /
/// `http(s)://localhost:<port>`, and `https://` origins listed in
/// `app.allowedOrigins`. Everything else (`file:`, `javascript:`, other
/// hosts, loopback without an explicit port, scheme-relative/backslash
/// smuggles) is `invalid_config`.
pub fn resolve_popup_url(url: &str, allowed_origins: &[String]) -> Result<ResolvedPopupUrl> {
    let parsed = match tauri::Url::parse(url) {
        Ok(parsed) => parsed,
        // No scheme/base — only accept a genuine app-relative asset path.
        // The join check asserts the app base keeps its origin (paranoia on
        // top of the structural check).
        Err(_) => {
            if !is_safe_app_relative(url) {
                return Err(Error::invalid_config(format!(
                    "popup url '{url}' is not a safe app-relative path"
                )));
            }
            let base = tauri::Url::parse("tauri://localhost").map_err(|e| {
                Error::invalid_config(format!("app base url unavailable: {e}"))
            })?;
            let joined = base.join(url).map_err(|e| {
                Error::invalid_config(format!("popup url '{url}' not joinable to app base: {e}"))
            })?;
            if joined.scheme() != base.scheme() || joined.host_str() != base.host_str() {
                return Err(Error::invalid_config(format!(
                    "popup url '{url}' would leave the app origin when joined"
                )));
            }
            return Ok(ResolvedPopupUrl::App(url.to_string()));
        }
    };

    match parsed.scheme() {
        "http" | "https" => {
            let host = parsed.host_str().unwrap_or_default();
            let is_loopback =
                (host == "127.0.0.1" || host == "localhost") && parsed.port().is_some();
            let is_allowed_origin = parsed.scheme() == "https"
                && allowed_origins
                    .iter()
                    .any(|origin| origin_allowed(origin, &parsed));
            if is_loopback || is_allowed_origin {
                Ok(ResolvedPopupUrl::External(parsed))
            } else {
                Err(Error::invalid_config(format!(
                    "popup url host '{host}' is not allowed (loopback http(s) with port or https allowedOrigins only)"
                )))
            }
        }
        scheme => Err(Error::invalid_config(format!(
            "popup url scheme '{scheme}' is not allowed (app-relative, loopback http(s) or https allowedOrigins only)"
        ))),
    }
}

/// True if `origin` is a `https://` origin matching `url`'s host and
/// effective port (default 443 normalised on both sides).
fn origin_allowed(origin: &str, url: &tauri::Url) -> bool {
    let parsed = match tauri::Url::parse(origin) {
        Ok(parsed) => parsed,
        Err(_) => return false,
    };
    parsed.scheme() == "https"
        && parsed.host_str() == url.host_str()
        && parsed.port_or_known_default() == url.port_or_known_default()
}

/// Fully resolved `WebviewWindowBuilder` arguments for a popup (K11 AC4).
#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedPopupSpec {
    pub title: String,
    pub width: f64,
    pub height: f64,
    pub resizable: bool,
    pub always_on_top: bool,
    pub decorations: bool,
    pub transparent: bool,
    pub skip_taskbar: bool,
    pub min_width: Option<f64>,
    pub min_height: Option<f64>,
}

/// Resolves a popup config entry into concrete builder arguments, applying K7
/// defaults: `resizable` = true, `always_on_top` = false, `decorations` =
/// true, `transparent` = false, `skipTaskbar` = false.
pub fn resolve_popup_spec(popup: &PopupConfig) -> ResolvedPopupSpec {
    ResolvedPopupSpec {
        title: popup.title.clone(),
        width: popup.width,
        height: popup.height,
        resizable: popup.resizable.unwrap_or(true),
        always_on_top: popup.always_on_top.unwrap_or(false),
        decorations: popup.decorations.unwrap_or(true),
        transparent: popup.transparent.unwrap_or(false),
        skip_taskbar: popup.skip_taskbar.unwrap_or(false),
        min_width: popup.min_width,
        min_height: popup.min_height,
    }
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
            commands::list_popups,
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

    /// K11 AC1: label formats — default and instance-key variants.
    #[test]
    fn test_popup_label_default_and_instance_key() {
        assert_eq!(popup_label("notes", None).unwrap(), "orbitkit-popup-notes");
        assert_eq!(
            popup_label("notes", Some("chat-1")).unwrap(),
            "orbitkit-popup-notes-chat-1"
        );
        assert_eq!(
            popup_label("chat", Some("_a_")).unwrap(),
            "orbitkit-popup-chat-_a_"
        );
    }

    /// K11 AC1: instanceKey regex `^[a-z0-9_-]{1,32}$` — rejects empty,
    /// uppercase, whitespace, non-ASCII and >32 chars; accepts 32-char key.
    #[test]
    fn test_popup_label_rejects_invalid_instance_keys() {
        for bad in [
            "",
            "UPPER",
            "a b",
            "café",
            "dot.dot",
            "slash/slash",
            &"a".repeat(33),
        ] {
            let err = popup_label("notes", Some(bad)).unwrap_err();
            assert_eq!(err.code, ErrorCode::InvalidConfig, "key '{bad}'");
        }
        let long_ok = "a".repeat(32);
        assert!(popup_label("notes", Some(long_ok.as_str())).is_ok());
    }

    /// K11 AC2: `{param}` values are percent-encoded; multiple placeholders
    /// substitute independently.
    #[test]
    fn test_substitute_popup_params_encodes_values() {
        let mut params = HashMap::new();
        params.insert("q".to_string(), "a b&c=1".to_string());
        params.insert("chat".to_string(), "хелло/world~".to_string());

        let out = substitute_popup_params(
            "index.html?orbitkit=popup&popup=notes&q={q}&c={chat}",
            Some(&params),
        )
        .unwrap();
        assert_eq!(
            out,
            "index.html?orbitkit=popup&popup=notes&q=a%20b%26c%3D1&c=%D1%85%D0%B5%D0%BB%D0%BB%D0%BE%2Fworld~"
        );
    }

    /// K11 AC2: unknown/missing placeholder is `invalid_config`; params absent
    /// at all also rejects; non-placeholder text (incl. unclosed `{`) is kept.
    #[test]
    fn test_substitute_popup_params_unknown_placeholder_rejected() {
        let mut params = HashMap::new();
        params.insert("a".to_string(), "1".to_string());

        let err = substitute_popup_params("x.html?p={b}", Some(&params)).unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidConfig);

        let err = substitute_popup_params("x.html?p={a}", None).unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidConfig);

        assert_eq!(
            substitute_popup_params("x.html?{unclosed", Some(&params)).unwrap(),
            "x.html?{unclosed"
        );
    }

    /// K11 AC3: app-relative paths pass through untouched.
    #[test]
    fn test_resolve_popup_url_app_relative() {
        for url in [
            "index.html?orbitkit=popup",
            "/pages/p.html",
            "p.html",
            "/popups/note.html?x=1",
        ] {
            assert_eq!(
                resolve_popup_url(url, &[]).unwrap(),
                ResolvedPopupUrl::App(url.to_string()),
                "url '{url}'"
            );
        }
    }

    /// K11 AC3/F1: scheme-relative, backslash and smuggled-scheme inputs are
    /// `invalid_config` — joining them against the app base would swap the
    /// host to an attacker-controlled origin. These MUST fail on the old
    /// parse-Err → App behaviour.
    #[test]
    fn test_resolve_popup_url_rejects_scheme_relative_smuggles() {
        for url in [
            "//evil.example/x",
            "/\\evil.example/x",
            "\\evil.example/x",
            "p.html?q=http://x",
            "",
        ] {
            let err = resolve_popup_url(url, &[]).unwrap_err();
            assert_eq!(err.code, ErrorCode::InvalidConfig, "url '{url}'");
        }
    }

    /// K11 AC3: loopback http(s) hosts are allowed only with an explicit port.
    #[test]
    fn test_resolve_popup_url_loopback() {
        for url in [
            "http://127.0.0.1:1420/p.html",
            "http://localhost:3000/x?q=1",
            "https://localhost:8443/",
            "https://127.0.0.1:5173/app",
        ] {
            let resolved = resolve_popup_url(url, &[]).unwrap();
            assert!(
                matches!(resolved, ResolvedPopupUrl::External(_)),
                "url '{url}'"
            );
        }

        for url in ["http://localhost/p.html", "https://127.0.0.1/", "http://[::1]:3000/"] {
            let err = resolve_popup_url(url, &[]).unwrap_err();
            assert_eq!(err.code, ErrorCode::InvalidConfig, "url '{url}'");
        }
    }

    /// K11 AC3: `file:`, `javascript:` and non-loopback hosts are rejected;
    /// configured `https://` allowedOrigins are honoured with port
    /// normalisation, `http://` origin entries are not.
    #[test]
    fn test_resolve_popup_url_policy() {
        for url in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "data:text/html,hi",
            "http://evil.example.com:8080/",
            "https://evil.example.com/",
        ] {
            let err = resolve_popup_url(url, &[]).unwrap_err();
            assert_eq!(err.code, ErrorCode::InvalidConfig, "url '{url}'");
        }

        let origins = vec![
            "https://app.example.com".to_string(),
            "https://popup.example.com:8443".to_string(),
            "http://insecure.example.com".to_string(),
        ];

        // Exact https origin (default port 443 on both sides).
        assert!(matches!(
            resolve_popup_url("https://app.example.com/p", &origins).unwrap(),
            ResolvedPopupUrl::External(_)
        ));
        // Origin listed with port, URL without (both default 8443? no: 8443
        // explicit in origin, URL must carry it too).
        assert!(matches!(
            resolve_popup_url("https://popup.example.com:8443/p", &origins).unwrap(),
            ResolvedPopupUrl::External(_)
        ));
        // Wrong port on an allowed host.
        assert_eq!(
            resolve_popup_url("https://popup.example.com:9000/p", &origins).unwrap_err().code,
            ErrorCode::InvalidConfig
        );
        // http:// entry must NOT whitelist anything.
        assert_eq!(
            resolve_popup_url("http://insecure.example.com/p", &origins).unwrap_err().code,
            ErrorCode::InvalidConfig
        );
    }

    /// K11 AC4: spec fields resolve from config with K7 defaults.
    #[test]
    fn test_resolve_popup_spec_defaults_and_overrides() {
        let defaults = resolve_popup_spec(&popup("notes", "index.html"));
        assert_eq!(
            defaults,
            ResolvedPopupSpec {
                title: "Title notes".to_string(),
                width: 320.0,
                height: 480.0,
                resizable: true,
                always_on_top: false,
                decorations: true,
                transparent: false,
                skip_taskbar: false,
                min_width: None,
                min_height: None,
            }
        );

        let mut custom = popup("chat", "chat.html");
        custom.resizable = Some(false);
        custom.always_on_top = Some(true);
        custom.decorations = Some(false);
        custom.transparent = Some(true);
        custom.skip_taskbar = Some(true);
        custom.min_width = Some(200.0);
        custom.min_height = Some(150.0);
        let resolved = resolve_popup_spec(&custom);
        assert!(!resolved.resizable);
        assert!(resolved.always_on_top);
        assert!(!resolved.decorations);
        assert!(resolved.transparent);
        assert!(resolved.skip_taskbar);
        assert_eq!(resolved.min_width, Some(200.0));
        assert_eq!(resolved.min_height, Some(150.0));
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
