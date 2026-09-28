# REPORT okc-integ-fix3 — starter `open_popup` K11 signature fix

Campaign: orbitkit-cutecare-v02. Branch `megastruktur/okc-integ-fix3`, base = campaign tip `c5cd0ead`.

## What & why
okc-popups-dynamic (67b77ef) changed the plugin API to
`open_popup(id: String, params: Option<HashMap<String,String>>, instance_key: Option<String>)` (K11).
The starter menu handler still called the 0.1.0 shape `open_popup(popup_id)` at
`examples/starter/src-tauri/src/lib.rs:56`, so `cargo check -p starter` failed with E0061.
The campaign Rust gate only builds `-p tauri-plugin-orbitkit`, so the break was never caught.

## Changes (commit `38e9738fef9f`)
- `examples/starter/src-tauri/src/lib.rs:56` → `open_popup(popup_id, None, None)` — plain menu popup:
  no params, no instanceKey ⇒ one instance per id, re-open focuses/re-anchors. Nothing else touched.
- `examples/starter/README.md:20` → popup mention updated to the K11 shape.

## Call-site audit (brief item 3)
Grep over `examples/starter` (Rust + TS) for open_popup/close_popup/list_popups/mascot_monitor/
set_mascot_state/bridge openPopup:
- `set_mascot_state(state: String)` — unchanged in plugin (`crates/tauri-plugin-orbitkit/src/desktop.rs:499`);
  starter call sites lib.rs:65,67,75 already match. TS bridge `setMascotState(state: string)`
  (`packages/orbitkit/src/bridge.ts:179`) unchanged; `SettingsPopup.svelte:15` `setMascotState(newState)` matches.
- No starter call sites of close_popup/list_popups/mascot_monitor/`openPopup` (TS) exist.
- No other breaks found. `packages/` and `crates/` untouched.

## Proof (raw logs in `evidence/okc/integ-fix3/raw/`)
| Gate | Result | Evidence |
| --- | --- | --- |
| `cargo check -p starter --all-targets && cargo clippy -p starter --all-targets -- -D warnings` (container `okc-rust-gate:1`) | `STARTER_OK` | `raw/starter-check.txt` |
| Same check on base `c5cd0ead` (scratch worktree) | fails: `error[E0061]: this method takes 3 arguments but 1 argument was supplied` at lib.rs:56 | `raw/starter-check-base.txt` |
| `scripts/linux-desktop.sh build examples/starter` | Build successful, binary `examples/starter/src-tauri/target-linux/debug/starter` | `raw/linux-desktop-build.txt` |
| `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test && pnpm -r check` | exit 0; 350/350 vitest + starter 13 node tests; `tsc --noEmit` clean | `raw/js-gates.txt` |
| `bash plans/orbitkit-cutecare-v02/okc_tools/rust_gate.sh` | `67 passed; 0 failed` (baseline 67), `OKC_RUST_GATE_OK`, exit 0 | `raw/rust-gate.txt` |

READY FOR REVIEW at `38e9738fef9f`.
