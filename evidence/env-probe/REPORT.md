# okf_env-probe — verified toolchain inventory

Worktree: `okf-env-probe` (repo `orbitkit`), branch `okf-env-probe`, base bootstrap `okf-c1` (669c986).
Probed on the real host shell: Debian 12 bookworm, x86_64, kernel `7.2.0-1-cachyos`.
Every VERIFIED row is real executed output; excerpts in `raw/`. Nothing assumed.

## Inventory

| Command | Status | Version (executed output) | Path | Verification |
|---|---|---|---|---|
| `rustc` | VERIFIED | `rustc 1.98.0 (88d9e12ae 2026-08-18)` | `/home/megastruktur/.cargo/bin/rustc` | `rustc --version` → raw/versions.txt |
| `cargo` | VERIFIED | `cargo 1.98.0 (797e8a9bc 2026-08-05)` | `/home/megastruktur/.cargo/bin/cargo` | `cargo --version` → raw/versions.txt |
| `rustup` | VERIFIED | `rustup 1.29.0 (28d1352db 2026-03-05)` | `/home/megastruktur/.cargo/bin/rustup` | `rustup --version` → raw/versions.txt |
| `node` | VERIFIED | `v22.22.3` | `/home/megastruktur/.local/bin/node` | `node --version` → raw/versions.txt |
| `npm` | VERIFIED | `10.9.8` | `/home/megastruktur/.local/bin/npm` | `npm --version` → raw/versions.txt |
| `pnpm` | VERIFIED | `12.4.1` | `/home/megastruktur/.npm-global/bin/pnpm` | `pnpm --version` → raw/versions.txt |
| `corepack` | VERIFIED (not needed) | `0.34.6` | `/usr/bin/corepack` | `corepack --version` → raw/versions.txt |
| `java` | VERIFIED (installed this task) | `openjdk version "17.0.20.1" 2026-08-18`, `Temurin-17.0.20.1+1` | `/home/megastruktur/Android/jdk-17.0.20.1+1/bin/java` | `java -version` → raw/java-version.txt |
| `adb` | VERIFIED (installed this task) | `Android Debug Bridge version 1.0.41` / `Version 37.0.1-15733141` | `/home/megastruktur/Android/Sdk/platform-tools/adb` | `adb version` → raw/adb-version.txt |
| `sdkmanager` | VERIFIED (installed this task) | `19.0` | `/home/megastruktur/Android/Sdk/cmdline-tools/latest/bin/sdkmanager` | `sdkmanager --version` → raw/sdkmanager-version.txt |
| webkit2gtk-4.1 | VERIFIED (library) | `2.52.6` | system pkg-config path | `pkg-config --modversion webkit2gtk-4.1` → raw/pkgconfig.txt; related: gtk+-3.0 3.24.52, libsoup-3.0 3.6.6, javascriptcoregtk-4.1 2.52.6 |
| `pkg-config` | VERIFIED | `3.0.6` | `/home/megastruktur/.local/bin/pkg-config` | `pkg-config --version` → raw/versions.txt |
| NDK | ABSENT (contract: do not install) | — | `~/Android/Sdk/ndk` missing | `ls` → `No such file or directory`; see §NDK |

## Installations performed this task (all user-local, no root)

1. **JDK 17** — Temurin `OpenJDK17U-jdk_x64_linux_hotspot_17.0.20.1_1.tar.gz` (17.0.20.1+1) → `~/Android/jdk-17.0.20.1+1/`. Resolved via GitHub API `adoptium/temurin17-binaries` latest release.
2. **cmdline-tools** — `commandlinetools-linux-13114758_latest.zip` (157.1 MB) → `~/Android/Sdk/cmdline-tools/latest/`. Host had no `unzip`; extracted with `python3 -m zipfile -e`, then restored exec bits on `bin/*` with python3 `chmod 0o755` (python's zip extractor drops the executable bit).
3. **Licenses + packages** — `yes | sdkmanager --licenses` (exit 0) then `yes | sdkmanager "platform-tools" "platforms;android-36"` (exit 0). Installed: `platform-tools 37.0.1`, `platforms;android-36 2`.
4. No `~/gradle/` was needed; nothing created there. Nothing outside `~/Android/`, repo evidence dir.

## Device (C5)

`adb devices -l`:

```
R5CY70FPFSM            device usb:3-1 product:b7sxxx model:SM_F766B device:b7s transport_id:3
```

- Model `SM-F766B` = Samsung Galaxy Z Flip 7. Authorized state (`device`), not unauthorized — no user action needed.
- `ro.product.model` = `SM-F766B`; `ro.product.device` = `b7s`; Android `16` (SDK 36); build `BP2A.250605.031.A3.F766BXXS2AYGD`.

## NDK

Not installed (`~/Android/Sdk/ndk` absent; no `ndk-bundle`). Per brief §5 the exact command that would install it (NOT executed; T03 decides version contract):

```sh
yes | sdkmanager "ndk;30.0.16248370"   # newest available in this repo's sdkmanager --list (range here: 16.1.4479499 … 30.0.16248370; T03 pins)
```

Observed available versions (excerpt): `ndk;16.1.4479499` (oldest listed) and `ndk;30.0.16248370` (newest listed) — raw excerpt in `raw/ndk-available.txt`.

## Out-of-scope findings (recorded, not acted on)

- Host has no `unzip` (python3 used as fallback) — relevant for later task briefs that assume `unzip`.
- `corepack 0.34.6` exists at `/usr/bin/corepack` but standalone `pnpm 12.4.1` already shadows it on PATH (`~/.npm-global/bin` precedes `/usr/bin`); C1 satisfied without corepack enablement. If a later task wants corepack-managed pnpm, it must prepend corepack's shims or remove `~/.npm-global/bin/pnpm`.
- `/usr/lib/jvm` is empty; no system Java existed before this task.
- `~/.android/adbkey` already existed pre-task (adb server key pair); first `adb devices` worked without re-pairing.

## Build/source identity

- Bootstrap base commit (`okf-c1`): `669c986`
- First evidence commit: `bdedf0d` (full inventory + raw captures + env.sh). Final state = an
  amend of that commit (NDK section corrected from placeholder to `sdkmanager --list`-observed
  versions; this section added). A git commit cannot contain its own hash, so the final tip SHA
  is published in the worktree status comment and handoff message.

## Runtime test-loop (fresh shell)

`env -i HOME=… bash --noprofile --norc -c 'source evidence/env-probe/env.sh && …'` from a
pristine environment (no inherited PATH, profile skipped): JAVA_HOME and ANDROID_HOME
resolve, `java -version` → 17.0.20.1, `sdkmanager --version` → 19.0, `adb version` →
37.0.1-15733141, `adb devices -l` → SM-F766B authorized. Full transcript:
`raw/fresh-shell.txt`. This matches the coordinator's post-merge smoke (fresh shell +
`source env.sh` + `adb devices`).

## Ready handoff

Inventory complete: 11/11 items VERIFIED (NDK deliberately absent per brief §5, install command recorded for T03). JDK 17 + Android SDK (cmdline-tools, platform-tools 37.0.1, platforms;android-36) installed user-local and verified. Device SM-F766B visible and authorized. `env.sh` provided at `evidence/env-probe/env.sh` for later task briefs.

Ready handoff statement: **this task is complete and ready for review/integration; T02/T03 can source `evidence/env-probe/env.sh` and proceed.**

Final evidence commit SHA: published in the worktree status comment (first evidence commit `bdedf0d`; final state is its amend).
