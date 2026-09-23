use std::collections::HashMap;
use serde::{Deserialize, Serialize};

fn default_mascot_size() -> u32 {
    96
}

fn default_initial_state() -> String {
    "idle".to_string()
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MascotKind {
    Svg,
    Image,
    Sprite,
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
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MenuTrigger {
    #[default]
    Click,
    Hover,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuItem {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
}

impl MenuItem {
    pub fn is_valid_id(id: &str) -> bool {
        if id.is_empty() || id.len() > 32 {
            return false;
        }
        let mut chars = id.chars();
        let first = chars.next().unwrap();
        if !first.is_ascii_lowercase() && !first.is_ascii_digit() {
            return false;
        }
        chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')
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
        }
    }
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_menu_item_id_validation() {
        assert!(MenuItem::is_valid_id("act1"));
        assert!(MenuItem::is_valid_id("menu-item_2"));
        assert!(!MenuItem::is_valid_id("-bad"));
        assert!(!MenuItem::is_valid_id("Bad"));
        assert!(!MenuItem::is_valid_id(""));
        assert!(!MenuItem::is_valid_id("a".repeat(33).as_str()));
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
        assert_eq!(parsed.menu.items[0].icon, Some("🚀".into()));
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
}
