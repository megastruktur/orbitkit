# Task Report: `starter-polish` (R-T11-2)

## Summary
Completed task `starter-polish` (`oks-starter-polish` worktree) resolving all 4 T11 review LOW findings identified during plan review:

1. **`svelte-check` probe & `package.json` `check` (Fix 1)**:
   - Probed `pnpm ls -r svelte-check` across the entire workspace.
   - Result: `svelte-check` is not installed anywhere in the repository.
   - Per K1 ("forbids new deps") and task brief instructions ("if NOT present, K1 forbids new deps → leave `check` as is and document in REPORT 'svelte-check not added (K1)'"):
     - Left `"check": "tsc --noEmit"` unchanged in `examples/starter/package.json`.
     - Documented: `svelte-check not added (K1)`.
     - Verified: `pnpm -r check` passes cleanly (exit code 0).

2. **Dangling native intent phrase in `README.md` (Fix 2)**:
   - In `examples/starter/README.md` line 101, removed the dangling phrase "or dispatch via native intent:".
   - The paragraph now cleanly instructs:
     ```markdown
     5. **Display Floating Mascot Overlay**:
        Tap the **Show Overlay** button in the app.
        The floating mascot bubble will appear on top of other applications.
     ```

3. **Unknown popup handling in `main.ts` & `UnknownPopup.svelte` (Fix 3)**:
   - In `examples/starter/src/main.ts`, unknown `?popup=<id>` previously silently fell back to rendering `NotesPopup`.
   - Created `examples/starter/src/views/UnknownPopup.svelte` displaying a styled card with warning icon, heading `Unknown popup: {popupId}`, and description.
   - ID escaping: Uses Svelte text interpolation `{popupId}` with `$derived`, never `{@html}`, guaranteeing automatic HTML entity escaping.
   - Tested with `?popup=nope` (screenshot `05-unknown-popup.png`) and XSS payload `?popup=<h1>XSS</h1>` confirming automatic HTML entity escaping (`&lt;h1&gt;XSS&lt;/h1&gt;`) and zero DOM injection.

4. **Dynamic mascot state buttons in `SettingsPopup.svelte` (Fix 4)**:
   - In `examples/starter/src/views/SettingsPopup.svelte`, replaced hardcoded `["idle", "busy", "active", "attention"]` array with states dynamically derived from configuration:
     ```ts
     const configuredStates = Object.keys(config.mascot.states ?? {});
     const availableStates = configuredStates.length > 0 ? configuredStates : ["idle"];
     ```
   - Buttons reflect the mascot states configured in `orbitkit.config.json` (`"idle"` and `"busy"`), with safe fallback to `["idle"]` if none defined.

---

## Code Changes

### 1. `examples/starter/README.md`
```diff
@@ -98,7 +98,7 @@ When an Android device or emulator is connected via ADB:
-   Tap the **Show Overlay** button in the app or dispatch via native intent:
+   Tap the **Show Overlay** button in the app.
     The floating mascot bubble will appear on top of other applications.
  6. **Interact with Radial Menu**:
     - Tap the mascot bubble: radial menu items (`notes`, `timer`, `settings`, `about`, `quit`) expand.
```

### 2. `examples/starter/src/main.ts`
```diff
@@ -3,10 +3,12 @@ import MainView from "./views/MainView.svelte";
 import MascotView from "./views/MascotView.svelte";
 import NotesPopup from "./views/NotesPopup.svelte";
 import SettingsPopup from "./views/SettingsPopup.svelte";
+import UnknownPopup from "./views/UnknownPopup.svelte";
 
 const params = new URLSearchParams(window.location.search);
 
-let ActiveView: Component = MainView;
+let ActiveView: Component<any> = MainView;
+let viewProps: Record<string, any> = {};
 
 if (params.get("orbitkit") === "mascot") {
   ActiveView = MascotView;
@@ -17,12 +19,14 @@ if (params.has("popup")) {
   if (popupId === "notes") {
     ActiveView = NotesPopup;
   } else if (popupId === "settings") {
     ActiveView = SettingsPopup;
   } else {
-    ActiveView = NotesPopup;
+    ActiveView = UnknownPopup;
+    viewProps = { id: popupId ?? "" };
   }
 }
 
 const app = mount(ActiveView, {
   target: document.getElementById("app")!,
+  props: viewProps,
 });
```

### 3. `examples/starter/src/views/UnknownPopup.svelte`
```svelte
<script lang="ts">
  let { id = "" }: { id?: string } = $props();

  const popupId = $derived(id || (typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("popup") ?? "") : ""));
</script>

<main class="unknown-popup-container">
  <div class="unknown-popup-card">
    <div class="icon">⚠️</div>
    <h2>Unknown popup: {popupId}</h2>
    <p class="description">No popup view is registered for identifier "{popupId}".</p>
  </div>
</main>
```

### 4. `examples/starter/src/views/SettingsPopup.svelte`
```diff
@@ -1,11 +1,13 @@
 <script lang="ts">
   import { onMount } from "svelte";
   import { setMascotState, onMascotState } from "@orbitkit/ui";
+  import config from "../orbitkit.config";
 
   let currentState = $state<string>("idle");
   let statusText = $state<string>("Ready");
 
-  const availableStates = ["idle", "busy", "active", "attention"];
+  const configuredStates = Object.keys(config.mascot.states ?? {});
+  const availableStates = configuredStates.length > 0 ? configuredStates : ["idle"];
```

---

## Scenario Results Matrix

| # | Scenario | Command | Expected | Observed / Evidence | Exit Code |
|---|---|---|---|---|---|
| 1 | `svelte-check` Probe | `{ pnpm ls -r svelte-check; echo "EXIT_CODE=$?"; }` | Check if installed | PASS: empty output, not installed; K1 documented (`raw/00-svelte-check-probe.txt`) | 0 |
| 2 | JS Workspace Build, Check & Test | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r check && pnpm -r test` | exit 0 | PASS: all 3 packages build, check, and test cleanly (`raw/01-pnpm-build-check-test.txt`) | 0 |
| 3 | Desktop Container Build | `scripts/linux-desktop.sh build examples/starter` | exit 0 | PASS: builds `target-linux/debug/starter` binary (`raw/02-desktop-build.txt`) | 0 |
| 4 | Desktop Scenario Full Flow | `scripts/linux-desktop.sh run-scenario examples/starter evidence/sdk-v1/starter-polish/run-desktop-flow.sh` | 4 screenshots + exit 0 | PASS: 4 screenshots captured, wmctrl entries verified, app exited 0 on quit (`raw/03-desktop-scenario-flow.txt`) | 0 |
| 5 | Unknown Popup Browser & XSS Verification | Preview `?popup=nope` & `?popup=<h1>XSS</h1>` | text interpolated, no XSS | PASS: captured `05-unknown-popup.png`, verified safe escaping (`raw/01-pnpm-build-check-test.txt`) | 0 |

---

## Screenshots

- **Main Window**: `evidence/sdk-v1/starter-polish/01-main-window.png` (Tauri main window 800x600)
- **Mascot Overlay**: `evidence/sdk-v1/starter-polish/02-mascot-overlay.png` (Floating mascot overlay window 296x296)
- **Radial Menu**: `evidence/sdk-v1/starter-polish/03-radial-menu.png` (Mascot tapped, radial menu items visible)
- **Notes Popup**: `evidence/sdk-v1/starter-polish/04-notes-popup.png` (Notes popup window 320x420)
- **Unknown Popup**: `evidence/sdk-v1/starter-polish/05-unknown-popup.png` (Unknown popup view displaying `Unknown popup: nope`)

---

## Out-of-Scope Findings
- None.

## Contract Questions
- None.

---

READY FOR REVIEW at 24ea3c6bf5a9d345a75021e18191e4ac40a6a675
