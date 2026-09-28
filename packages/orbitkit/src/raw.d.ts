/**
 * Ambient typing for Vite `?raw` imports (used by passthrough.test.ts to load
 * module source text for the criterion-6 no-static-tauri-import guard).
 * No @types/node in this workspace (lockfiles frozen), so the test cannot use
 * node:fs typings.
 */
declare module "*?raw" {
  const source: string;
  export default source;
}
