use std::collections::HashMap;
use serde::{Deserialize, Serialize};

fn default_mascot_size() -> u32 {
    96
}

fn default_initial_state() -> String {
    "idle".to_string()
}

/// K7: sheets mascot integer upscale default.
fn default_scale() -> u32 {
    1
}

/// K7: arc-anchor head gap default (px).
fn default_head_gap() -> f64 {
    12.0
}

/// K7: stagger timing defaults (260/180/40 ms).
fn default_stagger() -> MenuStaggerConfig {
    MenuStaggerConfig {
        open_ms: 260.0,
        close_ms: 180.0,
        step_ms: 40.0,
    }
}

/// K7: mascot window label default.
fn default_mascot_window_label() -> String {
    "orbitkit-mascot".to_string()
}

/// K7: mascot window URL default.
fn default_mascot_window_url() -> String {
    "index.html?orbitkit=mascot".to_string()
}

fn default_menu_radius() -> f64 {
    96.0
}

fn default_start_angle() -> f64 {
    -90.0
}

fn default_end_angle() -> f64 {
    270.0
}

fn default_item_size() -> f64 {
    44.0
}

fn default_menu_trigger() -> MenuTrigger {
    MenuTrigger::Click
}

fn default_menu_animation() -> Option<String> {
    Some("spawn".to_string())
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MascotKind {
    Svg,
    Image,
    Sprite,
    Sheets,
}

/// K7: one sprite-sheet animation definition (kind="sheets").
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MascotSheetDef {
    pub src: String,
    pub frame_width: u32,
    pub frame_height: u32,
    pub frames: u32,
    pub fps: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub r#loop: Option<bool>,
}

/// K7: anchor within the mascot window (sheets kind).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum MascotAnchor {
    #[default]
    BottomCenter,
    Center,
}

/// K7 (kind="sheets"): state pool definition.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MascotPoolState {
    pub pool: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ttl_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MascotSpriteState {
    pub frames: u32,
    pub fps: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub r#loop: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub row: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MascotStateDefinition {
    Sprite(MascotSpriteState),
    Pool(MascotPoolState),
    Source { src: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MascotConfig {
    pub kind: MascotKind,
    pub src: String,
    #[serde(default = "default_mascot_size")]
    pub size: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frame_width: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frame_height: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub states: Option<HashMap<String, MascotStateDefinition>>,
    #[serde(default = "default_initial_state")]
    pub initial_state: String,
    /// K7 (kind="sheets"): sheet definitions by name.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub sheets: HashMap<String, MascotSheetDef>,
    /// K7 (kind="sheets"): integer upscale factor, default 1.
    #[serde(default = "default_scale")]
    pub scale: u32,
    /// K7 (kind="sheets"): default "bottom-center".
    #[serde(default)]
    pub anchor: MascotAnchor,
    /// K7 (kind="sheets"): mirror sheet horizontally when vx < 0, default false.
    #[serde(default)]
    pub face_by_velocity: bool,
}

impl Default for MascotConfig {
    fn default() -> Self {
        Self {
            kind: MascotKind::Svg,
            src: String::new(),
            size: default_mascot_size(),
            frame_width: None,
            frame_height: None,
            states: None,
            initial_state: default_initial_state(),
            sheets: HashMap::new(),
            scale: default_scale(),
            anchor: MascotAnchor::default(),
            face_by_velocity: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
// kebab-case: single-word variants keep the historical lowercase spellings
// ("click"/"hover"); `RightClick` serializes as "right-click", matching the
// TS `MenuConfig["trigger"]` union in packages/orbitkit/src/config.ts.
#[serde(rename_all = "kebab-case")]
pub enum MenuTrigger {
    #[default]
    Click,
    Hover,
    RightClick,
}

/// K7: menu item icon — URL/data-URL string or inline SVG object.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MenuItemIcon {
    Text(String),
    Svg { svg: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuItem {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<MenuItemIcon>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
}

impl MenuItem {
    /// K7: `^[a-z0-9][a-z0-9_.:-]{0,63}$` — identical to TS `MENU_ITEM_ID_REGEX`.
    pub fn is_valid_id(id: &str) -> bool {
        if id.is_empty() || id.len() > 64 {
            return false;
        }
        let mut chars = id.chars();
        let first = chars.next().unwrap();
        if !first.is_ascii_lowercase() && !first.is_ascii_digit() {
            return false;
        }
        chars.all(|c| {
            c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '.' || c == ':' || c == '-'
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MenuArcConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub span: Option<f64>,
    /// K7 (layout "arc-anchor"): gap in px above mascot's top edge, default 12.
    #[serde(default = "default_head_gap")]
    pub head_gap: f64,
}

/// K7: per-item open/close stagger timing.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuStaggerConfig {
    pub open_ms: f64,
    pub close_ms: f64,
    pub step_ms: f64,
}

impl Default for MenuStaggerConfig {
    fn default() -> Self {
        default_stagger()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuConfig {
    pub items: Vec<MenuItem>,
    #[serde(default = "default_menu_radius")]
    pub radius: f64,
    #[serde(default = "default_start_angle")]
    pub start_angle: f64,
    #[serde(default = "default_end_angle")]
    pub end_angle: f64,
    #[serde(default = "default_item_size")]
    pub item_size: f64,
    #[serde(default = "default_menu_trigger")]
    pub trigger: MenuTrigger,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arc: Option<MenuArcConfig>,
    #[serde(default = "default_menu_animation", skip_serializing_if = "Option::is_none")]
    pub animation: Option<String>,
    /// K7: defaults 260/180/40.
    #[serde(default = "default_stagger")]
    pub stagger: MenuStaggerConfig,
}

impl Default for MenuConfig {
    fn default() -> Self {
        Self {
            items: Vec::new(),
            radius: default_menu_radius(),
            start_angle: default_start_angle(),
            end_angle: default_end_angle(),
            item_size: default_item_size(),
            trigger: default_menu_trigger(),
            layout: None,
            arc: None,
            animation: default_menu_animation(),
            stagger: default_stagger(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedMenuAngles {
    pub start_angle: f64,
    pub end_angle: f64,
}

impl ResolvedMenuAngles {
    pub fn tuple(&self) -> (f64, f64) {
        (self.start_angle, self.end_angle)
    }
}

pub fn resolve_menu_angles(menu: &MenuConfig) -> ResolvedMenuAngles {
    if menu.layout.as_deref() == Some("arc") {
        let position = menu
            .arc
            .as_ref()
            .and_then(|a| a.position.as_deref())
            .unwrap_or("top");
        let span = menu
            .arc
            .as_ref()
            .and_then(|a| a.span)
            .unwrap_or(180.0);

        let centre = match position {
            "top" => -90.0,
            "right" => 0.0,
            "bottom" => 90.0,
            "left" => 180.0,
            _ => -90.0,
        };

        ResolvedMenuAngles {
            start_angle: centre - span / 2.0,
            end_angle: centre + span / 2.0,
        }
    } else {
        ResolvedMenuAngles {
            start_angle: menu.start_angle,
            end_angle: menu.end_angle,
        }
    }
}

impl MenuConfig {
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if let Some(layout) = &self.layout {
            if layout != "orbit" && layout != "arc" && layout != "arc-anchor" {
                errors.push("menu.layout: must be 'orbit', 'arc', or 'arc-anchor'".to_string());
            }
        }
        if let Some(arc) = &self.arc {
            if let Some(position) = &arc.position {
                if position != "top" && position != "bottom" && position != "left" && position != "right" {
                    errors.push("menu.arc.position: must be 'top', 'bottom', 'left', or 'right'".to_string());
                }
            }
            if let Some(span) = arc.span {
                if span.is_nan() || span < 30.0 || span > 300.0 {
                    errors.push("menu.arc.span: must be between 30 and 300".to_string());
                }
            }
            // K7 (layout "arc-anchor")
            if arc.head_gap.is_nan() || arc.head_gap < 0.0 {
                errors.push("menu.arc.headGap: must be a number >= 0".to_string());
            }
        }
        // K7: item ids must match the shared id pattern
        for (i, item) in self.items.iter().enumerate() {
            if !MenuItem::is_valid_id(&item.id) {
                errors.push(format!(
                    "menu.items[{}].id: must match ^[a-z0-9][a-z0-9_.:-]{{0,63}}$",
                    i
                ));
            }
        }
        // K7: stagger timing
        for (field, value) in [
            ("openMs", self.stagger.open_ms),
            ("closeMs", self.stagger.close_ms),
            ("stepMs", self.stagger.step_ms),
        ] {
            if value.is_nan() || value < 0.0 {
                errors.push(format!("menu.stagger.{}: must be a number >= 0", field));
            }
        }

        if let Some(animation) = &self.animation {
            if animation != "spawn" && animation != "none" {
                errors.push("menu.animation: must be one of spawn, none".to_string());
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

impl OrbitKitConfig {
    pub fn validate(&self) -> Result<(), Vec<String>> {
        self.menu.validate()
    }
}

/// K7: mascot window roam behaviour.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MascotRoamCorner {
    BottomRight,
    BottomLeft,
    TopRight,
    TopLeft,
}

/// K7: mascot window roam behaviour settings.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MascotRoamConfig {
    pub width: f64,
    pub height: f64,
    pub margin: f64,
    pub corner: MascotRoamCorner,
    pub speed: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MascotWindowConfig {
    pub transparent: bool,
    pub always_on_top: bool,
    pub decorations: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub x: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub y: Option<f64>,
    /// K7: window label, default "orbitkit-mascot".
    #[serde(default = "default_mascot_window_label")]
    pub label: String,
    /// K7: window URL, default "index.html?orbitkit=mascot".
    #[serde(default = "default_mascot_window_url")]
    pub url: String,
    /// K10: click-through outside hit regions, default false.
    #[serde(default)]
    pub passthrough: bool,
    /// K7: roam behaviour.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub roam: Option<MascotRoamConfig>,
    /// K7: size window to content, default false.
    #[serde(default)]
    pub fit_content: bool,
}

/// K11: popup placement anchor, default none.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum PopupAnchor {
    Mascot,
    Center,
    #[default]
    None,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PopupConfig {
    pub id: String,
    pub url: String,
    pub title: String,
    pub width: f64,
    pub height: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resizable: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub always_on_top: Option<bool>,
    /// K11: default "none".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub anchor: Option<PopupAnchor>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decorations: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transparent: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub skip_taskbar: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_width: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_height: Option<f64>,
}

/// K11: app-level popup/origin settings.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WindowsConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mascot_window: Option<MascotWindowConfig>,
    #[serde(default)]
    pub popups: Vec<PopupConfig>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OrbitKitConfig {
    pub mascot: MascotConfig,
    pub menu: MenuConfig,
    pub windows: WindowsConfig,
    /// K11: app-level settings.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app: Option<AppConfig>,
}

#[cfg(test)]
#[allow(clippy::field_reassign_with_default)] // test fixtures build a default MenuConfig and override a few fields for readability
mod tests {
    use super::*;

    #[test]
    fn test_menu_item_id_validation() {
        // K7 regex ^[a-z0-9][a-z0-9_.:-]{0,63}$
        assert!(MenuItem::is_valid_id("act1"));
        assert!(MenuItem::is_valid_id("menu-item_2"));
        assert!(MenuItem::is_valid_id("chat.new"));
        assert!(MenuItem::is_valid_id("page.open:settings"));
        assert!(MenuItem::is_valid_id("a".repeat(64).as_str()));
        assert!(!MenuItem::is_valid_id(".x"));
        assert!(!MenuItem::is_valid_id("A"));
        assert!(!MenuItem::is_valid_id("-bad"));
        assert!(!MenuItem::is_valid_id(":lead"));
        assert!(!MenuItem::is_valid_id(""));
        assert!(!MenuItem::is_valid_id("a".repeat(65).as_str()));
        assert!(MenuItem::is_valid_id("a".repeat(33).as_str()));
    }

    #[test]
    fn test_k2_config_serde_roundtrip() {
        let sample_json = r#"{
            "mascot": {
                "kind": "sprite",
                "src": "mascot-sprite.png",
                "size": 128,
                "frameWidth": 32,
                "frameHeight": 48,
                "initialState": "waving",
                "states": {
                    "waving": {
                        "frames": 6,
                        "fps": 15.0,
                        "loop": true,
                        "row": 1
                    },
                    "custom": {
                        "src": "custom.png"
                    }
                }
            },
            "menu": {
                "items": [
                    { "id": "action_1", "label": "Action 1", "icon": "🚀", "disabled": false }
                ],
                "radius": 120.0,
                "startAngle": 45.0,
                "endAngle": 315.0,
                "itemSize": 56.0,
                "trigger": "hover"
            },
            "windows": {
                "mascotWindow": {
                    "transparent": true,
                    "alwaysOnTop": true,
                    "decorations": false,
                    "x": 150.0,
                    "y": 250.0
                },
                "popups": [
                    {
                        "id": "settings",
                        "url": "settings.html",
                        "title": "Settings",
                        "width": 400.0,
                        "height": 300.0,
                        "resizable": true,
                        "alwaysOnTop": true
                    }
                ]
            },
            "unknownIgnoredField": "extra"
        }"#;

        let parsed: OrbitKitConfig = serde_json::from_str(sample_json).expect("deserialize K2 config");

        // Assert every parsed mascot field
        assert_eq!(parsed.mascot.kind, MascotKind::Sprite);
        assert_eq!(parsed.mascot.src, "mascot-sprite.png");
        assert_eq!(parsed.mascot.size, 128);
        assert_eq!(parsed.mascot.frame_width, Some(32));
        assert_eq!(parsed.mascot.frame_height, Some(48));
        assert_eq!(parsed.mascot.initial_state, "waving");
        let states = parsed.mascot.states.as_ref().expect("states map present");
        assert_eq!(states.len(), 2);
        match states.get("waving").expect("waving state") {
            MascotStateDefinition::Sprite(s) => {
                assert_eq!(s.frames, 6);
                assert_eq!(s.fps, 15.0);
                assert_eq!(s.r#loop, Some(true));
                assert_eq!(s.row, Some(1));
            }
            _ => panic!("expected sprite state for waving"),
        }
        match states.get("custom").expect("custom state") {
            MascotStateDefinition::Source { src } => assert_eq!(src, "custom.png"),
            _ => panic!("expected source definition for custom"),
        }

        // Assert every parsed menu field
        assert_eq!(parsed.menu.items.len(), 1);
        assert_eq!(parsed.menu.items[0].id, "action_1");
        assert_eq!(parsed.menu.items[0].label, "Action 1");
        assert_eq!(parsed.menu.items[0].icon, Some(MenuItemIcon::Text("🚀".into())));
        assert_eq!(parsed.menu.items[0].disabled, Some(false));
        assert_eq!(parsed.menu.radius, 120.0);
        assert_eq!(parsed.menu.start_angle, 45.0);
        assert_eq!(parsed.menu.end_angle, 315.0);
        assert_eq!(parsed.menu.item_size, 56.0);
        assert_eq!(parsed.menu.trigger, MenuTrigger::Hover);

        // Assert every parsed windows field
        let mw = parsed.windows.mascot_window.as_ref().expect("mascot window present");
        assert!(mw.transparent);
        assert!(mw.always_on_top);
        assert!(!mw.decorations);
        assert_eq!(mw.x, Some(150.0));
        assert_eq!(mw.y, Some(250.0));

        assert_eq!(parsed.windows.popups.len(), 1);
        let popup = &parsed.windows.popups[0];
        assert_eq!(popup.id, "settings");
        assert_eq!(popup.url, "settings.html");
        assert_eq!(popup.title, "Settings");
        assert_eq!(popup.width, 400.0);
        assert_eq!(popup.height, 300.0);
        assert_eq!(popup.resizable, Some(true));
        assert_eq!(popup.always_on_top, Some(true));

        // Serialize and assert camelCase keys are emitted in JSON
        let serialized = serde_json::to_string(&parsed).expect("serialize K2 config");
        assert!(serialized.contains(r#""initialState":"waving""#));
        assert!(serialized.contains(r#""frameWidth":32"#));
        assert!(serialized.contains(r#""frameHeight":48"#));
        assert!(serialized.contains(r#""startAngle":45.0"#));
        assert!(serialized.contains(r#""endAngle":315.0"#));
        assert!(serialized.contains(r#""itemSize":56.0"#));
        assert!(serialized.contains(r#""alwaysOnTop":true"#));
        assert!(serialized.contains(r#""mascotWindow":"#));

        let roundtrip: OrbitKitConfig = serde_json::from_str(&serialized).expect("deserialize roundtrip");
        assert_eq!(parsed, roundtrip);
    }

    #[test]
    fn test_k2_minimal_config_defaults() {
        let minimal_json = r#"{
            "mascot": {
                "kind": "svg",
                "src": "<svg>minimal</svg>"
            },
            "menu": {
                "items": [
                    { "id": "act-1", "label": "Act 1" }
                ]
            },
            "windows": {
                "popups": []
            }
        }"#;
        let min_parsed: OrbitKitConfig =
            serde_json::from_str(minimal_json).expect("deserialize minimal K2 config");

        assert_eq!(min_parsed.mascot.kind, MascotKind::Svg);
        assert_eq!(min_parsed.mascot.src, "<svg>minimal</svg>");
        assert_eq!(min_parsed.mascot.size, 96);
        assert_eq!(min_parsed.mascot.initial_state, "idle");
        assert_eq!(min_parsed.mascot.frame_width, None);
        assert_eq!(min_parsed.mascot.frame_height, None);
        assert_eq!(min_parsed.mascot.states, None);

        assert_eq!(min_parsed.menu.items.len(), 1);
        assert_eq!(min_parsed.menu.items[0].id, "act-1");
        assert_eq!(min_parsed.menu.radius, 96.0);
        assert_eq!(min_parsed.menu.start_angle, -90.0);
        assert_eq!(min_parsed.menu.end_angle, 270.0);
        assert_eq!(min_parsed.menu.item_size, 44.0);
        assert_eq!(min_parsed.menu.trigger, MenuTrigger::Click);

        assert_eq!(min_parsed.windows.mascot_window, None);
        assert!(min_parsed.windows.popups.is_empty());
    }

    #[test]
    fn test_menu_trigger_right_click_parses() {
        // The transcripter injects the webview config through
        // `serde_json::from_str::<OrbitKitConfig>`; the "right-click" spelling
        // added in TS (`MenuConfig["trigger"]`) MUST parse or the app won't boot.
        let json = r#"{
            "mascot": { "kind": "svg", "src": "<svg>rc</svg>" },
            "menu": {
                "items": [{ "id": "act-1", "label": "Act 1" }],
                "trigger": "right-click"
            },
            "windows": { "popups": [] }
        }"#;
        let parsed: OrbitKitConfig = serde_json::from_str(json).expect("right-click trigger parses");
        assert_eq!(parsed.menu.trigger, MenuTrigger::RightClick);

        // Serialized form matches the TS union spelling.
        let serialized = serde_json::to_string(&parsed.menu).expect("serialize menu");
        assert!(serialized.contains(r#""trigger":"right-click""#));

        // kebab-case rename must not drift the historical spellings.
        assert_eq!(serde_json::to_string(&MenuTrigger::Click).unwrap(), r#""click""#);
        assert_eq!(serde_json::to_string(&MenuTrigger::Hover).unwrap(), r#""hover""#);
        assert_eq!(
            serde_json::to_string(&MenuTrigger::RightClick).unwrap(),
            r#""right-click""#
        );

        // Unknown trigger strings still fail to parse.
        let bad = r#"{
            "mascot": { "kind": "svg", "src": "<svg>bad</svg>" },
            "menu": {
                "items": [{ "id": "act-1", "label": "Act 1" }],
                "trigger": "double-click"
            },
            "windows": { "popups": [] }
        }"#;
        assert!(serde_json::from_str::<OrbitKitConfig>(bad).is_err());
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct CanonicalVector {
        layout: String,
        arc: Option<MenuArcConfig>,
        start_angle: f64,
        end_angle: f64,
    }

    #[test]
    fn test_canonical_vectors_against_arc_vectors_json() {
        let vectors_json = include_str!("../../../packages/orbitkit/src/arc-vectors.json");
        let vectors: Vec<CanonicalVector> =
            serde_json::from_str(vectors_json).expect("deserialize arc-vectors.json");

        assert!(vectors.len() >= 6, "must have at least 6 canonical vectors");

        for v in vectors {
            let mut menu = MenuConfig::default();
            menu.layout = Some(v.layout.clone());
            menu.arc = v.arc;
            if v.layout == "orbit" {
                menu.start_angle = v.start_angle;
                menu.end_angle = v.end_angle;
            }
            let resolved = resolve_menu_angles(&menu);
            assert_eq!(resolved.start_angle, v.start_angle);
            assert_eq!(resolved.end_angle, v.end_angle);
        }
    }

    #[test]
    fn test_resolve_menu_angles_positions_and_defaults() {
        // 1. arc top default span
        let mut m_top = MenuConfig::default();
        m_top.layout = Some("arc".into());
        m_top.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: Some(180.0),
            head_gap: 12.0,
});
        assert_eq!(resolve_menu_angles(&m_top), ResolvedMenuAngles { start_angle: -180.0, end_angle: 0.0 });

        // 2. arc bottom default span
        let mut m_bot = MenuConfig::default();
        m_bot.layout = Some("arc".into());
        m_bot.arc = Some(MenuArcConfig {
            position: Some("bottom".into()),
            span: Some(180.0),
            head_gap: 12.0,
});
        assert_eq!(resolve_menu_angles(&m_bot), ResolvedMenuAngles { start_angle: 0.0, end_angle: 180.0 });

        // 3. arc left default span
        let mut m_left = MenuConfig::default();
        m_left.layout = Some("arc".into());
        m_left.arc = Some(MenuArcConfig {
            position: Some("left".into()),
            span: Some(180.0),
            head_gap: 12.0,
});
        assert_eq!(resolve_menu_angles(&m_left), ResolvedMenuAngles { start_angle: 90.0, end_angle: 270.0 });

        // 4. arc right default span
        let mut m_right = MenuConfig::default();
        m_right.layout = Some("arc".into());
        m_right.arc = Some(MenuArcConfig {
            position: Some("right".into()),
            span: Some(180.0),
            head_gap: 12.0,
});
        assert_eq!(resolve_menu_angles(&m_right), ResolvedMenuAngles { start_angle: -90.0, end_angle: 90.0 });

        // 5. span default when omitted
        let mut m_span_def = MenuConfig::default();
        m_span_def.layout = Some("arc".into());
        m_span_def.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: None,
            head_gap: 12.0,
});
        assert_eq!(resolve_menu_angles(&m_span_def), ResolvedMenuAngles { start_angle: -180.0, end_angle: 0.0 });

        // 6. span custom 120
        let mut m_span_custom = MenuConfig::default();
        m_span_custom.layout = Some("arc".into());
        m_span_custom.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: Some(120.0),
            head_gap: 12.0,
});
        assert_eq!(resolve_menu_angles(&m_span_custom), ResolvedMenuAngles { start_angle: -150.0, end_angle: -30.0 });
    }

    #[test]
    fn test_menu_config_validation() {
        // 1. Invalid layout
        let mut m1 = MenuConfig::default();
        m1.layout = Some("zigzag".into());
        let errs1 = m1.validate().unwrap_err();
        assert!(errs1.contains(&"menu.layout: must be 'orbit', 'arc', or 'arc-anchor'".to_string()));

        // 2. Invalid arc position
        let mut m2 = MenuConfig::default();
        m2.layout = Some("arc".into());
        m2.arc = Some(MenuArcConfig {
            position: Some("diagonal".into()),
            span: Some(180.0),
            head_gap: 12.0,
});
        let errs2 = m2.validate().unwrap_err();
        assert!(errs2.contains(&"menu.arc.position: must be 'top', 'bottom', 'left', or 'right'".to_string()));

        // 3. Invalid arc span (< 30 or > 300)
        let mut m3 = MenuConfig::default();
        m3.layout = Some("arc".into());
        m3.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: Some(20.0),
            head_gap: 12.0,
});
        let errs3 = m3.validate().unwrap_err();
        assert!(errs3.contains(&"menu.arc.span: must be between 30 and 300".to_string()));

        let mut m3_large = MenuConfig::default();
        m3_large.layout = Some("arc".into());
        m3_large.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: Some(350.0),
            head_gap: 12.0,
});
        let errs3_large = m3_large.validate().unwrap_err();
        assert!(errs3_large.contains(&"menu.arc.span: must be between 30 and 300".to_string()));

        // 4. Valid arc config
        let mut m4 = MenuConfig::default();
        m4.layout = Some("arc".into());
        m4.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: Some(180.0),
            head_gap: 12.0,
});
        assert!(m4.validate().is_ok());

        // 5. Arc without layout arc is allowed
        let mut m5 = MenuConfig::default();
        m5.layout = Some("orbit".into());
        m5.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: Some(180.0),
            head_gap: 12.0,
});
        assert!(m5.validate().is_ok());

        // 6. Invalid animation
        let mut m6 = MenuConfig::default();
        m6.animation = Some("pop".into());
        let errs6 = m6.validate().unwrap_err();
        assert!(errs6.contains(&"menu.animation: must be one of spawn, none".to_string()));

        // 7. Valid animation values
        let mut m7_spawn = MenuConfig::default();
        m7_spawn.animation = Some("spawn".into());
        assert!(m7_spawn.validate().is_ok());

        let mut m7_none = MenuConfig::default();
        m7_none.animation = Some("none".into());
        assert!(m7_none.validate().is_ok());
    }

    #[test]
    fn test_menu_animation_serde_defaults_and_roundtrip() {
        let json = r#"{"items":[]}"#;
        let parsed: MenuConfig = serde_json::from_str(json).expect("deserialize menu without animation");
        assert_eq!(parsed.animation, Some("spawn".to_string()));

        let none_json = r#"{"items":[],"animation":"none"}"#;
        let parsed_none: MenuConfig = serde_json::from_str(none_json).expect("deserialize menu with animation none");
        assert_eq!(parsed_none.animation, Some("none".to_string()));

        let serialized = serde_json::to_string(&parsed_none).expect("serialize");
        assert!(serialized.contains(r#""animation":"none""#));
    }

    #[test]
    fn test_menu_layout_arc_serde_roundtrip() {
        let json = r#"{"items":[],"layout":"arc","arc":{"position":"left","span":120},"animation":"none"}"#;
        let parsed: MenuConfig = serde_json::from_str(json).expect("deserialize menu layout arc");
        assert_eq!(parsed.layout.as_deref(), Some("arc"));
        assert_eq!(
            parsed.arc,
            Some(MenuArcConfig {
                position: Some("left".to_string()),
                span: Some(120.0),
                head_gap: 12.0,
})
        );
        assert_eq!(parsed.animation.as_deref(), Some("none"));

        let serialized = serde_json::to_string(&parsed).expect("serialize menu layout arc");
        assert!(serialized.contains(r#""layout":"arc""#));
        assert!(serialized.contains(r#""arc":{"position":"left","span":120.0,"headGap":12.0}"#));
        assert!(serialized.contains(r#""animation":"none""#));

        let roundtrip: MenuConfig = serde_json::from_str(&serialized).expect("deserialize roundtrip");
        assert_eq!(parsed, roundtrip);
    }

    #[test]
    fn test_starter_config_compat_k7() {
        // AC3: the frozen 0.1.0 starter config fixture deserializes and validates unchanged.
        let json = include_str!("../../../packages/orbitkit/src/test-fixtures/starter-0.1.0.json");
        let parsed: OrbitKitConfig = serde_json::from_str(json).expect("deserialize starter config");
        assert!(parsed.validate().is_ok(), "starter config must validate: {:?}", parsed.validate());
        assert_eq!(parsed.mascot.kind, MascotKind::Svg);
        assert_eq!(parsed.mascot.size, 96);
        assert_eq!(parsed.mascot.sheets.len(), 0);
        assert_eq!(parsed.mascot.scale, 1);
        assert_eq!(parsed.mascot.anchor, MascotAnchor::BottomCenter);
        assert!(!parsed.mascot.face_by_velocity);
        assert_eq!(parsed.menu.items.len(), 5);
        assert_eq!(parsed.menu.layout.as_deref(), Some("orbit"));
        assert_eq!(parsed.menu.stagger.open_ms, 260.0);
        assert_eq!(parsed.windows.mascot_window.as_ref().expect("mascotWindow").label, "orbitkit-mascot");
        assert!(!parsed.windows.mascot_window.as_ref().unwrap().passthrough);
        assert!(parsed.windows.popups.iter().all(|p| p.anchor.is_none()));
        assert!(parsed.app.is_none());
    }

    #[test]
    fn test_k7_full_fixture_roundtrip() {
        // AC4: full-featured K7 config — Rust reads the same file the TS tests validate.
        let json = include_str!("../../../packages/orbitkit/src/test-fixtures/k7-full.json");
        let parsed: OrbitKitConfig = serde_json::from_str(json).expect("deserialize K7 full fixture");
        assert!(parsed.validate().is_ok(), "K7 fixture must validate: {:?}", parsed.validate());

        // mascot (sheets kind)
        assert_eq!(parsed.mascot.kind, MascotKind::Sheets);
        assert_eq!(parsed.mascot.size, 64);
        assert_eq!(parsed.mascot.scale, 2);
        assert_eq!(parsed.mascot.anchor, MascotAnchor::Center);
        assert!(parsed.mascot.face_by_velocity);
        let walk = parsed.mascot.sheets.get("walk").expect("walk sheet");
        assert_eq!(walk.src, "walk.png");
        assert_eq!(walk.frame_width, 32);
        assert_eq!(walk.frame_height, 32);
        assert_eq!(walk.frames, 6);
        assert_eq!(walk.fps, 10.0);
        assert_eq!(walk.r#loop, Some(true));
        let cheer = parsed.mascot.sheets.get("cheer").expect("cheer sheet");
        assert_eq!(cheer.frames, 4);
        assert_eq!(cheer.r#loop, None);
        let states = parsed.mascot.states.as_ref().expect("states");
        match states.get("idle").expect("idle state") {
            MascotStateDefinition::Pool(p) => {
                assert_eq!(p.pool, vec!["walk".to_string()]);
                assert_eq!(p.priority, Some(2.0));
                assert_eq!(p.ttl_ms, Some(5000));
            }
            other => panic!("expected pool state, got {:?}", other),
        }
        match states.get("alert").expect("alert state") {
            MascotStateDefinition::Pool(p) => {
                assert_eq!(p.pool, vec!["cheer".to_string(), "walk".to_string()]);
                assert_eq!(p.priority, None);
                assert_eq!(p.ttl_ms, None);
            }
            other => panic!("expected pool state, got {:?}", other),
        }

        // menu (arc-anchor, stagger, svg icon)
        assert_eq!(parsed.menu.layout.as_deref(), Some("arc-anchor"));
        assert_eq!(parsed.menu.items.len(), 2);
        assert!(MenuItem::is_valid_id("chat.new"));
        assert!(MenuItem::is_valid_id("page.open:settings"));
        match &parsed.menu.items[0].icon {
            Some(MenuItemIcon::Svg { svg }) => assert!(svg.starts_with("<svg")),
            other => panic!("expected svg icon, got {:?}", other),
        }
        match &parsed.menu.items[1].icon {
            Some(MenuItemIcon::Text(t)) => assert!(t.starts_with("data:image/svg+xml")),
            other => panic!("expected text icon, got {:?}", other),
        }
        let arc = parsed.menu.arc.as_ref().expect("arc");
        assert_eq!(arc.position.as_deref(), Some("top"));
        assert_eq!(arc.span, Some(180.0));
        assert_eq!(arc.head_gap, 16.0);
        assert_eq!(parsed.menu.stagger.open_ms, 200.0);
        assert_eq!(parsed.menu.stagger.close_ms, 120.0);
        assert_eq!(parsed.menu.stagger.step_ms, 30.0);

        // windows (mascotWindow K7 + popup K11)
        let mw = parsed.windows.mascot_window.as_ref().expect("mascotWindow");
        assert_eq!(mw.label, "my-mascot");
        assert_eq!(mw.url, "index.html?orbitkit=mascot");
        assert!(mw.passthrough);
        assert!(mw.fit_content);
        let roam = mw.roam.as_ref().expect("roam");
        assert_eq!(roam.width, 64.0);
        assert_eq!(roam.height, 64.0);
        assert_eq!(roam.margin, 24.0);
        assert_eq!(roam.corner, MascotRoamCorner::BottomRight);
        assert_eq!(roam.speed, 2.5);
        let popup = &parsed.windows.popups[0];
        assert_eq!(popup.anchor, Some(PopupAnchor::Mascot));
        assert_eq!(popup.decorations, Some(false));
        assert_eq!(popup.transparent, Some(true));
        assert_eq!(popup.skip_taskbar, Some(true));
        assert_eq!(popup.min_width, Some(200.0));
        assert_eq!(popup.min_height, Some(160.0));
        assert!(popup.url.contains("{ref}"), "popup url keeps K11 placeholder");

        // app (K11)
        let app = parsed.app.as_ref().expect("app");
        assert_eq!(
            app.allowed_origins,
            vec!["https://example.com".to_string(), "http://localhost:1420".to_string()]
        );

        // roundtrip
        let serialized = serde_json::to_string(&parsed).expect("serialize K7 fixture");
        assert!(serialized.contains(r#""faceByVelocity":true"#));
        assert!(serialized.contains(r#""headGap":16.0"#));
        assert!(serialized.contains(r#""openMs":200.0"#));
        assert!(serialized.contains(r#""skipTaskbar":true"#));
        assert!(serialized.contains(r#""allowedOrigins":["#));
        let roundtrip: OrbitKitConfig = serde_json::from_str(&serialized).expect("deserialize roundtrip");
        assert_eq!(parsed, roundtrip);
    }

    #[test]
    fn test_k7_defaults_applied_on_deserialize() {
        // AC1: all optional K7 fields carry contract defaults.
        let json = r#"{"mascot":{"kind":"sheets","src":"m.png","size":64,"sheets":{}},"menu":{"items":[{"id":"a","label":"A"}],"arc":{}},"windows":{"mascotWindow":{"transparent":true,"alwaysOnTop":true,"decorations":false},"popups":[]}}"#;
        let parsed: OrbitKitConfig = serde_json::from_str(json).expect("deserialize defaults config");
        assert_eq!(parsed.mascot.scale, 1);
        assert_eq!(parsed.mascot.anchor, MascotAnchor::BottomCenter);
        assert!(!parsed.mascot.face_by_velocity);
        let arc = parsed.menu.arc.as_ref().expect("arc default");
        assert_eq!(arc.head_gap, 12.0);
        assert_eq!(parsed.menu.stagger.open_ms, 260.0);
        assert_eq!(parsed.menu.stagger.close_ms, 180.0);
        assert_eq!(parsed.menu.stagger.step_ms, 40.0);
        let mw = parsed.windows.mascot_window.as_ref().expect("mascotWindow");
        assert_eq!(mw.label, "orbitkit-mascot");
        assert_eq!(mw.url, "index.html?orbitkit=mascot");
        assert!(!mw.passthrough);
        assert!(!mw.fit_content);
        assert!(mw.roam.is_none());
    }

    #[test]
    fn test_k7_validate_rejects_invalid() {
        // layout arc-anchor accepted; ids validated via shared pattern
        let mut ok = MenuConfig::default();
        ok.layout = Some("arc-anchor".into());
        ok.items = vec![MenuItem { id: "page.open:settings".into(), label: "S".into(), icon: None, disabled: None }];
        assert!(ok.validate().is_ok());

        let mut bad_id = MenuConfig::default();
        bad_id.items = vec![MenuItem { id: ".x".into(), label: "B".into(), icon: None, disabled: None }];
        assert!(bad_id
            .validate()
            .unwrap_err()
            .iter()
            .any(|e| e.contains("must match ^[a-z0-9][a-z0-9_.:-]{0,63}$")));

        let mut bad_stagger = MenuConfig::default();
        bad_stagger.stagger.step_ms = -1.0;
        assert!(bad_stagger
            .validate()
            .unwrap_err()
            .iter()
            .any(|e| e.contains("menu.stagger.stepMs")));

        let mut bad_gap = MenuConfig::default();
        bad_gap.arc = Some(MenuArcConfig { head_gap: -1.0, ..Default::default() });
        assert!(bad_gap
            .validate()
            .unwrap_err()
            .iter()
            .any(|e| e.contains("menu.arc.headGap")));
    }
}
