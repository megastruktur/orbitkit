<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import {
    showOverlay,
    hideOverlay,
    overlayPermission,
    requestOverlayPermission,
    onMenuAction,
    setMascotState,
    type MenuActionPayload,
  } from "@orbitkit/ui";
  import config from "../orbitkit.config";

  interface LogEntry {
    id: string;
    source: string;
    time: string;
  }

  interface RecorderState {
    state: string;
    spoolPath: string;
    bytesRecorded: number;
    isForeground: boolean;
  }

  interface PersistedStateInfo {
    state: string;
    bytesRecorded: number;
    spoolPath: string;
    recoveryCount: number;
    lastRecoveredAt: number;
    isForeground: boolean;
    processPid: number;
    lastAction: string;
  }
  interface JniActionRecord {
    receiptId: number;
    id: string;
    source: string;
  }


  let permissionGranted = $state<boolean | null>(null);
  let statusMessage = $state<string>("Ready");
  let lastError = $state<string | null>(null);
  let actionLogs = $state<LogEntry[]>([]);

  // Platform detection: show recorder UI strictly on Android
  const isAndroid =
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  // Recorder state (Android only)
  let hasRecorderPlugin = $state<boolean>(false);
  let recState = $state<string>("IDLE");
  let recSpoolPath = $state<string>("");
  let recBytesRecorded = $state<number>(0);
  let recIsForeground = $state<boolean>(false);
  let persistedState = $state<PersistedStateInfo | null>(null);
  let jniActionCount = $state<number>(0);

  function formatError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null && "message" in err) {
      return String((err as { message: unknown }).message);
    }
    return String(err);
  }

  async function checkPermission() {
    try {
      lastError = null;
      statusMessage = "Checking overlay permission...";
      const granted = await overlayPermission();
      permissionGranted = granted;
      statusMessage = `Overlay permission: ${granted ? "GRANTED" : "NOT GRANTED"}`;
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "Error checking overlay permission";
    }
  }

  async function requestPermission() {
    try {
      lastError = null;
      statusMessage = "Requesting overlay permission...";
      await requestOverlayPermission();
      await checkPermission();
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "Error requesting overlay permission";
    }
  }

  async function handleShowOverlay() {
    try {
      lastError = null;
      statusMessage = "Showing overlay...";
      await showOverlay({
        menu: config.menu,
        mascot: { size: config.mascot.size },
      });
      statusMessage = "Overlay displayed";
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "Failed to show overlay";
    }
  }

  async function handleHideOverlay() {
    try {
      lastError = null;
      statusMessage = "Hiding overlay...";
      await hideOverlay();
      statusMessage = "Overlay hidden";
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "Failed to hide overlay";
    }
  }

  async function handleSetState(state: string) {
    try {
      lastError = null;
      statusMessage = `Setting mascot state to: ${state}...`;
      await setMascotState(state);
      statusMessage = `Mascot state set to: ${state}`;
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "Failed to set mascot state";
    }
  }

  // Recorder commands (retained for Android feature compatibility)
  async function checkRecorderPlugin() {
    if (!isAndroid) return;
    try {
      const res = await invoke<RecorderState>("plugin:orbitkit-recorder|state");
      hasRecorderPlugin = true;
      recState = res.state;
      recSpoolPath = res.spoolPath;
      recBytesRecorded = res.bytesRecorded;
      recIsForeground = res.isForeground;
    } catch {
      hasRecorderPlugin = false;
    }
  }

  async function pollRecorderState() {
    try {
      lastError = null;
      const res = await invoke<RecorderState>("plugin:orbitkit-recorder|state");
      recState = res.state;
      recSpoolPath = res.spoolPath;
      recBytesRecorded = res.bytesRecorded;
      recIsForeground = res.isForeground;
      statusMessage = `Recorder state: ${res.state} | ${res.bytesRecorded} bytes`;
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "recorderState query failed";
    }
  }

  async function startRecordingS1() {
    try {
      lastError = null;
      statusMessage = "Starting mic-FGS from visible Activity...";
      await invoke("plugin:orbitkit-recorder|start_foreground");
      statusMessage = "recorderStartForeground invoked successfully";
      await pollRecorderState();
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "recorderStartForeground failed";
    }
  }

  async function pauseRecording() {
    try {
      lastError = null;
      statusMessage = "Pausing recorder...";
      await invoke("plugin:orbitkit-recorder|pause");
      await pollRecorderState();
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "recorderPause failed";
    }
  }

  async function resumeRecording() {
    try {
      lastError = null;
      statusMessage = "Resuming recorder...";
      await invoke("plugin:orbitkit-recorder|resume");
      await pollRecorderState();
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "recorderResume failed";
    }
  }

  async function stopRecording() {
    try {
      lastError = null;
      statusMessage = "Stopping recorder...";
      await invoke("plugin:orbitkit-recorder|stop");
      await pollRecorderState();
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "recorderStop failed";
    }
  }

  async function postStandbyNotificationS3b() {
    try {
      lastError = null;
      await invoke("plugin:orbitkit-recorder|post_standby_notification");
      statusMessage = "Posted S3b standby notification";
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "Failed to post standby notification";
    }
  }

  async function queryPersistedState() {
    try {
      lastError = null;
      const res = await invoke<PersistedStateInfo>(
        "plugin:orbitkit-recorder|get_persisted_state"
      );
      persistedState = res;
      statusMessage = `Persisted: ${res.state} | ${res.bytesRecorded}B | recovCount=${res.recoveryCount}`;
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "Query persisted state failed";
    }
  }

  async function recoverStateManually() {
    try {
      lastError = null;
      const res = await invoke<PersistedStateInfo>(
        "plugin:orbitkit-recorder|recover_state"
      );
      persistedState = res;
      statusMessage = `Recovered: ${res.state} | ${res.bytesRecorded}B`;
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "Recover state failed";
    }
  }

  async function queryJniLog() {
    try {
      lastError = null;
      const res = await invoke<JniActionRecord[]>("jni_get_action_log");
      jniActionCount = res.length;
      statusMessage = `JNI records: ${res.length}`;
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "Query JNI log failed";
    }
  }

  onMount(() => {
    checkPermission();
    if (isAndroid) {
      checkRecorderPlugin();
    }

    let unlisten: (() => void) | undefined;
    onMenuAction((payload: MenuActionPayload) => {
      const entry: LogEntry = {
        id: payload.id,
        source: payload.source,
        time: new Date().toLocaleTimeString(),
      };
      actionLogs = [entry, ...actionLogs.slice(0, 49)];
      statusMessage = `Menu action received: ${payload.id} (${payload.source})`;
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  });
</script>

<main>
  <div class="header">
    <h1>OrbitKit Starter</h1>
    <p class="subtitle">Floating mascot overlay & radial menu companion app</p>
  </div>

  <div class="controls-card">
    <div class="section-title">Overlay Controls</div>
    <div class="button-grid">
      <button class="primary" id="btn-show-overlay" onclick={handleShowOverlay}>
        Show Overlay
      </button>
      <button class="secondary" id="btn-hide-overlay" onclick={handleHideOverlay}>
        Hide Overlay
      </button>
    </div>

    {#if isAndroid}
      <div class="section-title">Android Overlay Permission</div>
      <div class="status-row">
        <span class="label">Permission:</span>
        <span class="val {permissionGranted ? 'granted' : 'denied'}">
          {permissionGranted === null ? "..." : permissionGranted ? "GRANTED" : "NOT GRANTED"}
        </span>
      </div>
      <div class="button-grid">
        <button onclick={checkPermission}>Check Permission</button>
        <button onclick={requestPermission}>Request Permission</button>
      </div>
    {/if}

    <div class="section-title">Mascot State</div>
    <div class="button-grid">
      <button onclick={() => handleSetState("idle")}>Set Idle</button>
      <button onclick={() => handleSetState("busy")}>Set Busy</button>
    </div>

    {#if isAndroid && hasRecorderPlugin}
      <div class="section-title">Recorder Extension (Android)</div>
      <div class="status-row">
        <span class="label">Rec State:</span>
        <span class="val highlight">{recState} {recIsForeground ? "(FGS)" : ""}</span>
      </div>
      <div class="status-row">
        <span class="label">Bytes:</span>
        <span class="val">{recBytesRecorded}</span>
      </div>
      {#if recSpoolPath}
        <div class="status-row">
          <span class="label">Spool:</span>
          <span class="val">{recSpoolPath}</span>
        </div>
      {/if}
      <div class="button-grid">
        <button class="rec-start" onclick={startRecordingS1}>Start FGS</button>
        <button onclick={pollRecorderState}>Poll</button>
        <button class="rec-pause" onclick={pauseRecording}>Pause</button>
        <button class="rec-resume" onclick={resumeRecording}>Resume</button>
        <button class="rec-stop" onclick={stopRecording}>Stop</button>
        <button class="rec-standby" onclick={postStandbyNotificationS3b}>Standby Notif</button>
      </div>
      <div class="button-grid" style="margin-top: 0.5rem;">
        <button onclick={queryPersistedState}>Query Persistence</button>
        <button onclick={recoverStateManually}>Recover</button>
        <button onclick={queryJniLog}>JNI Log ({jniActionCount})</button>
      </div>
      {#if persistedState}
        <div class="status-subrow">
          <span class="sublabel">Persisted:</span>
          <span class="subval">{persistedState.state} ({persistedState.bytesRecorded}B)</span>
        </div>
      {/if}
    {/if}

    <div class="section-title">Menu Action Log</div>
    <div class="log-container">
      {#if actionLogs.length === 0}
        <div class="empty-log">No menu actions received yet</div>
      {:else}
        {#each actionLogs as log}
          <div class="log-item">
            <span class="log-time">{log.time}</span>
            <span class="log-id">{log.id}</span>
            <span class="log-source">[{log.source}]</span>
          </div>
        {/each}
      {/if}
    </div>

    <div class="status-box">
      <div class="status-text">{statusMessage}</div>
      {#if lastError}
        <div class="error-text">{lastError}</div>
      {/if}
    </div>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #0f172a;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }

  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 1.5rem;
    box-sizing: border-box;
  }

  .header {
    text-align: center;
    margin-bottom: 1.25rem;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
    color: #38bdf8;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0;
  }

  .controls-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 1.25rem;
    max-width: 440px;
    width: 100%;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    box-sizing: border-box;
  }

  .section-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    margin: 1rem 0 0.5rem;
    font-weight: 700;
  }

  .section-title:first-child {
    margin-top: 0;
  }

  .button-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  button {
    background: #334155;
    color: #f8fafc;
    border: 1px solid #475569;
    border-radius: 6px;
    padding: 0.55rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  button:hover {
    background: #475569;
    border-color: #64748b;
  }

  button.primary {
    background: #0284c7;
    border-color: #0369a1;
  }

  button.primary:hover {
    background: #0369a1;
  }

  button.secondary {
    background: #475569;
    border-color: #64748b;
  }

  button.rec-start {
    background: #dc2626;
    border-color: #b91c1c;
  }

  button.rec-pause {
    background: #d97706;
    border-color: #b45309;
  }

  button.rec-resume {
    background: #16a34a;
    border-color: #15803d;
  }

  button.rec-stop {
    background: #475569;
  }

  button.rec-standby {
    background: #7c3aed;
    border-color: #6d28d9;
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.8125rem;
    margin: 0.35rem 0;
  }

  .status-subrow {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.35rem;
  }

  .label {
    color: #94a3b8;
  }

  .val.granted {
    color: #4ade80;
    font-weight: 600;
  }

  .val.denied {
    color: #f87171;
    font-weight: 600;
  }

  .val.highlight {
    color: #38bdf8;
    font-weight: 600;
  }

  .log-container {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 0.5rem;
    max-height: 120px;
    overflow-y: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
  }

  .empty-log {
    color: #64748b;
    text-align: center;
    padding: 0.75rem;
  }

  .log-item {
    display: flex;
    gap: 0.5rem;
    padding: 0.2rem 0;
    border-bottom: 1px solid #1e293b;
  }

  .log-time {
    color: #64748b;
  }

  .log-id {
    color: #38bdf8;
    font-weight: 600;
  }

  .log-source {
    color: #a855f7;
  }

  .status-box {
    margin-top: 1rem;
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    min-height: 2rem;
  }

  .status-text {
    color: #94a3b8;
  }

  .error-text {
    color: #f87171;
    margin-top: 0.25rem;
  }
</style>
