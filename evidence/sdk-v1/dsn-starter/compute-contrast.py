#!/usr/bin/env python3
"""
Compute WCAG 2.1 relative luminance and contrast ratios for OrbitKit planetary design palette.
Formula: (L1 + 0.05) / (L2 + 0.05) where L1 > L2.
WCAG AA requirement for normal text: >= 4.5:1.
"""

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def relative_luminance(hex_color):
    hex_color = hex_color.lstrip('#')
    r, g, b = [int(hex_color[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
    return 0.2126 * srgb_to_linear(r) + 0.7152 * srgb_to_linear(g) + 0.0722 * srgb_to_linear(b)

def contrast_ratio(hex1, hex2):
    l1 = relative_luminance(hex1)
    l2 = relative_luminance(hex2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

def blend(fg_hex, alpha, bg_hex):
    fg_hex = fg_hex.lstrip('#')
    bg_hex = bg_hex.lstrip('#')
    fg_r, fg_g, fg_b = [int(fg_hex[i:i+2], 16) for i in (0, 2, 4)]
    bg_r, bg_g, bg_b = [int(bg_hex[i:i+2], 16) for i in (0, 2, 4)]
    r = int(fg_r * alpha + bg_r * (1 - alpha))
    g = int(fg_g * alpha + bg_g * (1 - alpha))
    b = int(fg_b * alpha + bg_b * (1 - alpha))
    return f"#{r:02X}{g:02X}{b:02X}"

def main():
    bg_space_dark = "#070B1A"
    bg_space_mid = "#0E1433"
    card_bg_composite = blend("#0E1433", 0.75, bg_space_dark)
    radial_disc_bg = blend("#0E1433", 0.85, bg_space_dark)

    palette = [
        ("Bright text / SVG icon stroke (#E6F6FF)", "#E6F6FF", [
            ("Space dark bg (#070B1A)", bg_space_dark),
            ("Space mid bg (#0E1433)", bg_space_mid),
            ("Glass card surface", card_bg_composite),
            ("Radial menu glass disc", radial_disc_bg),
        ]),
        ("Muted text (#9FB3D9)", "#9FB3D9", [
            ("Space dark bg (#070B1A)", bg_space_dark),
            ("Space mid bg (#0E1433)", bg_space_mid),
            ("Glass card surface", card_bg_composite),
        ]),
        ("Cyan accent (#38BDF8)", "#38BDF8", [
            ("Space dark bg (#070B1A)", bg_space_dark),
            ("Space mid bg (#0E1433)", bg_space_mid),
            ("Glass card surface", card_bg_composite),
            ("Radial menu glass disc", radial_disc_bg),
        ]),
        ("Violet accent (#A78BFA)", "#A78BFA", [
            ("Space dark bg (#070B1A)", bg_space_dark),
            ("Space mid bg (#0E1433)", bg_space_mid),
            ("Glass card surface", card_bg_composite),
        ]),
        ("Amber accent / busy state (#F59E0B)", "#F59E0B", [
            ("Space dark bg (#070B1A)", bg_space_dark),
            ("Space mid bg (#0E1433)", bg_space_mid),
            ("Glass card surface", card_bg_composite),
            ("Radial menu glass disc", radial_disc_bg),
        ]),
        ("Error text (#FCA5A5)", "#FCA5A5", [
            ("Space dark bg (#070B1A)", bg_space_dark),
            ("Space mid bg (#0E1433)", bg_space_mid),
            ("Glass card surface", card_bg_composite),
        ]),
        ("Primary button text (#E6F6FF)", "#E6F6FF", [
            ("Primary button bg (#0369A1)", "#0369A1"),
        ]),
        ("White button text (#FFFFFF)", "#FFFFFF", [
            ("Recording start bg (#DC2626)", "#DC2626"),
            ("Recording pause bg (#B45309)", "#B45309"),
            ("Recording resume bg (#15803D)", "#15803D"),
            ("Standby notification bg (#7C3AED)", "#7C3AED"),
        ]),
    ]

    print("==========================================================================")
    print("OrbitKit Planetary Restyle — Contrast Ratio Analysis (WCAG 2.1)")
    print("==========================================================================")
    print(f"{'Foreground':<42} | {'Background':<26} | {'Ratio':<8} | {'WCAG AA (>=4.5:1)'}")
    print("-" * 92)

    all_passed = True
    for fg_name, fg_hex, bgs in palette:
        for bg_name, bg_hex in bgs:
            ratio = contrast_ratio(fg_hex, bg_hex)
            passed = ratio >= 4.5
            if not passed:
                all_passed = False
            status = "PASS" if passed else "FAIL"
            print(f"{fg_name:<42} | {bg_name:<26} | {ratio:>5.2f}:1 | {status}")

    print("=" * 92)
    if all_passed:
        print("ALL PAIRS PASS WCAG 2.1 AA (>= 4.5:1 contrast requirement).")
    else:
        print("WARNING: Some pairs failed WCAG 2.1 AA.")

if __name__ == "__main__":
    main()
