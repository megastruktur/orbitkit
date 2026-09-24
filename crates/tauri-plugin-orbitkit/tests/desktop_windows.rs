use tauri_plugin_orbitkit::{
    calculate_overlay_position, calculate_overlay_size, lookup_popup, resolve_mascot_window,
    ErrorCode, MascotWindowConfig, MonitorBounds, PopupConfig,
};

#[test]
fn test_calculate_overlay_size_menu_dominates() {
    // When menu diameter is larger than mascot size:
    // mascot = 96, radius = 96, item_size = 44
    // menu span = 2 * (96 + 44) = 280
    // max(96, 280) = 280
    // size = 280 + 16 = 296
    let size = calculate_overlay_size(96.0, 96.0, 44.0);
    assert_eq!(size, 296.0);
}

#[test]
fn test_calculate_overlay_size_mascot_dominates() {
    // When mascot size is larger than menu diameter:
    // mascot = 300, radius = 80, item_size = 30
    // menu span = 2 * (80 + 30) = 220
    // max(300, 220) = 300
    // size = 300 + 16 = 316
    let size = calculate_overlay_size(300.0, 80.0, 30.0);
    assert_eq!(size, 316.0);
}

#[test]
fn test_calculate_overlay_size_edge_cases() {
    let size = calculate_overlay_size(0.0, 0.0, 0.0);
    assert_eq!(size, 16.0);

    let size_equal = calculate_overlay_size(100.0, 40.0, 10.0);
    // menu span = 2 * (40 + 10) = 100
    // max(100, 100) = 100
    // size = 100 + 16 = 116
    assert_eq!(size_equal, 116.0);
}

#[test]
fn test_calculate_overlay_position_bottom_right_default() {
    let monitor = MonitorBounds::new(0.0, 0.0, 1920.0, 1080.0);
    let window_size = 296.0;
    let margin = 24.0;

    let (pos_x, pos_y) = calculate_overlay_position(monitor, window_size, margin, None, None);
    assert_eq!(pos_x, 1600.0);
    assert_eq!(pos_y, 760.0);
}

#[test]
fn test_calculate_overlay_position_non_zero_origin_monitor() {
    let monitor = MonitorBounds::new(1920.0, 100.0, 1280.0, 720.0);
    let window_size = 296.0;
    let margin = 24.0;

    let (pos_x, pos_y) = calculate_overlay_position(monitor, window_size, margin, None, None);
    assert_eq!(pos_x, 1920.0 + 1280.0 - 296.0 - 24.0);
    assert_eq!(pos_y, 100.0 + 720.0 - 296.0 - 24.0);
}

#[test]
fn test_calculate_overlay_position_custom_coordinates() {
    let monitor = MonitorBounds::new(0.0, 0.0, 1920.0, 1080.0);
    let window_size = 296.0;
    let margin = 24.0;

    // Fully custom
    let (pos_x, pos_y) = calculate_overlay_position(
        monitor,
        window_size,
        margin,
        Some(150.0),
        Some(250.0),
    );
    assert_eq!(pos_x, 150.0);
    assert_eq!(pos_y, 250.0);

    // Partial custom x
    let (pos_x, pos_y) = calculate_overlay_position(
        monitor,
        window_size,
        margin,
        Some(150.0),
        None,
    );
    assert_eq!(pos_x, 150.0);
    assert_eq!(pos_y, 760.0);

    // Partial custom y
    let (pos_x, pos_y) = calculate_overlay_position(
        monitor,
        window_size,
        margin,
        None,
        Some(250.0),
    );
    assert_eq!(pos_x, 1600.0);
    assert_eq!(pos_y, 250.0);
}

#[test]
fn test_lookup_popup_success() {
    let popups = vec![
        PopupConfig {
            id: "chat".to_string(),
            url: "chat.html".to_string(),
            title: "Chat Window".to_string(),
            width: 500.0,
            height: 400.0,
            resizable: Some(true),
            always_on_top: Some(false),
        },
        PopupConfig {
            id: "settings".to_string(),
            url: "settings.html".to_string(),
            title: "Settings Window".to_string(),
            width: 350.0,
            height: 250.0,
            resizable: None,
            always_on_top: None,
        },
    ];

    let found = lookup_popup(&popups, "settings").expect("should find settings popup");
    assert_eq!(found.id, "settings");
    assert_eq!(found.title, "Settings Window");
    assert_eq!(found.width, 350.0);
    assert_eq!(found.height, 250.0);
}

#[test]
fn test_lookup_popup_not_found_scenario_3() {
    // Scenario 3 from BRIEF.md: test asserting not_found
    let popups = vec![PopupConfig {
        id: "chat".to_string(),
        url: "chat.html".to_string(),
        title: "Chat".to_string(),
        width: 400.0,
        height: 300.0,
        resizable: None,
        always_on_top: None,
    }];

    let result = lookup_popup(&popups, "unknown_popup_id");
    assert!(result.is_err(), "lookup of nonexistent popup must return error");
    let err = result.unwrap_err();
    assert_eq!(err.code, ErrorCode::NotFound);

    // Verify serialized error structure matches K4 contract
    let json_val = serde_json::to_value(&err).expect("serialize error");
    assert_eq!(json_val["code"], "not_found");
    assert!(
        json_val["message"]
            .as_str()
            .expect("message should be string")
            .contains("unknown_popup_id")
    );
}

#[test]
fn test_lookup_popup_empty_popups_list() {
    let popups: Vec<PopupConfig> = vec![];
    let result = lookup_popup(&popups, "settings");
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, ErrorCode::NotFound);
}

#[test]
fn test_resolve_mascot_window_defaults() {
    let resolved = resolve_mascot_window(None);
    assert!(resolved.transparent);
    assert!(!resolved.decorations);
    assert!(resolved.always_on_top);
    assert!(resolved.skip_taskbar);
    assert!(!resolved.shadow);
    assert_eq!(resolved.x, None);
    assert_eq!(resolved.y, None);
}

#[test]
fn test_resolve_mascot_window_custom() {
    let config = MascotWindowConfig {
        transparent: false,
        always_on_top: false,
        decorations: true,
        x: Some(150.0),
        y: Some(250.0),
    };
    let resolved = resolve_mascot_window(Some(&config));
    assert!(!resolved.transparent);
    assert!(resolved.decorations);
    assert!(!resolved.always_on_top);
    assert!(resolved.skip_taskbar);
    assert!(!resolved.shadow);
    assert_eq!(resolved.x, Some(150.0));
    assert_eq!(resolved.y, Some(250.0));
}

#[test]
fn test_harness_config_deserialization() {
    let json_str = include_str!("fixtures/harness-config.json");
    let config: tauri_plugin_orbitkit::OrbitKitConfig =
        serde_json::from_str(json_str).expect("harness-config.json must deserialize successfully");
    assert_eq!(config.windows.popups.len(), 1);
    assert_eq!(config.windows.popups[0].id, "settings");
}

#[test]
fn test_start_mascot_drag_not_found_when_no_window() {
    let app = tauri::test::mock_app();
    let orbitkit = tauri_plugin_orbitkit::Orbitkit::new(
        app.handle().clone(),
        tauri_plugin_orbitkit::OrbitKitConfig::default(),
    );
    let result = orbitkit.start_mascot_drag();
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, ErrorCode::NotFound);
    assert!(err.message.contains("Mascot window not found"));
}
