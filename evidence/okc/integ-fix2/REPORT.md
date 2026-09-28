# okc-integ-fix2 — Evidence Report

Campaign: `orbitkit-cutecare-v02`, branch `megastruktur/okc-integ-fix2`, base `081f1f9de3db8ced38a851c8a93d98e260601a95`.

## What & why

okc-contracts AC3 ("the 0.1.0 starter config validates unchanged in TS AND deserializes in Rust") was
implemented live against `examples/starter/src/orbitkit.config.json`. The upcoming okc-demo-b1 rewrite of
that live file would turn the compat tests red although the schema is fine. Fix (coordinator decision,
contract-preserving): prove compatibility against a **frozen copy** of the 0.1.0 config instead of demo
content.

## Change set

| File | Change |
|---|---|
| `packages/orbitkit/src/test-fixtures/starter-0.1.0.json` | NEW — frozen 0.1.0 starter config |
| `crates/tauri-plugin-orbitkit/src/config.rs` | `test_starter_config_compat_k7`: `include_str!` path + comment only; all assertions kept |
| `packages/orbitkit/src/config.test.ts` | starter-config import switched to the fixture; all assertions kept |

`examples/starter/**` untouched (`git status` clean for that path).

## Fixture provenance

- Source: `git show 081f1f9:examples/starter/src/orbitkit.config.json`
- `cmp` byte-identical: YES (re-verified after proof mutations and restore)
- sha256: `e18a6d2b34edf3275b5a419f43e7aa6ea34522c2858251178cc798bacd03936a`

## Gates

| Gate | Result | Evidence |
|---|---|---|
| TS: `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test && pnpm -r check` | exit 0, **276/276 tests** (13 files) | `raw/ts-gate.log` |
| Rust: `bash plans/orbitkit-cutecare-v02/okc_tools/rust_gate.sh` | **36 passed**, 0 failed, clippy `-D warnings` clean, prints `OKC_RUST_GATE_OK` | `raw/rust-gate.log` |

Both gates re-run green on the final tree state (fixture pristine).

## Decoupling proof (mutation-sensitive)

**A — demo edit must NOT affect compat tests.** Temporarily changed
`examples/starter/src/orbitkit.config.json` `mascot.kind: "svg" → "sheets"`, then:

- Rust `cargo test -p tauri-plugin-orbitkit --lib test_starter_config_compat_k7` (inside the gate image):
  `1 passed` → `raw/proof-a-demo-edit-rust.txt`
- TS `vitest run src/config.test.ts -t "compat: 0.1.0 starter"`: `Test Files 1 passed (1)`, `2 passed | 48 skipped` →
  `raw/proof-a-demo-edit-ts.txt`
- Demo reverted via `git checkout --`.

**B — fixture edit MUST be caught.** Temporarily changed the FIXTURE `mascot.kind: "svg" → "sheets"`, then:

- Rust: `test_starter_config_compat_k7 ... FAILED` — `left: Sheets, right: Svg` at `config.rs:910`,
  gate exit 101 → `raw/proof-b-fixture-edit-rust.txt`
- TS: compat describe `2 failed` (validate rejects `sheets` without a sheets record) →
  `raw/proof-b-fixture-edit-ts.txt`
- Fixture restored from the `081f1f9` blob; sha256 re-verified identical (see Provenance).

Conclusion: both suites now read only the frozen fixture; demo content can change freely.

## Status

READY FOR REVIEW at `e5d9c92fc12fb1d21a863e4efc6053abb62f49e6`
