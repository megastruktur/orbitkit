#!/usr/bin/env bash
# scripts/ci/record-macos.sh
# Full flow driver for macOS GitHub Actions runner
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWIFT_HELPER="$SCRIPT_DIR/get_window.swift"

function write_timeline() {
    local msg="$1"
    local ts
    ts=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$ts] $msg" | tee -a timeline.txt
}

# Clear / init timeline.txt
rm -f timeline.txt
write_timeline "Starting OrbitKit Desktop Video Recording (macOS)"

# Check / install dependencies
if ! command -v ffmpeg &>/dev/null; then
    brew install ffmpeg
fi
if ! command -v cliclick &>/dev/null; then
    brew install cliclick
fi

# Precompile swift helper for fast polling
if [ ! -f "$SCRIPT_DIR/get_window" ] || [ "$SWIFT_HELPER" -nt "$SCRIPT_DIR/get_window" ]; then
    write_timeline "Precompiling get_window.swift with swiftc..."
    swiftc -O "$SWIFT_HELPER" -o "$SCRIPT_DIR/get_window"
fi
GET_WINDOW_BIN="$SCRIPT_DIR/get_window"

# Detect avfoundation screen index
SCREEN_INDEX="0"
DEVICE_OUT=$(ffmpeg -f avfoundation -list_devices true -i "" 2>&1 || true)
if echo "$DEVICE_OUT" | grep -q "Capture screen 0"; then
    SCREEN_INDEX=$(echo "$DEVICE_OUT" | grep "Capture screen 0" | head -n1 | sed -E 's/.*\[([0-9]+)\].*/\1/')
fi
write_timeline "AVFoundation screen index: $SCREEN_INDEX"

# Helper to query window info: returns "x y w h"
function query_window() {
    local target="$1"
    "$GET_WINDOW_BIN" "$target" 2>/dev/null || return 1
}

function wait_for_window() {
    local target="$1"
    local max_tries=30
    for ((i=1; i<=max_tries; i++)); do
        local geom
        if geom=$(query_window "$target"); then
            echo "$geom"
            return 0
        fi
        sleep 0.3
    done
    return 1
}

function park_pointer() {
    cliclick m:20,20 2>/dev/null || true
}

function smooth_drag() {
    local start_x="$1"
    local start_y="$2"
    local end_x="$3"
    local end_y="$4"
    local steps=15

    cliclick m:"$start_x","$start_y"
    sleep 0.1
    cliclick dd:"$start_x","$start_y"
    sleep 0.1

    for ((s=1; s<=steps; s++)); do
        local cur_x=$(( start_x + (end_x - start_x) * s / steps ))
        local cur_y=$(( start_y + (end_y - start_y) * s / steps ))
        cliclick m:"$cur_x","$cur_y"
        sleep 0.03
    done

    sleep 0.1
    cliclick du:"$end_x","$end_y"
    sleep 0.2
}

# Start ffmpeg recorder reading from named pipe for clean shutdown
FIFO="/tmp/ffmpeg_macos_fifo"
rm -f "$FIFO"
mkfifo "$FIFO"
exec 3<> "$FIFO"

VIDEO_PATH="video-macos.mp4"
rm -f "$VIDEO_PATH"

write_timeline "Starting screen recorder..."
ffmpeg -y -f avfoundation -capture_cursor 1 -framerate 30 -i "${SCREEN_INDEX}:none" \
       -c:v libx264 -preset ultrafast -pix_fmt yuv420p -movflags +faststart "$VIDEO_PATH" <&3 &
REC_PID=$!

sleep 2
park_pointer

# Launch app
APP_BIN="target/debug/starter"
if [ ! -f "$APP_BIN" ]; then
    echo "Error: Binary not found at $APP_BIN" >&2
    exit 1
fi
chmod +x "$APP_BIN"

write_timeline "Launching starter desktop app..."
"$APP_BIN" > app.log 2>&1 &
APP_PID=$!
write_timeline "App launched with PID $APP_PID"

# Step 1: Main window ready
write_timeline "Step 1: Waiting for main window 'orbitkit'..."
MAIN_GEOM=$(wait_for_window "orbitkit")
if [ -z "$MAIN_GEOM" ]; then
    echo "Error: Main window not found" >&2
    exit 1
fi
read -r MAIN_X MAIN_Y MAIN_W MAIN_H <<< "$MAIN_GEOM"
write_timeline "Step 1: Main window ready at ($MAIN_X, $MAIN_Y) size ${MAIN_W}x${MAIN_H}"

sleep 1
screencapture -x 01-main.png
write_timeline "Step 1: Captured 01-main.png"

# Step 2: Click Show Overlay
# Window frame titlebar is ~32px, content button center is at dx=295, dy=212 inside content
BTN_X=$(( MAIN_X + 295 ))
BTN_Y=$(( MAIN_Y + 32 + 212 ))
write_timeline "Step 2: Clicking Show Overlay at ($BTN_X, $BTN_Y)..."
cliclick c:"$BTN_X","$BTN_Y"
write_timeline "Step 2: Clicked Show Overlay"

# Step 3: Wait for mascot window
write_timeline "Step 3: Waiting for mascot window 'orbitkit-mascot'..."
MASCOT_GEOM=""
for ((try=1; try<=30; try++)); do
    if MASCOT_GEOM=$(query_window "orbitkit-mascot"); then
        break
    fi
    if [ "$try" -eq 10 ]; then
        write_timeline "Retry clicking Show Overlay..."
        cliclick c:"$BTN_X","$BTN_Y"
    fi
    sleep 0.3
done
if [ -z "$MASCOT_GEOM" ]; then
    echo "Error: Mascot window not found" >&2
    exit 1
fi
read -r MASCOT_X MASCOT_Y MASCOT_W MASCOT_H <<< "$MASCOT_GEOM"
write_timeline "Step 3: Mascot window ready at ($MASCOT_X, $MASCOT_Y) size ${MASCOT_W}x${MASCOT_H}"

park_pointer
sleep 1.5
screencapture -x 02-overlay.png
write_timeline "Step 3: Captured 02-overlay.png"

# Step 4 & 5: Click Mascot -> radial menu opens (spawn animation)
CX=$(( MASCOT_X + MASCOT_W / 2 ))
CY=$(( MASCOT_Y + MASCOT_H / 2 ))
write_timeline "Step 4: Clicking mascot at center ($CX, $CY) to open radial menu..."
cliclick c:"$CX","$CY"
park_pointer

write_timeline "Step 5: Waiting 1.5s for radial menu spawn animation..."
sleep 1.5
screencapture -x 03-menu-open.png
write_timeline "Step 5: Captured 03-menu-open.png (Radial menu open)"

# Step 6: Click mascot -> menu closes
write_timeline "Step 6: Clicking mascot at ($CX, $CY) to close radial menu..."
cliclick c:"$CX","$CY"
park_pointer
sleep 1.5
write_timeline "Step 6: Radial menu closed"

# Step 7: Click mascot again -> click Notes -> Notes popup appears
write_timeline "Step 7: Clicking mascot at ($CX, $CY) to reopen menu..."
cliclick c:"$CX","$CY"
sleep 0.8

# Notes item is at (CX, CY - 96)
NOTES_X="$CX"
NOTES_Y=$(( CY - 96 ))
write_timeline "Step 7: Clicking Notes item at ($NOTES_X, $NOTES_Y)..."
cliclick c:"$NOTES_X","$NOTES_Y"

write_timeline "Step 7: Waiting for Notes popup window..."
NOTES_GEOM=$(wait_for_window "Notes")
if [ -z "$NOTES_GEOM" ]; then
    echo "Error: Notes popup window not found" >&2
    exit 1
fi
read -r NOTES_X_POS NOTES_Y_POS NOTES_W NOTES_H <<< "$NOTES_GEOM"
write_timeline "Step 7: Notes popup displayed at ($NOTES_X_POS, $NOTES_Y_POS) size ${NOTES_W}x${NOTES_H}"

park_pointer
sleep 1.5
screencapture -x 04-notes-popup.png
write_timeline "Step 7: Captured 04-notes-popup.png"

# Step 8: Drag mascot about 200 px
DRAG_END_X=$(( CX - 200 ))
DRAG_END_Y=$(( CY - 80 ))
write_timeline "Step 8: Dragging mascot from ($CX, $CY) to ($DRAG_END_X, $DRAG_END_Y)..."
smooth_drag "$CX" "$CY" "$DRAG_END_X" "$DRAG_END_Y"
sleep 1.5

# Re-query mascot window position
NEW_MASCOT_GEOM=$(query_window "orbitkit-mascot" || echo "")
if [ -n "$NEW_MASCOT_GEOM" ]; then
    read -r NEW_MX NEW_MY NEW_MW NEW_MH <<< "$NEW_MASCOT_GEOM"
    NEW_CX=$(( NEW_MX + NEW_MW / 2 ))
    NEW_CY=$(( NEW_MY + NEW_MH / 2 ))
    write_timeline "Step 8: Mascot dragged successfully. Old center: ($CX, $CY), New center: ($NEW_CX, $NEW_CY)"
else
    NEW_CX="$DRAG_END_X"
    NEW_CY="$DRAG_END_Y"
    write_timeline "Step 8: Mascot dragged to approximate center ($NEW_CX, $NEW_CY)"
fi

# Step 9: Click mascot -> menu opens at new position
write_timeline "Step 9: Clicking mascot at ($NEW_CX, $NEW_CY) to open menu..."
cliclick c:"$NEW_CX","$NEW_CY"
park_pointer
sleep 1.5
write_timeline "Step 9: Radial menu opened at new position"

# Step 10: Click Quit -> app exits
# Quit item is at (NEW_CX - 91, NEW_CY - 30)
QUIT_X=$(( NEW_CX - 91 ))
QUIT_Y=$(( NEW_CY - 30 ))
write_timeline "Step 10: Clicking Quit item at ($QUIT_X, $QUIT_Y)..."
cliclick c:"$QUIT_X","$QUIT_Y"

write_timeline "Step 10: Waiting for app process to exit..."
for ((w=0; w<6; w++)); do
    if ! kill -0 "$APP_PID" 2>/dev/null; then
        write_timeline "Step 10: App exited cleanly"
        break
    fi
    sleep 1
done

if kill -0 "$APP_PID" 2>/dev/null; then
    write_timeline "Step 10: App still running, terminating..."
    kill -TERM "$APP_PID" 2>/dev/null || kill -9 "$APP_PID" 2>/dev/null || true
fi

# Stop recorder cleanly
write_timeline "Stopping screen recorder..."
echo "q" >&3
exec 3>&-

# Wait up to 8s for ffmpeg to exit cleanly
for ((wait_sec=0; wait_sec<8; wait_sec++)); do
    if ! kill -0 "$REC_PID" 2>/dev/null; then
        break
    fi
    sleep 1
done

if kill -0 "$REC_PID" 2>/dev/null; then
    kill -INT "$REC_PID" 2>/dev/null || true
    sleep 2
fi
wait "$REC_PID" 2>/dev/null || true
rm -f "$FIFO"
write_timeline "Screen recorder stopped"

# Copy alternative names
cp 01-main.png main.png 2>/dev/null || true
cp 02-overlay.png overlay.png 2>/dev/null || true
cp 03-menu-open.png menu-open.png 2>/dev/null || true
cp 04-notes-popup.png notes-popup.png 2>/dev/null || true

# Verify output
write_timeline "=== Output Verification ==="
if [ -f "$VIDEO_PATH" ]; then
    V_SIZE=$(stat -f%z "$VIDEO_PATH" 2>/dev/null || wc -c < "$VIDEO_PATH")
    write_timeline "Video file: $VIDEO_PATH ($V_SIZE bytes)"
    ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,r_frame_rate,nb_frames -of default=noprint_wrappers=1 "$VIDEO_PATH" >> timeline.txt 2>&1 || true
else
    write_timeline "ERROR: Video file not found!"
fi

write_timeline "Completed OrbitKit Desktop Video Recording (macOS)"
