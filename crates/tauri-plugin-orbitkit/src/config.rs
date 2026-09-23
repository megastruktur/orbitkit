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

fn default_menu_animation() -> Option<String> {
    Some("spawn".to_string())
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MenuArcConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub span: Option<f64>,
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
            if layout != "orbit" && layout != "arc" {
                errors.push("menu.layout: must be 'orbit' or 'arc'".to_string());
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
        });
        assert_eq!(resolve_menu_angles(&m_top), ResolvedMenuAngles { start_angle: -180.0, end_angle: 0.0 });

        // 2. arc bottom default span
        let mut m_bot = MenuConfig::default();
        m_bot.layout = Some("arc".into());
        m_bot.arc = Some(MenuArcConfig {
            position: Some("bottom".into()),
            span: Some(180.0),
        });
        assert_eq!(resolve_menu_angles(&m_bot), ResolvedMenuAngles { start_angle: 0.0, end_angle: 180.0 });

        // 3. arc left default span
        let mut m_left = MenuConfig::default();
        m_left.layout = Some("arc".into());
        m_left.arc = Some(MenuArcConfig {
            position: Some("left".into()),
            span: Some(180.0),
        });
        assert_eq!(resolve_menu_angles(&m_left), ResolvedMenuAngles { start_angle: 90.0, end_angle: 270.0 });

        // 4. arc right default span
        let mut m_right = MenuConfig::default();
        m_right.layout = Some("arc".into());
        m_right.arc = Some(MenuArcConfig {
            position: Some("right".into()),
            span: Some(180.0),
        });
        assert_eq!(resolve_menu_angles(&m_right), ResolvedMenuAngles { start_angle: -90.0, end_angle: 90.0 });

        // 5. span default when omitted
        let mut m_span_def = MenuConfig::default();
        m_span_def.layout = Some("arc".into());
        m_span_def.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: None,
        });
        assert_eq!(resolve_menu_angles(&m_span_def), ResolvedMenuAngles { start_angle: -180.0, end_angle: 0.0 });

        // 6. span custom 120
        let mut m_span_custom = MenuConfig::default();
        m_span_custom.layout = Some("arc".into());
        m_span_custom.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: Some(120.0),
        });
        assert_eq!(resolve_menu_angles(&m_span_custom), ResolvedMenuAngles { start_angle: -150.0, end_angle: -30.0 });
    }

    #[test]
    fn test_menu_config_validation() {
        // 1. Invalid layout
        let mut m1 = MenuConfig::default();
        m1.layout = Some("zigzag".into());
        let errs1 = m1.validate().unwrap_err();
        assert!(errs1.contains(&"menu.layout: must be 'orbit' or 'arc'".to_string()));

        // 2. Invalid arc position
        let mut m2 = MenuConfig::default();
        m2.layout = Some("arc".into());
        m2.arc = Some(MenuArcConfig {
            position: Some("diagonal".into()),
            span: Some(180.0),
        });
        let errs2 = m2.validate().unwrap_err();
        assert!(errs2.contains(&"menu.arc.position: must be 'top', 'bottom', 'left', or 'right'".to_string()));

        // 3. Invalid arc span (< 30 or > 300)
        let mut m3 = MenuConfig::default();
        m3.layout = Some("arc".into());
        m3.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: Some(20.0),
        });
        let errs3 = m3.validate().unwrap_err();
        assert!(errs3.contains(&"menu.arc.span: must be between 30 and 300".to_string()));

        let mut m3_large = MenuConfig::default();
        m3_large.layout = Some("arc".into());
        m3_large.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: Some(350.0),
        });
        let errs3_large = m3_large.validate().unwrap_err();
        assert!(errs3_large.contains(&"menu.arc.span: must be between 30 and 300".to_string()));

        // 4. Valid arc config
        let mut m4 = MenuConfig::default();
        m4.layout = Some("arc".into());
        m4.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: Some(180.0),
        });
        assert!(m4.validate().is_ok());

        // 5. Arc without layout arc is allowed
        let mut m5 = MenuConfig::default();
        m5.layout = Some("orbit".into());
        m5.arc = Some(MenuArcConfig {
            position: Some("top".into()),
            span: Some(180.0),
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
            })
        );
        assert_eq!(parsed.animation.as_deref(), Some("none"));

        let serialized = serde_json::to_string(&parsed).expect("serialize menu layout arc");
        assert!(serialized.contains(r#""layout":"arc""#));
        assert!(serialized.contains(r#""arc":{"position":"left","span":120.0}"#));
        assert!(serialized.contains(r#""animation":"none""#));

        let roundtrip: MenuConfig = serde_json::from_str(&serialized).expect("deserialize roundtrip");
        assert_eq!(parsed, roundtrip);
    }
}
