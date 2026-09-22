<!-- // STUB owned by oks-mascot-comp -->
<script lang="ts">
  import type { MascotConfig, MascotStateName } from "./config";

  interface Props {
    config: MascotConfig;
    state?: MascotStateName;
    onclick?: () => void;
  }

  let { config, state = "idle", onclick }: Props = $props();
</script>

<div class="orbitkit-mascot-stub" role="presentation" {onclick}>
  <!-- STUB owned by oks-mascot-comp -->
  {config?.src ?? ""} ({state})
</div>
