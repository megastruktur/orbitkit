<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import Mascot from "./lib/Mascot.svelte";

  interface RecorderState {
    state: string;
    spoolPath: string;
    bytesRecorded: number;
    isForeground: boolean;
  }

  let permissionGranted = $state<boolean | null>(null);
  let statusMessage = $state<string>("Ready");
  let lastError = $state<string | null>(null);

  let recState = $state<string>("IDLE");
  let recSpoolPath = $state<string>("");
  let recBytesRecorded = $state<number>(0);
  let recIsForeground = $state<boolean>(false);

  let hasRecorderPlugin = $state<boolean>(false);

  async function checkRecorderPlugin() {
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

  onMount(() => {
    checkPermission();
    checkRecorderPlugin();
  });
  async function checkPermission() {
    try {
      lastError = null;
      statusMessage = "Checking overlay permission...";
      const res = await invoke<{ granted: boolean }>("plugin:orbitkit|overlay_permission");
      permissionGranted = res.granted;
      statusMessage = `Overlay permission: ${res.granted ? "GRANTED" : "NOT GRANTED"}`;
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "Error checking overlay permission";
    }
  }

  async function requestPermission() {
    try {
      lastError = null;
      statusMessage = "Opening overlay permission settings...";
      await invoke("plugin:orbitkit|request_overlay_permission");
      statusMessage = "Settings intent dispatched";
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "Error requesting overlay permission";
    }
  }

  async function showOverlay() {
    try {
      lastError = null;
      statusMessage = "Showing native overlay...";
      await invoke("plugin:orbitkit|show_overlay");
      statusMessage = "Overlay displayed successfully";
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "overlayShow failed";
    }
  }

  async function hideOverlay() {
    try {
      lastError = null;
      statusMessage = "Hiding native overlay...";
      await invoke("plugin:orbitkit|hide_overlay");
      statusMessage = "Overlay hidden";
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "overlayHide failed";
    }
  }

  // Recorder commands
  async function pollState() {
    try {
      lastError = null;
      const res = await invoke<RecorderState>("plugin:orbitkit-recorder|state");
      recState = res.state;
      recSpoolPath = res.spoolPath;
      recBytesRecorded = res.bytesRecorded;
      recIsForeground = res.isForeground;
      statusMessage = `Recorder state: ${res.state} | ${res.bytesRecorded} bytes`;
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "recorderState query failed";
    }
  }

  async function startRecordingS1() {
    try {
      lastError = null;
      statusMessage = "Starting mic-FGS from visible Activity (S1)...";
      await invoke("plugin:orbitkit-recorder|start_foreground");
      statusMessage = "recorderStartForeground invoked successfully";
      await pollState();
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "recorderStartForeground failed";
    }
  }

  async function pauseRecording() {
    try {
      lastError = null;
      statusMessage = "Pausing recorder (internal AudioRecord stop)...";
      await invoke("plugin:orbitkit-recorder|pause");
      statusMessage = "recorderPause invoked";
      await pollState();
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "recorderPause failed";
    }
  }

  async function resumeRecording() {
    try {
      lastError = null;
      statusMessage = "Resuming recorder (AudioRecord start)...";
      await invoke("plugin:orbitkit-recorder|resume");
      statusMessage = "recorderResume invoked";
      await pollState();
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "recorderResume failed";
    }
  }

  async function stopRecording() {
    try {
      lastError = null;
      statusMessage = "Stopping recorder and FGS...";
      await invoke("plugin:orbitkit-recorder|stop");
      statusMessage = "recorderStop invoked";
      await pollState();
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "recorderStop failed";
    }
  }

  async function postStandbyNotificationS3b() {
    try {
      lastError = null;
      statusMessage = "Posting standby notification for S3b candidate test...";
      await invoke("plugin:orbitkit-recorder|post_standby_notification");
      statusMessage = "S3b standby notification posted. Background app & tap START in notification.";
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "Failed to post standby notification";
    }
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
    rawJson?: string;
  }

  let persistedState = $state<PersistedStateInfo | null>(null);
  let jniActionCount = $state<number>(0);

  async function queryPersistedState() {
    try {
      lastError = null;
      statusMessage = "Querying C4 persistence file...";
      const res = await invoke<PersistedStateInfo>("plugin:orbitkit-recorder|get_persisted_state");
      persistedState = res;
      statusMessage = `C4 Persisted: ${res.state} | ${res.bytesRecorded}B | pid=${res.processPid} | recovCount=${res.recoveryCount}`;
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "Query persisted state failed";
    }
  }

  async function recoverStateManually() {
    try {
      lastError = null;
      statusMessage = "Recovering C4 state...";
      const res = await invoke<PersistedStateInfo>("plugin:orbitkit-recorder|recover_state");
      persistedState = res;
      statusMessage = `C4 Recovered: ${res.state} | ${res.bytesRecorded}B | recoveryCount=${res.recoveryCount}`;
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "Recover state failed";
    }
  }

  async function queryJniLog() {
    try {
      lastError = null;
      statusMessage = "Querying JNI action log...";
      const res = await invoke<any[]>("jni_get_action_log");
      jniActionCount = res.length;
      statusMessage = `JNI actions received in Rust: ${res.length}`;
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "Query JNI log failed";
    }
  }
</script>

<main>
  <Mascot />
  <h1>orbitkit</h1>
  <p>Survival & JNI Bridge under WebView Suspension — Task T06</p>

  <div class="controls-card">
    <div class="status-row">
      <span class="label">SAW Permission:</span>
      <span class="badge" class:granted={permissionGranted === true} class:denied={permissionGranted === false}>
        {permissionGranted === null ? "UNKNOWN" : permissionGranted ? "GRANTED" : "DENIED"}
      </span>
    </div>

    {#if hasRecorderPlugin}
      <div class="status-row">
        <span class="label">Recorder State:</span>
        <span class="badge" class:granted={recState === "RECORDING"} class:paused={recState === "PAUSED"} class:denied={recState === "STOPPED" || recState === "IDLE"}>
          {recState} {recIsForeground ? "(FGS)" : ""}
        </span>
      </div>

      <div class="status-subrow">
        <span class="sublabel">Bytes Spooled:</span>
        <span class="subval">{recBytesRecorded.toLocaleString()} B</span>
      </div>

      {#if recSpoolPath}
        <div class="status-subrow">
          <span class="sublabel">Spool File:</span>
          <span class="subval path">{recSpoolPath}</span>
        </div>
      {/if}
    {/if}

    <div class="section-title">Overlay Controls</div>
    <div class="button-grid">
      <button onclick={checkPermission}>Check SAW</button>
      <button onclick={requestPermission}>Request SAW</button>
      <button class="primary" onclick={showOverlay}>overlayShow</button>
      <button class="secondary" onclick={hideOverlay}>overlayHide</button>
    </div>

    {#if hasRecorderPlugin}
      <div class="section-title">Mic-FGS Scenario Actions</div>
      <div class="button-grid">
        <button class="rec-start" onclick={startRecordingS1}>S1: Start FGS</button>
        <button onclick={pollState}>Poll State</button>
        <button class="rec-pause" onclick={pauseRecording}>S2: Pause</button>
        <button class="rec-resume" onclick={resumeRecording}>S2: Resume</button>
        <button class="rec-stop" onclick={stopRecording}>S2: Stop</button>
        <button class="rec-standby" onclick={postStandbyNotificationS3b}>S3b: Standby Notif</button>
      </div>

      <div class="section-title">C4 Persistence</div>
      <div class="button-grid">
        <button onclick={queryPersistedState}>Query State File</button>
        <button onclick={recoverStateManually}>Recover State</button>
      </div>

      {#if persistedState}
        <div class="status-subrow">
          <span class="sublabel">Persisted:</span>
          <span class="subval">{persistedState.state} ({persistedState.bytesRecorded}B, recov={persistedState.recoveryCount})</span>
        </div>
        <div class="status-subrow">
          <span class="sublabel">Last Action:</span>
          <span class="subval">{persistedState.lastAction}</span>
        </div>
      {/if}
      <div class="scenario-hints">
        <div class="hint"><strong>S1:</strong> Start FGS from visible Activity.</div>
        <div class="hint"><strong>S2:</strong> Background app; use overlay buttons to Pause/Resume/Stop.</div>
        <div class="hint"><strong>S3:</strong> Background app; tap START on overlay (cold start gate).</div>
        <div class="hint"><strong>S3b:</strong> Tap Standby Notif; background app; tap START in notification.</div>
      </div>
    {/if}

    <div class="section-title">JNI Bridge</div>
    <div class="button-grid">
      <button onclick={queryJniLog}>Query JNI ({jniActionCount})</button>
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
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
    padding: 1rem;
    background: #10141a;
    color: #e6e9ef;
    font-family: system-ui, sans-serif;
    text-align: center;
    box-sizing: border-box;
  }

  h1 {
    margin: 0.5rem 0 0.25rem;
    font-size: 1.75rem;
  }

  p {
    margin: 0 0 1rem;
    opacity: 0.7;
    font-size: 0.85rem;
  }

  .controls-card {
    background: #191f28;
    border: 1px solid #2d3748;
    border-radius: 12px;
    padding: 1.1rem;
    max-width: 380px;
    width: 100%;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    text-align: left;
  }

  .section-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    margin: 0.75rem 0 0.4rem;
    font-weight: 700;
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .status-subrow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #94a3b8;
    margin-bottom: 0.35rem;
  }

  .subval.path {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
  }

  .label {
    font-weight: 600;
    font-size: 0.85rem;
  }

  .badge {
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    background: #4a5568;
    color: #edf2f7;
  }

  .badge.granted {
    background: #059669;
    color: #ffffff;
  }

  .badge.paused {
    background: #d97706;
    color: #ffffff;
  }

  .badge.denied {
    background: #dc2626;
    color: #ffffff;
  }

  .button-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.45rem;
    margin-bottom: 0.5rem;
  }

  button {
    background: #2b3545;
    color: #e2e8f0;
    border: 1px solid #4a5568;
    border-radius: 8px;
    padding: 0.55rem 0.4rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    text-align: center;
  }

  button:hover {
    background: #3b4759;
  }

  button.primary {
    background: #2563eb;
    border-color: #3b82f6;
    color: #ffffff;
  }

  button.primary:hover {
    background: #1d4ed8;
  }

  button.secondary {
    background: #475569;
    border-color: #64748b;
  }

  button.rec-start {
    background: #dc2626;
    border-color: #ef4444;
    color: #ffffff;
  }

  button.rec-start:hover {
    background: #b91c1c;
  }

  button.rec-pause {
    background: #d97706;
    border-color: #f59e0b;
    color: #ffffff;
  }

  button.rec-resume {
    background: #059669;
    border-color: #10b981;
    color: #ffffff;
  }

  button.rec-stop {
    background: #475569;
    border-color: #64748b;
  }

  button.rec-standby {
    background: #7c3aed;
    border-color: #8b5cf6;
    color: #ffffff;
  }

  .scenario-hints {
    background: #121820;
    border: 1px solid #232d3d;
    border-radius: 6px;
    padding: 0.5rem 0.6rem;
    margin: 0.6rem 0;
    font-size: 0.72rem;
    color: #94a3b8;
    line-height: 1.4;
  }

  .status-box {
    background: #10141a;
    border-radius: 6px;
    padding: 0.5rem;
    font-family: monospace;
    font-size: 0.75rem;
    min-height: 2.2rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    word-break: break-all;
  }

  .status-text {
    color: #94a3b8;
  }

  .error-text {
    color: #f87171;
    margin-top: 0.25rem;
  }
</style>
