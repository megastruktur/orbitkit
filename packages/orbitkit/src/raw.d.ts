/**
 * Ambient typing for Vite `?raw` imports: types every `?raw` import in this
 * package (module source text loaded by passthrough.test.ts for the
 * criterion-6 no-static-tauri-import guard, and by mascotMachine.test.ts).
 * No @types/node in this workspace (lockfiles frozen), so the test cannot use
 * node:fs typings.
 */
declare module "*?raw" {
  const source: string;
  export default source;
}
