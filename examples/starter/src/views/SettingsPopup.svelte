<script lang="ts">
  import { onMount } from "svelte";
  import { setMascotState, onMascotState } from "@orbitkit/ui";
  import config from "../orbitkit.config";

  let currentState = $state<string>("idle");
  let statusText = $state<string>("Ready");

  const configuredStates = Object.keys(config.mascot.states ?? {});
  const availableStates = configuredStates.length > 0 ? configuredStates : ["idle"];

  async function changeState(newState: string) {
    try {
      statusText = `Switching to ${newState}...`;
      await setMascotState(newState);
      currentState = newState;
      statusText = `Mascot state: ${newState}`;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      statusText = `Error: ${msg}`;
    }
  }

  onMount(() => {
    let unlisten: (() => void) | undefined;
    onMascotState((payload) => {
      if (payload && payload.state) {
        currentState = payload.state;
        statusText = `Current state: ${payload.state}`;
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  });
</script>

<main class="settings-container">
  <div class="settings-header">
    <span class="icon">⚙️</span>
    <h2>Settings</h2>
  </div>

  <div class="settings-content">
    <div class="card">
      <div class="card-title">Mascot State</div>
      <p class="description">Select the active animation state for the overlay mascot:</p>

      <div class="state-buttons">
        {#each availableStates as state}
          <button
            class="state-btn"
            class:active={currentState === state}
            onclick={() => changeState(state)}
          >
            <span class="dot" class:dot-active={currentState === state}></span>
            {state}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="settings-footer">
    <span class="status-indicator">{statusText}</span>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #0f172a;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    user-select: none;
    -webkit-user-select: none;
  }

  .settings-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    box-sizing: border-box;
    padding: 0.75rem;
    background: #1e293b;
  }

  .settings-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #334155;
  }

  .icon {
    font-size: 1.1rem;
  }

  h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: #38bdf8;
  }

  .settings-content {
    flex: 1;
    margin: 0.6rem 0;
  }

  .card {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 0.75rem;
  }

  .card-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #e2e8f0;
    margin-bottom: 0.25rem;
  }

  .description {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0 0 0.75rem;
  }

  .state-buttons {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .state-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: #1e293b;
    border: 1px solid #334155;
    color: #f8fafc;
    border-radius: 6px;
    padding: 0.5rem 0.6rem;
    font-size: 0.8125rem;
    cursor: pointer;
    text-transform: capitalize;
    transition: all 0.15s ease;
  }

  .state-btn:hover {
    background: #334155;
    border-color: #475569;
  }

  .state-btn.active {
    background: #0369a1;
    border-color: #38bdf8;
    font-weight: 600;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #64748b;
  }

  .dot.dot-active {
    background: #38bdf8;
    box-shadow: 0 0 6px #38bdf8;
  }

  .settings-footer {
    padding-top: 0.4rem;
    border-top: 1px solid #334155;
  }

  .status-indicator {
    font-size: 0.75rem;
    color: #94a3b8;
  }
</style>
