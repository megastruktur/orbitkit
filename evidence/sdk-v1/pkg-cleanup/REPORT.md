# Report: sdk-v1 / pkg-cleanup (Remediation R-T11-1 + R-T10-1)

## Overview
- Worktree: `oks-pkg-cleanup`
- Base: `2f1122f` (`megastruktur/oks-campaign`)
- Scope: Remediation R-T11-1 (MINOR: default mascot asset not consumable) and R-T10-1 (LOW: dead imports in core Kotlin).

## Changes Implemented

### R-T11-1: Default Mascot Asset Consumable
- File modified: `packages/orbitkit/package.json`
- Changes:
  - Added `"assets"` to `"files"` array alongside `"dist"`.
  - Added `"./assets/*": "./assets/*"` to `"exports"` map.
  - No changes made to other exports, package versions, or dependencies.

### R-T10-1: Dead Imports Removed from Core Kotlin Plugin
- File modified: `crates/tauri-plugin-orbitkit/android/src/main/java/dev/orbitkit/native/OrbitkitNativePlugin.kt`
- Candidate symbols audited: `AtomicBoolean`, `AtomicLong`, `java.io.File`, `Manifest`, `PackageManager`.
- Verification by grep confirmed none of these 5 symbols were referenced outside import statements after the recorder extraction.
- Removed only the 5 unused imports:
  - `import android.Manifest`
  - `import android.content.pm.PackageManager`
  - `import java.io.File`
  - `import java.util.concurrent.atomic.AtomicBoolean`
  - `import java.util.concurrent.atomic.AtomicLong`

---

## Verification Matrix

| # | Scenario | Command | Expected | Observed | Exit Code | Raw Log |
|---|---|---|---|---|---|---|
| 1 | UI build, check & test | `pnpm --filter @orbitkit/ui build && pnpm --filter @orbitkit/ui check && pnpm --filter @orbitkit/ui test` | Green (types emit, tsc clean, all vitests pass) | 5 test files passed, 82 tests passed, tsc clean | 0 | `evidence/sdk-v1/pkg-cleanup/raw/01-ui-build-check-test.txt` |
| 2 | UI package tarball contents | `pnpm --filter @orbitkit/ui pack` + `tar -tzf` | Tarball contains `package/assets/default-mascot.svg` | Verified `package/assets/default-mascot.svg` packaged | 0 | `evidence/sdk-v1/pkg-cleanup/raw/02-ui-pack.txt` |
| 3 | Consumer smoke test in `$TMPDIR` | Temp Vite + Svelte consumer app importing `@orbitkit/ui/assets/default-mascot.svg?url` and `?raw` | `vite build` exits 0 | Built production bundle in 51ms; asset URL and SVG content verified | 0 | `evidence/sdk-v1/pkg-cleanup/raw/03-consumer-smoke.txt` |
| 4 | Workspace recursive build | `pnpm -r build` | All packages build green | `@orbitkit/ui` and `starter` built cleanly | 0 | `evidence/sdk-v1/pkg-cleanup/raw/04-pnpm-r-build.txt` |
| 5 | Starter Android debug APK build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | Build succeeds, produces APK | Built universal debug APK at `examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk` | 0 | `evidence/sdk-v1/pkg-cleanup/raw/05-android-build.txt` |
| 6 | Core plugin JUnit tests | `cd examples/starter/src-tauri/gen/android && ./gradlew --rerun-tasks :tauri-plugin-orbitkit:testDebugUnitTest` | Green, report JUnit count | 36 unit tests passed, 0 failures, 0 skipped (`MenuConfigParserTest`: 10, `OrbitkitNativePluginTest`: 9, `OverlayActionDispatcherTest`: 6, `RadialLayoutTest`: 11) | 0 | `evidence/sdk-v1/pkg-cleanup/raw/06-junit-test.txt` |

---

## Scope Allowlist Verification
- Allowlisted paths in BRIEF.md: `packages/orbitkit/package.json`, `pnpm-lock.yaml` (if rewritten), `crates/tauri-plugin-orbitkit/android/src/main/java/dev/orbitkit/native/OrbitkitNativePlugin.kt`, `evidence/sdk-v1/pkg-cleanup/**`.
- Modified files strictly match allowlist:
  - `packages/orbitkit/package.json` (commit `e6e0f72`)
  - `crates/tauri-plugin-orbitkit/android/src/main/java/dev/orbitkit/native/OrbitkitNativePlugin.kt` (commit `d8575df`)
  - `evidence/sdk-v1/pkg-cleanup/**` (committed with report)

## Contract Questions
- None.

## Out-of-Scope Findings
- None.

READY FOR REVIEW at d8575dfaf7b2ec3c8af9a2e39abec00fb8e8a03a
