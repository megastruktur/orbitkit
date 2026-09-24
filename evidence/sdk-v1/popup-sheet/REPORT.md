# OrbitKit Follow-up Report: `popup-sheet` (P4b in-app popup sheet for Android)

## 1. Executive Summary

Per the architecture decision (2026-09-24), multi-window Tauri popups are desktop-only; on Android, auxiliary popups are rendered in-app within the main activity's webview using a responsive planetary glass sheet component (`<PopupSheet />`). This report documents the implementation and verification of card P4b (UI half).

The native half (P4a) emits `orbitkit://popup-open` with payload `{ id: string, title: string, url: string, width: number, height: number }` and `orbitkit://popup-close` with payload `{ id: string }`.

The UI half implemented here:
1. Adds `onPopupOpen` and `onPopupClose` listener wrappers and `PopupOpenPayload` / `PopupClosePayload` types to `@orbitkit/ui` bridge.
2. Implements and exports `<PopupSheet />` from `@orbitkit/ui`, honoring single-sheet presentation, responsive dimensions (`min(width, 100vw - 24px)` by `min(height, 85vh)`), planetary glass styling (`rgba(14,20,51,0.92)` surface, `#38BDF8` ring, >4.5:1 text contrast), Svelte 5 transitions (180 ms intro/outro, instant when `prefers-reduced-motion: reduce`), accessible dialog semantics (`role="dialog"`, `aria-modal="true"`, focus restore), and dismissal triggers (✕ button, backdrop tap, Escape key, popstate back gesture, native popup-close event).
3. Connects the starter app via unified `popupViews` mapping, mounting `<PopupSheet />` in `MainView.svelte`.
4. Restructures root styles in popup views (`NotesPopup`, `SettingsPopup`, `UnknownPopup`) so they fill 100% height without leaking `overflow: hidden` or full-window `100vh` constraints into the main webview.
5. Documents the Android in-app popup sheet contract and APIs in `docs/`.

---

## 2. Deliverables & Scope Checklist

| Deliverable | Location | Status | Description |
|---|---|---|---|
| Bridge Listeners & Types | `packages/orbitkit/src/bridge.ts`, `bridge.test.ts` | **PASS** | `onPopupOpen`, `onPopupClose`, `PopupOpenPayload`, unit tests covering subscription, payload delivery, unlisten, and non-Tauri safety. |
| PopupSheet Component | `packages/orbitkit/src/PopupSheet.svelte` | **PASS** | Responsive glass card dialog, backdrop, title bar, ✕ button, a11y focus trapping (Tab/Shift+Tab wrap) & restore, replaceState on replacement, popstate integration, reduced motion support. |
| PopupSheet Tests | `packages/orbitkit/src/PopupSheet.test.ts` | **PASS** | 12 comprehensive unit tests covering all required criteria + replaceState on sheet replace, focus trap (Tab/Shift+Tab wrap and containment), backdrop click, popstate, focus management, dimension styles, test hooks. |
| Starter Single Mapping | `examples/starter/src/popupViews.ts`, `main.ts` | **PASS** | Shared `popupComponents` and `popupFallback` definitions reused for both desktop query routing (`?popup=`) and Android sheet mapping. |
| Starter MainView Mount | `examples/starter/src/views/MainView.svelte` | **PASS** | Mounts `<PopupSheet components={popupComponents} fallback={popupFallback} />`. |
| Scoped Popup View CSS | `examples/starter/src/views/{NotesPopup,SettingsPopup,UnknownPopup}.svelte` | **PASS** | `height: 100%; min-height: 0;` containers; `:global(body.orbitkit-popup-window)` body styling active only in standalone desktop window mode. |
| Documentation | `docs/platforms/android.md`, `docs/api.md` | **PASS** | Documented "Popups on Android (In-App Popup Sheet)" architecture and TypeScript API signatures. |
| Visual Evidence | `evidence/sdk-v1/popup-sheet/01-popup-sheet-notes.png` | **PASS** | Real binary PNG screenshot (412x915) of Notes popup rendered in `<PopupSheet />` over MainView, verified with `file`. |

---

## 3. Verification & Checks

### Check 1: Workspace Build, Typecheck, and Unit Tests
- Command: `pnpm -r build && pnpm -r check && pnpm -r test`
- Result: **PASS** (`EXIT_CODE=0`)
- Details: All 3 workspace packages built (`dist/` generated), TypeScript typecheck passed with zero diagnostics across all packages, and Vitest suite passed 119 tests across 6 files (including 27 bridge tests and 12 PopupSheet component tests).

### Check 2: Desktop Application Container Build
- Command: `scripts/linux-desktop.sh build examples/starter`
- Result: **PASS** (`EXIT_CODE=0`)
- Details: Clean container build of Tauri desktop binary (`starter` ELF 64-bit executable).

### Check 3: Desktop Full Flow Scenario Regression
- Command: `scripts/linux-desktop.sh run-scenario examples/starter evidence/sdk-v1/dsn-starter/run-desktop-flow.sh`
- Result: **PASS** (`EXIT_CODE=0`)
- Details: Verified that multi-window desktop behavior is completely preserved:
  - Step 1: Main window ready
  - Step 2: Show overlay creates `orbitkit-mascot` window
  - Step 3: Radial menu opens
  - Step 4: Notes menu item opens desktop window `orbitkit-popup-notes`
  - Step 5: Quit menu item exits process cleanly (`App exited 0 on quit`)
  - Verification assets under `evidence/sdk-v1/dsn-starter/` restored intact.

### Check 4: Visual & Visual A11y Verification
- Evidence: `evidence/sdk-v1/popup-sheet/01-popup-sheet-notes.png` (PNG image data, 412 x 915, 8-bit/color RGB, non-interlaced, 67,897 bytes)
- Capture method: Real browser execution via Vite dev server and headless Chromium:
  1. Started starter Vite dev server on `127.0.0.1:1420`.
  2. Opened headless Chromium browser window configured with mobile viewport 412x915 (`deviceScaleFactor: 1`).
  3. Waited for `.main-container` to mount.
  4. Dispatched `orbitkit:test-popup-open` with Notes payload (`{ id: "notes", title: "Notes", url: "index.html?popup=notes", width: 320, height: 420 }`).
  5. Waited for `.orbitkit-popup-sheet-card` and settled Svelte 5 entrance transition (180 ms).
  6. Captured binary PNG screenshot with `page.screenshot()`.
- Format proof: Verified with `file evidence/sdk-v1/popup-sheet/01-popup-sheet-notes.png` (`raw/04-file-evidence-screenshot.txt`):
  `evidence/sdk-v1/popup-sheet/01-popup-sheet-notes.png: PNG image data, 412 x 915, 8-bit/color RGB, non-interlaced` (`EXIT_CODE=0`).
- Observations:
  - Centered glass card (`rgba(14, 20, 51, 0.92)`) with bright `#38BDF8` ring border and drop shadow over dimmed background.
  - Title bar ("Notes") with accessible ✕ close button.
  - Quick Notes view renders with its planetary starry background, text area, character counter, and Clear button.
  - Zero horizontal or vertical layout overflow.
---

## 4. Raw Command Output Inventory

All raw command logs are located under `evidence/sdk-v1/popup-sheet/raw/` with trailing `EXIT_CODE=<n>`:
- `raw/01-pnpm-build-check-test.txt`: Output of `pnpm -r build && pnpm -r check && pnpm -r test` (`EXIT_CODE=0`)
- `raw/02-linux-desktop-build.txt`: Output of `scripts/linux-desktop.sh build examples/starter` (`EXIT_CODE=0`)
- `raw/03-linux-desktop-run-scenario.txt`: Output of `scripts/linux-desktop.sh run-scenario examples/starter evidence/sdk-v1/dsn-starter/run-desktop-flow.sh` (`EXIT_CODE=0`)
- `raw/04-file-evidence-screenshot.txt`: Output of `file evidence/sdk-v1/popup-sheet/01-popup-sheet-notes.png` (`EXIT_CODE=0`)

---

## 5. Out-of-Scope Findings

None. All modifications strictly adhered to the assigned scope without modifying Rust, Kotlin, RadialMenu, MascotView, or geometry files.

---

## 6. Review Round 1 Remediation

Following review round 1 (`P4b-popup-sheet.verdict.md`, VERDICT: FIX):
1. **F1 (HIGH) — Real Binary Screenshot**: Captured authentic binary PNG screenshot of starter app with Notes sheet open on 412x915 mobile viewport using Vite dev server and headless Chromium. Committed real binary PNG (`evidence/sdk-v1/popup-sheet/01-popup-sheet-notes.png`), proved with `file` command output in `raw/04-file-evidence-screenshot.txt`, and corrected report documentation.
2. **F2 (LOW) — replaceState on Sheet Replacement**: Updated `openSheet` in `PopupSheet.svelte` to detect if a sheet is already open (`isReplacing`); uses `window.history.replaceState` when replacing an open sheet instead of stacking `pushState`, eliminating orphaned history entries on back dismissal. Verified with unit test asserting `pushState` on initial open and `replaceState` on replacement.
3. **F3 (LOW) — Focus Trap**: Implemented keyboard focus trap inside `.orbitkit-popup-sheet-card` (`PopupSheet.svelte`). Traps `Tab` and `Shift+Tab` cycles among focusable elements (`a[href], button, input, select, textarea, [tabindex]`), wrapping between first and last elements, and pulling focus back inside dialog if active focus escapes to background elements. Verified with new comprehensive unit test (`PopupSheet.test.ts` test 12) using interactive fixture.

---

READY FOR REVIEW at 4e8f27648827888cf10a19f46cc83b32cc5e236b
