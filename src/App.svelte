<script lang="ts">
  import Mascot from "./lib/Mascot.svelte";
</script>

<main>
  <Mascot />
  <h1>orbitkit</h1>
  <p>shell skeleton — Tauri v2 + Svelte 5 + TypeScript</p>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    margin: 0;
    background: #10141a;
    color: #e6e9ef;
    font-family: system-ui, sans-serif;
    text-align: center;
  }

  p {
    opacity: 0.7;
  }
</style>
