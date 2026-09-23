# Task Report: `starter-example` (T11) — Full Report (Phase A + Phase B)

## Summary
Completed task `starter-example` (`oks-starter-example` worktree) across Phase A (desktop architecture, config, routing, views, container scenario) and Phase B (Android dual-APK builds, aapt permissions verification, device runbook, README, and cleanup).

### Phase A Deliverables
1. **Config & TypeScript Wrapper (`src/orbitkit.config.json` + `src/orbitkit.config.ts`)**:
   - Single canonical `src/orbitkit.config.json` specifying default bright mascot (SVG with idle/busy states), 5 menu items (`notes`, `timer`, `settings`, `about`, `quit`), popups (`notes`: 320x420 at `index.html?popup=notes`, `settings`: 360x300 at `index.html?popup=settings`), and mascot window defaults (`transparent: true`, `alwaysOnTop: true`, `decorations: false`).
   - `src/orbitkit.config.ts` wraps the JSON with `defineConfig` and validates with `validateConfig`.
   - Vendored mascot SVG into `examples/starter/public/assets/default-mascot.svg`.
   - Removed unreferenced duplicate `orbitkit.config.json` at root to maintain single source of truth.
2. **Frontend Routing & Svelte Views (`src/main.ts`, `src/views/*`)**:
   - `src/main.ts` routes based on query parameters:
     - `?orbitkit=mascot` → `MascotView.svelte`
     - `?popup=notes` → `NotesPopup.svelte`
     - `?popup=settings` → `SettingsPopup.svelte`
     - default → `MainView.svelte`
   - `MascotView.svelte`: renders `Mascot` and `RadialMenu` centered with transparent background. Clicking mascot toggles radial menu. Selecting a menu item emits `emitMenuAction(id)`. Listens to `onMascotState` to update animation state.
   - `NotesPopup.svelte`: quick notes textarea persisted to `localStorage` (`orbitkit_starter_notes`).
   - `SettingsPopup.svelte`: buttons to toggle mascot state (`idle`, `busy`, `active`, `attention`) via `setMascotState`.
   - `MainView.svelte`: explains app, provides Show/Hide overlay controls, displays Android overlay permission status, event log listening to `onMenuAction`, and retains Android recorder extension UI.
   - Removed obsolete spike files `App.svelte` and `src/lib/Mascot.svelte`.
3. **Rust Backend (`src-tauri/src/lib.rs`, `src-tauri/build.rs`, `capabilities/default.json`)**:
   - `lib.rs`: initializes plugin via `tauri_plugin_orbitkit::init(config)` with configuration parsed from embedded `orbitkit.config.json`.
   - `on_menu_action` handler:
     - `about` → logs action to stdout and eprintln
     - `quit` → `app_clone.exit(0)`
     - `notes` / `settings` → `app_clone.orbitkit().open_popup(action_id)` dispatched on main thread
     - `timer` → spawns thread setting mascot state to `"busy"`, sleeping 5s, then reverting to `"idle"`
   - `capabilities/default.json`: added `"windows": ["main", "orbitkit-mascot", "orbitkit-popup-*"]` so mascot and popup windows have permission to invoke orbitkit commands.
   - `build.rs`: replaced `let _ = fs::write/remove_file` with `.expect(...)` (T10 LOW fix).
4. **Remediation R-T01-1 (`scripts/linux-desktop.sh`)**:
   - Updated `find_binary()` to deterministically resolve the binary name from Cargo package name or `[[bin]]` section in `Cargo.toml`, or `mainBinaryName` in `tauri.conf.json`, never falling back to hardcoded `orbitkit` or blind scanning.
   - Updated `container_build()` to enforce build start timestamp marker and fail if the resolved binary mtime is older than build start.
   - Added `run-scenario` subcommand for containerized scenario execution.

### Phase B Deliverables
1. **Android Core APK (Without Recorder)**:
   - Built universal debug APK via `pnpm --filter starter tauri android build --debug --target aarch64 --apk`.
   - Inspected permissions via `aapt dump badging`: contains strictly `INTERNET`, `SYSTEM_ALERT_WINDOW`, and dynamic receiver permissions. Zero microphone or foreground service permissions.
2. **Android Recorder APK (`--features recorder`)**:
   - Built universal debug APK via `pnpm --filter starter tauri android build --debug --target aarch64 --apk --features recorder`.
   - Inspected permissions via `aapt dump badging`: contains `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `POST_NOTIFICATIONS`.
3. **Device / ADB Probe & DEFERRED Runbook**:
   - Executed `adb devices -l` (0 attached devices). Scenario marked DEFERRED with comprehensive device & emulator reproduction runbook.
4. **Documentation (`examples/starter/README.md`)**:
   - Authored complete README detailing architecture, host and containerized desktop execution, and Android build & execution commands.
5. **Platform UI Guard**:
   - Confirmed the recorder extension UI section is guarded by `/Android/i.test(navigator.userAgent)` and is never displayed on desktop.

---

## Scenario Results Matrix

| # | Scenario | Command | Expected | Observed / Evidence | Exit Code |
|---|---|---|---|---|---|
| 1 | JS Build, Check & Test | `pnpm -r build && pnpm -r check && pnpm -r test` | exit 0 | PASS: all 3 packages build, check, and test cleanly (`raw/01-pnpm-build-check-test.txt`) | 0 |
| 2 | Desktop Container Build | `scripts/linux-desktop.sh build examples/starter` | exit 0 | PASS: builds `target-linux/debug/starter` binary (`raw/02-desktop-build.txt`) | 0 |
| 3 | R-T01-1 Stale Binary Resolution | Plant stale `orbitkit` older than build, run `exec` | use fresh `starter` | PASS: verified running process is `starter`, ignoring stale `orbitkit` (`raw/03-r-t01-1-stale-binary-evidence.txt`) | 0 |
| 4 | Desktop Full Flow Scenario | `scripts/linux-desktop.sh run-scenario examples/starter evidence/sdk-v1/starter-example/run-desktop-flow.sh` | 4 screenshots + wmctrl logs + exit 0 on quit | PASS: 4 screenshots captured, wmctrl window entries verified, app exited 0 on quit (`raw/04-desktop-scenario-flow.txt`) | 0 |
| 5 | Android APK Core Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | APK built | PASS: `app-universal-debug.apk` built cleanly (`raw/05-apk-core-build.txt`) | 0 |
| 6 | Core APK Badging Verification | `aapt dump badging <apk>` | SAW only, no mic/FGS | PASS: `INTERNET` + `SYSTEM_ALERT_WINDOW` only (`raw/06-apk-core-badging.txt`) | 0 |
| 7 | Android APK Recorder Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk --features recorder` | APK built | PASS: `app-universal-debug.apk` built with recorder feature (`raw/07-apk-recorder-build.txt`) | 0 |
| 8 | Recorder APK Badging Verification | `aapt dump badging <apk>` | mic/FGS perms present | PASS: `RECORD_AUDIO`, `FOREGROUND_SERVICE*`, `POST_NOTIFICATIONS` present (`raw/08-apk-recorder-badging.txt`) | 0 |
| 9 | Device / ADB Probe | `adb devices -l` | attached device or DEFERRED | 0 devices attached; marked DEFERRED with runbook (`raw/09-adb-devices.txt`) | 0 |

---

## Desktop Scenario Screenshots
- Screenshot 1 (Main Window): `evidence/sdk-v1/starter-example/01-main-window.png` (window `orbitkit` 800x600)
- Screenshot 2 (Mascot Overlay): `evidence/sdk-v1/starter-example/02-mascot-overlay.png` (window `orbitkit-mascot` 296x296 at 960,479)
- Screenshot 3 (Radial Menu Open): `evidence/sdk-v1/starter-example/03-radial-menu.png` (mascot clicked, radial menu items visible)
- Screenshot 4 (Notes Popup): `evidence/sdk-v1/starter-example/04-notes-popup.png` (window `Notes` 320x420 at 2,395)

---

## Android Manifest Permissions Comparison

| Permission | Core APK (Default) | Recorder APK (`--features recorder`) |
|---|---|---|
| `android.permission.INTERNET` | Yes | Yes |
| `android.permission.SYSTEM_ALERT_WINDOW` | Yes | Yes |
| `android.permission.RECORD_AUDIO` | **No** | **Yes** |
| `android.permission.FOREGROUND_SERVICE` | **No** | **Yes** |
| `android.permission.FOREGROUND_SERVICE_MICROPHONE` | **No** | **Yes** |
| `android.permission.POST_NOTIFICATIONS` | **No** | **Yes** |

---

## DEFERRED Physical / Emulator Device Runbook

When an Android physical device or emulator is attached:

1. **Verify ADB connectivity**:
   ```bash
   adb devices -l
   ```
2. **Install Core APK**:
   ```bash
   adb install -r examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
   ```
3. **Grant Overlay Permission (`SYSTEM_ALERT_WINDOW`)**:
   ```bash
   adb shell appops set dev.orbitkit.app SYSTEM_ALERT_WINDOW allow
   ```
4. **Launch Main Activity**:
   ```bash
   adb shell am start -n dev.orbitkit.app/dev.orbitkit.app.MainActivity
   ```
5. **Display Overlay & Tap About**:
   - In the application window, tap **Show Overlay**.
   - Tap the floating mascot bubble to expand the radial menu.
   - Tap **About**:
   - Verify logcat output:
     ```bash
     adb logcat -d -s starter:V Orbitkit:V
     ```
     Expected receipt: `[starter] Menu action: about`

---

## Out-of-Scope Findings
- **`packages/orbitkit` assets export gap**: `packages/orbitkit/assets/default-mascot.svg` exists in the repository, but `packages/orbitkit/package.json` only exports `.` and includes `dist` in `"files"`. It does not export or package `assets/`. A downstream consumer cannot import `@orbitkit/ui/assets/default-mascot.svg` through npm/workspace package resolution. As instructed by BRIEF.md, `packages/` was not edited; instead, the mascot SVG was embedded into `orbitkit.config.json` and vendored to `examples/starter/public/assets/default-mascot.svg`. Coordinator noted this finding will be routed to a separate task.

## Deviations
- None. All contracts K2–K5 strictly satisfied.

## Contract Questions
- None.

READY FOR REVIEW at b1a9f11d08c27b4c56e6182a03cecfbe91c0df4a
