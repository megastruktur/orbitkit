# Task Report: R-DEV-2 Android overlay radial items spawn from mascot and collapse back into it

Worktree: `oks-spawn-anim` (`/home/megastruktur/orca/workspaces/orbitkit/oks-spawn-anim`)  
Base Commit: `294245c fix(android-overlay): mascot no longer jumps when the radial menu opens/closes (R-DEV-1)`  

---

## 1. Summary of Changes

### A. Pure Geometry & Animation Timing Helper (`SpawnAnimation.kt`)
- Created pure helper `dev.orbitkit.native.SpawnAnimation` with zero Android imports.
- `startOffset(mascotCenterX, mascotCenterY, itemScreenX, itemScreenY, itemSize)`:
  - Computes translation offset `(mascotCenterX - itemFinalCenterX, mascotCenterY - itemFinalCenterY)` in screen px.
  - Ensures items always spawn centered exactly at mascot centroid, even when item orbit position is clamped against screen edges by `OverlayGeometry`.
- Timing Constants & Stagger:
  - `OPEN_DURATION_MS = 220L`: per-item open animation duration (220 ms).
  - `CLOSE_DURATION_MS = 180L`: per-item close animation duration (180 ms).
  - `DEFAULT_STAGGER_STEP_MS = 20L`: per-item stagger step (20 ms).
  - `staggerDelay(index, totalItems, isOpening, stepMs)` and `staggerDelays(...)`:
    - Open: forward order (item 0 starts at 0ms delay, item $i$ starts at $i \times 20$ms delay).
    - Close: reverse order (last item starts at 0ms delay, item 0 closes last).
    - Uncapped 20ms stagger for all items (60ms cap removed per F1). Total open span scales as $220 + (N-1) \times 20$ ms; close span scales as $180 + (N-1) \times 20$ ms.
- `reverseDuration(currentFraction, targetFraction, baseDurationMs, minDurationMs)`:
  - Scales remaining duration by distance fraction traversed so velocity is preserved when reversed mid-flight.
  - Uses `OPEN_DURATION_MS` (220ms) when opening and `CLOSE_DURATION_MS` (180ms) when closing.
  - Progress fraction clamps interpolator overshoot (values > 1.0f clamp to 1.0f).
- `enabled(configValue, animatorScale)`:
  - Decision helper: returns `false` if `animatorScale == 0f` (reduced motion) or `configValue == "none"`. Defaults to `true` ("spawn") for null, empty, or unrecognized values.

### B. Overlay Animation Integration (`OrbitkitNativePlugin.kt`)
- `expandMenu()`:
  - When enabled: makes `menuContainer.visibility = View.VISIBLE` and clears `FLAG_NOT_TOUCHABLE`. Items are set to `isClickable = false` during animation.
  - Animates each item view using `ViewPropertyAnimator` with `OvershootInterpolator(1.2f)` and duration `OPEN_DURATION_MS` (220 ms).
  - Moves from mascot center start offset to `(0, 0)`, grows scale from `0f` to `1f`, and fades alpha from `0f` to target alpha (`1.0f` enabled, `0.5f` disabled) with forward stagger delays (20 ms per item).
  - When open animation ends, items are made clickable (`isClickable = true`).
  - If `animation == "none"` or `animatorScale == 0f`, items jump immediately to final expanded state.
- `collapseMenu(animate: Boolean = true)`:
  - When enabled: disables item clicks immediately so shrinking items cannot dispatch.
  - Keeps menu window `VISIBLE` and touchable until the last item animation ends.
  - Animates items back into mascot center start offset with `scale = 0f` and `alpha = 0f` using `AccelerateInterpolator` and duration `CLOSE_DURATION_MS` (180 ms) with reverse stagger delays.
  - On animation completion, sets `menuContainer.visibility = View.INVISIBLE`, sets `FLAG_NOT_TOUCHABLE`, and calls `wm.updateViewLayout`.
  - When `animate == false` (e.g. mascot drag starts, or hide/destroy), cancels all running animators and collapses immediately.
- Mid-Flight Tap Reversal:
  - Tapping mascot or outside container while animating immediately cancels running animators and animates to the opposing target from current view property values with scaled reverse duration. No queued double toggles or stuck states.
- Dragging while expanded:
  - `mascot.setOnTouchListener` triggers `collapseMenu(animate = false)` instantly upon exceeding touch slop before translating bubble window via `moveBubble`.
- Teardown:
  - `removeOverlayViews()` cancels all running animators on item views via `activeOverlayTeardown` callback before window detachment.
- Mascot Window Invariant:
  - Bubble window (`bubbleView`) is never moved, resized, or touched during expand/collapse animations. Mascot centroid movement is 0 px (within ±3 px requirement).

### C. Menu Config Parser Animation Field (`MenuConfigParser.kt`)
- Added `animation: String = DEFAULT_ANIMATION` (default `"spawn"`) to `NativeMenuConfig`.
- `MenuConfigParser.parseMenu` parses `animation` field from menu JSON:
  - Missing/null -> `"spawn"`
  - `"none"` -> `"none"`
  - `"spawn"` -> `"spawn"`
  - Unknown/garbage -> `"spawn"` with a logged warning via safe host/device logging helper.

### D. Findings Addressed

#### R-DEV-1 Low Findings:
- **Finding (a)**: Added `menuContainer.post { if (isMenuAttached) updateMenuPositions(bubbleCenterX, bubbleCenterY) }` after `wm.addView(menuContainer, mParams)` so initial expanded show updates margins using real `getLocationOnScreen` origin.
- **Finding (b)**: Disabled items set `isClickable = true` with a no-op click listener so taps are consumed and do not fall through to `menuContainer`, keeping the menu open.
- **Finding (c)**: Removed dead `menuContainer.setOnClickListener` (touches handled by `setOnTouchListener`) and removed the duplicate `overlayView` field from `OrbitkitNativePlugin`.

#### R-DEV-2 Round 2 Review Findings:
- **F1 (Timing & Easing)**: Updated open animation to 220 ms per item with `OvershootInterpolator(1.2f)`; updated close animation to 180 ms per item with `AccelerateInterpolator`. Removed 60 ms stagger cap so stagger is 20 ms per item for all items. Split duration constants into `OPEN_DURATION_MS = 220L` and `CLOSE_DURATION_MS = 180L`. Updated tests to assert per-item durations and uncapped stagger for $N=5$ and $N=12$.
- **F2 (Test Cleanup)**: Deleted implementation-pinning test `OrbitkitNativePluginTest.testDuplicateOverlayViewFieldRemoved`.
- **F3 (Report & SHA)**: Updated timing documentation, test matrix, and evidence logs; updated review SHA reference.

---

## 2. Test Suite Additions

1. `SpawnAnimationTest.kt` (9 unit tests):
   - `testDurationAndStaggerConstants`: asserts 220ms open, 180ms close, and 20ms stagger step constants.
   - `testStartOffsetCentersItemOnMascotUnclamped`: verifies start offset centers item on mascot.
   - `testStartOffsetWhenItemClampedToScreenEdges`: verifies start offset places clamped items at mascot center.
   - `testStaggerDelaysForFiveItems`: asserts open `[0, 20, 40, 60, 80]` and close `[80, 60, 40, 20, 0]` proving uncapped stagger for $N=5$.
   - `testStaggerDelaysForTwelveItems`: asserts open and close delays for $N=12$ items up to 220ms stagger.
   - `testStaggerDelaySingleItemAndZeroItems`: verifies edge cases (single item / zero items).
   - `testReverseDurationProportionalToRemainingDistance`: verifies proportional duration scaling for both 220ms open and 180ms close.
   - `testCurrentFractionAndLerp`: verifies fraction calculations, clamping, and overshoot handling.
   - `testAnimationEnabledDecision`: verifies reduced motion (scale 0), config "none", "spawn", missing, and garbage.

2. `MenuConfigParserTest.kt` (11 unit tests):
   - `testParseAnimationField`: verifies missing -> spawn, "none" -> none, "spawn" -> spawn, garbage -> spawn.
   - Plus 10 existing menu parsing tests.

3. `OrbitkitNativePluginTest.kt` (9 unit tests):
   - Removed implementation-pinning reflection test per F2; retains 9 behavior and integration unit tests.

4. Other Suites:
   - `OverlayActionDispatcherTest.kt` (6 unit tests)
   - `OverlayGeometryTest.kt` (18 unit tests)
   - `RadialLayoutTest.kt` (11 unit tests)

Total: 64 unit tests across 6 test suites, all passing.

---

## 3. Verification Matrix

| Step | Action | Command | Result | Evidence File | Exit Code |
|---|---|---|---|---|---|
| 1 | Full Gradle Tests (All Modules) | `cd examples/starter/src-tauri/gen/android && ./gradlew test` | PASS (328 tasks, all module unit tests green) | `raw/01-gradlew-all-tests.txt` | 0 |
| 2 | JUnit Test Results Summary | `python3 parse_junit_xml.py` | PASS (64/64 tests pass across 6 test suites) | `raw/02-junit-test-results-summary.txt` | 0 |
| 3 | Android Starter Debug APK Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | PASS (`app-universal-debug.apk` built successfully) | `raw/03-tauri-android-build.txt` | 0 |
| 4 | ADB Device Probe | `adb devices -l` | PROBED (0 attached devices in sandbox; coordinator on-device run) | `raw/04-adb-devices.txt` | 0 |

---

## 4. Out-of-Scope Findings
None. All changes remained strictly within `crates/tauri-plugin-orbitkit/android/**` and `evidence/sdk-v1/spawn-anim/**`.

READY FOR REVIEW at 991613df008d38d936bf3abd89192d3fdb47e221
