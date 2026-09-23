# Report: sdk-v1 / ci (T12)

## Overview
- Worktree: `oks-ci`
- Task: GitHub Actions CI workflow covering SDK + starter build on Linux, Windows, macOS, Android, and test execution
- Scope: `.github/workflows/ci.yml`, `evidence/sdk-v1/ci/**`

## Implemented Workflow Architecture (`.github/workflows/ci.yml`)
- **Triggers**: `push` on `main` and `oks/**`, `pull_request`, `workflow_dispatch`.
- **Permissions**: `contents: read`.
- **Concurrency**: `cancel-in-progress: true` keyed by `github.workflow` and `github.ref`.
- **Jobs**:
  1. `js`: Ubuntu 24.04, pnpm 12.4.1 (`pnpm/action-setup@v4`), Node 22 (`actions/setup-node@v4`), executing `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r check && pnpm -r test`.
  2. `rust`: Ubuntu 24.04, Linux system webkit2gtk dependencies (`libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `libxdo-dev`, `libssl-dev`, `build-essential`, `file`, `pkg-config`), Rust toolchain (`dtolnay/rust-toolchain@stable` with `clippy`), executing `cargo test --workspace --exclude starter` and `cargo clippy -p tauri-plugin-orbitkit -p tauri-plugin-orbitkit-recorder --all-targets -- -D warnings`.
  3. `desktop`: Matrix `[ubuntu-24.04, windows-latest, macos-latest]`, setup Rust stable, pnpm 12.4.1, Node 22, `pnpm install --frozen-lockfile`, `pnpm -r build` (ensuring `@orbitkit/ui` dist artifacts are compiled for starter imports), `pnpm --filter starter tauri build --debug --no-bundle`, artifact upload with 1-day retention and `if-no-files-found: error` (`actions/upload-artifact@v4`). Includes Windows runner pnpm script-shell configuration (`C:\Program Files\Git\bin\bash.exe`) and `npm_config_shell_emulator: 'true'` environment variable.
  4. `android`: Ubuntu 24.04, Java 17 Temurin (`actions/setup-java@v4`), Android SDK `platforms;android-36` + NDK `27.3.13750724`, Rust stable with target `aarch64-linux-android`, pnpm 12.4.1, Node 22, `pnpm install --frozen-lockfile`, `pnpm -r build`, debug APK build without recorder (`pnpm --filter starter tauri android build --debug --target aarch64 --apk`), debug APK build with recorder (`--features recorder`), Gradle unit tests (`./gradlew test`), artifact upload with 1-day retention and `if-no-files-found: error`.

## Real Runtime Testing Matrix

| # | Scenario | Command | Expected | Observed | Exit Code | Evidence Log |
|---|---|---|---|---|---|---|
| 1 | lint | `docker run --rm -v $PWD:/repo --workdir /repo rhysd/actionlint:latest` | exit 0 | Clean lint, zero schema errors, shellcheck passed | 0 | `evidence/sdk-v1/ci/raw/01-actionlint.txt` |
| 2 | js job local | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r check && pnpm -r test` | exit 0 | Clean install, build, check (tsc), test (vitest 82/82 passed) | 0 | `evidence/sdk-v1/ci/raw/02-js-job-local.txt` |
| 3 | CI (coordinator) | `git push origin HEAD:oks/ci` + `gh run watch` | all green, URL | 6/6 green: all 6 jobs passed (js, rust, android, desktop-linux, desktop-windows, desktop-macos) | 0 | https://github.com/megastruktur/orbitkit/actions/runs/35878493349 |

## Supplementary Local Validation Evidence

| Component | Command | Result | Evidence Log |
|---|---|---|---|
| Rust unit tests | `cargo test --workspace --exclude starter` (in `orbitkit-linux-desktop:1`) | 12/12 passed locally; CI run 35878493349 ran 26 Rust tests (14 plugin-orbitkit + 12 plugin-orbitkit-recorder, vs local 12), all passed; 6/6 green (https://github.com/megastruktur/orbitkit/actions/runs/35878493349) | `evidence/sdk-v1/ci/raw/03-rust-cargo-test.txt` |
| Rust clippy | `cargo clippy -p tauri-plugin-orbitkit -p tauri-plugin-orbitkit-recorder --all-targets -- -D warnings` | Clean, 0 warnings, exit 0 | `evidence/sdk-v1/ci/raw/04-rust-cargo-clippy.txt` |
| Android Gradle unit tests | `./gradlew test` in `examples/starter/src-tauri/gen/android` | BUILD SUCCESSFUL, exit 0 | `evidence/sdk-v1/ci/raw/05-android-gradlew-test.txt` |
| Android recorder APK build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk --features recorder` | APK generated, exit 0 | `evidence/sdk-v1/ci/raw/06-android-recorder-build.txt` |

## Deviations
- Added `pnpm -r build` before `pnpm --filter starter tauri build` and `pnpm --filter starter tauri android build` in `desktop` and `android` jobs: in a clean checkout, `@orbitkit/ui` does not have pre-built `dist/` artifacts in git. Without building `@orbitkit/ui` first, starter frontend compilation (`vite build`) fails with `Rolldown failed to resolve import "@orbitkit/ui"`. Running workspace build first ensures all workspace dependencies are resolved.
- Configured pnpm script-shell on Windows runner to Git bash (`C:\Program Files\Git\bin\bash.exe`) and set `npm_config_shell_emulator: 'true'` in the `desktop` job to ensure lifecycle commands like `rm -f` in `@orbitkit/ui` build script execute reliably.
- Dropped setup-node pnpm caching to adhere strictly to non-goals ("no caching secrets").

## Out-of-Scope Findings
- In `packages/orbitkit/package.json`, the `"build"` script is `"svelte-package -i src -o dist && rm -f dist/*.test.*"`. This command relies on POSIX `rm -f`, which is not available in Windows `cmd.exe` by default. While mitigated in CI via pnpm's `script-shell` set to Git bash and shell emulator, upstream script should consider a cross-platform cleanup tool (e.g. node script or rimraf) so manual Windows developer builds without Git bash also succeed.
- In `examples/starter/src-tauri/tauri.conf.json`, bundle identifier `dev.orbitkit.app` ends in `.app`, triggering Tauri warning `Warn bundle identifier "dev.orbitkit.app" set in "tauri.conf.json" identifier ends in .app. This is not recommended because it conflicts with bundle extension on macOS`. A future cleanup task should consider updating the identifier (e.g. `dev.orbitkit.starter`).

## Contract Questions
None.

READY FOR REVIEW at 99d99a55e205a2e9986bbb91b575812c11df2c1b
