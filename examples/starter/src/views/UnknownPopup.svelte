<script lang="ts">
  import { onMount } from "svelte";

  let { id = "" }: { id?: string } = $props();

  const popupId = $derived(
    id ||
      (typeof window !== "undefined"
        ? (new URLSearchParams(window.location.search).get("popup") ?? "")
        : "")
  );

  onMount(() => {
    const isStandalone =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("popup");
    if (isStandalone) {
      document.body.classList.add("orbitkit-popup-window");
    }
  });
</script>

<main class="unknown-popup-container">
  <div class="unknown-popup-card">
    <svg
      class="warning-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#F59E0B"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path
        d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
      />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
    <h2>Unknown Popup</h2>
    <span class="popup-id-chip">"{popupId}"</span>
    <p class="description">No popup view is registered for this identifier.</p>
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

  .unknown-popup-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
    padding: 1.5rem;
    background:
      radial-gradient(1px 1px at 30px 40px, rgba(230, 246, 255, 0.45), transparent),
      radial-gradient(1.5px 1.5px at 160px 70px, rgba(56, 189, 248, 0.4), transparent),
      radial-gradient(1px 1px at 260px 180px, rgba(167, 139, 250, 0.35), transparent),
      radial-gradient(circle at 50% 30%, #0e1433 0%, #070b1a 100%);
    background-repeat: repeat, repeat, repeat, no-repeat;
    background-size: 300px 240px, 260px 200px, 320px 280px, 100% 100%;
  }

  .unknown-popup-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    background: rgba(14, 20, 51, 0.85);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 12px;
    padding: 1.5rem;
    max-width: 300px;
    width: 100%;
    box-sizing: border-box;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .warning-icon {
    margin-bottom: 0.75rem;
    filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.5));
  }

  h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 0.4rem 0;
    color: #e6f6ff;
  }

  .popup-id-chip {
    display: inline-block;
    font-family: monospace;
    font-size: 0.8rem;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    margin-bottom: 0.75rem;
    word-break: break-all;
  }

  .description {
    font-size: 0.8125rem;
    color: #9fb3d9;
    margin: 0;
    line-height: 1.4;
  }
</style>
