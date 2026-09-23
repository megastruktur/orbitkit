<script lang="ts">
  import { onMount } from "svelte";

  const STORAGE_KEY = "orbitkit_starter_notes";

  let noteText = $state<string>("");
  let savedStatus = $state<string>("Loaded");

  onMount(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        noteText = saved;
      }
    } catch (e) {
      console.error("Failed to read from localStorage:", e);
    }
  });

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    noteText = target.value;
    try {
      localStorage.setItem(STORAGE_KEY, noteText);
      savedStatus = "Saved";
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
      savedStatus = "Save failed";
    }
  }

  function handleClear() {
    noteText = "";
    try {
      localStorage.removeItem(STORAGE_KEY);
      savedStatus = "Cleared";
    } catch (e) {
      console.error("Failed to clear localStorage:", e);
    }
  }
</script>

<main class="popup-container">
  <div class="popup-header">
    <div class="title-row">
      <span class="icon">📝</span>
      <h2>Quick Notes</h2>
    </div>
    <span class="status-badge">{savedStatus}</span>
  </div>

  <div class="editor-area">
    <textarea
      placeholder="Type your notes here... (persisted in localStorage)"
      value={noteText}
      oninput={handleInput}
      rows="12"
      aria-label="Notes content"
    ></textarea>
  </div>

  <div class="popup-footer">
    <span class="char-count">{noteText.length} characters</span>
    <button class="clear-btn" onclick={handleClear}>Clear</button>
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

  .popup-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    box-sizing: border-box;
    padding: 0.75rem;
    background: #1e293b;
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #334155;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
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

  .status-badge {
    font-size: 0.7rem;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
    background: #334155;
    color: #94a3b8;
  }

  .editor-area {
    flex: 1;
    margin: 0.6rem 0;
    display: flex;
  }

  textarea {
    width: 100%;
    height: 100%;
    resize: none;
    background: #0f172a;
    color: #f8fafc;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 0.6rem;
    font-family: inherit;
    font-size: 0.875rem;
    line-height: 1.4;
    box-sizing: border-box;
    outline: none;
    user-select: text;
    -webkit-user-select: text;
  }

  textarea:focus {
    border-color: #38bdf8;
  }

  .popup-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.4rem;
    border-top: 1px solid #334155;
  }

  .char-count {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .clear-btn {
    background: #334155;
    border: 1px solid #475569;
    color: #f8fafc;
    border-radius: 4px;
    padding: 0.25rem 0.6rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .clear-btn:hover {
    background: #dc2626;
    border-color: #ef4444;
  }
</style>
