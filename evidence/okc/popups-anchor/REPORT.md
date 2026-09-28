# REPORT okc-popups-anchor (campaign orbitkit-cutecare-v02, attempt 1)

Base: `67b77ef` (campaign tip). Branch `megastruktur/okc-popups-anchor`.
Scope touched: `crates/tauri-plugin-orbitkit/src/placement.rs` (new),
`src/desktop.rs` (placement wiring in `open_popup` only),
`src/lib.rs` (`mod placement;` decl), `evidence/okc/popups-anchor/**`.

## Per-criterion results

| # | Criterion | Result | Mutation-sensitive proof |
|---|-----------|--------|--------------------------|
| 1 | Pure `place_popup(anchor, size, work, gap) -> PhysPos` + `center_in(work, size)`, physical px; CuteCare cases ported | PASS | `placement.rs`: 12 tests ported verbatim from CuteCare `geometry.rs` (3 resolutions incl. 1920×1080 / 2560×1440@200% / 1920×1080@150%, 5+ mascot positions incl. multi-monitor negative origins). **Mutation check**: flip disabled (`break` after candidate #0) → 9 tests fail incl. `right_edge_flips_left`, `dpi_200_right_edge_flips`, `top_edge_rejects_above` (raw/mutation-flip.txt, exit 101); restored → 67/67 green (raw/rust-gate.txt) |
| 2 | open_popup: `anchor=mascot` uses mascot window rect + `mascot_monitor` work area; `center` uses mascot's monitor; `none` keeps default | PASS | `desktop.rs` pure `popup_placement_for` tests: mascot rect 0,0,0×0 in 1280×800 → BelowRight (14,14) hand-computed (`test_popup_placement_mascot_uses_mascot_rect_and_work_area`); center → (480,160); none → `None`. Size scaling by monitor scale proven @2× → flip to above-left (1346,226) (`test_popup_placement_scales_popup_size_by_monitor_scale`) |
| 3 | Re-open of an existing label re-applies placement | PASS | `open_popup` computes placement BEFORE the existing-window branch and re-opens take `set_position(Physical(pos))` with the freshly computed value (desktop-wiring.diff). Unit-level: `popup_placement_for` pins the recomputed value; the pre-change re-open path (show+focus only, no placement) fails `test_popup_placement_mascot_uses_mascot_rect_and_work_area`'s premise — see limitation note |
| 4 | Mascot window absent → falls back to center on primary, no error | PASS | `test_popup_placement_mascot_absent_falls_back_to_center` (mascot rect `None` → center (480,160)); `mascot_monitor()` already falls back primary → headless without error (K9), `popup_placement` never errors |
| 5 | Rust gate green; pnpm build/test/check green | PASS | `$OKC_RUST_GATE` → `OKC_RUST_GATE_OK`, 67 passed (raw/rust-gate.txt); `pnpm -r build`=0, `test`=0 (303/303, baseline intact), `check`=0 (raw/js-gates.txt) |

## New/changed symbols
- `placement.rs` (new, pure, `#[cfg(desktop)] mod placement;`): `PhysSize`, `PhysPos`,
  `PopupSide`, `Placement`, `POPUP_GAP=14`, `POPUP_PAD=12`,
  `place_popup(anchor: PhysRect, size: PhysSize, work: PhysRect, gap: i32) -> PhysPos`
  (K11 contract signature; pad = `POPUP_PAD` built in),
  `place_popup_with_pad(..., pad) -> Placement` (CuteCare signature, for the
  ported side-asserting tests), `center_in(work, size) -> PhysPos`.
- `desktop.rs`: `popup_placement_for(...)` (pure anchor decision, tested),
  `phys_size(spec, scale)` (logical config → physical px),
  `Orbitkit::popup_placement` (thin glue over `mascot_monitor` + `mascot_window_rect`),
  `Orbitkit::mascot_window_rect`, `PopupPlacement`. `open_popup` computes placement
  before the existing-window branch: create → `builder.position(logical)`; re-open →
  `set_position(Position::Physical)`; `anchor: "none"` → untouched platform default.

## Mutation proof
`raw/mutation-flip.txt`: with the candidate loop short-circuited after candidate #0
(flip disabled), the gate fails exit 101 with 9 failing tests, at minimum
`right_edge_flips_left` (required). Restored → exit 0, 67/67.

## Coordinate-space notes (inherited from K9, unchanged)
Mascot rect (`outer_position`/`outer_size`) and the chosen monitor's raw
`work_area` share tao's per-monitor reporting space; the popup is placed on that
same monitor, so the math is consistent there (exact on Windows and uniform-DPI;
approximate for a mascot straddling mixed-DPI monitors — a K9 reporting-space
property, not introduced here; the popup is sized with the target monitor's
`scale_factor`).

## Scope deviations
None. Only allowlisted paths changed.

## Contract questions
- K11 text says "prefer **above-left** of mascot"; CuteCare's canonical
  `placePopup` (and its ported test table) prefers **above-right** first, flipping
  to above-left at right edges. Ported CuteCare-exactly per the task file
  ("Port the generic algorithm and its test table from CuteCare geometry.rs");
  flagging the wording discrepancy for the coordinator.

## Out-of-scope findings
- tauri 2.11.6 `MockRuntime` **panics** (`unimplemented!()`,
  `mock_runtime.rs:245-255`) on AppHandle-level `primary_monitor()` /
  `available_monitors()` — anything calling `mascot_monitor()` cannot run under
  mock tests. This is why K9's tests cover only the pure `selector_inputs` seam
  and why my anchor-decision tests are pure too (`popup_placement_for`).
- Pre-existing code in `desktop.rs`/`lib.rs` is not rustfmt-clean; I deliberately
  did NOT reformat it (kept the diff to allowlisted logic). `rustfmt` on `lib.rs`
  recurses into all child modules — do not run it casually.

## Limitations
- AC3 re-anchor on real windows cannot be observed under MockRuntime
  (`set_position` is a no-op, `outer_position()` always 0,0). Evidence: pure
  decision tests + structural wiring (single placement computation feeding both
  create and re-open). Real-window verification belongs to the coordinator's
  macOS batch smoke (no GUI runtime test in-task per okc_COMMON).

READY FOR REVIEW at e05f450
