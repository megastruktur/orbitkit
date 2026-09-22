fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().plugin(
            "orbitkit-native",
            tauri_build::InlinedPlugin::new()
                .commands(&[
                    "overlayShow",
                    "overlayHide",
                    "requestOverlayPermission",
                    "isOverlayPermissionGranted",
                    "overlay_show",
                    "overlay_hide",
                    "request_overlay_permission",
                    "is_overlay_permission_granted",
                ])
                .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
        ),
    )
    .expect("failed to run tauri-build");
}
