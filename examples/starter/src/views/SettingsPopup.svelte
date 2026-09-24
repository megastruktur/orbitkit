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
    const isStandalone =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("popup");
    if (isStandalone) {
      document.body.classList.add("orbitkit-popup-window");
    }
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
    <svg
      class="header-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#38BDF8"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
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
            class:busy={state === "busy"}
            onclick={() => changeState(state)}
          >
            <span
              class="dot"
              class:dot-active={currentState === state}
              class:dot-busy={state === "busy"}
            ></span>
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
  :global(body.orbitkit-popup-window),
  :global(html:has(body.orbitkit-popup-window)),
  :global(body.orbitkit-popup-window #app) {
    height: 100%;
    margin: 0;
    padding: 0;
  }

  :global(body.orbitkit-popup-window) {
    background: #070b1a;
    color: #e6f6ff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    user-select: none;
    -webkit-user-select: none;
    overflow: hidden;
  }

  .settings-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
    padding: 1rem;
    background:
      radial-gradient(1px 1px at 30px 40px, rgba(230, 246, 255, 0.45), transparent),
      radial-gradient(1.5px 1.5px at 160px 70px, rgba(56, 189, 248, 0.4), transparent),
      radial-gradient(1px 1px at 260px 180px, rgba(167, 139, 250, 0.35), transparent),
      radial-gradient(circle at 50% 20%, #0e1433 0%, #070b1a 100%);
    background-repeat: repeat, repeat, repeat, no-repeat;
    background-size: 300px 240px, 260px 200px, 320px 280px, 100% 100%;
  }

  .settings-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(56, 189, 248, 0.2);
  }

  .header-icon {
    display: block;
    filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.6));
  }

  h2 {
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0;
    color: #e6f6ff;
    letter-spacing: 0.02em;
  }

  .settings-content {
    flex: 1;
    margin: 0.75rem 0;
  }

  .card {
    background: rgba(14, 20, 51, 0.75);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: 10px;
    padding: 1rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .card-title {
    font-size: 0.8125rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #38bdf8;
    margin-bottom: 0.35rem;
  }

  .description {
    font-size: 0.8rem;
    color: #9fb3d9;
    margin: 0 0 1rem;
    line-height: 1.4;
  }

  .state-buttons {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.6rem;
  }

  .state-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: rgba(14, 20, 51, 0.85);
    border: 1px solid rgba(56, 189, 248, 0.25);
    color: #e6f6ff;
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    text-transform: capitalize;
    transition: all 0.15s ease;
  }

  .state-btn:hover {
    background: rgba(56, 189, 248, 0.12);
    border-color: #38bdf8;
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
  }

  .state-btn.active {
    background: rgba(56, 189, 248, 0.2);
    border: 1.5px solid #38bdf8;
    color: #e6f6ff;
    font-weight: 600;
    box-shadow: 0 0 14px rgba(56, 189, 248, 0.4);
  }

  .state-btn.active.busy {
    background: rgba(245, 158, 11, 0.2);
    border-color: #f59e0b;
    box-shadow: 0 0 14px rgba(245, 158, 11, 0.4);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #475569;
    transition: all 0.15s ease;
  }

  .dot.dot-active {
    background: #38bdf8;
    box-shadow: 0 0 8px #38bdf8;
  }

  .dot.dot-active.dot-busy {
    background: #f59e0b;
    box-shadow: 0 0 8px #f59e0b;
  }

  .settings-footer {
    padding-top: 0.5rem;
    border-top: 1px solid rgba(56, 189, 248, 0.15);
  }

  .status-indicator {
    font-size: 0.75rem;
    color: #9fb3d9;
  }
</style>
