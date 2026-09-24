#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVIDENCE_DIR="$SCRIPT_DIR"
RAW_DIR="$EVIDENCE_DIR/raw"
mkdir -p "$RAW_DIR"

echo "=== OrbitKit Radial Menu Animation Real Motion Capture ==="
echo "Display: ${DISPLAY:-:77}, App PID: ${APP_PID:-unknown}"

# Launch 60fps x11grab recording in the background
ffmpeg -y -f x11grab -framerate 60 -video_size 1280x800 -i :77 -t 4 "$RAW_DIR/rec.mp4" > "$RAW_DIR/ffmpeg.log" 2>&1 &
FF_PID=$!

# Step 1: Click Show Overlay at (536, 312)
xdotool mousemove 536 312 click 1
sleep 2

# Step 2: Click mascot at (1108, 627) to open radial menu (plays spawn animation)
xdotool mousemove 1108 627 click 1
sleep 1.2

# Step 3: Click mascot at (1108, 627) again to close radial menu (plays collapse animation)
xdotool mousemove 1108 627 click 1

# Wait for ffmpeg recording to finish
wait $FF_PID || true

echo "=== Animation recording completed successfully ==="
