#!/usr/bin/env bash
# scripts/ci/probe-macos.sh
# Probe script for macOS GitHub Actions runner: screen recording, window detection, and synthetic input
set -uo pipefail

echo "=== macOS Probe: System & Display Info ==="
sw_vers || true
uname -a
system_profiler SPDisplaysDataType 2>/dev/null | grep -E "Resolution|Display" || true

# Check / install ffmpeg
echo "=== Checking ffmpeg ==="
if ! command -v ffmpeg &>/dev/null; then
    echo "ffmpeg not found, installing via brew..."
    brew install ffmpeg
fi
ffmpeg -version | head -n 2

# Check avfoundation devices
echo "=== Checking AVFoundation Devices ==="
ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | tee avfoundation_devices.txt || true

# Screen index detection
SCREEN_INDEX=""
if grep -q "Capture screen 0" avfoundation_devices.txt; then
    SCREEN_INDEX=$(grep "Capture screen 0" avfoundation_devices.txt | head -n1 | sed -E 's/.*\[([0-9]+)\].*/\1/')
    echo "Detected screen device index: $SCREEN_INDEX"
fi

# Check / install cliclick
echo "=== Checking cliclick (Synthetic Input) ==="
if ! command -v cliclick &>/dev/null; then
    echo "cliclick not found, installing via brew..."
    brew install cliclick
fi
cliclick -V || true

CLICLICK_INITIAL_POS=$(cliclick p 2>&1 || true)
echo "Initial mouse position: $CLICLICK_INITIAL_POS"

CLICLICK_MOVE_TEST=$(cliclick m:200,200 2>&1 || true)
echo "cliclick move test: $CLICLICK_MOVE_TEST"
CLICLICK_AFTER_MOVE=$(cliclick p 2>&1 || true)
echo "Mouse position after move: $CLICLICK_AFTER_MOVE"

CLICLICK_CLICK_TEST=$(cliclick c:200,200 2>&1 || true)
echo "cliclick click test: $CLICLICK_CLICK_TEST"

# Swift window query helper
echo "=== Preparing Swift Window Query Helper ==="
cat <<'EOF' > query_windows.swift
import Cocoa
import CoreGraphics

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
if let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] {
    for win in windowList {
        let owner = win[kCGWindowOwnerName as String] as? String ?? ""
        let name = win[kCGWindowName as String] as? String ?? ""
        let pid = win[kCGWindowOwnerPID as String] as? Int ?? 0
        let bounds = win[kCGWindowBounds as String] as? [String: CGFloat] ?? [:]
        let x = bounds["X"] ?? 0
        let y = bounds["Y"] ?? 0
        let w = bounds["Width"] ?? 0
        let h = bounds["Height"] ?? 0
        print("PID: \(pid), Owner: '\(owner)', Name: '\(name)', Bounds: (\(x), \(y), \(w), \(h))")
    }
}
EOF

# Test screencapture video mode
echo "=== Testing screencapture video recording ==="
# screencapture -V <seconds> records for N seconds
screencapture -v -V 5 screencapture-test.mp4 2>&1 | tee screencapture-video-test.log || true

# Test ffmpeg avfoundation recording if screen device found
if [ -n "$SCREEN_INDEX" ]; then
    echo "=== Testing ffmpeg avfoundation recording (5s) ==="
    ffmpeg -y -f avfoundation -framerate 30 -i "${SCREEN_INDEX}:none" -t 5 -c:v libx264 -pix_fmt yuv420p video-avfoundation.mp4 2>&1 | tee ffmpeg-avfoundation.log || true
fi

# Launch starter desktop app
echo "=== Launching starter desktop app ==="
APP_BIN="target/debug/starter"
if [ ! -f "$APP_BIN" ]; then
    echo "Error: Binary not found at $APP_BIN"
    exit 1
fi
chmod +x "$APP_BIN"

"$APP_BIN" > app.log 2>&1 &
APP_PID=$!
echo "App started with PID: $APP_PID"

# Wait for window to show
sleep 4

# Query windows
echo "=== Windows List via Swift ==="
swift query_windows.swift | tee windows-list.txt || true

# Capture screenshot with screencapture
echo "=== Capturing Screenshot ==="
screencapture -x probe-screenshot.png || true
echo "Screenshot captured with screencapture"

# Wait a few more seconds
sleep 6

# Stop app
echo "=== Stopping App ==="
kill -TERM "$APP_PID" 2>/dev/null || kill -9 "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true

# Summarize probe results
echo "=== macOS Probe Summary ===" | tee probe-summary.txt
echo "Initial mouse position: $CLICLICK_INITIAL_POS" >> probe-summary.txt
echo "Mouse position after move: $CLICLICK_AFTER_MOVE" >> probe-summary.txt
echo "cliclick click test result: $CLICLICK_CLICK_TEST" >> probe-summary.txt

if [ -f "screencapture-test.mp4" ]; then
    SC_SIZE=$(stat -f%z "screencapture-test.mp4" 2>/dev/null || wc -c < "screencapture-test.mp4")
    echo "screencapture-test.mp4 size: $SC_SIZE bytes" >> probe-summary.txt
    ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,r_frame_rate,nb_frames -of default=noprint_wrappers=1 screencapture-test.mp4 >> probe-summary.txt 2>&1 || true
    # Copy as primary probe video if valid
    cp screencapture-test.mp4 video-macos.mp4
else
    echo "screencapture-test.mp4 NOT found" >> probe-summary.txt
fi

if [ -f "video-avfoundation.mp4" ]; then
    AV_SIZE=$(stat -f%z "video-avfoundation.mp4" 2>/dev/null || wc -c < "video-avfoundation.mp4")
    echo "video-avfoundation.mp4 size: $AV_SIZE bytes" >> probe-summary.txt
    ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,r_frame_rate,nb_frames -of default=noprint_wrappers=1 video-avfoundation.mp4 >> probe-summary.txt 2>&1 || true
    # Prefer avfoundation if screencapture didn't work
    if [ ! -f "video-macos.mp4" ]; then
        cp video-avfoundation.mp4 video-macos.mp4
    fi
else
    echo "video-avfoundation.mp4 NOT found" >> probe-summary.txt
fi

if [ -f "probe-screenshot.png" ]; then
    SS_SIZE=$(stat -f%z "probe-screenshot.png" 2>/dev/null || wc -c < "probe-screenshot.png")
    echo "probe-screenshot.png size: $SS_SIZE bytes" >> probe-summary.txt
else
    echo "probe-screenshot.png NOT found" >> probe-summary.txt
fi

echo "--- Detected Windows ---" >> probe-summary.txt
grep -E "starter|orbitkit" windows-list.txt >> probe-summary.txt 2>&1 || true

cat probe-summary.txt
echo "=== macOS Probe Finished ==="
