import { defineConfig, validateConfig, type OrbitKitConfig } from "@orbitkit/ui";
import rawConfig from "./orbitkit.config.json";

export const config: OrbitKitConfig = defineConfig(rawConfig as OrbitKitConfig);
export const validation = validateConfig(config);
export default config;

// Example: configure an arc menu on one side of the mascot (Contract Amendment K2-A1):
// export const arcConfig: OrbitKitConfig = defineConfig({
//   ...config,
//   menu: {
//     ...config.menu,
//     layout: "arc",
//     arc: { position: "top", span: 180 },
//   },
// });
// Example: disable opening/closing transitions: menu: { ...config.menu, animation: "none" }
