# REPORT okc-popups-dynamic (campaign orbitkit-cutecare-v02, attempt 1 — ROUND 2)

Round 1 reviewed at 441ea60: AC1, AC2, AC4–AC7 PASS; F1 (blocker, AC3) + F2–F5 fixed below.
Base now includes campaign tip 6f16dbb (bubble-badge merged).

## Round 2 findings — status
- **F1 BLOCKER (AC3) — FIXED.** `resolve_popup_url` no longer treats parse-failures as
  app-relative by default. New `is_safe_app_relative` guard rejects empty strings,
  scheme-relative `//host/...`, any backslash (`/\\host`, `\\host`), control chars, and `:`
  before the first `/` (smuggled schemes); a leading `/` must be followed by a non-`/` char.
  Additionally the candidate is joined against the app base (`tauri://localhost`) and rejected
  unless scheme+host are preserved. `test_resolve_popup_url_rejects_scheme_relative_smuggles`
  asserts `invalid_config` for `//evil.example/x`, `/\evil.example/x`, `\evil.example/x`,
  `p.html?q=http://x`, `""` — all returned `Ok(App)` on 441ea60, so the test FAILS there
  (mutation-sensitive). Legit `/popups/note.html?x=1` still resolves to the app origin
  (pinned in `test_resolve_popup_url_app_relative`).
- **F2 Minor — FIXED.** `build.rs` COMMANDS now lists `list_popups`; gate re-ran the generator —
  regenerated permission files are byte-identical to the committed ones (nothing to commit).
- **F3 Minor — FIXED.** `mobile.rs::close_popup` now emits `orbitkit://popup-closed` with the
  FULL label (bare ids from legacy sheet callers normalized via the K11 label rule); the legacy
  `orbitkit://popup-close {id}` echo still carries the raw argument so `PopupSheet`'s
  id-matching keeps working.
- **F4 Minor — FIXED.** `desktop.rs` selftest block re-indented by hand (no cargo fmt).
- **F5 INTEGRATION — DONE.** Merged `megastruktur/okc-campaign` (6f16dbb). `bridge.test.ts`
  conflict resolved keeping BOTH sides (popup lifecycle no-op tests + bubble-badge suite);
  `bridge.ts` auto-merged.

## Gates on the merged tree (all re-run)
- `pnpm -r build` exit 0; `pnpm -r test` exit 0 — **303/303** (283 popups-side + 20 bubble-badge);
  `pnpm -r check` exit 0.
- Rust gate exit 0 — **48 tests ok** (47 + F1 smuggle test), clippy `-D warnings` clean,
  `OKC_RUST_GATE_OK`.

Base: `2f73d78752365c82ee277ece52cf47810dd72ddc` (okc-integ-fix1 tip). Branch `megastruktur/okc-popups-dynamic`.

## Per-criterion results

### AC1 — `open_popup {id, params?, instanceKey?}`, idempotent label, no duplicate — PASS
- Label per K11: `orbitkit-popup-{id}` / `orbitkit-popup-{id}-{instanceKey}`, instanceKey regex
  `^[a-z0-9_-]{1,32}$` enforced (pure `popup_label`, lib.rs).
- Mutation-sensitive (Rust, `desktop.rs::tests`):
  - `test_open_popup_creates_window_idempotently` — opens twice on a `tauri::test::mock_app`;
    asserts exactly one window `orbitkit-popup-chat`. Fails if open rebuilds/duplicates.
  - `test_open_popup_instance_keys_create_distinct_windows` — keys `chat-1`/`chat_2` give two
    windows with exact labels; a repeat of `chat-1` adds nothing.
  - `test_popup_label_rejects_invalid_instance_keys` (lib.rs) — empty/UPPER/space/non-ASCII/dot/33-char
    keys → `invalid_config`; 32-char key accepted.
- Note: mock-runtime event loop never runs in unit tests, so window removal after `close()` is not
  observable on mock; idempotency is asserted via the window set, which is what "never duplicates"
  means observably there.

### AC2 — `{param}` substitution, URL-encoded; unknown placeholder → `invalid_config`; unknown id → `not_found` — PASS
- `substitute_popup_params` + `percent_encode` (lib.rs): values percent-encoded (UTF-8, RFC 3986
  unreserved kept); unknown/missing placeholder → `invalid_config`; unclosed `{` kept verbatim.
- Mutation-sensitive (lib.rs): `test_substitute_popup_params_encodes_values`
  (`a b&c=1` → `a%20b%26c%3D1`, multibyte `хелло` → `%D1%85…`),
  `test_substitute_popup_params_unknown_placeholder_rejected`.
- Unknown id → `not_found`: `lookup_popup` (existing, kept) + asserted in
  `test_open_popup_rejects_invalid_requests` (desktop.rs, mock app).

### AC3 — URL scheme policy per K11 — PASS
- `resolve_popup_url` (lib.rs, pure): app-relative (URL parse fails → `App`), loopback
  `http(s)://127.0.0.1|localhost:<port>` with explicit port required, `https://` origins from
  `app.allowedOrigins` (scheme+host+effective-port match, default 443 normalised). `file:`,
  `javascript:`, `data:`, non-loopback hosts, portless loopback, `http://` origin entries →
  `invalid_config`.
- Mutation-sensitive (lib.rs): `test_resolve_popup_url_app_relative`, `test_resolve_popup_url_loopback`
  (incl. `http://[::1]:3000/` rejected — contract names only 127.0.0.1/localhost),
  `test_resolve_popup_url_policy` (incl. wrong-port and http-origin rejections). Also exercised
  end-to-end in `test_open_popup_rejects_invalid_requests` (`javascript:` popup → no window created).

### AC4 — Spec fields applied from config (pure `resolve_popup_spec` test) — PASS
- `resolve_popup_spec` (lib.rs) resolves title/width/height/resizable/alwaysOnTop/decorations/
  transparent/skipTaskbar/minWidth/minHeight with K7 defaults (resizable=true, alwaysOnTop=false,
  decorations=true, transparent=false, skipTaskbar=false). Builder applies all fields + conditional
  `min_inner_size`.
- Mutation-sensitive (lib.rs): `test_resolve_popup_spec_defaults_and_overrides` — asserts the full
  default struct (`assert_eq!` on every field) and every override; fails if any default flips.

### AC5 — Events `orbitkit://popup-shown|popup-closed {label}`, `list_popups`, `close_popup {label}` — PASS
- `popup-shown` emitted on create AND idempotent re-show (desktop). `popup-closed` emitted by
  `close_popup` directly and by a per-window `WindowEvent::Destroyed` listener (user-initiated
  closes), deduped via `pending_close: Arc<Mutex<HashSet<String>>>` so real platforms never
  double-emit. `list_popups` returns sorted labels of windows with the `orbitkit-popup-` prefix.
  `close_popup` accepts full label; non-popup labels → `not_found` (guards against closing
  e.g. `orbitkit-mascot`); already-closed popup label → no-op Ok.
- Mutation-sensitive (desktop.rs, mock app): `test_popup_events_and_list` — pins exact event
  payloads `{"label":"orbitkit-popup-chat"}`, `list_popups` content, and the non-popup-label
  `not_found` rejection. Fails if events are renamed/dropped (pre-change code emitted none).
- Mock-runtime limitation (documented): the mock event loop never dispatches `Destroyed`, so the
  listener path is covered by design review + dedupe logic, not by unit test; `close_popup`'s direct
  emission is what the test pins.

### AC6 — TS bridge — PASS
- `openPopup(id, opts?: {params?, instanceKey?})` with backward-compatible `openPopup(id)`
  (options keys omitted when absent — `5c` pins exact arg keys). `closePopup(label)` sends
  `{label}`. `listPopups()` → `string[]`. `onPopupShown`/`onPopupClosed` listen to
  `orbitkit://popup-shown`/`-closed` with `{label}` payloads.
- Legacy `onPopupOpen`/`onPopupClose` + `PopupOpenPayload`/`PopupClosePayload` KEPT: the Android
  native Kotlin layer and `PopupSheet.svelte` consume `orbitkit://popup-open|-close`; K13 forbids
  Android code changes, so removal would break the real Android sheet path. Mobile Rust arms now
  emit both contract events and the legacy sheet events.
- Mutation-sensitive (bridge.test.ts): `5a` pins command+args (fails on rename/payload change);
  `5b` pins opts forwarding; `6` pins `{label}`; `6b` pins `list_popups` command + array return;
  the two `popup-shown`/`popup-closed` subscription tests pin exact event names + payload delivery
  + real unlisten; non-Tauri no-op tests for all four subscription fns.

### AC7 — Gates — PASS
- `pnpm install --frozen-lockfile` ok. `pnpm -r build` exit 0.
- `pnpm -r test` exit 0 — **283/283** (baseline 276; +7 net: new K11 tests, legacy kept,
  PopupSheet close-path tests re-pinned to `{label}` arg).
- `pnpm -r check` exit 0.
- Rust gate `$OKC_RUST_GATE` exit 0 — **47 tests ok** (baseline 36; +11), clippy `-D warnings` clean,
  `OKC_RUST_GATE_OK` printed.

## Mutation-sensitivity summary (test → fails on pre-change behaviour)
| Criterion | Test |
|---|---|
| AC1 | `test_open_popup_creates_window_idempotently`, `test_open_popup_instance_keys_create_distinct_windows`, `test_popup_label_rejects_invalid_instance_keys` |
| AC2 | `test_substitute_popup_params_encodes_values`, `test_substitute_popup_params_unknown_placeholder_rejected`, `test_open_popup_rejects_invalid_requests` |
| AC3 | `test_resolve_popup_url_loopback`, `test_resolve_popup_url_policy`, `test_resolve_popup_url_app_relative` |
| AC4 | `test_resolve_popup_spec_defaults_and_overrides` |
| AC5 | `test_popup_events_and_list` |
| AC6 | bridge.test.ts `5a/5b/5c/6/6b` + `popup-shown`/`popup-closed` subscription tests |

## Post-report fixes
- `list_popups` unified to `Result<Vec<String>>` on both arms (desktop returns `Ok(labels)`):
  the original `Ok(app.orbitkit().list_popups())` in commands.rs would not compile for the
  android target (E0308, `Ok` wrapping `Result`); the desktop-only gate cannot catch
  android-target compilation. Gate re-run green (47 tests, clippy clean).

## Scope deviations (files outside allowlist, minimal, per-file justification)
- `docs/api.md` — K13 explicitly mandates documenting new commands there: updated `open_popup`/
  `close_popup` rows, added `list_popups` row. Table-only change.
- `packages/orbitkit/src/PopupSheet.test.ts` — test-only fix required by the `closePopup(label)`
  contract change: the `mockIPC` matcher for `plugin:orbitkit|close_popup` now matches `args.label`
  instead of `args.id`. Component behaviour unchanged; the sheet still passes the popup id and the
  mobile Rust arm echoes it back as the legacy `{id}` event, so Android runtime behaviour is
  preserved.

## Design decisions worth review
1. **Legacy + contract events coexist.** `mobile.rs::open_popup/close_popup` emit BOTH the K11
   `popup-shown`/`popup-closed` `{label}` events and the legacy `popup-open`
   `{id,title,url,width,height}` / `popup-close {id}` events (the latter consumed by Kotlin +
   `PopupSheet`). Desktop emits only the K11 events (it never emitted legacy popup events).
2. **`popup-closed` double-source with dedupe.** `close_popup` emits directly (deterministic,
   unit-testable); `WindowEvent::Destroyed` covers user-initiated closes; `pending_close` set
   prevents double emission on real runtimes. Mock runtime never dispatches `Destroyed`
   (`run_iteration` is a no-op in tauri 2.11.6 mock), hence the direct emission.
3. **Loopback requires explicit port** (literal reading of `http(s)://127.0.0.1|localhost:<port>`).
   Portless loopback → `invalid_config`. IPv6 `[::1]` not in the contract allowlist → rejected.
4. **`WebviewWindowBuilder` has no `on_window_event`** in tauri 2.11.6; listener registered on the
   built `WebviewWindow` instead.
5. Removed `popup_open_payload` + its test (payload superseded; mobile builds the legacy JSON
   inline where it is still needed).

## Out-of-scope findings (not fixed)
- `docs/api.md` command table previously claimed `open_popup`/`close_popup` return `unsupported` on
  Android — stale since the Android sheet work; rows now corrected.
- `docs/architecture/contracts.md` (K4/K5) and `docs/platforms/android.md` still document
  `orbitkit://popup-open|-close` as the only popup events without mentioning the K11 label events.
  Left untouched (outside allowlist); suggest a docs pass after campaign merge.
- `CHANGELOG.md` has no entry for this task (campaign owns the changelog at merge time, assumed).

## Contract questions
None blocking. Interpretations taken (documented above): loopback needs explicit port; `close_popup`
with a non-popup label is `not_found`; `open_popup` on an existing label also re-emits `popup-shown`.

## Verification transcript
See `raw/`: `rust-gate-final.log` (EXIT=0, `OKC_RUST_GATE_OK`, final re-run after the `list_popups` Result unification), `pnpm-build.log` (EXIT=0),
`pnpm-test.log` (EXIT=0, 283/283), `pnpm-check.log` (EXIT=0), `rust-gate-attempt1-errors.log`
(first run's 6 compile errors, all fixed: const HashMap::new, selftest arity, Listener import,
missing None arg).

READY FOR REVIEW at 69873cabadc143b25d9d46747643607b5d5d8444 (final code commit 69873ca; the sha-pinning commit is report-only)

## Round-2 review responses
See "Round 2 findings — status" above; all five findings addressed on the merged tree.
