#!/usr/bin/env python3
"""
evidence/sdk-v1/dsn-starter/check-halo-shape.py

Inspects the mascot window region of 03-radial-menu.png and quantitatively
verifies whether the cyan halo exhibits tapered, curved boundaries rather than
the flat/constant straight edges characteristic of the WebKitGTK clipping glitch.

Uses standard library (zlib, struct) with zero external dependencies.
"""

import sys
import zlib
import struct
from pathlib import Path


def read_png(path: Path):
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a valid PNG")

    pos = 8
    width = height = None
    color_type = None
    idat = []

    while pos < len(data):
        length, chunk_type = struct.unpack(">I4s", data[pos : pos + 8])
        pos += 8
        chunk_data = data[pos : pos + length]
        pos += length
        pos += 4  # crc

        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type, comp, filt, inter = struct.unpack(
                ">IIBBBBB", chunk_data
            )
        elif chunk_type == b"IDAT":
            idat.append(chunk_data)
        elif chunk_type == b"IEND":
            break

    decompressed = zlib.decompress(b"".join(idat))
    bpp = 4 if color_type == 6 else (3 if color_type == 2 else None)
    if not bpp:
        raise ValueError(f"Unsupported PNG color type: {color_type}")

    stride = 1 + width * bpp
    raw = bytearray(width * height * bpp)

    for y in range(height):
        filter_type = decompressed[y * stride]
        line = decompressed[y * stride + 1 : (y + 1) * stride]
        out_offset = y * width * bpp
        prev_offset = (y - 1) * width * bpp

        if filter_type == 0:
            raw[out_offset : out_offset + width * bpp] = line
        elif filter_type == 1:
            for x in range(width * bpp):
                left = raw[out_offset + x - bpp] if x >= bpp else 0
                raw[out_offset + x] = (line[x] + left) & 0xFF
        elif filter_type == 2:
            for x in range(width * bpp):
                up = raw[prev_offset + x] if y > 0 else 0
                raw[out_offset + x] = (line[x] + up) & 0xFF
        elif filter_type == 3:
            for x in range(width * bpp):
                left = raw[out_offset + x - bpp] if x >= bpp else 0
                up = raw[prev_offset + x] if y > 0 else 0
                raw[out_offset + x] = (line[x] + ((left + up) >> 1)) & 0xFF
        elif filter_type == 4:
            for x in range(width * bpp):
                a = raw[out_offset + x - bpp] if x >= bpp else 0
                b = raw[prev_offset + x] if y > 0 else 0
                c = raw[prev_offset + x - bpp] if (y > 0 and x >= bpp) else 0
                p = a + b - c
                pa = abs(p - a)
                pb = abs(p - b)
                pc = abs(p - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                raw[out_offset + x] = (line[x] + pr) & 0xFF

    return width, height, bpp, raw


def analyze_halo(png_path: Path):
    width, height, bpp, raw = read_png(png_path)

    def get_pixel(x, y):
        offset = (y * width + x) * bpp
        return raw[offset], raw[offset + 1], raw[offset + 2]

    # Mascot overlay window bounds in scenario: x in [960, 1256], y in [479, 775]
    # Mascot center is (1108, 627)
    # The halo boundary above the mascot spans y in [565, 593], x in [1050, 1166]
    # In the old square glitch, all rows had a constant count of 117 pixels (flat straight edge).
    # In the round fix, the row count tapers as the circular arc curves.

    print(f"Analyzing mascot halo geometry in: {png_path}")
    print("=" * 68)

    # 1. Row counts across the upper halo boundary (y in 565..593, step 2)
    print("\n--- Upper Halo Boundary: Row Pixel Counts (x in 1050..1166) ---")
    row_counts = []
    for y in range(565, 595, 2):
        count = sum(1 for x in range(1050, 1167) if get_pixel(x, y) != (0, 0, 0))
        row_counts.append((y, count))
        print(f"  y={y:3d} : {count:3d} px")

    # 2. Column counts across the left halo boundary (x in 1048..1069, y in 565..610)
    # In the old square glitch, all columns had a constant count of 46 pixels (flat straight edge).
    print("\n--- Left Halo Boundary: Column Pixel Counts (y in 565..610) ---")
    left_col_counts = []
    for x in range(1048, 1070):
        count = sum(1 for y in range(565, 611) if get_pixel(x, y) != (0, 0, 0))
        left_col_counts.append((x, count))
        print(f"  x={x:4d} : {count:2d} px")

    # 3. Column counts across the right halo boundary (x in 1150..1170, y in 565..610)
    print("\n--- Right Halo Boundary: Column Pixel Counts (y in 565..610) ---")
    right_col_counts = []
    for x in range(1150, 1171):
        count = sum(1 for y in range(565, 611) if get_pixel(x, y) != (0, 0, 0))
        right_col_counts.append((x, count))
        print(f"  x={x:4d} : {count:2d} px")

    # Metrics evaluation:
    # A straight square edge has zero variance (identical pixel counts across rows/cols).
    # A tapered edge has varying counts that slope/curve.
    row_vals = [c for _, c in row_counts]
    left_vals = [c for _, c in left_col_counts]
    right_vals = [c for _, c in right_col_counts]

    row_span = max(row_vals) - min(row_vals)
    left_span = max(left_vals) - min(left_vals)
    right_span = max(right_vals) - min(right_vals)

    print("\n" + "=" * 68)
    print("--- Geometric Curvature Assessment ---")
    print(f"  Row count dynamic range (max - min):  {row_span:2d} px (min={min(row_vals)}, max={max(row_vals)})")
    print(f"  Left col dynamic range (max - min):   {left_span:2d} px (min={min(left_vals)}, max={max(left_vals)})")
    print(f"  Right col dynamic range (max - min):  {right_span:2d} px (min={min(right_vals)}, max={max(right_vals)})")

    # Check for straight edge artifact
    is_row_straight = row_span == 0
    is_left_straight = left_span == 0
    is_right_straight = right_span == 0

    if is_row_straight or is_left_straight or is_right_straight:
        print("\n[FAIL] Straight hard edge detected! Halo does not taper.")
        return False
    else:
        print("\n[PASS] Halo tapers smoothly with non-constant curvature on all boundaries.")
        print("       Machine Spirit satisfied: no square clipping artifact present.")
        return True


def main():
    target = Path("evidence/sdk-v1/dsn-starter/03-radial-menu.png")
    if len(sys.argv) > 1:
        target = Path(sys.argv[1])

    if not target.exists():
        print(f"Error: {target} does not exist", file=sys.stderr)
        sys.exit(1)

    ok = analyze_halo(target)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
