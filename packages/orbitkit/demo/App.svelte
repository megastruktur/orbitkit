<script lang="ts">
  import Mascot from "../src/Mascot.svelte";
  import type { MascotConfig } from "../src/config";

  const svgPlanet = `<svg width="110" height="110" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
    <circle cx="80" cy="80" r="56" fill="#4f7cff" />
    <ellipse cx="80" cy="80" rx="72" ry="24" fill="none" stroke="#9db4ff" stroke-width="6" transform="rotate(-20 80 80)" />
    <circle cx="60" cy="68" r="10" fill="#ffffff" />
    <circle cx="100" cy="68" r="10" fill="#ffffff" />
    <circle cx="62" cy="70" r="5" fill="#10141a" />
    <circle cx="102" cy="70" r="5" fill="#10141a" />
    <path d="M 68 94 Q 80 106 92 94" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
  </svg>`;

  const svgConfig: MascotConfig = {
    kind: "svg",
    src: svgPlanet,
    size: 96,
    initialState: "idle",
  };

  // 4-frame sprite sheet: 4 frames of 96px width each (total width = 384px, height = 96px)
  const spriteSvg = `<svg width="384" height="96" viewBox="0 0 384 96" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(0, 0)">
      <circle cx="48" cy="48" r="38" fill="#10b981" />
      <circle cx="48" cy="48" r="28" fill="#34d399" />
      <circle cx="38" cy="42" r="5" fill="#064e3b" />
      <circle cx="58" cy="42" r="5" fill="#064e3b" />
      <path d="M 40 56 Q 48 64 56 56" fill="none" stroke="#064e3b" stroke-width="3" stroke-linecap="round" />
    </g>
    <g transform="translate(96, 0)">
      <circle cx="48" cy="48" r="42" fill="#10b981" />
      <circle cx="48" cy="48" r="32" fill="#6ee7b7" />
      <circle cx="38" cy="40" r="6" fill="#064e3b" />
      <circle cx="58" cy="40" r="6" fill="#064e3b" />
      <path d="M 38 54 Q 48 66 58 54" fill="none" stroke="#064e3b" stroke-width="4" stroke-linecap="round" />
    </g>
    <g transform="translate(192, 0)">
      <circle cx="48" cy="48" r="44" fill="#059669" />
      <circle cx="48" cy="48" r="34" fill="#a7f3d0" />
      <circle cx="38" cy="38" r="7" fill="#064e3b" />
      <circle cx="58" cy="38" r="7" fill="#064e3b" />
      <path d="M 36 52 Q 48 68 60 52" fill="none" stroke="#064e3b" stroke-width="4" stroke-linecap="round" />
    </g>
    <g transform="translate(288, 0)">
      <circle cx="48" cy="48" r="40" fill="#10b981" />
      <circle cx="48" cy="48" r="30" fill="#34d399" />
      <circle cx="38" cy="42" r="5" fill="#064e3b" />
      <circle cx="58" cy="42" r="5" fill="#064e3b" />
      <path d="M 40 56 Q 48 64 56 56" fill="none" stroke="#064e3b" stroke-width="3" stroke-linecap="round" />
    </g>
  </svg>`;

  const spriteDataUrl = "data:image/svg+xml;utf8," + encodeURIComponent(spriteSvg);

  const spriteConfig: MascotConfig = {
    kind: "sprite",
    src: spriteDataUrl,
    size: 96,
    frameWidth: 96,
    frameHeight: 96,
    initialState: "idle",
    states: {
      idle: { frames: 4, fps: 4, loop: true, row: 0 },
    },
  };

  // Image kind: vibrant solar gold mascot
  const imageSvg = `<svg width="110" height="110" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="46" fill="#f59e0b" />
    <circle cx="60" cy="60" r="38" fill="#fbbf24" />
    <circle cx="40" cy="68" r="8" fill="#f87171" opacity="0.6" />
    <circle cx="80" cy="68" r="8" fill="#f87171" opacity="0.6" />
    <circle cx="46" cy="54" r="6" fill="#1e1b4b" />
    <circle cx="74" cy="54" r="6" fill="#1e1b4b" />
    <circle cx="48" cy="52" r="2" fill="#ffffff" />
    <circle cx="76" cy="52" r="2" fill="#ffffff" />
    <path d="M 50 68 Q 60 78 70 68" fill="none" stroke="#1e1b4b" stroke-width="3" stroke-linecap="round" />
  </svg>`;
  const imageDataUrl = "data:image/svg+xml;utf8," + encodeURIComponent(imageSvg);

  const imageConfig: MascotConfig = {
    kind: "image",
    src: imageDataUrl,
    size: 96,
    initialState: "idle",
  };

  let clickedKind = $state<string | null>(null);
  function recordClick(kind: string) {
    clickedKind = kind;
  }
</script>

<main class="demo-container">
  <header class="demo-header">
    <h1 class="demo-title">OrbitKit Mascot Showcase</h1>
    <p class="demo-subtitle">K2 / K3 Svelte 5 Mascot Component (SVG • Sprite • Image)</p>
  </header>

  <div class="mascot-grid">
    <div class="mascot-card">
      <div class="mascot-badge badge-svg">KIND: SVG</div>
      <div class="mascot-stage">
        <Mascot config={svgConfig} ariaLabel="Blue planet SVG mascot" onclick={() => recordClick("SVG")} />
      </div>
      <div class="mascot-meta">
        <strong>Cosmic Planet</strong>
        <span>Inline SVG • #4f7cff</span>
      </div>
    </div>

    <div class="mascot-card">
      <div class="mascot-badge badge-sprite">KIND: SPRITE</div>
      <div class="mascot-stage">
        <Mascot config={spriteConfig} ariaLabel="Emerald pulse sprite mascot" onclick={() => recordClick("Sprite")} />
      </div>
      <div class="mascot-meta">
        <strong>Emerald Pulse</strong>
        <span>CSS steps(4) • #10b981</span>
      </div>
    </div>

    <div class="mascot-card">
      <div class="mascot-badge badge-image">KIND: IMAGE</div>
      <div class="mascot-stage">
        <Mascot config={imageConfig} ariaLabel="Solar gold image mascot" onclick={() => recordClick("Image")} />
      </div>
      <div class="mascot-meta">
        <strong>Solar Gold</strong>
        <span>Image &lt;img&gt; • #f59e0b</span>
      </div>
    </div>
  </div>

  {#if clickedKind}
    <footer class="demo-footer">
      <span>Interacted with: <strong>{clickedKind} Mascot</strong></span>
    </footer>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #0b0f19;
    color: #f1f5f9;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .demo-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 32px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .demo-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .demo-title {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 8px 0;
    background: linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .demo-subtitle {
    font-size: 14px;
    color: #94a3b8;
    margin: 0;
  }

  .mascot-grid {
    display: flex;
    flex-direction: row;
    gap: 24px;
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
  }

  .mascot-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 16px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 200px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    transition: transform 0.2s, border-color 0.2s;
  }

  .mascot-badge {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 4px 10px;
    border-radius: 9999px;
    margin-bottom: 16px;
  }

  .badge-svg {
    background: rgba(79, 124, 255, 0.2);
    color: #93c5fd;
    border: 1px solid #3b82f6;
  }

  .badge-sprite {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
    border: 1px solid #10b981;
  }

  .badge-image {
    background: rgba(245, 158, 11, 0.2);
    color: #fde68a;
    border: 1px solid #f59e0b;
  }

  .mascot-stage {
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f172a;
    border-radius: 12px;
    margin-bottom: 16px;
    border: 1px solid #1e293b;
  }

  .mascot-meta {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mascot-meta strong {
    font-size: 15px;
    color: #f8fafc;
  }

  .mascot-meta span {
    font-size: 12px;
    color: #94a3b8;
  }

  .demo-footer {
    margin-top: 28px;
    padding: 8px 16px;
    border-radius: 8px;
    background: #1e293b;
    border: 1px solid #475569;
    font-size: 13px;
    color: #cbd5e1;
  }
</style>
