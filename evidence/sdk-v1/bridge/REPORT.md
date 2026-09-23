# Task Report: `oks_bridge` (T07) — Worktree `oks-bridge`

## Summary
- Implemented typed TypeScript wrappers over the K4 Tauri plugin commands and events in `@orbitkit/ui` (`packages/orbitkit/src/bridge.ts`).
- **All 8 K4 Commands Implemented**:
  1. `overlayPermission(): Promise<boolean>`: invokes `plugin:orbitkit|overlay_permission`, unwraps `{ granted: boolean }` response and returns boolean (`true` on desktop).
  2. `requestOverlayPermission(): Promise<void>`: invokes `plugin:orbitkit|request_overlay_permission`.
  3. `showOverlay(options: ShowOverlayOptions): Promise<void>`: invokes `plugin:orbitkit|show_overlay` with `{ menu, mascot }` payload.
  4. `hideOverlay(): Promise<void>`: invokes `plugin:orbitkit|hide_overlay`.
  5. `openPopup(id: string): Promise<void>`: invokes `plugin:orbitkit|open_popup` with `{ id }` payload.
  6. `closePopup(id: string): Promise<void>`: invokes `plugin:orbitkit|close_popup` with `{ id }` payload.
  7. `setMascotState(state: string): Promise<void>`: invokes `plugin:orbitkit|set_mascot_state` with `{ state }` payload.
  8. `emitMenuAction(id: string): Promise<void>`: invokes `plugin:orbitkit|emit_menu_action` with `{ id }` payload.
- **Event Subscriptions**:
  - `onMenuAction(cb: MenuActionCallback): Promise<UnlistenFn>`: listens to `orbitkit://menu-action`, delivering `{ id, source }` payload to callback. Returns `UnlistenFn`.
  - `onMascotState(cb: MascotStateCallback): Promise<UnlistenFn>`: listens to `orbitkit://mascot-state`, delivering `{ state }` payload to callback. Returns `UnlistenFn`.
- **Environment Detection & Safe Non-Tauri Fallback**:
  - `isTauri(): boolean`: checks `typeof window !== "undefined" && window !== null && "__TAURI_INTERNALS__" in window`.
  - Outside Tauri: all 8 commands reject with `OrbitKitError { code: "unsupported", message: ... }`.
  - Outside Tauri: `onMenuAction` and `onMascotState` return a no-op unlisten function `() => {}` without throwing.
- **Error Normalization**:
  - `OrbitKitError` class extending `Error` with `code: OrbitKitErrorCode`.
  - Allowed error codes strictly constrained to `"permission_denied" | "unsupported" | "not_found" | "invalid_config"` (no `unknown`).
  - `normalizeError(err)` cleanly maps Rust/IPC rejections, strings, and foreign errors into `OrbitKitError` with one of the 4 valid error codes.
- **Dependencies**:
  - Pinned `@tauri-apps/api: 2.11.1` added as `peerDependency` and `devDependency` in `packages/orbitkit/package.json`.
  - Updated `pnpm-lock.yaml` with zero dependency upgrades.
- **Comprehensive Unit Testing (`packages/orbitkit/src/bridge.test.ts`)**:
  - 23 tests using `@tauri-apps/api/mocks` (`mockIPC`, `mockWindows`).
  - All 8 K4 commands asserted for exact command strings and payloads.
  - Event subscriptions (`onMenuAction`, `onMascotState`) and unlisten behavior verified.
  - Error normalization verified for all 4 error codes and arbitrary rejections.
  - Non-Tauri rejection and no-op unlisten verified.
  - `overlayPermission` granted and denied paths tested for `{ granted: true }`, `{ granted: false }`, bare `false`, and bare `true`.
  - Full suite: 82/82 passing tests in `@orbitkit/ui`.
---

## Cross-Check Table (Acceptance Criterion 3)

| K4 Plugin Command | IPC Command String | Rust `#[command]` Fn (`crates/tauri-plugin-orbitkit/src/commands.rs`) | Permission ID (`crates/tauri-plugin-orbitkit/permissions/default.toml`) | Grep Evidence Status |
|---|---|---|---|---|
| `overlay_permission` | `plugin:orbitkit\|overlay_permission` | `overlay_permission` (line 7) | `allow-overlay-permission` (line 5) | MATCH |
| `request_overlay_permission` | `plugin:orbitkit\|request_overlay_permission` | `request_overlay_permission` (line 14) | `allow-request-overlay-permission` (line 6) | MATCH |
| `show_overlay` | `plugin:orbitkit\|show_overlay` | `show_overlay` (line 21) | `allow-show-overlay` (line 7) | MATCH |
| `hide_overlay` | `plugin:orbitkit\|hide_overlay` | `hide_overlay` (line 30) | `allow-hide-overlay` (line 8) | MATCH |
| `open_popup` | `plugin:orbitkit\|open_popup` | `open_popup` (line 37) | `allow-open-popup` (line 9) | MATCH |
| `close_popup` | `plugin:orbitkit\|close_popup` | `close_popup` (line 45) | `allow-close-popup` (line 10) | MATCH |
| `set_mascot_state` | `plugin:orbitkit\|set_mascot_state` | `set_mascot_state` (line 53) | `allow-set-mascot-state` (line 11) | MATCH |
| `emit_menu_action` | `plugin:orbitkit\|emit_menu_action` | `emit_menu_action` (line 61) | `allow-emit-menu-action` (line 12) | MATCH |

*Raw grep evidence recorded in `evidence/sdk-v1/bridge/raw/grep-evidence.log` (all 8 verified, exit code 0).*

---

## Real Runtime Testing Scenarios

| # | Scenario | Command | Expected | Observed | Exit Code |
|---|---|---|---|---|---|
| 1 | unit | `pnpm --filter @orbitkit/ui test` | pass | 82/82 tests passed across 5 test files (`evidence/sdk-v1/bridge/raw/scenario1-unit-test.log`) | 0 |
| 2 | name parity | `python3` verification script | all 8 match | All 8 K4 commands match Rust commands and permission IDs (`evidence/sdk-v1/bridge/raw/scenario2-name-parity.log`) | 0 |
| 3 | desktop live | `scripts/linux-desktop.sh run-screenshot examples/starter evidence/sdk-v1/bridge/scenario3-desktop-live.png 6` | screenshot shows `true` | Temporary uncommitted starter patch calling `overlayPermission()` on mount; captured screenshot verifies green `GRANTED` badge (`evidence/sdk-v1/bridge/scenario3-desktop-live.png`, log in `evidence/sdk-v1/bridge/raw/scenario3-desktop-live.log`) | 0 |
| - | workspace-build | `pnpm -r build` | pass | Workspace packages build cleanly (`evidence/sdk-v1/bridge/raw/workspace-build.log`) | 0 |
| - | workspace-check | `pnpm -r check` | pass | Zero TypeScript errors across workspace (`evidence/sdk-v1/bridge/raw/workspace-check.log`) | 0 |
| - | workspace-test | `pnpm -r --if-present test` | pass | All workspace tests pass (`evidence/sdk-v1/bridge/raw/workspace-test.log`) | 0 |
| - | container-rust | `docker run ... cargo test -p tauri-plugin-orbitkit` | pass | 8/8 Rust crate tests pass in container (`evidence/sdk-v1/bridge/raw/container-cargo-test.log`) | 0 |
| - | adb-probe | `adb devices -l` | inventory | No devices attached (`evidence/sdk-v1/bridge/raw/adb-devices.log`) | 0 |

---

## Desktop Live Visual Verification (Scenario 3)
- Tested with a temporary, local-only starter patch in `examples/starter/src/App.svelte` calling `overlayPermission()` via `@orbitkit/ui` on mount.
- Built the Tauri desktop application inside the container using `./scripts/linux-desktop.sh build examples/starter`.
- Executed the application under Xvfb and captured a screenshot at `evidence/sdk-v1/bridge/scenario3-desktop-live.png`.
- Visual inspection confirmed that the `SAW Permission` badge transitioned from `UNKNOWN` (null) to the green `GRANTED` (true) state, demonstrating live Tauri IPC integration and `overlayPermission()` returning `true` on desktop.
- Reverted the temporary starter patch completely before committing (`git status --porcelain` clean).

---
## Remediation Round 2 (Finding F1)

### Finding F1 Description
- In Round 1, `overlayPermission` denied path was untested: replacing `(res?.granted ?? false)` with `true` in `packages/orbitkit/src/bridge.ts` passed all tests because only `{ granted: true }` was exercised.

### Remediation Applied (Test-Only)
1. **Added Denied & Granted Path Tests** in `packages/orbitkit/src/bridge.test.ts`:
   - `1a`: mockIPC returns `{ granted: true }` → resolves `true`.
   - `1b`: mockIPC returns `{ granted: false }` → resolves `false`.
   - `1c`: mockIPC returns bare boolean `false` → resolves `false`.
   - `1d`: mockIPC returns bare boolean `true` → resolves `true`.
2. **Zero Changes to Production Code**:
   - `packages/orbitkit/src/bridge.ts` remains completely untouched from the base commit (`git diff packages/orbitkit/src/bridge.ts` is empty).

### Mutation Verification Proof
- **Mutant Tested**: In `packages/orbitkit/src/bridge.ts` line 124, substituted `(res?.granted ?? false)` with `true`:
  ```ts
  return typeof res === "boolean" ? res : true;
  ```
- **Mutant Failure Execution**:
  - Executed `pnpm test src/bridge.test.ts`.
  - Test `1b` failed immediately:
    ```
    FAIL src/bridge.test.ts > bridge > K4 commands via Tauri IPC > 1b. overlayPermission returns false when mockIPC returns { granted: false }
    AssertionError: expected true to be false
    - Expected: false
    + Received: true
    ```
  - Exit code: 1.
  - Captured raw failure log at `evidence/sdk-v1/bridge/raw/mutation-overlay-permission-fail.log` (ending with `EXIT_CODE=1`).
- **Reverted Mutant**: `bridge.ts` restored cleanly to original.

---

## Deviations
- None. All contracts and acceptance criteria satisfied as specified.

---

## Out-of-Scope Findings
- None.

---

## Contract Questions
- None.

---

READY FOR REVIEW at 89bb4fb35006499c7dd2552b714740cd1522aca5
