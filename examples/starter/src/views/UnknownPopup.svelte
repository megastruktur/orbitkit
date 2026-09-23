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

  .unknown-popup-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    box-sizing: border-box;
    padding: 1.5rem;
    background: #1e293b;
  }

  .unknown-popup-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 320px;
    width: 100%;
    box-sizing: border-box;
  }

  .icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: #f87171;
    word-break: break-word;
  }

  .description {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
    word-break: break-word;
  }
</style>
