# okc2-caption evidence

Кампания: okc2 (caption-center). Воркер: glm-5.3-flash (omp, orca worktree okc2-caption).
Координатор: hermes planner TUI (Magos Logis). Ревью: kimi-k3-256k (LiteLLM-роут; прямой
пин упал — No API key found for moonshot, MODEL_DEVIATION по прецеденту okr EVENTS #8).

## Версии

- node 26.7.0, pnpm 12.4.1, vite 8.3.0, vitest 5.0.1, svelte 5.57.1
- Base: f1d8a81881efc51d9ced34d4201282cfb541b364 (= orbitkit main на старт кампании)

## Коммиты

- `433f687` fix(orbitkit): K14 caption dead-centre on horizontal arcs — no jump on label change
- `0fb84ce` docs(evidence): okc2-caption — test run + acceptance criteria

## Гейты

### pnpm test (packages/orbitkit)

1. Воркер: 17 файлов / 428 passed, exit 0 (17:02:57, в терминале воркера).
2. Координатор (независимый, на 433f687): `pnpm test` →
   `Test Files 17 passed (17), Tests 428 passed (428)`, EXIT=0 (17:03:36).
3. Ревьюер kimi-k3-256k: вердикт PASS, findings info + 1 minor (evidence dir okc vs okc2).

### RT-проба (координатор, Chromium headless-shell 1234, реальная вёрстка)

Стенд: untracked probe-страница (left-arc menu r=92 span=180, caption on, два пункта
с label радикально разной ширины: "A" и "Quick Record Popup"), vite createServer
(плагин svelte, порт 5211) + chrome-headless-shell --dump-dom. Пробник удалён после
замера (рабочее дерево чистое: только evidence/okc2/ + REVIEW-mandate.md untracked).

Замер getBoundingClientRect() caption-пилюли при hover каждого пункта:

```
RESULT {"transform":"matrix(1, 0, 0, 1, -8, -3)",
        "short":{"cx":180,"cy":180,"w":24},
        "long":{"cx":180,"cy":180,"w":137},
        "deltaCx":0,"pass":true,"captionText":"Quick Record Popup"}
```

- Центр пилюли (cx=180, cy=180) НЕПОДВИЖЕН при смене label (deltaCx=0 < 0.5).
- Ширина меняется 24 → 137 px ⇒ рост симметричный относительно origin дуги.
- 180,180 = центр 360×360 stage = origin дуги (точка маскота в оверлее).
- Компонент transform `matrix(1,0,0,1,-8,-3)` — композит-центрирование контейнера,
  caption-классы дают мёртвый центр (translate(-50%,-50%)).

Скриншоты (360×360, hover "A" и hover "Quick Record Popup"):
- rt-left-short.png, rt-left-long.png
- пиксельная проверка: 143/143 не-фоновых сэмпла в окне ±60×±40 px вокруг (180,180)
  в ОБОИХ кадрах — пилюля присутствует центром на origin в обоих состояниях.

## Acceptance

1. Оба горизонтальных caption-класса = translate(-50%, -50%) — подтверждено диффом.
2. Position-тест 6 кейсов — подтверждено ревью (строки 1173–1181).
3. vitest 428/428 exit 0 (воркер + координатор), существующие ожидания не изменены
   (diff тест-файла: +14/−0).
4. Коммиты в megastruktur/okc2-caption — 433f687 + 0fb84ce.

## Отклонения

- evidence в evidence/okc2/ (этот файл) — предыдущий okc/.../caption.md остался от
  воркера (minor у ревьюера, содержимое полное). Дубликат не канон.
- Прямой пин ревьюера kimi-k3 → LiteLLM moonshotai/kimi-k3-256k (та же модель,
  отклонение задокументировано выше).
