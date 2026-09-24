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
    PopupSheet,
    type MenuActionPayload,
  } from "@orbitkit/ui";
  import config from "../orbitkit.config";
  import { popupComponents, popupFallback } from "../popupViews";

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
      const res = await invoke<RecorderState>("plugin:orbitkit-recorder|state");
      recState = res.state;
      recSpoolPath = res.spoolPath;
      recBytesRecorded = res.bytesRecorded;
      recIsForeground = res.isForeground;
    } catch (err: unknown) {
      lastError = formatError(err);
    }
  }

  async function startRecordingS1() {
    try {
      lastError = null;
      statusMessage = "Starting recorder...";
      await invoke("plugin:orbitkit-recorder|start");
      await pollRecorderState();
    } catch (err: unknown) {
      lastError = formatError(err);
      statusMessage = "recorderStart failed";
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

  function clearLogs() {
    actionLogs = [];
    statusMessage = "Event logs cleared";
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
    }).then((fn: (() => void) | undefined) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  });
</script>

<main class="main-container">
  <!-- Hero Section with Mascot, Orbit Rings, and Tagline -->
  <header class="hero">
    <div class="hero-orbit">
      <div class="orbit-ring orbit-ring-1"></div>
      <div class="orbit-ring orbit-ring-2"></div>
      <div class="hero-planet">
        {@html config.mascot.src}
      </div>
    </div>
    <h1>OrbitKit Starter</h1>
    <p class="subtitle">Planetary floating mascot overlay & radial companion app</p>
  </header>

  <div class="cards-column">
    <!-- Card 1: Overlay Controls -->
    <section class="glass-card">
      <div class="section-title">Overlay Controls</div>
      <div class="button-grid">
        <button class="btn btn-primary" id="btn-show-overlay" onclick={handleShowOverlay}>
          Show Overlay
        </button>
        <button class="btn btn-secondary" id="btn-hide-overlay" onclick={handleHideOverlay}>
          Hide Overlay
        </button>
      </div>
    </section>

    <!-- Card 2: Mascot State -->
    <section class="glass-card">
      <div class="section-title">Mascot State</div>
      <div class="button-grid">
        <button class="btn btn-idle" onclick={() => handleSetState("idle")}>
          <span class="dot dot-idle"></span>
          Set Idle
        </button>
        <button class="btn btn-busy" onclick={() => handleSetState("busy")}>
          <span class="dot dot-busy"></span>
          Set Busy
        </button>
      </div>
    </section>

    <!-- Card 3: Android Overlay Permission (Conditional) -->
    {#if isAndroid}
      <section class="glass-card">
        <div class="section-title">Android Overlay Permission</div>
        <div class="status-row">
          <span class="label">Permission Status:</span>
          <span class="val {permissionGranted ? 'granted' : 'denied'}">
            {permissionGranted === null ? "CHECKING..." : permissionGranted ? "GRANTED" : "NOT GRANTED"}
          </span>
        </div>
        <div class="button-grid">
          <button class="btn btn-secondary" onclick={checkPermission}>Check Permission</button>
          <button class="btn btn-secondary" onclick={requestPermission}>Request Permission</button>
        </div>
      </section>
    {/if}

    <!-- Card 4: Recorder Extension (Conditional) -->
    {#if isAndroid && hasRecorderPlugin}
      <section class="glass-card">
        <div class="section-title">Recorder Extension (Android)</div>
        <div class="status-row">
          <span class="label">Rec State:</span>
          <span class="val highlight">{recState} {recIsForeground ? "(FGS)" : ""}</span>
        </div>
        <div class="status-row">
          <span class="label">Bytes Recorded:</span>
          <span class="val">{recBytesRecorded} B</span>
        </div>
        {#if recSpoolPath}
          <div class="status-row">
            <span class="label">Spool Path:</span>
            <span class="val truncate">{recSpoolPath}</span>
          </div>
        {/if}
        <div class="button-grid">
          <button class="btn btn-rec-start" onclick={startRecordingS1}>Start FGS</button>
          <button class="btn btn-secondary" onclick={pollRecorderState}>Poll</button>
          <button class="btn btn-rec-pause" onclick={pauseRecording}>Pause</button>
          <button class="btn btn-rec-resume" onclick={resumeRecording}>Resume</button>
          <button class="btn btn-rec-stop" onclick={stopRecording}>Stop</button>
          <button class="btn btn-rec-standby" onclick={postStandbyNotificationS3b}>Standby Notif</button>
        </div>
        <div class="button-grid button-grid-mt">
          <button class="btn btn-secondary" onclick={queryPersistedState}>Query Persistence</button>
          <button class="btn btn-secondary" onclick={recoverStateManually}>Recover</button>
          <button class="btn btn-secondary" onclick={queryJniLog}>JNI Log ({jniActionCount})</button>
        </div>
        {#if persistedState}
          <div class="status-subrow">
            <span class="label">Persisted:</span>
            <span class="val">{persistedState.state} ({persistedState.bytesRecorded}B)</span>
          </div>
        {/if}
      </section>
    {/if}

    <!-- Card 5: Live Event Log -->
    <section class="glass-card">
      <div class="card-header-row">
        <div class="section-title">Live Event Log</div>
        <div class="header-actions">
          <span class="badge">{actionLogs.length} events</span>
          {#if actionLogs.length > 0}
            <button class="clear-link" onclick={clearLogs}>Clear</button>
          {/if}
        </div>
      </div>
      <div class="log-container">
        {#if actionLogs.length === 0}
          <div class="empty-log">Awaiting menu action events...</div>
        {:else}
          {#each actionLogs as log (log.time + log.id + log.source)}
            <div class="log-item">
              <span class="log-time">{log.time}</span>
              <span class="log-id">{log.id}</span>
              <span class="log-source">({log.source})</span>
            </div>
          {/each}
        {/if}
      </div>
    </section>

    <!-- Telemetry & Status Bar -->
    <footer class="telemetry-bar">
      <div class="telemetry-status">
        <span class="status-prefix">System:</span>
        <span class="status-text">{statusMessage}</span>
      </div>
      {#if lastError}
        <div class="telemetry-error">{lastError}</div>
      {/if}
    </footer>
  </div>
</main>

<PopupSheet components={popupComponents} fallback={popupFallback} />

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #070b1a;
    color: #e6f6ff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    user-select: none;
    -webkit-user-select: none;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .main-container {
    min-height: 100vh;
    box-sizing: border-box;
    padding: 1.25rem 1rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    background:
      radial-gradient(1px 1px at 30px 40px, rgba(230, 246, 255, 0.45), transparent),
      radial-gradient(1.5px 1.5px at 150px 90px, rgba(56, 189, 248, 0.4), transparent),
      radial-gradient(1px 1px at 280px 160px, rgba(167, 139, 250, 0.35), transparent),
      radial-gradient(1.5px 1.5px at 420px 80px, rgba(230, 246, 255, 0.3), transparent),
      radial-gradient(1px 1px at 80px 280px, rgba(56, 189, 248, 0.35), transparent),
      radial-gradient(circle at 50% 15%, #0e1433 0%, #070b1a 100%);
    background-repeat: repeat, repeat, repeat, repeat, repeat, no-repeat;
    background-size: 320px 260px, 380px 300px, 450px 350px, 500px 400px, 300px 300px, 100% 100%;
  }

  .hero {
    text-align: center;
    margin-bottom: 1rem;
  }

  .hero-orbit {
    position: relative;
    width: 64px;
    height: 64px;
    margin: 0 auto 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .orbit-ring {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }

  .orbit-ring-1 {
    width: 72px;
    height: 26px;
    border: 1px solid rgba(56, 189, 248, 0.4);
    transform: rotate(-20deg);
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.2);
  }

  .orbit-ring-2 {
    width: 78px;
    height: 30px;
    border: 1px dashed rgba(167, 139, 250, 0.3);
    transform: rotate(25deg);
  }

  .hero-planet {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.5));
  }

  .hero-planet :global(svg) {
    width: 44px;
    height: 44px;
  }

  h1 {
    font-size: 1.4rem;
    margin: 0 0 0.2rem;
    color: #e6f6ff;
    letter-spacing: 0.02em;
  }

  .subtitle {
    font-size: 0.8rem;
    color: #9fb3d9;
    margin: 0;
    line-height: 1.3;
  }

  .cards-column {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 440px;
  }

  .glass-card {
    background: rgba(14, 20, 51, 0.75);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: 12px;
    padding: 0.875rem 1rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(230, 246, 255, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-sizing: border-box;
  }

  .section-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #38bdf8;
    margin-bottom: 0.5rem;
    font-weight: 700;
  }

  .card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .card-header-row .section-title {
    margin-bottom: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .badge {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #38bdf8;
  }

  .clear-link {
    background: transparent;
    border: none;
    color: #9fb3d9;
    font-size: 0.7rem;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }

  .clear-link:hover {
    color: #e6f6ff;
  }

  .button-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .button-grid-mt {
    margin-top: 0.5rem;
  }

  .btn {
    border-radius: 7px;
    padding: 0.55rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    transition: all 0.15s ease;
    box-sizing: border-box;
    text-align: center;
  }

  .btn:active {
    transform: scale(0.98);
  }

  .btn-primary {
    background: #0369a1;
    color: #e6f6ff;
    border: 1px solid #38bdf8;
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);
  }

  .btn-primary:hover {
    background: #0284c7;
    border-color: #7dd3fc;
    box-shadow: 0 0 14px rgba(56, 189, 248, 0.5);
  }

  .btn-secondary {
    background: rgba(14, 20, 51, 0.85);
    color: #e6f6ff;
    border: 1px solid rgba(56, 189, 248, 0.25);
  }

  .btn-secondary:hover {
    background: rgba(56, 189, 248, 0.12);
    border-color: #38bdf8;
  }

  .btn-idle {
    background: rgba(14, 20, 51, 0.85);
    color: #e6f6ff;
    border: 1px solid rgba(56, 189, 248, 0.35);
  }

  .btn-idle:hover {
    background: rgba(56, 189, 248, 0.15);
    border-color: #38bdf8;
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);
  }

  .btn-busy {
    background: rgba(14, 20, 51, 0.85);
    color: #e6f6ff;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .btn-busy:hover {
    background: rgba(245, 158, 11, 0.15);
    border-color: #f59e0b;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .dot-idle {
    background: #38bdf8;
    box-shadow: 0 0 6px #38bdf8;
  }

  .dot-busy {
    background: #f59e0b;
    box-shadow: 0 0 6px #f59e0b;
  }

  .btn-rec-start {
    background: #dc2626;
    color: #ffffff;
    border: 1px solid #ef4444;
  }

  .btn-rec-start:hover {
    background: #ef4444;
  }

  .btn-rec-pause {
    background: #b45309;
    color: #ffffff;
    border: 1px solid #d97706;
  }

  .btn-rec-resume {
    background: #15803d;
    color: #ffffff;
    border: 1px solid #22c55e;
  }

  .btn-rec-stop {
    background: rgba(14, 20, 51, 0.85);
    color: #e6f6ff;
    border: 1px solid #64748b;
  }

  .btn-rec-standby {
    background: #7c3aed;
    color: #ffffff;
    border: 1px solid #a78bfa;
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8125rem;
    margin: 0.35rem 0;
  }

  .status-subrow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    margin-top: 0.35rem;
    padding-top: 0.25rem;
    border-top: 1px dashed rgba(56, 189, 248, 0.15);
  }

  .label {
    color: #9fb3d9;
  }

  .val {
    color: #e6f6ff;
    font-weight: 500;
  }

  .val.granted {
    color: #38bdf8;
    font-weight: 600;
  }

  .val.denied {
    color: #fca5a5;
    font-weight: 600;
  }

  .val.highlight {
    color: #38bdf8;
  }

  .truncate {
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .log-container {
    background: rgba(7, 11, 26, 0.7);
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: 8px;
    padding: 0.5rem 0.65rem;
    max-height: 120px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .empty-log {
    color: #9fb3d9;
    font-style: italic;
    font-size: 0.75rem;
    padding: 0.25rem 0;
    text-align: center;
  }

  .log-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.15rem 0;
    border-bottom: 1px solid rgba(56, 189, 248, 0.08);
  }

  .log-item:last-child {
    border-bottom: none;
  }

  .log-time {
    color: #9fb3d9;
    font-size: 0.7rem;
  }

  .log-id {
    color: #38bdf8;
    font-weight: 600;
  }

  .log-source {
    color: #a78bfa;
    font-size: 0.7rem;
  }

  .telemetry-bar {
    background: rgba(7, 11, 26, 0.75);
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    min-height: 2rem;
    box-sizing: border-box;
  }

  .telemetry-status {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .status-prefix {
    color: #38bdf8;
    font-weight: 600;
  }

  .status-text {
    color: #9fb3d9;
  }

  .telemetry-error {
    color: #fca5a5;
    margin-top: 0.25rem;
    font-weight: 500;
  }
</style>
