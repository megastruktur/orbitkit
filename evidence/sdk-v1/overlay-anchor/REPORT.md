# Task Report: Remediation R-DEV-1: Android overlay mascot "jumps" when toggling radial menu

Branch: `megastruktur/oks-overlay-anchor`
Worktree: `/home/megastruktur/orca/workspaces/orbitkit/oks-overlay-anchor`
Base: `main 0fbfc5b`

## Summary of Changes

1. **Pure Geometry Helper (`OverlayGeometry.kt`):**
   - Implemented `dev.orbitkit.native.OverlayGeometry` with zero Android imports.
   - Provides `OverlayGeometry.place(desiredCenterX, desiredCenterY, windowSize, bubbleSize, screen: Bounds): OverlayPlacement`.
   - Computes:
     - `windowX`, `windowY`: clamped window origin ensuring the overlay window stays fully within usable screen bounds (or pinned to top-left if larger than screen).
     - `localCenterX`, `localCenterY`: bubble center coordinate relative to the window origin (`bubbleCenterX - windowX`), shifted to compensate for any window clamping.
     - `bubbleCenterX`, `bubbleCenterY`: clamped bubble center coordinates ensuring the mascot bubble itself remains fully visible on screen.
   - Added `Int` overload for caller convenience.
   - Removed `.overlay-geometry-draft.kt.txt` draft file from the worktree root.

2. **Overlay Layout Integration (`OrbitkitNativePlugin.kt`):**
   - Added helper function `getScreenBounds(wm: WindowManager, context: Context): OverlayGeometry.Bounds`:
     - On API 30+: uses `wm.currentWindowMetrics.bounds` minus `windowInsets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())`.
     - Below API 30: uses `resources.displayMetrics` width and height with top inset from `status_bar_height` dimension resource.
   - Updated `overlayShow` and `buildOverlayView`:
     - Every time window size or position changes (initial show, toggle expand, toggle collapse, and drag move), layout placement is computed with `OverlayGeometry.place` using the current window size (`containerSize` when expanded, `mascotSizePx` when collapsed).
     - Window params updated: `params.x = placement.windowX`, `params.y = placement.windowY`, `params.width = windowSize`, `params.height = windowSize`.
     - Mascot margins updated: `mascotLp.leftMargin = placement.localCenterX - mascotSizePx / 2`, `mascotLp.topMargin = placement.localCenterY - mascotSizePx / 2`.
     - Item margins updated: `itemLp.leftMargin = (placement.localCenterX + pos.x - itemSizePx / 2.0).roundToInt()`, `itemLp.topMargin = (placement.localCenterY + pos.y - itemSizePx / 2.0).roundToInt()`. Items move with the mascot, not the window center.
     - Bubble center state updated to clamped truth: `bubbleCenterX = placement.bubbleCenterX.toDouble()`, `bubbleCenterY = placement.bubbleCenterY.toDouble()`.
     - WindowManager layout updated via `wm.updateViewLayout(container, params)`.

3. **Comprehensive Unit Tests (`OverlayGeometryTest.kt`):**
   - Added 10 JUnit tests covering all required test specifications:
     - `testCenterOfScreenWindowCenteredAndBubbleCenterUnchanged`: centered window, `localCenter = windowSize / 2`, bubble center unchanged.
     - `testNearLeftEdgeWindowClampedAndLocalCenterShifted`: windowX clamped, bubbleCenter unchanged, localCenter shifted, `windowX + localCenterX == bubbleCenterX`.
     - `testNearTopEdgeWindowClampedAndLocalCenterShifted`: windowY clamped, bubbleCenter unchanged, localCenter shifted, `windowY + localCenterY == bubbleCenterY`.
     - `testNearRightEdgeWindowClampedAndLocalCenterShifted`: windowX clamped, bubbleCenter unchanged, localCenter shifted, `windowX + localCenterX == bubbleCenterX`.
     - `testNearBottomEdgeWindowClampedAndLocalCenterShifted`: windowY clamped, bubbleCenter unchanged, localCenter shifted, `windowY + localCenterY == bubbleCenterY`.
     - `testInvariantOverGridOfCentersAndBothWindowSizes`: verified identities over grid of centers for sizes 936 and 168 with screen `[0, 116, 1080, 2475]`: `windowX + localCenterX == bubbleCenterX`, window fully inside screen, bubble fully inside screen.
     - `testToggleInvariantExpandedAndCollapsedBubbleCenterMatch`: verifies `placement(expanded).bubbleCenter == placement(collapsed).bubbleCenter` and on-screen position is identical (the exact bug fix).
     - `testWindowLargerThanScreenPinnedToScreenLeftTopNoCrash`: window larger than screen pinned to `screen.left`/`top` without crash.
     - `testBubbleDraggedPartlyOffScreenClampedToStayFullyVisible`: bubble dragged off screen edges is clamped to stay fully visible.
     - `testDeviceReproductionZFlip7Coordinates`: exact measured root cause coordinates on Z Flip 7 screen `[0, 116, 1080, 2475]` at `(124, 303)`: verified on-screen position is identical between collapsed and expanded states without jump.

## Verification Matrix

| Step | Action | Command | Result | Evidence File | Exit Code |
|---|---|---|---|---|---|
| 1 | Gradle Plugin Unit Tests | `cd examples/starter/src-tauri/gen/android && ./gradlew :tauri-plugin-orbitkit:testDebugUnitTest --rerun-tasks` | PASS (46/46 tests green, 0 failures, 0 errors, 0 skipped) | `raw/01-gradlew-plugin-unit-tests.txt` | 0 |
| 2 | JUnit Test Counts Summary | Summarized all test suite XMLs | PASS (OverlayGeometryTest: 10, OrbitkitNativePluginTest: 9, MenuConfigParserTest: 10, OverlayActionDispatcherTest: 6, RadialLayoutTest: 11) | `raw/02-junit-test-results-summary.txt` | 0 |
| 3 | Android APK Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | PASS (`app-universal-debug.apk` built) | `raw/03-tauri-android-build.txt` | 0 |
| 4 | ADB Device Probe | `adb devices -l` | Probe recorded (0 attached devices). Per BRIEF, NO device is available; coordinator performs on-device run. | `raw/04-adb-devices.txt` | 0 |
| 5 | Gradle Starter Unit Tests | `cd examples/starter/src-tauri/gen/android && ./gradlew :app:testUniversalDebugUnitTest` | PASS (all starter tests green) | `raw/05-gradlew-starter-unit-tests.txt` | 0 |

## Device Availability Note
NO device was available during this session (`adb devices -l` reported 0 attached devices). Per task brief instructions, the coordinator will perform the on-device run.


---

## Round 2: Transition Artifact Remediation (Two-Window Architecture)

### Problem in Round 1
Round 1 (257d96b) correctly fixed the settled layout coordinates using `OverlayGeometry.place`. However, during menu open/close transitions, Android's `WindowManager.updateViewLayout` animates/defers the window frame resizing (~150–230 ms) while child view margin updates render immediately. This transient frame mismatch resulted in the mascot centroid momentarily sliding across frames during toggles.

### Round 2 Solution & Architecture
Split the overlay into two distinct `WindowManager` windows:

1. **Bubble Window (`bubbleView`):**
   - Dimensions: exactly `mascotSizePx` x `mascotSizePx` (`56dp`).
   - Content: contains ONLY the mascot bubble view (centered within the window, margins 0).
   - Invariant: window size NEVER changes on expand or collapse.
   - Positioning: positioned using `OverlayGeometry.place(desiredCenterX, desiredCenterY, mascotSizePx, mascotSizePx, screen)`.
   - Interaction: dragging translates only the bubble window via `wm.updateViewLayout`.
   - Tap: toggles the radial menu.

2. **Menu Window (`menuView`):**
   - Dimensions: `containerSize` x `containerSize` (`2 * halfExtent`).
   - Content: contains ONLY the radial menu item views (no mascot view).
   - Positioning: positioned with `OverlayGeometry.place(bubbleCenterX, bubbleCenterY, containerSize, mascotSizePx, screen)`.
   - Item Layout: items placed using pure helper `OverlayGeometry.itemMargin(localCenterX, localCenterY, pos.x, pos.y, itemSizePx)`.
   - Window animations disabled: `menuParams.windowAnimations = 0` and `bubbleParams.windowAnimations = 0`.

3. **Expand & Collapse Behavior:**
   - **Expand:**
     - `updateMenuPositions(bubbleCenterX, bubbleCenterY)` adjusts item margins to current bubble center.
     - Menu window added: `wm.addView(menuContainer, menuParams)`.
     - Bubble brought on top: `wm.removeViewImmediate(bubbleContainer); wm.addView(bubbleContainer, bubbleParams)`.
     - Mascot remains topmost and immediately tappable; item views remain clickable outside the bubble window.
   - **Collapse:**
     - Menu window removed: `wm.removeView(menuContainer)`.
     - The bubble window is **never touched or resized** by collapse, guaranteeing identical mascot centroid across all frames.
   - **Drag while expanded:**
     - Immediately collapses menu on drag initiation (`collapseMenu()`), removing the menu window before dragging the bubble.

4. **Lifecycle & Clean Up:**
   - `removeOverlayViews()` safely clears both windows across `overlayHide`, `onDestroy`, and re-show invocations without double-add or leak.

5. **Pure Geometry Extensions (`OverlayGeometry.kt`):**
   - Added `OverlayGeometry.ItemMargin` and pure helper `OverlayGeometry.itemMargin(...)` to compute `FrameLayout` left/top margins from radial position offsets.
   - Added unit tests verifying item center matching in screen space and bubble window parameter invariance.

### Round 2 Verification Matrix

| Step | Action | Command | Result | Evidence File | Exit Code |
|---|---|---|---|---|---|
| 1 | Full Gradle Tests | `cd examples/starter/src-tauri/gen/android && ./gradlew test` | PASS (49/49 plugin tests + all starter tests green) | `raw/06-round2-gradlew-test.txt` | 0 |
| 2 | Round 2 JUnit Summary | Summarized all unit test XML reports | PASS (OverlayGeometryTest: 13, OrbitkitNativePluginTest: 9, MenuConfigParserTest: 10, OverlayActionDispatcherTest: 6, RadialLayoutTest: 11) | `raw/07-round2-junit-summary.txt` | 0 |
| 3 | Android APK Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | PASS (`app-universal-debug.apk` built successfully) | `raw/08-round2-tauri-android-build.txt` | 0 |
| 4 | ADB Device Probe | `adb devices -l` | Probe recorded (0 attached devices). Per BRIEF, NO device is available; coordinator performs on-device run. | `raw/09-round2-adb-devices.txt` | 0 |

READY FOR REVIEW at ca7e472620f4c02283e35bf5bfda27187900b731

---

## Round 3: Zero-Blink Fixed Architecture (No Add/Remove/Move/Resize on Toggle)

### Problem in Round 2
Round 2 eliminated close-transition jump and centroid drift. However, on open, a ~50 ms (5-frame) mascot disappear/blink artifact occurred because `expandMenu()` called `wm.removeViewImmediate(bubbleContainer)` + `wm.addView(bubbleContainer, ...)` to ensure the bubble remained on top of the menu window.

### Round 3 Solution & Architecture
Eliminated all window add, remove, move, and resize operations during toggle:

1. **Window Creation & Z-Order Invariant:**
   - Both windows are created ONCE during `overlayShow`.
   - The **Menu Window** (`menuContainer`) is added FIRST: full screen (`MATCH_PARENT x MATCH_PARENT`, `x = 0, y = 0, gravity = TOP|START`), `windowAnimations = 0`. It never moves and never resizes.
   - The **Bubble Window** (`bubbleContainer`) is added SECOND: `mascotSizePx x mascotSizePx`. By Android `WindowManager` specification, same-type windows follow add order, so the bubble window is unconditionally and permanently on top of the menu window.

2. **Zero-Window-Op Toggle Mechanism:**
   - **Collapsed State:**
     - `menuContainer.visibility = View.INVISIBLE`
     - `mParams.flags = mParams.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE` (touches pass through to underlying applications).
     - Applied via `wm.updateViewLayout(menuContainer, mParams)`.
     - Bubble window is untouched.
   - **Expanded State:**
     - Item margins computed in screen coordinates relative to menu window's on-screen origin (`menuContainer.getLocationOnScreen()` with fallback to screen bounds origin), clamped fully inside screen bounds.
     - `menuContainer.visibility = View.VISIBLE`
     - `mParams.flags = mParams.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv()` (intercepts touches).
     - Applied via `wm.updateViewLayout(menuContainer, mParams)`.
     - Bubble window is untouched.
   - Entire `removeViewImmediate`/re-add code path removed from toggle.

3. **Touch Interception & Outside Click Collapse:**
   - When expanded, the full-screen menu window intercepts touches outside any menu item.
   - `menuContainer.setOnTouchListener` and `menuContainer.setOnClickListener` detect taps outside any item view and immediately invoke `collapseMenu()`.
   - Child item buttons handle their own touches and dispatch actions normally without triggering background collapse.

4. **Drag Behavior:**
   - Mascot drag begins with touch slop detection. If the menu is expanded, it collapses first, then moves only the bubble window via `moveBubble`.

5. **Lifecycle & Clean Up:**
   - `removeOverlayViews()` safely tears down both windows on `overlayHide`, `onDestroy`, and prior to re-show in `overlayShow`, preventing leaks or double-add.

6. **Pure Geometry Extensions (`OverlayGeometry.kt`):**
   - Added `OverlayGeometry.ItemPosition(val x: Int, val y: Int)`.
   - Added pure helper `OverlayGeometry.itemScreenPosition(bubbleCenterX, bubbleCenterY, relX, relY, itemSize, screen: Bounds): ItemPosition` which clamps each item's screen bounding box `[pos.x, pos.x + itemSize]`, `[pos.y, pos.y + itemSize]` fully inside `screen` bounds (and pins to `screen.left`/`top` if screen smaller than item).
   - Added pure helper `OverlayGeometry.itemMargin(bubbleCenterX, bubbleCenterY, relX, relY, itemSize, screen: Bounds, menuOriginX, menuOriginY): ItemMargin` computing FrameLayout margins relative to the menu container's screen origin.
   - Added 5 unit tests in `OverlayGeometryTest.kt` covering un-clamped center, left/top edge clamping, right/bottom edge clamping, screen-smaller-than-item pinning, and menu origin offset margins.

### Round 3 Verification Matrix

| Step | Action | Command | Result | Evidence File | Exit Code |
|---|---|---|---|---|---|
| 1 | Full Gradle Tests | `cd examples/starter/src-tauri/gen/android && ./gradlew test` | PASS (54/54 plugin tests + all starter tests green) | `raw/10-round3-gradlew-test.txt` | 0 |
| 2 | Round 3 JUnit Summary | Summarized all unit test XML reports | PASS (OverlayGeometryTest: 18, OrbitkitNativePluginTest: 9, MenuConfigParserTest: 10, OverlayActionDispatcherTest: 6, RadialLayoutTest: 11) | `raw/11-round3-junit-summary.txt` | 0 |
| 3 | Android APK Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | PASS (`app-universal-debug.apk` built successfully) | `raw/12-round3-tauri-android-build.txt` | 0 |
| 4 | ADB Device Probe | `adb devices -l` | Probe recorded (0 attached devices). Per BRIEF, NO device is available; coordinator performs on-device run. | `raw/13-round3-adb-devices.txt` | 0 |

READY FOR REVIEW at 4daf865536676672434293d5c6df95c7313dc542
