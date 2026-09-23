# OrbitKit Documentation (sdk-v1) Report

- **Task**: `docs` (T13)
- **Worktree**: `/home/megastruktur/orca/workspaces/orbitkit/oks-docs`
- **Date**: 2026-09-23

---

## 1. Executive Summary

All documentation requirements specified in `BRIEF.md`, `CONTRACTS.md`, and `COMMON.md` have been fulfilled. Every public symbol and command across the `@orbitkit/ui` TypeScript library, `tauri-plugin-orbitkit` crate, `tauri-plugin-orbitkit-recorder` crate, and container runner scripts has been verified against source code without missing items. All internal relative markdown links resolve cleanly with 0 broken links. The Quickstart script was replayed verbatim in a clean clone under `$TMPDIR` with 100% success across all steps.

---

## 2. Real Runtime Testing Matrix

| # | Scenario | Command / Tool | Result | Raw Log | Exit Code |
|---|---|---|---|---|---|
| 1 | **links** | Node relative markdown link checker across 16 documents | **PASS**: 50/50 links resolved, 0 broken | `evidence/sdk-v1/docs/raw/links.log` | `0` |
| 2 | **quickstart** | Clean clone verbatim replay under `$TMPDIR` (`$HOME/tmp`) | **PASS**: All 6 steps passed (JS build/check/test + cargo check + container build) | `evidence/sdk-v1/docs/raw/quickstart.log` | `0` |
| 3 | **crosscheck** | Code-only symbol verification across 96 source files | **PASS**: 80/80 symbols matched, 0 missing | `evidence/sdk-v1/docs/raw/api-crosscheck.txt` | `0` |

---

## 3. Delivered Documentation Artifacts

1. **`README.md` (root)**:
   - Architectural overview of OrbitKit domain-neutral shell SDK.
   - Four embedded screenshot assets (`docs/images/01-main-window.png`, `02-mascot-overlay.png`, `03-radial-menu.png`, `04-notes-popup.png`).
   - Feature highlights: SVG sandbox (K3-A3), sprite animations, radial menu geometry, direct JNI survival.
   - Quickstart (6 commands, ≤ 10 requirement).
   - Platform support matrix with explicit Android Gate B notice ("overlay cannot cold-start mic FGS") and physical device DEFERRED status.
2. **`docs/getting-started.md`**:
   - Integration into existing Tauri v2 + Svelte 5 application.
   - Workspace and path dependencies for `@orbitkit/ui` and `tauri-plugin-orbitkit`.
   - Android gradle notes, permissions (`SYSTEM_ALERT_WINDOW`), and `capabilities/default.json`.
3. **`docs/configuration.md`**:
   - Complete K2 schema reference: `mascot`, `menu`, `windows`.
   - Validation rules, defaults, and helper functions (`defineConfig`, `validateConfig`, `withDefaults`).
   - Detailed examples: static SVG, animated CSS sprite sheet, and arc menu.
4. **`docs/api.md`**:
   - TypeScript API (`Mascot`, `RadialMenu`, `layoutItems`, `ItemPosition`, bridge methods, events, `OrbitKitError`).
   - Rust API (`tauri_plugin_orbitkit::init`, `OrbitkitExt`, `jni_bridge::MenuAction`, `JniActionRecord`).
   - K4 plugin command table and four-variant error code union (`permission_denied`, `unsupported`, `not_found`, `invalid_config`).
5. **`docs/architecture.md`**:
   - High-level three-layer model (Frontend, Plugin, Platform Native).
   - Multi-window desktop model vs. Android `WindowManager` `SYSTEM_ALERT_WINDOW`.
   - Direct JNI bridge architecture preserving action handling during WebView background suspension.
   - Extension system pattern.
6. **`docs/architecture/contracts.md`**:
   - Moved from repo root `CONTRACTS.md` with appended "Amendments" section documenting ratified campaign amendments:
     - K1-A1 (TypeScript toolchain versioning).
     - K3-A1 (Radial geometry `ItemPosition` type export).
     - K3-A2 (Vitest browser condition resolution).
     - K3-A3 (Mascot SVG `<img>` data URL sandbox).
     - K4 strict 4-code error union.
     - K4 `emit_menu_action` internal command.
7. **`docs/platforms/android.md`**:
   - Android overlay lifecycle and touch interaction.
   - Direct JNI path (`OrbitkitJniBridge.onNativeAction`).
   - Strict phrasing and technical explanation of While-In-Use Gate B limitation: "overlay cannot cold-start mic FGS".
   - Physical device test status (DEFERRED).
8. **`docs/platforms/desktop.md`**:
   - Multi-window desktop lifecycle (`orbitkit-mascot`, `orbitkit-popup-*`).
   - Overlay sizing formula and primary monitor positioning.
   - Linux compositor requirements and `scripts/linux-desktop.sh` container runner.
   - Dev-only selftest hooks (`ORBITKIT_SELFTEST=1`, `ORBITKIT_SELFTEST_CONFIG`).
9. **`docs/platforms/macos.md`**:
   - Window transparency and `macOSPrivateApi: true`.
   - Frameless shadow and floating window level.
   - Entitlements clarification (desktop recorder is mock; no audio entitlements required).
10. **`docs/platforms/windows.md`**:
    - Borderless transparency, frameless windowing, and WebView2 runtime notes.
    - Taskbar isolation (`skip_taskbar: true`) and high-DPI scaling.
11. **`docs/extensions.md`**:
    - Extension architecture pattern.
    - Reference implementation: `tauri-plugin-orbitkit-recorder` commands (`start_foreground`, `pause`, `resume`, `stop`, `state`, `post_standby_notification`, `get_persisted_state`, `recover_state`).
    - LMK crash recovery and spool file persistence.
12. **`docs/development.md`**:
    - Workspace layout and K6 shell environment configuration.
    - Build and test commands (JS, Rust, Android).
    - `scripts/linux-desktop.sh` container runner usage.
    - GitHub Actions CI workflow reference and run URL ([https://github.com/megastruktur/orbitkit/actions/runs/35878493349](https://github.com/megastruktur/orbitkit/actions/runs/35878493349)).
13. **Package & Crate Documentation**:
    - `packages/orbitkit/README.md`
    - `crates/tauri-plugin-orbitkit/README.md`
    - `crates/tauri-plugin-orbitkit-recorder/README.md`
    - `CHANGELOG.md` (v0.1.0 release notes)
14. **Scaffolding Cleanup**:
    - Removed root campaign scaffolding files `COMMON.md` and `BRIEF.md`.

---

## 4. Deviations & Out-of-Scope Findings

1. **Docker Daemon PrivateTmp Mount Namespace**:
   On this development host, `dockerd` runs under a systemd unit with `PrivateTmp=yes`. Consequently, the Docker daemon's mount namespace isolates host `/tmp` and `/var/tmp`. Running containerized builds from a clone located in `/tmp` fails with `stat .../scripts/linux-desktop.sh: no such file or directory`. Setting `TMPDIR=$HOME/tmp` provides a directory accessible to Docker volume mounts and resolves the issue.
2. **Host Desktop Compilation Limit**:
   As predicted by COMMON.md rule 7, host `cargo build`/`cargo test` for desktop applications fails to link because WebKitGTK 4.1 development libraries are not present on the host OS. The Quickstart and verification workflows use host `cargo check` for plugin typechecking and `scripts/linux-desktop.sh build examples/starter` for containerized compilation.
3. **Physical Android Device Execution**:
   Scenarios requiring physical device attachment are marked **DEFERRED** per coordinator instructions, as no physical Android device was connected to the CI workstation. All Android logic is verified via automated Gradle JUnit suites, mock JNI bridges, and headless APK compilation.

---

## 5. Contract Questions

- **LICENSE**:
  The repository currently does not contain a `LICENSE` file. Per BRIEF.md coordinator instructions, no license file was created. This is recorded as a **TODO** for the coordinator to confirm the intended open-source or proprietary license with the project owner.

---
## 6. Remediation Round 2 (Gate 1 / FIX @ 1cc36a1)

### 6.1 Findings Resolved

- **F1 (MAJOR) Host-Specific Environment Cleanup**:
  - Removed host-specific environment commands (`export HOME=/home/megastruktur`, `source evidence/env-probe/env.sh`, and local absolute paths) from `docs/development.md`.
  - Replaced with generic prerequisites: Node 22, pnpm 12.4.1, Rust stable, JDK 17, Android SDK + `ANDROID_HOME`, `NDK_HOME=$ANDROID_HOME/ndk/<version>` (CI uses `27.3.13750724`), and Docker for the Linux container runner.
  - Verified with `grep -rn "/home/megastruktur\|env-probe" README.md docs packages/*/README.md crates/*/README.md CHANGELOG.md` which hits strictly only frozen text in `docs/architecture/contracts.md`.
- **F2 Recorder State Literals Uppercase**:
  - Updated recorder status literals to uppercase `IDLE`, `RECORDING`, `PAUSED`, `STOPPED` in `crates/tauri-plugin-orbitkit-recorder/README.md:81` and `docs/extensions.md:107` matching Rust `desktop.rs` and Kotlin `OrbitkitRecorderService.kt` implementations.
- **F3 Package Manager Version Pin**:
  - Updated `docs/getting-started.md:12` to specify `pnpm 12 (pinned 12.4.1)`.

### 6.2 Verification Matrix Rerun

| # | Scenario | Command / Tool | Result | Raw Log | Exit Code |
|---|---|---|---|---|---|
| 1 | **links** | Node relative markdown link checker across 16 documents | **PASS**: 50/50 links resolved, 0 broken | `evidence/sdk-v1/docs/raw/r2-01-links.log` | `0` |
| 2 | **crosscheck** | Code-only symbol verification across 95 code files | **PASS**: 80/80 symbols matched, 0 missing | `evidence/sdk-v1/docs/raw/r2-02-api-crosscheck.txt` | `0` |
| 3 | **grep-clean** | Host path leak verification across docs suite | **PASS**: Only contracts.md frozen text matches | stdout check | `0` |

---

READY FOR REVIEW at 3f79b02ba0c75596a5edd21da4829c2824877538
