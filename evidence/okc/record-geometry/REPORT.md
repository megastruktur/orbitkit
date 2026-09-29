# okc-record-geometry — record-windows.ps1 must follow the capped-shift app geometry

Campaign: orbitkit-cutecare-v02 · Branch: `megastruktur/okc-starter-defaults` · Base: main `525c81e`

## Root cause

Desktop Video run 36573470644 (on 525c81e) FAILED at Step 5 ("First Notes popup window not found").
The APP is correct — my r1 windowFit y-cap is merged — but the SCRIPT still modelled the OLD
uncapped shift. It logged `Startup contentShift = (0, 24); effective pin = (132, 216), arc origin
= (180, 204)` while the app's capped truth is `shift = (0, 0); pin = (132, 192); origin =
(180, 180)` (app: window (618,432) 360×288, mascot blob ends at screen y 720 = window bottom).
Every menu-disc aim was 24 px too low: the 96 px mascot click still hit, the 44 px `app.notes`
disc (edge of its hit region) missed → no Notes window → red.

Stale code: `Get-Content-Shift` (scripts/ci/record-windows.ps1) mirrored the pre-525c81e
demoWindowFit (`shift = ideal − clamped`, uncapped); the Step-2 observed-pre-fit override calls
the same function, so both callers were wrong together.

## Fix (scripts/ci/record-windows.ps1 only)

1. **Capped math mirrored** in `Get-Content-Shift` — now returns
   `Y = min(idealY − cY, WinH − MascotSize − PinY)` (the padding slack below the bottom-pinned
   mascot; exactly the merged `windowFit.ts` cap `Math.min(ideal.y − cy, height − m − gNew.y)`).
   Both callers (boot model at the geometry section, Step-2 observed-pre-fit override) go through
   the one function, so both are fixed. With the starter numbers the cap is 0 → shift (0,0),
   effective pin (132,192), origin (180,180).
2. **Post-fit ground-truth invariant at Step 2** (after the window reaches 360×288): the script
   cannot see the DOM, so it asserts the WINDOW-level invariants instead — mascot screen bottom
   (`windowTop + PinYEff + MascotSize`) must EQUAL the window bottom, and the window rect must sit
   fully inside the work area. Values are logged; violations fail loudly (that would be an APP
   regression, not a script issue).
3. Step 7 drag: r5 ≥150 px work-area margins untouched.
4. r4/r5 determinism instrumentation untouched (velocity-predicted clicks, miss diagnostics,
   bounded retries; with the static mascot the velocity prediction degenerates to v=(0,0) — kept).
5. Header + geometry-section comments updated: app caps the y shift at the mascot's bottom edge
   (mirrored here); mascot static by default (no roam; opt-in library feature).

## Verification (raw/)

- `raw/selfcheck-out.txt` (docker `mcr.microsoft.com/powershell:latest`, EXIT=0): **PARSE OK**
  via `[System.Management.Automation.Language.Parser]::ParseFile` (no host pwsh; image pre-pulled),
  then the REAL `Get-Content-Shift` extracted verbatim from the shipped script (lines 369–392)
  and executed with the failed run's inputs (pre-fit 404×404 @ (596,340), work area (0,0,1024,720),
  mascot 96, window 360×288, pin 132/192):
  - new shift = **(0, 0)**; effective pin **(132, 192)**; arc origin **(180, 180)**
  - `app.notes` disc local = **(30, 180)** (origin + radius at −180°) — consistent with the run's
    menu disc layout
  - old uncapped model contrast: shift.y 24 → pin (132,216), origin (180,204) — the failed run's
    exact logged values (mutation-sensitivity: the pre-change script produces these and the
    assertions fail)
  - post-fit invariant: mascot screen bottom 720 == window bottom 720; window inside the work area
- Honest limits: no Windows runner here — the full .ps1 flow was parse-checked and its geometry
  function executed under pwsh, not run end-to-end; the DOM is invisible to the script, so the
  window-rect invariant (not pixel truth) is the ground truth it asserts at Step 2.

## Round 3 (review PASS, 3 Minor)

1. **Stale roam comments reworded** — `Get-Mascot-Rect-Twice` ("roam moves the window ~24 px/s")
   and `Get-Mascot-Point` ("roam moves … never cache") now state the mascot is static by default
   and the rect changes only on drags / one-shot settle re-clamps (velocity instrumentation kept;
   reads v=(0,0) while static). Step 7 comment + timeline label: window follows the drag, settle
   re-clamp moves it back inside — "roam resumed" wording gone.
2. **Tautological bottom check replaced** — the Step-2 `mascotScreenBottom == windowBottom`
   assertion compared the model with itself (pin is DOM-invisible, so it reduced to
   `ContentShift.Y == 0`). Now the block observes APP truth only: (a) the OBSERVED final window
   rect must sit fully inside the work area (hard fail = app regression), and (b) the applied
   clamp delta `ideal − observed final` is logged as ground truth (`ideal` is pure geometry from
   the observed pre-fit rect, or the model pre-fit when the 25 ms poll missed it — the source is
   labelled in the log). Honest limit, stated in the comment: the applied WINDOW clamp is
   identical pre/post app-fix (the app change was to the CONTENT shift, which is DOM-visible
   only) — a model/app content-shift mismatch can only surface as missed discs via the r4 miss
   diagnostics; the mascot-bottom relation is not asserted.
3. **capY comment** — notes it equals the padding slack below the pinned mascot when `maxY == m`
   and `MinYp` is integral (the starter's numbers); in general `WinH − m − pin` with any ceil
   slack included.

Re-verification (`raw/selfcheck-r3.txt`, docker pwsh, EXIT=0): PARSE OK; the real extracted
function (now lines 369–395) still returns shift (0,0), pin (132,192), origin (180,180),
app.notes disc (30,180); old-model contrast (0,24)/(132,216)/(180,204) unchanged. Note: the
selfcheck's own "post-fit invariant OK" line is a numeric consequence check of the cap in the
scratch script — the recording script itself no longer makes that DOM-less claim.

Advisory (amend loop): no loop existed — the r1 handoff used a separate docs-pin commit
(`6febd9f`) on top of the referenced `11f55c1` (reachable as `HEAD~1`, verified `git cat-file -t`
→ commit). Same convention kept this round.

## Files changed

- `scripts/ci/record-windows.ps1` — capped Get-Content-Shift, Step-2 invariant, comments.
- `evidence/okc/record-geometry/` — this REPORT + raw/ (selfcheck.ps1, selfcheck-out.txt).

`git diff --name-only 525c81e..HEAD` ⊆ allowlist (verified below).

READY FOR REVIEW at c3e64f234e7cd8e1dd9968645b38628b59aa38fc
