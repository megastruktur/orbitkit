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
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M10 9H8" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
      </svg>
      <h2>Quick Notes</h2>
    </div>
    <span
      class="status-badge"
      class:saved={savedStatus === "Saved"}
      class:cleared={savedStatus === "Cleared"}
    >
      {savedStatus}
    </span>
  </div>

  <div class="editor-area">
    <textarea
      value={noteText}
      oninput={handleInput}
      placeholder="Type your notes here... (auto-saved to localStorage)"
      rows="10"
      aria-label="Notes input"
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
    background: #070b1a;
    color: #e6f6ff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    user-select: none;
    -webkit-user-select: none;
    overflow: hidden;
  }

  .popup-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    box-sizing: border-box;
    padding: 1rem;
    background:
      radial-gradient(1px 1px at 20px 30px, rgba(230, 246, 255, 0.45), transparent),
      radial-gradient(1.5px 1.5px at 150px 80px, rgba(56, 189, 248, 0.4), transparent),
      radial-gradient(1px 1px at 280px 200px, rgba(167, 139, 250, 0.35), transparent),
      radial-gradient(circle at 50% 20%, #0e1433 0%, #070b1a 100%);
    background-repeat: repeat, repeat, repeat, no-repeat;
    background-size: 300px 240px, 260px 200px, 320px 280px, 100% 100%;
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(56, 189, 248, 0.2);
    margin-bottom: 0.75rem;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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

  .status-badge {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    background: rgba(14, 20, 51, 0.8);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #9fb3d9;
    transition: all 0.2s ease;
  }

  .status-badge.saved {
    background: rgba(56, 189, 248, 0.15);
    border-color: #38bdf8;
    color: #38bdf8;
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.3);
  }

  .status-badge.cleared {
    background: rgba(245, 158, 11, 0.15);
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .editor-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  textarea {
    flex: 1;
    width: 100%;
    box-sizing: border-box;
    background: rgba(14, 20, 51, 0.75);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: 8px;
    padding: 0.75rem;
    color: #e6f6ff;
    font-family: inherit;
    font-size: 0.875rem;
    line-height: 1.5;
    resize: none;
    outline: none;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  textarea::placeholder {
    color: #9fb3d9;
    opacity: 0.8;
  }

  textarea:focus {
    border-color: #38bdf8;
    box-shadow: 0 0 12px rgba(56, 189, 248, 0.35);
  }

  .popup-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.75rem;
    padding-top: 0.5rem;
  }

  .char-count {
    font-size: 0.75rem;
    color: #9fb3d9;
  }

  .clear-btn {
    background: rgba(14, 20, 51, 0.8);
    border: 1px solid rgba(167, 139, 250, 0.35);
    color: #e6f6ff;
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .clear-btn:hover {
    background: rgba(167, 139, 250, 0.2);
    border-color: #a78bfa;
    box-shadow: 0 0 10px rgba(167, 139, 250, 0.4);
  }

  .clear-btn:active {
    transform: scale(0.97);
  }
</style>
