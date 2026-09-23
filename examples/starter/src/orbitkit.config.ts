import { defineConfig, validateConfig, type OrbitKitConfig } from "@orbitkit/ui";
import rawConfig from "./orbitkit.config.json";

export const config: OrbitKitConfig = defineConfig(rawConfig as OrbitKitConfig);
export const validation = validateConfig(config);
export default config;
