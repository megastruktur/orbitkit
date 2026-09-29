# REPORT — okc-integ-fix7: Android CI red on main (0.2.0 rewrote live starter config)

Branch `megastruktur/okc-integ-fix7`, base `e41eca0`.

## Problem
GitHub Actions run 36528854697, job `android`: `./gradlew test` → 136 tests, 6 failed.
All 6 read the LIVE starter config `examples/starter/src/orbitkit.config.json`, which the
0.2.0 demo rewrote (kind `sheets`, planet sprite, 9-item menu). The tests assert 0.1.0
content. Same bug class integ-fix2 fixed for Rust/TS compatibility tests; never caught
locally because nothing runs Android tests here (no SDK/NDK).

## Fix
Pointed the config loaders in the 3 Android test files at the frozen fixture
`packages/orbitkit/src/test-fixtures/starter-0.1.0.json` (same approach as integ-fix2):
- `MascotSpecTest.kt` — `loadConfigFile()` (6-candidate list + upward loop): only the
  relative path changed (`examples/starter/src/orbitkit.config.json` →
  `packages/orbitkit/src/test-fixtures/starter-0.1.0.json`); fail message updated.
- `SvgIconTest.kt` — `loadConfigFile()` same treatment. `loadIconFile()` (live starter
  icons, used by the passing `testRealIcon*` tests) deliberately untouched.
- `IconDecoderTest.kt` — 4-candidate list in `testStarterConfigIconsDecodeCleanly`:
  only the relative path changed; assertion message updated.

No assertion was weakened or changed: `git diff` line filter confirms every changed
line is either a path swap, a message, or a comment. No assertion literals
(`#4f7cff`, `#f59e0b`, `#9db4ff`, `#fcd34d`, `#ffffff`, `#10141a`, 6 elements, 2 states,
size 96, 24x24 viewBox, 5 items) were touched. Comments added document provenance:
fixture is byte-identical to `examples/starter/src/orbitkit.config.json` @ `098f969`.

Allowlist respected: 3 test files + `evidence/okc/integ-fix7/**`. No changes to
`examples/starter/**`, Android main source, or Rust code.

## Per-criterion results

| Criterion | Result | Evidence |
|---|---|---|
| Fixture byte-identical to `git show 098f969:examples/starter/src/orbitkit.config.json` | PASS (`cmp_exit=0`, md5 `3c365658cafa1231ef6ce326d0c225a2` both) | `raw/fixture-byte-identity.txt` |
| 3 loaders resolve fixture from CI gradle working dir `crates/tauri-plugin-orbitkit/android` | PASS, `exit=0` (all 3 via `candidates[1]` = `../../../packages/orbitkit/src/test-fixtures/starter-0.1.0.json`) | `raw/loader-resolution.txt` |
| Every assertion of the 6 red tests holds on fixture | PASS 22/22, `exit=0` (kind svg, size 96, initialState idle, 2 states, idle `#4f7cff`, busy `#f59e0b`, 6 elements in Kotlin order body/ring/eyes/pupils incl. ring fill none/`#9db4ff`/sw 4/`rotate(-20 80 80)`, pupils `#10141a`, busy ring `#fcd34d`, 5 menu items with base64 24x24 SVG icons) | `raw/fixture-values.txt` |
| Assertions unchanged (no weakening) | PASS — diff contains only path/message/comment lines | `git diff e41eca0` |
| Real gradle run | Deferred — no Android SDK/NDK locally (per brief: coordinator proves via CI on the branch) | — |

Proof scripts (mirroring exact Kotlin candidate order / `File` semantics and
`MascotSpec.parse`/`srcFor` raw-src semantics): `raw/proof_loader_resolution.py`,
`raw/proof_fixture_values.py`.

## Out-of-scope findings
- `IconDecoderTest.testStarterConfigIconsDecodeCleanly` resolves only from
  `crates/tauri-plugin-orbitkit/android` (its 4 candidates reach ≤3 levels up, no
  upward loop). From `crates/tauri-plugin-orbitkit` it would not find the fixture —
  pre-existing limitation (old candidates had the same reach), left as-is per brief
  ("keep same search-upwards logic, change only relative path"). CI cwd is the
  android dir. Marked INFO in `raw/loader-resolution.txt`.

## Notes
- No Rust changes → Rust gate not applicable to this task.
- Code commit (all allowlisted changes + raw/ evidence): `86965eaedb3ba605c8723b5cbefa63d4607dc4db`. Branch tip = this REPORT-only commit.

READY FOR REVIEW at `86965eaedb3ba605c8723b5cbefa63d4607dc4db`
