#!/usr/bin/env python3
"""
Vendor Lucide icons from upstream commit f06ac67e33d6 and update orbitkit.config.json.
Asserts that base64 decoded data URLs match the on-disk SVG bytes exactly.
"""

import base64
import json
import urllib.request
from pathlib import Path

COMMIT = "f06ac67e33d6"
BASE_URL = f"https://raw.githubusercontent.com/lucide-icons/lucide/{COMMIT}/icons"

ICON_MAP = {
    "notes": "file-text",
    "timer": "timer",
    "settings": "settings",
    "about": "info",
    "quit": "power",
}

REPO_ROOT = Path(__file__).resolve().parents[3]
ICONS_DIR = REPO_ROOT / "examples/starter/public/icons"
CONFIG_PATH = REPO_ROOT / "examples/starter/src/orbitkit.config.json"

def main():
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    b64_urls = {}

    for local_name, upstream_name in ICON_MAP.items():
        url = f"{BASE_URL}/{upstream_name}.svg"
        print(f"Fetching {upstream_name}.svg from {url}...")
        req = urllib.request.Request(url, headers={"User-Agent": "OrbitKit-Scaffold/1.0"})
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")

        # Change ONLY stroke="currentColor" -> stroke="#E6F6FF"
        assert 'stroke="currentColor"' in content, f"stroke='currentColor' not found in {upstream_name}.svg"
        patched = content.replace('stroke="currentColor"', 'stroke="#E6F6FF"')

        out_path = ICONS_DIR / f"{local_name}.svg"
        out_bytes = patched.encode("utf-8")
        out_path.write_bytes(out_bytes)
        print(f"Wrote {len(out_bytes)} bytes to {out_path}")

        # Base64 encode
        b64_str = base64.b64encode(out_bytes).decode("ascii")
        data_url = f"data:image/svg+xml;base64,{b64_str}"
        b64_urls[local_name] = data_url

        # Strict roundtrip assertion: decoded base64 MUST equal the on-disk file bytes
        decoded = base64.b64decode(b64_str)
        assert decoded == out_bytes, f"Roundtrip assertion failed for {local_name}"
        assert decoded == out_path.read_bytes(), f"Disk comparison failed for {local_name}"
        print(f"Asserted roundtrip match for {local_name}: {len(decoded)} bytes")

    # Update orbitkit.config.json
    print(f"\nUpdating {CONFIG_PATH}...")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    for item in config.get("menu", {}).get("items", []):
        item_id = item.get("id")
        if item_id in b64_urls:
            item["icon"] = b64_urls[item_id]
            print(f"Updated icon for item '{item_id}'")

    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
        f.write("\n")

    print("\nVerifying updated orbitkit.config.json...")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        reloaded = json.load(f)

    for item in reloaded["menu"]["items"]:
        item_id = item["id"]
        assert item["icon"].startswith("data:image/svg+xml;base64,")
        payload = item["icon"].split(",", 1)[1]
        raw_svg = base64.b64decode(payload)
        expected_svg = (ICONS_DIR / f"{item_id}.svg").read_bytes()
        assert raw_svg == expected_svg, f"Mismatch in config for {item_id}"
        print(f"Verified config icon for '{item_id}' matches on-disk SVG verbatim ({len(raw_svg)} bytes)")

    print("\nAll icon provenance assertions PASSED.")

if __name__ == "__main__":
    main()
