# okrc-menu REPORT — K14 hovered-item caption

Task: `plans/radial-caption/okrc_menu.md` (contract K14, `okrc_PLAN.md` § Shared
contracts). Worktree `/home/megastruktur/orca/workspaces/orbitkit/okrc-menu`,
branch `megastruktur/okrc-menu`, base `6599e0e84ecd10ea5df4ee5dfd25bd77afe37db1`.

## Files changed (scope allowlist only)

| File | Diff |
|---|---|
| `packages/orbitkit/src/config.ts` | +14 / −0 (`MenuConfig.caption?`, withDefaults default, validateConfig check) |
| `packages/orbitkit/src/RadialMenu.svelte` | +119 / −0 (caption state/derived/handlers, `data-caption`, one `.orbitkit-caption` span, CSS) |
| `packages/orbitkit/src/RadialMenu.test.ts` | +125 / −0 (new `describe("K14 caption …")` only — existing tests unmodified) |
| `packages/orbitkit/src/config.test.ts` | +39 / −0 (new `describe("K14 caption config")` only) |
| `packages/orbitkit/demo/menu.ts` | +48 / −1 (`caption: true` on both configs; `?only=` / `?hover=` / `?focus=` capture hooks; `await tick()` before driving) |
| `evidence/okrc/menu/` | new (this REPORT + 2 screenshots) |

`git diff --numstat` verified: all test-file changes are pure additions
(criterion 2 diff rule).

## Commands and exit codes (chronological)

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `git log --oneline -1` | 0 | `6599e0e Merge campaign okv: …` — base confirmed |
| 2 | `pnpm install --frozen-lockfile` | 0 | workspace install (fresh node_modules) |
| 3 | `pnpm --filter @orbitkit/ui test` (first run) | 1 | 2 K14 focus tests failed — see "Captured defects" |
| 4 | `pnpm --filter @orbitkit/ui test` (after fix) | 0 | 17 files / 414 tests passed |
| 5 | `pnpm -r build && pnpm -r test && pnpm -r check` | 0 | gate green: `svelte-package` + `vite build`; vitest 414/414; app `node --test` 33/33; `tsc --noEmit` ×2 clean (pre-existing warnings only: `import.meta.env` in MascotView packaging, `gesture` non-reactive in MascotView — both predate this task) |
| 6 | same gate re-run after demo `await tick()` fix (coordinator steer) | 0 | identical green results |
| 7 | `git diff --numstat` | 0 | table above |

Key unit output (gate step 5):

```
 Test Files  17 passed (17)
      Tests  414 passed (414)
ℹ tests 33  ℹ pass 33  ℹ fail 0
GATE_EXIT:0
```

New coverage: `K14 caption (hovered-item label mirror)` — 8 tests (off ⇒ no
span/no attribute; on ⇒ exactly one aria-hidden span + empty `data-caption` at
rest; hover sets label; pointerleave empties; focus sets + wins over hover;
focusout empties; disabled hover never changes caption; close clears at once +
reopen starts empty; position classes arc-top / arc-bottom / arc-anchor→arc-top
/ non-arc→center). `K14 caption config` — 4 tests (withDefaults default false /
explicit true preserved; validateConfig accepts booleans; rejects non-boolean).

## RT-1 real-runtime evidence

Binary (coordinator-probed path):
`/home/megastruktur/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`

### Serve command (resolved empirically)

`vite` is not a direct dependency of `@orbitkit/ui` (pnpm strict layout → no
`.bin/vite`; `pnpm dlx vite` has no svelte plugin; plain http cannot compile
`.svelte`). Working dev server = vite `createServer` with the exact plugin set
of `packages/orbitkit/vitest.config.ts`, from `packages/orbitkit/`:

```bash
cd packages/orbitkit && node --input-type=module -e "
import { createServer } from 'file:///home/megastruktur/orca/workspaces/orbitkit/okrc-menu/node_modules/.pnpm/vite@8.3.0/node_modules/vite/dist/node/index.js';
const { svelte } = await import('@sveltejs/vite-plugin-svelte');
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  server: { port: 5199, strictPort: true, host: '127.0.0.1' },
});
await server.listen();
"   # → DEMO_SERVE_READY http://127.0.0.1:5199/demo/menu.html ; service stopped after capture
```

Health: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5199/demo/menu.html`
→ `200`; served `menu.ts` showed the svelte transform of `RadialMenu.svelte`.

### Screenshots (360×640)

```bash
CHROME=…/chrome-headless-shell
$CHROME --no-sandbox --disable-gpu --hide-scrollbars --window-size=360,640 \
  --virtual-time-budget=6000 --screenshot=evidence/okrc/menu/full-ring-hover.png \
  "http://127.0.0.1:5199/demo/menu.html?only=ring&hover=chat"      # exit 0
$CHROME --no-sandbox --disable-gpu --hide-scrollbars --window-size=360,640 \
  --virtual-time-budget=6000 --screenshot=evidence/okrc/menu/half-arc-focus.png \
  "http://127.0.0.1:5199/demo/menu.html?only=arc&focus=cut"        # exit 0
```

- `/home/megastruktur/orca/workspaces/orbitkit/okrc-menu/evidence/okrc/menu/full-ring-hover.png` (PNG 360×640, 68620 B) — full ring, hover on `chat`, caption `Chat`
- `/home/megastruktur/orca/workspaces/orbitkit/okrc-menu/evidence/okrc/menu/half-arc-focus.png` (PNG 360×640, 66409 B) — half arc, keyboard focus on `cut`, caption `Cut`

Demo capture hooks used (in scope, `demo/menu.ts`): `?only=ring|arc` isolates
one card, `?hover=<id>` dispatches `pointerenter`, `?focus=<id>` calls
`.focus()` — the headless shell has no real pointer/keyboard.

### Structural proof (same binary, `--dump-dom`)

- `?only=ring&hover=chat` → first menu container + span:
  `data-caption="Chat"` (hidden second menu: `""`)
- `?only=arc&focus=cut` → arc menu container + span: `data-caption="Cut"`
  (first menu: `""`)

Caption DOM shape in both dumps: one
`<span aria-hidden="true" class="orbitkit-caption orbitkit-caption-center …"
data-caption="…"></span>` per menu; text is CSS `content:
attr(data-caption)` (`.orbitkit-caption::after`), per-item `::after` tooltips
suppressed by `.orbitkit-radial-menu[data-caption] .orbitkit-radial-item::after
{ content: none; }`.

### Pixel proof (archived PNGs, canvas scan of the centre region)

Caption text colour `#e2e8f0` glyph pixels inside the central 240×400 window:
`full-ring-hover.png` = 622 px, `half-arc-focus.png` = 573 px — caption text is
rendered on both archived screenshots. (Item circles share the pill background
colour, so the pill box is not separable by that channel; the glyph channel is.)

### Caption placement

Caption placement is pure CSS inside the 0×0-origin container (centred class
for both demo menus — neither config declares `arc`); the container sits at the
centre of each 320×320 stage, r=110/item 52 leaves the caption clear of items.
The caption itself is not clipped in either capture. Capture-wide cosmetic
artifacts — demo layout, not K14: the demo card and dashed orbit chrome
truncate at the right 360px window edge (320px stage + paddings exceed the
viewport), and emoji icons render as tofu boxes (container lacks emoji fonts).
Neither affects the caption observables.

## Captured defects (fixed during the task)

1. **jsdom focus flush** — raw `item.focus()` bypasses testing-library's act
   wrapping, so Svelte template effects flush a microtask later and assertions
   read stale DOM. Fixed in tests by using `fireEvent.focusIn/focusOut`
   (bubbling focusin/focusout — the same events the component listens for).
2. **Demo capture hooks fired before items existed** — Svelte 5 `mount()`
   completes the first render asynchronously; `driveCaption` ran before
   `[data-orbitkit-radial-item=…]` was in the DOM (probe evidence:
   `item:false`). Fixed with `await tick()` after the mounts. Proven by
   `--dump-dom` before/after: `data-caption=""` → `data-caption="Chat"`/`"Cut"`.

A throwaway probe page used to isolate defect 2 was deleted before commit (per
coordinator steer); the live equivalent stays in `demo/menu.ts` params.

## Commit

Single conventional commit containing all sources + this evidence dir:
`feat(menu): hovered-item caption (K14)` on `megastruktur/okrc-menu`. HEAD SHA
= `git rev-parse HEAD` of the branch tip; it is echoed in the executor
ready-line (`okrc-menu ready: <sha>`) — a self-referential SHA inside this file
is impossible within the required single commit.
