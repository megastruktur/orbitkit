#!/usr/bin/env python3
"""Proof (b): every assertion the 6 red Android tests make against the starter
config holds on the frozen fixture packages/orbitkit/src/test-fixtures/starter-0.1.0.json.

Mirrors MascotSpec.parse/srcFor (raw src values, no decoding) and the
SvgParser element order (body, ring, eyeL, eyeR, pupilL, pupilR) plus
IconDecoder's base64 data-URL expectations for menu icons.
"""
import base64, json, re, sys

FIXTURE = "/home/megastruktur/orca/workspaces/orbitkit/okc-integ-fix7/packages/orbitkit/src/test-fixtures/starter-0.1.0.json"
cfg = json.load(open(FIXTURE, encoding="utf-8"))
m = cfg["mascot"]
results = []

def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))

# testMascotSpecParseFromRealStarterConfig
check("kind == svg (MascotKind.SVG)", m.get("kind") == "svg", m.get("kind"))
check("size == 96", m.get("size") == 96, m.get("size"))
check("initialState == idle", m.get("initialState") == "idle", m.get("initialState"))
check("top-level src starts with <svg (not fallback)", m.get("src", "").lstrip().startswith("<svg"))
check("exactly 2 states", isinstance(m.get("states"), dict) and len(m["states"]) == 2, sorted(m.get("states", {})))

TAG = r"<(circle|ellipse|rect|line|polyline|polygon|path)\b"
def elements(svg):
    return list(re.finditer(TAG + r"[^>]*>", svg))

def attr(tag, name):
    hit = re.search(name + r'\s*=\s*"([^"]*)"', tag)
    return hit.group(1) if hit else None

idle, busy = m["states"]["idle"], m["states"]["busy"]

# testSrcForIdleShowsBlueBody / testSrcForBusyShowsAmberBody (srcFor returns raw state src)
check('srcFor("idle") contains #4f7cff', "#4f7cff" in idle["src"])
check('srcFor("busy") contains #f59e0b', "#f59e0b" in busy["src"])

# testIdleMascotFromConfigParsesCorrectElementsAndPaint
ie = [attr(x.group(0), "fill") for x in elements(idle["src"])]
itags = [x.group(1) for x in elements(idle["src"])]
check("idle parses into exactly 6 elements", len(itags) == 6, str(itags))
check("idle element order body/ring/eyes/pupils", itags == ["circle", "ellipse", "circle", "circle", "circle", "circle"], str(itags))
if len(ie) == 6:
    check("idle[0] body fill #4f7cff, no stroke", ie[0] == "#4f7cff" and attr(elements(idle["src"])[0].group(0), "stroke") is None, ie[0])
    ring = elements(idle["src"])[1].group(0)
    check("idle[1] ring fill none, stroke #9db4ff, width 4, rotate(-20 80 80)",
          attr(ring, "fill") == "none" and attr(ring, "stroke") == "#9db4ff"
          and attr(ring, "stroke-width") == "4" and attr(ring, "transform") == "rotate(-20 80 80)",
          "%s/%s/%s/%s" % (attr(ring, "fill"), attr(ring, "stroke"), attr(ring, "stroke-width"), attr(ring, "transform")))
    check("idle[2],[3] eyes #ffffff", ie[2] == "#ffffff" and ie[3] == "#ffffff", str(ie[2:4]))
    check("idle[4],[5] pupils #10141a", ie[4] == "#10141a" and ie[5] == "#10141a", str(ie[4:6]))

# testBusyMascotFromConfigGivesAmberBody
be = [attr(x.group(0), "fill") for x in elements(busy["src"])]
btags = [x.group(1) for x in elements(busy["src"])]
check("busy parses into exactly 6 elements", len(btags) == 6, str(btags))
if len(be) == 6:
    check("busy[0] body fill #f59e0b", be[0] == "#f59e0b", be[0])
    bring = elements(busy["src"])[1].group(0)
    check("busy[1] ring stroke #fcd34d", attr(bring, "stroke") == "#fcd34d", attr(bring, "stroke"))

# testStarterConfigIconsDecodeCleanly (5 items; IconDecoder: base64 svg data URL -> DecodedIcon.Svg, viewBox 24x24, commands non-empty)
items = cfg["menu"]["items"]
check("menu has 5 items", len(items) == 5, str([i.get("label") for i in items]))
for item in items:
    icon = item.get("icon")
    label = item.get("label", "?")
    ok = icon is not None and icon.startswith("data:image/svg+xml;base64,")
    body = base64.b64decode(icon.split(",", 1)[1]).decode("utf-8") if ok else ""
    vb = re.search(r'viewBox\s*=\s*"0 0 24 24"', body) if body else None
    has_cmds = bool(re.search(r'\bd\s*=\s*"[^"]+"|<(circle|ellipse|rect|line|polyline|polygon)\b', body)) if body else False
    check("icon %s: base64 svg, viewBox 24x24, has commands" % label,
          ok and "<svg" in body and vb is not None and has_cmds,
          "" if ok else "missing icon")

fails = [n for n, ok, _ in results if not ok]
for n, ok, d in results:
    print("%s %s%s" % ("PASS" if ok else "FAIL", n, ("  [%s]" % d) if d and not ok else ""))
print("\n%d checks, %d failed" % (len(results), len(fails)))
sys.exit(1 if fails else 0)
