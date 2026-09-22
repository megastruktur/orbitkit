<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import Mascot from "./lib/Mascot.svelte";

  let permissionGranted = $state<boolean | null>(null);
  let statusMessage = $state<string>("Ready");
  let lastError = $state<string | null>(null);

  async function checkPermission() {
    try {
      lastError = null;
      statusMessage = "Checking overlay permission...";
      const res = await invoke<boolean>("isOverlayPermissionGranted");
      permissionGranted = res;
      statusMessage = `Permission status: ${res ? "GRANTED" : "NOT GRANTED"}`;
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "Error checking permission";
    }
  }

  async function requestPermission() {
    try {
      lastError = null;
      statusMessage = "Opening overlay permission settings...";
      await invoke("requestOverlayPermission");
      statusMessage = "Settings intent dispatched";
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "Error requesting permission";
    }
  }

  async function showOverlay() {
    try {
      lastError = null;
      statusMessage = "Showing native overlay...";
      await invoke("overlayShow");
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
      await invoke("overlayHide");
      statusMessage = "Overlay hidden";
    } catch (err: any) {
      lastError = String(err?.message || err);
      statusMessage = "overlayHide failed";
    }
  }
</script>

<main>
  <Mascot />
  <h1>orbitkit</h1>
  <p>Native Overlay Debug — Task T04</p>

  <div class="controls-card">
    <div class="status-row">
      <span class="label">SAW Permission:</span>
      <span class="badge" class:granted={permissionGranted === true} class:denied={permissionGranted === false}>
        {permissionGranted === null ? "UNKNOWN" : permissionGranted ? "GRANTED" : "DENIED"}
      </span>
    </div>

    <div class="button-grid">
      <button onclick={checkPermission}>Check Permission</button>
      <button onclick={requestPermission}>Request Permission</button>
      <button class="primary" onclick={showOverlay}>overlayShow</button>
      <button class="secondary" onclick={hideOverlay}>overlayHide</button>
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
    margin: 0 0 1.5rem;
    opacity: 0.7;
    font-size: 0.9rem;
  }

  .controls-card {
    background: #191f28;
    border: 1px solid #2d3748;
    border-radius: 12px;
    padding: 1.25rem;
    max-width: 360px;
    width: 100%;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #2d3748;
  }

  .label {
    font-weight: 500;
    font-size: 0.85rem;
  }

  .badge {
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    background: #4a5568;
    color: #edf2f7;
  }

  .badge.granted {
    background: #059669;
    color: #ffffff;
  }

  .badge.denied {
    background: #dc2626;
    color: #ffffff;
  }

  .button-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  button {
    background: #2b3545;
    color: #e2e8f0;
    border: 1px solid #4a5568;
    border-radius: 8px;
    padding: 0.6rem 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
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

  button.secondary:hover {
    background: #334155;
  }

  .status-box {
    background: #10141a;
    border-radius: 6px;
    padding: 0.6rem;
    font-family: monospace;
    font-size: 0.8rem;
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
