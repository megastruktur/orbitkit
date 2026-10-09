# okr-trigger — evidence

- Дата: 2026-10-09
- Worktree: `/home/megastruktur/orca/workspaces/orbitkit/okr-trigger`, ветка `megastruktur/okr-trigger`
- Модель: glm-5.3-flash (zai/glm-5.3-flash:max)
- Parent commit: `9306014` → **Commit: `ac056f2167043be736860dd8b385ef5b5bf0f80b`** (evidence-файл идёт отдельным вторым коммитом)

## Изменения (7 файлов, +238/−8)

| Файл | Что |
|---|---|
| `packages/orbitkit/src/config.ts` | `MenuConfig["trigger"] = "click" \| "hover" \| "right-click"`; `validateConfig` принимает новые, отвергает прочие (`menu.trigger: must be 'click', 'hover', or 'right-click'`); `withDefaults` держит default `"click"` |
| `packages/orbitkit/src/dragGesture.ts` | Опшен `openButton?: "left" \| "right"` (default `"left"`); при `"right"`: `pointerdown button===2` ставит pending (toggle-путь), левая — только drag (toggle заглушен); новый хендлер `oncontextmenu`: preventDefault (подавление системного меню) + toggle, после drag — только подавление без toggle. Enter/Space не тронуты |
| `packages/orbitkit/src/roam.ts` | 1 строка: `oncontextmenu` форвардится через `createRoamDrag` handlers (требование нового обязательного поля `DragGestureHandlers`, поймал `tsc`) |
| `crates/tauri-plugin-orbitkit/src/config.rs` | `MenuTrigger::RightClick`; serde `rename_all` `lowercase` → `kebab-case` (однoсловные варианты дают те же `"click"`/`"hover"`; `RightClick` → `"right-click"`). Прецедент в этом же файле: `MascotAnchor`, `MascotRoamCorner` уже kebab-case |
| `packages/orbitkit/src/config.test.ts` | +2 кейса: validate принимает `"right-click"`; withDefaults прокидывает `"right-click"` и держит `"click"` по умолчанию |
| `packages/orbitkit/src/dragGesture.test.ts` | +7 кейсов в новом `describe("createDragGesture openButton")` |
| `packages/orbitkit/README.md` | trigger описан с `"right-click"` |

Старые тесты: `git diff` тестовых файлов содержит **0 удалённых строк** (только добавления) — ожидания не менялись.

## Решение: почему toggle в `oncontextmenu`

Браузеры (WebKitGTK/Tauri, Chromium, Firefox — per UI Events) не доставляют `click` для button 2 — только `contextmenu`/`auxclick`. Поэтому при `openButton="right"` правый клик в реальном рантайме тогглится через `gesture.oncontextmenu`, который одновременно подавляет системное меню (preventDefault). Юнит-тест критерия 3 симулирует правую кнопку как `pointerdown(button 2)` + `onclick` → `onToggle` (путь click-события) — оба пути покрыты. Двойного toggle нет: для button 2 `click` не приходит, для button 0 `contextmenu` не приходит.

## Где подавляется contextmenu (acceptance 4)

В `createDragGesture` (чистый `oncontextmenu`, активен только при `openButton="right"`). Прокидывать на уровень кнопки не нужно: `Mascot.svelte` уже разворачивает `{...restProps}` на `<button>`, так что потребитель передаёт `oncontextmenu={gesture.oncontextmenu}` как prop — изменений в `Mascot.svelte` не требуется. `RadialMenu.svelte` не трогал: hover-выбор пунктов включается только при `config.trigger === "hover"`, `"right-click"` в него не попадает.

## Гейты

### 1. `pnpm test` в `packages/orbitkit` (vitest 5.0.1, jsdom)

```
 Test Files  17 passed (17)
      Tests  428 passed (428)
   Duration  1.72s
vitest exit: 0
```
(node v22.22.3, pnpm 12.4.1; +9 новых тестов — 2 в config.test.ts, 7 в dragGesture.test.ts)

### 2. `pnpm check` (`tsc --noEmit`)

```
$ tsc --noEmit
tsc exit: 0
```

### 3. `cargo check -p tauri-plugin-orbitkit` (нативно, host)

```
cargo build (261 crates compiled)
Finished `dev` profile [unoptimized + debuginfo] target(s) in 59.27s
```
Примечание: нативный `cargo test` на хосте не линкуется — `cc` в PATH это zig-обёртка (`~/.local/bin/cc → cc-zig`), gcc/clang на хосте нет; системных dev-симлинков glib не хватает. Поэтому тесты прогнаны в gate-образе.

### 4. `cargo test -p tauri-plugin-orbitkit --lib` в gate-образе (rustc 1.98.0, docker 29.8.1)

Образы собраны из `tools/docker/linux-desktop.Dockerfile` этого worktree (+clippy-слой как в `rust-gate.Dockerfile` предыдущей кампании):

```
docker build -f tools/docker/linux-desktop.Dockerfile -t orbitkit-linux-desktop:1 tools/docker
docker build -t okc-rust-gate:1 -   # FROM orbitkit-linux-desktop:1
```

```
$ docker run --rm --user 1000:1000 -v "$ROOT:$ROOT" -v orbitkit-cargo-cache:/cargo-cache \
    -e CARGO_TARGET_DIR="$ROOT/target-linux" -w "$ROOT" okc-rust-gate:1 \
    cargo test -p tauri-plugin-orbitkit --lib
test result: ok. 68 passed; 0 failed; 0 ignored; 0 measured
```

Новый тест и соседние (config::tests, 13 passed / 0 failed):

```
test config::tests::test_menu_trigger_right_click_parses ... ok
test config::tests::test_k2_minimal_config_defaults ... ok
test config::tests::test_k2_config_serde_roundtrip ... ok
test config::tests::test_starter_config_compat_k7 ... ok
...
test result: ok. 13 passed; 0 failed
```

`test_menu_trigger_right_click_parses`: `serde_json::from_str::<OrbitKitConfig>` с `"trigger": "right-click"` парсится; сериализация даёт ровно `"right-click"`; спеллинги `"click"`/`"hover"` не изменились; неизвестная строка (`"double-click"`) отвергается → приложение с инжектом нового конфига стартует.

## Мутационная проверка контракта TS↔Rust (антис-дрейф, требование владельца)

1. Union в `config.ts` `"right-click"` → `"rightclick"`: `pnpm check` **RED** — `src/config.test.ts(387,9): error TS2820: Type '"right-click"' is not assignable to type '"click" | "hover" | "rightclick" | undefined'`.
2. Литерал в `validateConfig` `"right-click"` → `"rightclick"`: vitest **RED** — `FAILED: validateConfig accepts menu.trigger 'right-click'` (AssertionError, config.test.ts:376).
3. Rust-сторона pinned тестом `test_menu_trigger_right_click_parses` (точные строки трёх вариантов + reject неизвестной).
4. Откат: `git diff` до/после мутаций **байт-в-байт идентичен** (`RESTORED_IDENTICAL`), контрольный полный vitest 428/428 green.

## Acceptance criteria — статус

1. ✅ validateConfig принимает `"right-click"`, прочие строки отвергает — тесты (`accepts menu.trigger 'right-click'` + существующий `validates menu trigger must be click or hover`).
2. ✅ Rust: parse-тест `config::tests::test_menu_trigger_right_click_parses` в crates-тестах (плюс cargo check green).
3. ✅ dragGesture: `openButton="right"` — правая тогглит по click-пути и через contextmenu, левая не тогглит (только drag); `openButton="left"` (default) — поведение идентично прежнему (существующий тест `non-primary mouse buttons are ignored` зелёный без правок).
4. ✅ `contextmenu` подавляется при `openButton="right"` (preventDefault + toggle-путь) — тесты `openButton='right': contextmenu is suppressed and toggles` и `... after a right drag suppresses without toggling`; обоснование размещения — секция выше.
5. ✅ `pnpm test` — 428/428, 17 файлов.
6. ✅ Старые тесты не менялись (0 удалённых строк в diff обоих тестовых файлов).

## Не входит (по allowlist)

- Вiring потребителя (пример `examples/starter/src/views/MascotView.svelte` / transcripter): передавать `openButton: "right"` + `oncontextmenu: gesture.oncontextmenu` при `config.menu.trigger === "right-click"` — за пределами allowlist этой задачи.
- `docs/api.md` (общерепозитный) не обновлялся — allowlist разрешает только README пакета.
