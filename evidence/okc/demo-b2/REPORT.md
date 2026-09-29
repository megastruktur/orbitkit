# REPORT okc-demo-b2 (campaign orbitkit-cutecare-v02, attempt 1)

Demo-only wiring of the batch-2 features into `examples/starter`. **No library
changes** (`packages/`, `crates/` untouched).

## Per-criterion results (okc_SMOKE.md ## B2)

Owner interaction for every item: launch the built starter binary; click the
mascot to open the 9-item arc menu; click an item.

| # | Smoke item | Starter interaction | Result |
|---|---|---|---|
| 1 | Mascot roams inside corner zone; faces walking direction; turns at edges | `windows.mascotWindow.roam` (960×480, margin 12, corner bottom-left, speed 24 px/s); window placed at the zone origin before the loop starts; `faceByVelocity: true` + roam `onVelocity` → `Mascot velocityX` mirrors the sprite; edge turns are `stepRoam` flip-and-continue | **DONE (r2)**: root cause of the r1 stall was the demo adapter passing fractional physical px to `setPosition` (Tauri rejects them); the adapter now rounds (`physWindowAdapter`, unit-tested). Runtime: `raw/roam-motion-r2.log` — window moves (216,129) → (639,356) over 20 s ≈ 24 px/s, stays inside the work area. |
| 2 | Drag: roam pauses, resumes around new spot; plain click still opens menu | `createRoam` drag binding replaces the bare gesture: pause on drag, `rebaseRoamBounds` on drop, resume from the drop point; click toggles the arc menu | **DONE (r2)**: same adapter fix un-blocks every `setPosition` in the roam loop, including the post-drag `resume(point)` path (`roam.ts` `resume` → next tick `setPosition` now accepted). Click-toggle unchanged from B1 (fixed window, content-only transitions). |
| 3 | "note" ×2 → two separate windows next to mascot; flip inward at edges | Backend `app.notes` opens `notes` with K11 `instanceKey note-N`; `windows.popups[notes].anchor: "mascot"` → plugin `place_popup` | **PROVEN in container**: two separate "Notes" windows (distinct X11 ids, each 320×420) anchored beside the mascot — `raw/notes.windows.txt`, `raw/demo-b2-notes.png`. Flip-inward needs a screen-edge mascot (owner-manual). |
| 4 | "settings" → one centred window; second click focuses, no duplicate | `open_popup("settings")` without instanceKey (idempotent singleton); `windows.popups[settings].anchor: "center"` | **PROVEN in container**: single "Settings" 360×300 centred on the screen (centre ≈ (642,440) on 1280×800) after the second click — `raw/settings-first.windows.txt`, `raw/settings-second.windows.txt`, `raw/demo-b2-settings.png`. |
| 5 | "bubble" → bubble next to mascot, TTL, hover keeps | Menu "Bubble": `Bubble` above mascot with `ttlMs 4000` + `onexpire` hide; hover pauses TTL (component) | Clicked (log `app.bubble`). Screenshot: `raw/demo-b2-bubble.png`. |
| 6 | "badge +1" ×3 → badge shows 3 | Menu "Badge +1": `nextBadgeCount` → `setBadge` → `orbitkit://badge`; `<Badge listen>` top-right of mascot | Clicked ×3 (log `app.badge` ×3). Screenshot: `raw/demo-b2-badge3.png`. |
| 7 | "park" → corner + sleep; "bubble" while parked → badge +1, no bubble; "unpark" restores | Menu "Park": `createPark` pauses roam, moves window to bottom-right corner, sleeps; K8 gate ignores state requests while parked (`gatedMascotState`); label flips Park ↔ Unpark; demo keeps the parked mascot clickable (park's passthrough pause overridden — otherwise nothing could ever be clicked again); "Bubble" while parked routes `parkHandle.notify` → suppressed + badge +1; "Unpark" restores pre-park position | **PROVEN in container**: parked geometry `920 512 360 288` (bottom-right corner of 1280×800), unparked restored `12 20 360 288` (pre-park spot); parked-menu screenshot with Unpark label; parked bubble click logged (badge +1). `raw/park.windows.txt`, `raw/demo-b2-parked*.png`, `raw/demo-b2-unparked.png`. |
| 8 | (second monitor) drag mascot there → notes open there | `mascot_monitor()` re-read on every drag re-base; popups anchor to the mascot's current monitor | Owner-manual (single monitor in CI). |

## NOT DONE + findings

1. r1 roam stall — RESOLVED in r2. Cause (reviewer-confirmed, reproduced in
   this round): the demo's window adapter passed FRACTIONAL physical coords
   (roam steps ≈ 0.8 px/tick) to Tauri `set_position`, which requires
   integers, so every roam step was rejected and the window froze at the
   zone origin. Fix: `physWindowAdapter()` rounds via `Math.round` for roam
   AND park (one shared adapter). Guarded by a starter test that fails on
   the r1 tree (`r2: roam/park window adapter rounds coordinates…`). The
   library-side hardening runs as the parallel okc-integ-fix4 task; the
   starter no longer depends on it.
2. r1 badge-count staleness — RESOLVED in r2. `MascotView` now re-syncs
   `badgeCount` from `orbitkit://badge` (`onBadge`), so a parked bubble's
   park-counted badge is honoured by the next "badge +1" instead of sending
   a stale count+1. Guarded by a starter test that fails on the r1 tree.
3. Resolved during r1 evidence gathering: the first scenario pass captured
   windows grepping `orbitkit` only, while popup window titles are
   "Notes"/"Settings" — the popups were present but filtered. The final
   capture lists all windows and proves items 3 and 4.
4. Owner-manual remainders: drag feel (B2.2 on a real pointer), notes
   flip-inward at a screen edge (needs a mascot parked at an edge), and the
   second-monitor item (single monitor in CI). Hover-keep for the bubble is
   component behaviour and was not separately captured (no hit region over
   the floating bubble — K10 keeps the window click-through there).

## Files changed (all inside the allowlist)

- `examples/starter/src/orbitkit.config.json` — `faceByVelocity: true`;
  `mascotWindow.roam` {960×480, margin 12, corner bottom-left, speed 24};
  popup anchors (`notes` → `mascot`, `settings` → `center`); menu
  +`app.bubble`/`app.badge`/`app.park` (9 items, `radius` 96 → 150 so the
  adjacent-item chord ≈58 px fits itemSize 44).
- `examples/starter/src/views/MascotView.svelte` — demo-b2 wiring: roam +
  drag (`createRoam`, window placed at the zone origin before the loop
  starts), park handle (`createPark`, passthrough pause overridden), bubble
  toggle + park `notify` gate, badge counter, K8 state gate, `velocityX`
  mirroring, boot awaits the fixed-window fit before reading monitor/size.
- `examples/starter/src/lib/demoB2.ts` — pure demo-layer helpers
  (`noteInstanceKey`, `nextBadgeCount`, `parkMenuLabel`, `gatedMascotState`).
- `examples/starter/src-tauri/src/lib.rs` — `app.notes` opens a NEW popup per
  click with `instanceKey note-N` (counter); `app.settings` singleton.
- `examples/starter/tests/demo-b2.test.mjs` — NEW: 9 tests on the wiring
  logic (instance keys unique + K11-valid, badge counter, park label, K8
  gate, roam config sanity, popup anchors, 9-item arc chord ≥ itemSize, roam
  zone exceeds the fixed window, backend instance vs singleton popups). Fail
  on base by construction (helpers file + config fields do not exist there).
- `examples/starter/tests/demo-b1.test.mjs` — updated for B2 supersets:
  `faceByVelocity` now `true` (smoke B2.1), menu = 9 items, Design-B setter
  count scoped to the demo-b1 region (menu open/close closure guard intact).
- r2 additions: `physWindowAdapter()` (shared roam/park window adapter,
  `Math.round` on both coords — the r1-stall fix), `onBadge` re-sync of
  `badgeCount`, two new r2 regression tests in `demo-b2.test.mjs` (both fail
  on the r1 tree), `raw/roam-motion-r2.log` runtime proof.

## Gates / commands (rerun at the r2 tree unless noted)

| Command | Result |
|---|---|
| `pnpm -r build` | exit 0 |
| `pnpm -r test` | library 373/373 + starter 30/30 (exit 0) |
| `pnpm -r check` | exit 0 |
| `bash plans/orbitkit-cutecare-v02/okc_tools/rust_gate.sh` | `OKC_RUST_GATE_OK` (67 tests) |
| `bash plans/orbitkit-cutecare-v02/okc_tools/starter_gate.sh` | `OKC_STARTER_GATE_OK` |
| `scripts/linux-desktop.sh build examples/starter` | BUILD_OK |
| `scripts/linux-desktop.sh run-screenshot examples/starter evidence/okc/demo-b2/raw/demo-b2-idle.png 15` | OK, app alive, mascot visible (r1 evidence, unchanged surface) |
| `scripts/linux-desktop.sh exec examples/starter -- bash …/raw/probe-roam.sh` | `raw/roam-motion-r2.log`: mascot window advances ≈ 95 px per 4 s = 24 px/s (r1: byte-identical samples) |

## Out-of-scope findings

- Library `park.ts` unconditionally pauses passthrough (`setPaused(true)` →
  window non-interactive), making a parked mascot permanently unclickable
  unless the consumer overrides the pause as this demo does. Worth a contract
  note if parked interaction should survive park mode by default.
- `open_popup` results are swallowed (`let _ = …`) in the starter's backend
  handlers (pre-existing b1 pattern); surfacing the error would have made the
  popup gap faster to diagnose.

## Final state

- Reviewable content SHA: `c299fb7f7e4bad6b48e2c383d8d288a83449cf05` (the tip commit adds only this stamp)
- READY FOR REVIEW at `c299fb7f7e4bad6b48e2c383d8d288a83449cf05`
