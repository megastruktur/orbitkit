# Development, Testing & CI Guide

This guide describes repository setup, testing workflows, contract amendments, containerized environments, and continuous integration pipelines for OrbitKit.

---

## 1. Repository Layout

OrbitKit is organized as a monorepo combining a [pnpm](https://pnpm.io) workspace (managing frontend packages and examples) and a Cargo workspace (managing Rust plugins):

```
orbitkit/
├── package.json              # Workspace root scripts & pnpm packageExtensions
├── pnpm-workspace.yaml       # Workspace definition: packages/*, examples/*
├── packages/
│   └── orbitkit/             # @orbitkit/ui (Svelte 5 + TS components and bridge)
│       └── assets/           # Bundled assets (default-mascot.svg)
├── crates/
│   ├── tauri-plugin-orbitkit/          # Core Tauri v2 plugin crate & Android module
│   └── tauri-plugin-orbitkit-recorder/ # Audio recording & FGS extension crate
├── examples/
│   └── starter/              # Runnable sample app (Svelte 5 + Tauri v2)
├── tools/
│   └── docker/               # Container definitions (linux-desktop.Dockerfile)
├── scripts/
│   └── linux-desktop.sh      # Container build, screenshot & scenario runner
└── docs/                     # Documentation suite
```

---

## 2. Environment Setup

To build and test OrbitKit across desktop and Android cross-compilation targets, ensure the following generic prerequisites are available:

- **Node.js**: Node 22
- **Package Manager**: pnpm 12.4.1 (`packageManager` pinned in root `package.json`)
- **Rust Toolchain**: Rust stable (edition 2021)
- **Java Development Kit**: JDK 17
- **Android SDK & NDK**: Android SDK with `ANDROID_HOME`, and `NDK_HOME=$ANDROID_HOME/ndk/<version>` (CI uses `27.3.13750724`)
- **Docker**: Docker for the Linux container script (`scripts/linux-desktop.sh`)

---

## 3. Contract Amendments

The following amendments were ratified during campaign execution (recorded in [contracts.md](architecture/contracts.md)):

1. **K1-A1 (TypeScript Toolchain Parity)**:
   - `packages/orbitkit` specifies `typescript: 6.0.3` for compatibility with `@sveltejs/package: 2.5.8`.
   - `pnpm-workspace.yaml` declares `packageExtensions` supplying `peerDependencies` `typescript: "*"` to `@sveltejs/package`.
   - `examples/starter` uses TypeScript `7.0.2`.
2. **K3-A1 (Radial Geometry Type Export)**:
   - `@orbitkit/ui` public barrel exports `type { ItemPosition } from "./geometry.js"`.
3. **K3-A2 (Vitest Browser Resolution)**:
   - `packages/orbitkit/vitest.config.ts` sets `resolve: { conditions: ["browser"] }`, allowing Svelte 5 browser-runtime components to mount cleanly in test suites without mock shims.
4. **K3-A3 (Mascot SVG Security Sandbox)**:
   - Mascot SVGs are rendered exclusively via `<img>` tags pointing to encoded data URLs (`data:image/svg+xml;charset=utf-8,...`).
   - Direct `{@html}` markup insertion is forbidden to prevent script execution, DOM clobbering, and mutation cross-site scripting (mXSS).
5. **K4 (Strict Error Code Union)**:
   - The plugin error union is strictly limited to four typed error codes:
     `"permission_denied" | "unsupported" | "not_found" | "invalid_config"`.
   - Any unknown mobile or platform rejections map deterministically to `"unsupported"`.
6. **K4 (Internal Menu Action Dispatch)**:
   - The command `emit_menu_action` (`{ id: string }`) is registered as a first-class plugin command to unify webview and native overlay action dispatch.
7. **Default Mascot Asset Export**:
   - Bundled default planet mascot asset is exported at `@orbitkit/ui/assets/default-mascot.svg` via `package.json` `"exports": { "./assets/*": "./assets/*" }`.

---

## 4. Local Build & Test Commands

### JavaScript / Frontend Pipeline

```bash
# Install frozen dependencies across the workspace
pnpm install --frozen-lockfile

# Build all workspace packages (@orbitkit/ui and starter)
pnpm -r build

# Typecheck all packages
pnpm -r check

# Run Vitest unit tests (59 unit tests covering Mascot, RadialMenu, geometry, bridge, config)
pnpm -r test
```

### Rust Workspace Pipeline

```bash
# Run unit and integration tests across all plugin crates (excluding starter desktop app)
cargo test --workspace --exclude starter

# Run Clippy lints with deny warnings
cargo clippy -p tauri-plugin-orbitkit -p tauri-plugin-orbitkit-recorder --all-targets -- -D warnings
```

### Android Build & Tests

```bash
# Compile debug APK for Android aarch64
pnpm --filter starter tauri android build --debug --target aarch64 --apk

# Compile debug APK with optional audio recorder extension
pnpm --filter starter tauri android build --debug --target aarch64 --apk --features recorder

# Run Gradle JVM unit tests for Android plugins and JNI survival
cd examples/starter/src-tauri/gen/android
./gradlew test
```

---

## 5. Development-Only Environment Variables (Debug Builds Only)

`tauri-plugin-orbitkit` and the starter example provide diagnostic hooks for testing:

| Variable | Values | Description |
|---|---|---|
| `ORBITKIT_SELFTEST` | `"1"` | Automatically opens the mascot overlay window and the first configured popup window 2 seconds after startup. |
| `ORBITKIT_SELFTEST_CONFIG` | Path to JSON | Path to an alternate `OrbitKitConfig` JSON file that overrides the compiled configuration during selftests. |
| `VITE_ORBITKIT_DEBUG` | `"1"` | Enables frontend gesture telemetry in the starter, forwarding `console` logs to Tauri via `log_telemetry`. |

Setting `VITE_ORBITKIT_DEBUG="1"` at frontend build or development time enables verbose gesture diagnostics in the starter example. When set, `main.ts` forwards console messages (`log`, `warn`, `error`) to the Tauri backend via `log_telemetry`, and `MascotView` logs window focus/blur and pointer/click events to aid in automated headless testing. In production builds or when unset, this telemetry is completely disabled and console output is not forwarded.

Rust selftest hooks are completely removed in release builds.

---

## 6. Containerized Linux Desktop Runner (`scripts/linux-desktop.sh`)

Because host development environments often lack WebKitGTK 4.1 development libraries, OrbitKit provides a containerized workflow:

```bash
# Build the container image
scripts/linux-desktop.sh image

# Build starter desktop app inside container
scripts/linux-desktop.sh build examples/starter

# Launch headless Xvfb, run application for 15s, and capture screenshot
scripts/linux-desktop.sh run-screenshot examples/starter /tmp/screenshot.png 15

# Execute scenario script against running app ($APP_PID exported)
scripts/linux-desktop.sh run-scenario examples/starter evidence/sdk-v1/starter-example/run-desktop-flow.sh

# Run custom command inside container with app active
scripts/linux-desktop.sh exec examples/starter -- xdotool getactivewindow windowminimize
```

All `ORBITKIT_*` environment variables on the host are automatically forwarded into the container.

---

## 7. Continuous Integration (GitHub Actions)

OrbitKit runs a multi-platform matrix CI workflow defined in `.github/workflows/ci.yml`:

- **`js`**: Runs on `ubuntu-24.04` with Node 22 and pnpm 12.4.1. Executes `build`, `check`, and `test`.
- **`rust`**: Runs on `ubuntu-24.04`. Tests plugin crates and enforces strict Clippy (`-D warnings`).
- **`desktop`**: Matrix covering `linux` (`ubuntu-24.04`), `windows` (`windows-latest`), and `macos` (`macos-latest`). Compiles the starter desktop app across all three operating systems and uploads binary artifacts.
- **`android`**: Runs on `ubuntu-24.04` with JDK 17, Android NDK 27.3, and SDK 36. Compiles both core and recorder APKs, executes Gradle unit tests, and archives artifacts.

### Verified CI Runs
- **Run ID 35878493349** (6/6 green across all jobs):
  [https://github.com/megastruktur/orbitkit/actions/runs/35878493349](https://github.com/megastruktur/orbitkit/actions/runs/35878493349)

---

## 8. Physical Device Status

Physical on-device Android scenarios were **DEFERRED** during the campaign because no physical device was connected to the automated CI runner. All scenarios are code-complete and backed by automated Gradle unit tests, JNI mock suites, and reproducible runbooks.
