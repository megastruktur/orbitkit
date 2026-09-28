# REPORT okc-integ-fix1 (campaign orbitkit-cutecare-v02, attempt 1)

Worktree: `/home/megastruktur/orca/workspaces/orbitkit/okc-integ-fix1` (branch `megastruktur/okc-integ-fix1`), base `150d9c0`.

## What / why

Two independently-green tasks collided on `150d9c0`:

- okc-anim-states placed `// @ts-expect-error` on the Vite `?raw` import in
  `packages/orbitkit/src/mascotMachine.test.ts` (no `?raw` typing existed then).
- okc-passthrough added `packages/orbitkit/src/raw.d.ts` declaring `module "*?raw"`.

With the ambient declaration present, the directive became unused and
`pnpm -r check` failed with
`src/mascotMachine.test.ts(6,1): error TS2578: Unused '@ts-expect-error' directive.`
Build and all tests were unaffected.

## Fix (exactly per brief)

1. `packages/orbitkit/src/mascotMachine.test.ts` — removed the
   `// @ts-expect-error ...` line above `import mascotSource from "./mascotMachine.ts?raw";`;
   the 2 comment lines above the import now say the typing comes from `src/raw.d.ts`.
   No other change to the file.
2. `packages/orbitkit/src/raw.d.ts` — doc comment only: no longer says it is used
   only by passthrough.test.ts; now states it types every `?raw` import in the
   package. Declaration unchanged.

Diff scope: `git diff --stat` shows exactly the two allowlist files
(5 insertions, 5 deletions). No formatter with autofix run.

## Per-criterion result

| Criterion | Result |
|---|---|
| `@ts-expect-error` removed; comments reference `src/raw.d.ts` | PASS |
| `raw.d.ts` doc comment generalized; declaration untouched | PASS |
| Nothing else changed (allowlist respected) | PASS |

## Gates (all on fix commit `5225f23`)

| Gate | Exit | Evidence |
|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | raw/build.txt (install ran in same session; exit logged in transcript) |
| `pnpm -r build` | 0 | raw/build.txt |
| `pnpm -r test` | 0 — **276/276 passed, 13 files** | raw/test.txt |
| `pnpm -r check` (tsc --noEmit, all packages) | 0 | raw/check.txt |
| `bash plans/orbitkit-cutecare-v02/okc_tools/rust_gate.sh` | 0 — **36 passed**, `OKC_RUST_GATE_OK` | raw/rust_gate.txt |

## Mutation proof

Re-added the exact directive line
`// @ts-expect-error vite ?raw import has no type declarations in this package`
above the `?raw` import in a working-tree mutation of
`mascotMachine.test.ts`, ran `pnpm -r check`:

- Result: **fails**, exit 1, reproducing `src/mascotMachine.test.ts(6,1): error TS2578:
  Unused '@ts-expect-error' directive.` (raw/mutation-check-fails.txt, raw/mutation-exits.txt).
- File then restored to the committed state; `git diff --stat` re-verified only
  the two allowlist files.

So the passing `pnpm -r check` is mutation-sensitive to this exact fix.

## Out-of-scope findings

- Pre-existing (present at `150d9c0`, unrelated to this fix): build emits
  `[INEFFECTIVE_DYNAMIC_IMPORT]` warning — `@tauri-apps/api/window.js` dynamically
  imported by `packages/orbitkit/dist/passthrough.js` but statically imported by
  `dist/bridge.js`. Warning only, build exits 0.

READY FOR REVIEW at 5225f23
