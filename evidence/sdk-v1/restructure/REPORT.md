# Task Report: `oks_restructure` (T02)

## Summary
- Flat spike successfully restructured into K1 pnpm workspace layout.
- Spike application moved to `examples/starter` via `git mv`, preserving file histories.
- `packages/orbitkit` scaffolded as `@orbitkit/ui` with required scripts, configs, and placeholder `src/index.ts`.
- Workspace wired via root `package.json`, `pnpm-workspace.yaml`, and `tsconfig.base.json`.
- `pnpm install --frozen-lockfile` succeeds (exit 0).
- `pnpm -r check` succeeds (exit 0).
- `examples/starter` build succeeds (Vite build, exit 0).
- `packages/orbitkit` build succeeds (`svelte-package`, exit 0, outputs `dist/index.js` and `dist/index.d.ts`).
- Monorepo full build `pnpm -r build` succeeds (exit 0).
- Rust desktop `cargo check` and `cargo check --features mic-recorder` in `examples/starter/src-tauri` succeed (exit 0).
- Android debug APK built successfully via `pnpm --filter starter tauri android build --debug --target aarch64 --apk`, generating `app-universal-debug.apk` (exit 0).
- Android unit tests verified via `./gradlew testUniversalDebugUnitTest` with 22/22 green (OrbitkitNativePluginTest: 8/8, OrbitkitSurvivalJniTest: 14/14, exit 0).
- Root `src/` and `src-tauri/` completely removed.

## Scenario Results

| # | Scenario | Command | Expected | Actual / Evidence | Exit Code |
|---|---|---|---|---|---|
| 1 | JS install (fresh) | `pnpm install --no-frozen-lockfile` | exit 0, lockfile updated | Lockfile updated with workspace projects (`evidence/sdk-v1/restructure/raw/01-pnpm-install.txt`) | 0 |
| 1 | JS install (frozen) | `pnpm install --frozen-lockfile` | exit 0 | Clean install from frozen lockfile (`evidence/sdk-v1/restructure/raw/02-pnpm-install-frozen.txt`) | 0 |
| 1 | JS check | `pnpm -r check` | exit 0 | `tsc --noEmit` green across all workspace packages (`evidence/sdk-v1/restructure/raw/03-pnpm-r-check.txt`) | 0 |
| 1 | Starter build | `pnpm --filter starter build` | exit 0 | Vite built dist bundle in 109ms (`evidence/sdk-v1/restructure/raw/04-pnpm-starter-build.txt`) | 0 |
| 1 | Monorepo build | `pnpm -r build` | exit 0 | All workspace packages build cleanly (`evidence/sdk-v1/restructure/raw/05-pnpm-r-build.txt`) | 0 |
| 2 | Rust check | `cd examples/starter/src-tauri && cargo check` | exit 0 | Dev profile targets checked in 0.28s (`evidence/sdk-v1/restructure/raw/06-cargo-check.txt`) | 0 |
| 2 | Rust check (mic-recorder) | `cargo check --features mic-recorder` | exit 0 | Dev profile targets checked in 0.10s (`evidence/sdk-v1/restructure/raw/07-cargo-check-mic-recorder.txt`) | 0 |
| 3 | Android APK build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | APK path | Built universal APK `app-universal-debug.apk` in 43s (`evidence/sdk-v1/restructure/raw/08-tauri-android-build.txt`) | 0 |
| 3 | Android unit tests | `cd examples/starter/src-tauri/gen/android && ./gradlew testUniversalDebugUnitTest` | 22/22 green | 22/22 tests green (OrbitkitNativePluginTest: 8/8, OrbitkitSurvivalJniTest: 14/14) (`evidence/sdk-v1/restructure/raw/09-gradlew-unit-tests.txt`) | 0 |
| 4 | Desktop run | `scripts/linux-desktop.sh` | screenshot or declared limit | Declared limit: `scripts/linux-desktop.sh` does not exist on base ("T01 not on base, cargo check only") | N/A |

## Deviations
- **Contract Amendment K1-A1 (Approved by Coordinator):**
  - `@sveltejs/package` requires TypeScript's programmatic compiler API (`import("typescript")`). In `typescript@7.0.2` (Microsoft's native Go rewrite), this programmatic JS API is absent.
  - Coordinator approved amendment K1-A1:
    1. `packages/orbitkit/package.json` devDependency pinned to `"typescript": "6.0.3"`, while `examples/starter` remains on `"typescript": "7.0.2"`.
    2. Added `packageExtensions` in `pnpm-workspace.yaml`:
       ```yaml
       packageExtensions:
         "@sveltejs/package":
           peerDependencies:
             typescript: "*"
       ```
  - Result: `pnpm -r build` passes cleanly (exit 0) emitting `dist/index.js` and `dist/index.d.ts`.
## Out-of-Scope Findings
- None.

READY FOR REVIEW at 014795bcb50a417e73f292669f9fdfdc425098e4
