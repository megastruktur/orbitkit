# Task Report: `oks_desktop-windows` (T08) — Remediation Round 3

## Summary
- Implemented desktop arms of the K4 contract in `crates/tauri-plugin-orbitkit/src/desktop.rs`:
  - `show_overlay`: creates or shows WebviewWindow with label `orbitkit-mascot`, url `index.html?orbitkit=mascot`. Window configuration resolved via pure function `resolve_mascot_window`:
    - Sized as square: `max(mascot.size, 2*(menu.radius+menu.itemSize)) + 16`
    - Transparent (`transparent: true` default)
    - Undecorated (`decorations: false` default)
    - Always on top per config (`always_on_top: true` default)
    - Skips taskbar (`skip_taskbar: true`)
    - No window shadow (`shadow: false`)
    - Positioned at bottom-right of primary monitor with 24px margin (or explicit config coordinates if provided).
    - If window exists, updates size/position, calls `show()`, and focuses window.
  - `hide_overlay`: hides `orbitkit-mascot` window.
  - `open_popup`: looks up popup by `id` from `config.windows.popups`.
    - If found: creates or shows WebviewWindow label `orbitkit-popup-<id>` with title, dimensions, resizable, and always_on_top from config. Existing window is focused.
    - If unknown id: returns error with exact code `not_found`.
  - `close_popup`: closes `orbitkit-popup-<id>` WebviewWindow if present.
  - `set_mascot_state`: emits `orbitkit://mascot-state` with payload `{"state": state}` to all windows.
  - `emit_menu_action`: internal command emitting `orbitkit://menu-action` `{"id": id, "source": "webview"}` and notifying registered native handlers.
  - `overlay_permission`: returns `{"granted": true}`.
  - `request_overlay_permission`: clean no-op returning `Ok(())`.
  - `ORBITKIT_SELFTEST=1` hook compiled only under `cfg(debug_assertions)`: checks ONLY `ORBITKIT_SELFTEST == "1"`. Dispatches `show_overlay` and opens the first configured popup IF one is present in configuration.
  - `ORBITKIT_SELFTEST_CONFIG` config override hook compiled only under `cfg(debug_assertions)`: honored ONLY when `should_run_selftest()` is true (`ORBITKIT_SELFTEST == "1"`). If `ORBITKIT_SELFTEST` is unset or not `"1"`, `ORBITKIT_SELFTEST_CONFIG` is ignored and the passed configuration is retained. On read or parse error, panics with a clear descriptive error message (no silent fallback).
  - Added comprehensive doc-comments on `Orbitkit::new` describing both development environment variables (`ORBITKIT_SELFTEST` and `ORBITKIT_SELFTEST_CONFIG`).
- Pure functions and data structures:
  - `resolve_mascot_window(Option<&MascotWindowConfig>) -> ResolvedMascotWindow`: pure default resolution (`transparent: true`, `decorations: false`, `always_on_top: true`, `skip_taskbar: true`, `shadow: false`).
  - `calculate_overlay_size(mascot_size, menu_radius, menu_item_size) -> f64`
  - `calculate_overlay_position(monitor: MonitorBounds, window_size, margin, config_x, config_y) -> (f64, f64)`
  - `lookup_popup(popups, id) -> Result<&PopupConfig>`
  - `MonitorBounds` geometry struct
- Scripts allowlist update:
  - `scripts/linux-desktop.sh`: generic passthrough collecting host environment variables matching `^ORBITKIT_` and forwarding them via `-e` into `docker run` across `host_build`, `host_run_screenshot`, and `host_exec`.
- Starter app configuration allowlist updates:
  - `examples/starter/src-tauri/Cargo.toml`: added `macos-private-api` feature to `tauri` dependency.
  - `examples/starter/src-tauri/tauri.conf.json`: enabled `"macOSPrivateApi": true` in `"app"`.
- Unit and integration test suite:
  - `crates/tauri-plugin-orbitkit/tests/fixtures/harness-config.json`: moved harness JSON fixture from `evidence/` into the crate's `tests/fixtures/` directory so integration tests do not depend on `evidence/`.
  - `crates/tauri-plugin-orbitkit/tests/desktop_windows.rs`: 12 tests covering sizing, position, popup lookup (`not_found` assertion), `resolve_mascot_window` defaults, custom window config, and harness config deserialization.
  - Updated all boolean assertions in `tests/desktop_windows.rs` to `assert!(x)` / `assert!(!x)` per Clippy `bool_assert_comparison`.
  - Mutation testing: mutated `always_on_top: false` in default branch of `resolve_mascot_window` — verified `test_resolve_mascot_window_defaults` failed with exit code 101 (`left: false, right: true`) (`raw/mutation-always-on-top.log`). Restored to `true`.

## Remediation Round 3 Findings Addressed
1. **R1 MAJOR (config override hook, desktop.rs:107-136):**
   - Renamed `ORBITKIT_CONFIG_FILE` to `ORBITKIT_SELFTEST_CONFIG`.
   - The config override is honored ONLY when `should_run_selftest()` is true (`ORBITKIT_SELFTEST == "1"`), and still only under `cfg(debug_assertions)`.
   - On read failure, panics with message: `Failed to read ORBITKIT_SELFTEST_CONFIG file '<path>': <err>`.
   - On parse failure, panics with message: `Failed to parse ORBITKIT_SELFTEST_CONFIG file '<path>': <err>`.
   - Both failure paths verified in the container (`raw/r3-selftest-config-read-panic.log`, `raw/r3-selftest-config-parse-panic.log`, both exit code 101).
   - Added doc-comment on `Orbitkit::new` detailing both dev environment variables.
   - Added entry to Deviations disclosing the dev hook.
   - Moved test harness JSON to `crates/tauri-plugin-orbitkit/tests/fixtures/harness-config.json`; updated `tests/desktop_windows.rs` to load `fixtures/harness-config.json`. Kept a copy in `evidence/sdk-v1/desktop-windows/harness/harness-config.json` for runtime scenario reference.
2. **R2 minor (clippy bool_assert_comparison):**
   - In `tests/desktop_windows.rs`, replaced `assert_eq!(resolved.transparent, true)` etc. with `assert!(resolved.transparent)`, `assert!(!resolved.decorations)`, `assert!(resolved.always_on_top)`, etc.
   - Ran `cargo clippy -p tauri-plugin-orbitkit --all-targets -- -D warnings`: exits 0 with 0 warnings.
3. **R3 minor (separate clippy raw logs):**
   - Generated `evidence/sdk-v1/desktop-windows/raw/clippy-plugin-all-targets.log` with `cargo clippy -p tauri-plugin-orbitkit --all-targets -- -D warnings` (EXIT_CODE=0).
   - Generated `evidence/sdk-v1/desktop-windows/raw/clippy-plugin-release.log` with `cargo clippy -p tauri-plugin-orbitkit --release -- -D warnings` (EXIT_CODE=0).

## Scenario Results

| # | Scenario | Command | Expected | Actual / Evidence | Exit Code |
|---|---|---|---|---|---|
| 1 | Unit tests | `docker run --rm -u 1000 -e HOME=/tmp -v $PWD:$PWD -v orbitkit-cargo-cache:/usr/local/cargo/registry -w $PWD orbitkit-linux-desktop:1 cargo test -p tauri-plugin-orbitkit` | pass | 20/20 tests passed (8 plugin unit tests in `src/lib.rs` + 12 desktop window integration tests in `tests/desktop_windows.rs`) (`raw/scenario-1-unit.log`) | 0 |
| 2 | Scenario 2 (positive selftest) | `ORBITKIT_SELFTEST=1 scripts/linux-desktop.sh run-screenshot examples/starter evidence/sdk-v1/desktop-windows/scenario-2.png 10` | main + orbitkit-mascot (2 windows) | PASS: `scenario-2.windows.txt` lists exactly 2 windows (`orbitkit` main window, `orbitkit-mascot` overlay window); screenshot captured (`scenario-2.png`); app alive (`raw/scenario-2.log`) | 0 |
| 2-ctrl | Scenario 2 (negative control: no env) | `scripts/linux-desktop.sh run-screenshot examples/starter evidence/sdk-v1/desktop-windows/scenario-2-control.png 10` | main ONLY (1 window) | PASS: `scenario-2-control.windows.txt` lists exactly 1 window (`orbitkit` main window ONLY); screenshot captured (`scenario-2-control.png`); app alive (`raw/scenario-2-control.log`) | 0 |
| 2-cfg-ctrl | Scenario 2 (negative control: config set, selftest unset) | `ORBITKIT_SELFTEST_CONFIG=$PWD/crates/tauri-plugin-orbitkit/tests/fixtures/harness-config.json scripts/linux-desktop.sh run-screenshot examples/starter evidence/sdk-v1/desktop-windows/scenario-2-config-only.png 10` | main ONLY (1 window) | PASS: `scenario-2-config-only.windows.txt` lists exactly 1 window (`orbitkit` main window ONLY); screenshot captured (`scenario-2-config-only.png`); app alive (`raw/scenario-2-config-only.log`) | 0 |
| 2-harn | Scenario 2 (positive: both set) | `ORBITKIT_SELFTEST=1 ORBITKIT_SELFTEST_CONFIG=$PWD/crates/tauri-plugin-orbitkit/tests/fixtures/harness-config.json scripts/linux-desktop.sh run-screenshot examples/starter evidence/sdk-v1/desktop-windows/harness/scenario-2-harness.png 15` | main + orbitkit-mascot + popup (3 windows) | PASS: `scenario-2-harness.windows.txt` lists exactly 3 windows (`orbitkit`, `orbitkit-mascot`, `orbitkit popup settings`); screenshot captured (`harness/scenario-2-harness.png`); app alive (`raw/scenario-2-harness.log`) | 0 |
| 3 | Unknown popup | `docker run --rm -u 1000 -e HOME=/tmp -v $PWD:$PWD -v orbitkit-cargo-cache:/usr/local/cargo/registry -w $PWD orbitkit-linux-desktop:1 cargo test -p tauri-plugin-orbitkit --test desktop_windows -- test_lookup_popup_not_found_scenario_3` | pass asserting `not_found` | PASS: asserts `err.code == ErrorCode::NotFound`, JSON serialization `code: "not_found"`, and error message contains popup id (`raw/scenario-3-unknown-popup.log`) | 0 |
| Supp | Starter cargo check | `cargo check --manifest-path examples/starter/src-tauri/Cargo.toml` | pass | PASS: starter compiles cleanly without warnings on host (`raw/cargo-check-starter.log`) | 0 |
| Supp | Plugin clippy all-targets | `cargo clippy -p tauri-plugin-orbitkit --all-targets -- -D warnings` | pass | PASS: clippy all-targets passes with 0 warnings on host (`raw/clippy-plugin-all-targets.log`) | 0 |
| Supp | Plugin clippy release | `cargo clippy -p tauri-plugin-orbitkit --release -- -D warnings` | pass | PASS: clippy release profile passes with 0 warnings on host (`raw/clippy-plugin-release.log`) | 0 |
| Supp | R1 config read panic proof | `ORBITKIT_SELFTEST=1 ORBITKIT_SELFTEST_CONFIG=/nonexistent/path.json ...` | panic on read failure | PASS: panics with `Failed to read ORBITKIT_SELFTEST_CONFIG file` (`raw/r3-selftest-config-read-panic.log`) | 101 |
| Supp | R1 config parse panic proof | `ORBITKIT_SELFTEST=1 ORBITKIT_SELFTEST_CONFIG=target/bad-config.json ...` | panic on parse failure | PASS: panics with `Failed to parse ORBITKIT_SELFTEST_CONFIG file` (`raw/r3-selftest-config-parse-panic.log`) | 101 |
| Supp | Device probe | `adb devices -l` | log device state | 0 devices attached (`raw/adb-devices-probe.log`) | 0 |
| Supp | Mutation test | `docker run ... cargo test -p tauri-plugin-orbitkit --test desktop_windows -- test_resolve_mascot_window_defaults` (mutated `always_on_top: false`) | fail (`left: false, right: true`) | PASS: test fails with assertion panic as expected (`raw/mutation-always-on-top.log`) | 101 |

## Linux Desktop Windows Verification

### Negative Control 1: No Env (`scripts/linux-desktop.sh run-screenshot examples/starter ...` without env)
```
0x00400003  0 9fde531895ae orbitkit
```
Only the main window is created when `ORBITKIT_SELFTEST` is unset.

### Negative Control 2: Config Set, Selftest Unset (`ORBITKIT_SELFTEST_CONFIG=... scripts/linux-desktop.sh ...`)
```
0x00400003  0 84b835bed6d2 orbitkit
```
Only the main window is created when `ORBITKIT_SELFTEST_CONFIG` is set but `ORBITKIT_SELFTEST` is unset (the override is strictly ignored).

### Positive Scenario 2: Default Starter Config (`ORBITKIT_SELFTEST=1 scripts/linux-desktop.sh ...`)
```
0x00400003  0 fd9a66a6c119 orbitkit
0x00400024  0 fd9a66a6c119 orbitkit-mascot
```
The starter application creates the main window and, via the self-test hook, opens `orbitkit-mascot` as expected.

### Positive Scenario 2-Harn: Runtime Harness with Configured Popup (`ORBITKIT_SELFTEST=1 ORBITKIT_SELFTEST_CONFIG=...`)
```
0x00400003  0 ad731cfe353c orbitkit
0x00400021  0 ad731cfe353c orbitkit-mascot
0x0040002f  0 ad731cfe353c orbitkit popup settings
```
All 3 windows (`orbitkit`, `orbitkit-mascot`, and `orbitkit popup settings`) open and are detected by `wmctrl -l`.

Note on Linux transparency: Per contract and BRIEF.md, full transparency on Linux requires a running compositing window manager; under headless Xvfb transparency renders with black background, which is expected and documented.

## Deviations
1. Allowlist extension approved by coordinator in Remediation Round 2: `scripts/linux-desktop.sh` was updated with a generic passthrough function (`collect_orbitkit_env_args`) that passes all host environment variables matching `^ORBITKIT_` into `docker run` via `-e` flags for `host_build`, `host_run_screenshot`, and `host_exec`. No other changes were made to `scripts/linux-desktop.sh`.
2. Self-test runtime configuration injection hook: `Orbitkit::new` in `crates/tauri-plugin-orbitkit/src/desktop.rs` contains a debug-assertion-only hook for `ORBITKIT_SELFTEST` and `ORBITKIT_SELFTEST_CONFIG`. This enables headless container runtime verification of popup window lifecycles without modifying the `examples/starter` source code. The hook is strictly gated behind `cfg(debug_assertions)` and `should_run_selftest()` (`ORBITKIT_SELFTEST == "1"`), and panics if the configuration file is unreadable or contains invalid JSON.

## Out-of-Scope Findings
1. Host `cargo test` / `cargo build` for desktop Tauri crates cannot link directly on the host because the host `/usr` is a stub where `libwebkit2gtk-4.1` is unlinked. As specified in `COMMON.md` rule 7 and the `orbitkit-scaffold` skill, this is a declared sandbox constraint; all desktop compilation and testing is performed inside the `orbitkit-linux-desktop:1` container or checked with `cargo clippy` on host.

## Contract Questions
- None.

READY FOR REVIEW at d8307c0d1d5e9868c948b9666ff62e4290dc03d9
