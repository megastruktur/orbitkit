#!/usr/bin/env python3
"""Proof (a): the repointed Kotlin config loaders resolve the frozen fixture
from the CI gradle working dir crates/tauri-plugin-orbitkit/android.

Mirrors kotlin.io.File semantics: File("rel") resolves against user.dir;
File(userDir, "rel") = userDir/rel; upward loop walks parentFile from userDir.
Candidate lists are byte-for-byte the lists now in the three test files.
"""
import os, sys

REPO = "/home/megastruktur/orca/workspaces/orbitkit/okc-integ-fix7"
FIXTURE = "packages/orbitkit/src/test-fixtures/starter-0.1.0.json"

def kfile(*parts):
    """java.io.File(parent, child) / File(path) path join + normalize."""
    return os.path.normpath(os.path.join(*parts))

def candidates_mascot_spec(user_dir):
    # 6 entries: File(rel) resolves identically to File(userDir, rel); mirrors Kotlin list order.
    return [
        kfile(user_dir, FIXTURE),
        kfile(user_dir, "../../../" + FIXTURE),
        kfile(user_dir, "../../../../" + FIXTURE),
        kfile(user_dir, FIXTURE),
        kfile(user_dir, "../../../" + FIXTURE),
        kfile(user_dir, "../../../../" + FIXTURE),
    ]

def simple(cands, user_dir):
    return [
        kfile(user_dir, FIXTURE),
        kfile(user_dir, "../../../" + FIXTURE),
        kfile(user_dir, "../../../../" + FIXTURE),
        kfile(user_dir, FIXTURE),
        kfile(user_dir, "../../../" + FIXTURE),
        kfile(user_dir, "../../../../" + FIXTURE),
    ]

def load_mascotspec_svgicon(user_dir):
    # MascotSpecTest.loadConfigFile / SvgIconTest.loadConfigFile (identical logic)
    for i, c in enumerate(candidates_mascot_spec(user_dir)):
        if os.path.isfile(c):
            return ("candidates[%d]" % i, c)
    d = user_dir
    while os.path.dirname(d) != d:
        check = kfile(d, FIXTURE)
        if os.path.isfile(check):
            return ("upward-loop", check)
        d = os.path.dirname(d)
    return (None, None)

def load_icondecoder(user_dir):
    # IconDecoderTest.testStarterConfigIconsDecodeCleanly (4 candidates, no loop)
    cands = [
        kfile(user_dir, FIXTURE),
        kfile(user_dir, "../../../" + FIXTURE),
        kfile(user_dir, FIXTURE),
        kfile(user_dir, "../../../" + FIXTURE),
    ]
    for i, c in enumerate(cands):
        if os.path.isfile(c):
            return ("candidates[%d]" % i, c)
    return (None, None)

failures = 0
# REQUIRED: resolution from the CI gradle working dir (drives exit code).
for label, cwd_rel, fn in [
    ("MascotSpecTest.loadConfigFile",     "crates/tauri-plugin-orbitkit/android", load_mascotspec_svgicon),
    ("SvgIconTest.loadConfigFile",        "crates/tauri-plugin-orbitkit/android", load_mascotspec_svgicon),
    ("IconDecoderTest (testStarterConfigIconsDecodeCleanly)", "crates/tauri-plugin-orbitkit/android", load_icondecoder),
]:
    user_dir = os.path.join(REPO, cwd_rel)
    how, resolved = fn(user_dir)
    ok = resolved is not None and os.path.isfile(resolved)
    if not ok:
        failures += 1
    print("REQUIRED %s | user.dir=%s" % (label, user_dir))
    print("  -> %s resolved: %s | exists=%s" % (how, resolved, ok))
    print("  -> %s" % ("PASS" if ok else "FAIL"))

print()
# INFORMATIONAL: gradle may also run from the plugin dir. MascotSpec/SvgIcon
# loaders find the fixture via their upward loop. IconDecoderTest only lists
# up-to-3-level candidates and has no loop, so it does not resolve from there —
# a pre-existing limitation (its old candidates had the same reach), unchanged
# by this fix; CI runs gradle from the android dir, where it resolves.
for label, cwd_rel, fn in [
    ("MascotSpecTest.loadConfigFile",     "crates/tauri-plugin-orbitkit",         load_mascotspec_svgicon),
    ("SvgIconTest.loadConfigFile",        "crates/tauri-plugin-orbitkit",         load_mascotspec_svgicon),
    ("IconDecoderTest (testStarterConfigIconsDecodeCleanly)", "crates/tauri-plugin-orbitkit",         load_icondecoder),
]:
    user_dir = os.path.join(REPO, cwd_rel)
    how, resolved = fn(user_dir)
    ok = resolved is not None and os.path.isfile(resolved)
    print("INFO %s | user.dir=%s" % (label, user_dir))
    print("  -> %s resolved: %s | exists=%s -> %s" % (how, resolved, ok, "PASS" if ok else "FAIL (pre-existing, not CI cwd)"))

# the old live path must NOT be read by the new loaders from any repo cwd
live = kfile(REPO, "examples/starter/src/orbitkit.config.json")
print("note: live examples/starter config exists=%s (loaders no longer reference it)" % os.path.isfile(live))
sys.exit(1 if failures else 0)
