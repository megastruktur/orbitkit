#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
APP_LOG="$REPO_ROOT/examples/starter/src-tauri/target-linux/exec-app.log"
RAW_DIR="$SCRIPT_DIR/raw"
mkdir -p "$RAW_DIR"

if [ -z "${APP_PID:-}" ]; then
  echo "--> Building starter with VITE_ORBITKIT_DEBUG=1..."
  VITE_ORBITKIT_DEBUG=1 "$REPO_ROOT/scripts/linux-desktop.sh" build examples/starter
  echo "--> Running mascot drag test in container..."
  exec env VITE_ORBITKIT_DEBUG=1 "$REPO_ROOT/scripts/linux-desktop.sh" exec examples/starter -- bash "$SCRIPT_DIR/run-drag-test.sh"
fi

echo "=== OrbitKit Desktop Mascot Drag Test ==="
echo "Display: $DISPLAY, App PID: $APP_PID"

# Step 1: Wait for main window
echo "--- Step 1: Waiting for main window ---"
MAIN_WIN=""
for _ in $(seq 1 30); do
  MAIN_WIN=$(wmctrl -l | grep -i "orbitkit" | head -n1 | awk '{print $1}' || true)
  if [ -n "$MAIN_WIN" ]; then
    break
  fi
  sleep 0.5
done

if [ -z "$MAIN_WIN" ]; then
  echo "Error: Main window not found" >&2
  exit 1
fi

xdotool windowactivate "$MAIN_WIN"
sleep 0.5

# Step 2: Click Show Overlay at (536, 312)
echo "--- Step 2: Click Show Overlay ---"
xdotool mousemove 536 312 click 1
sleep 2

# Wait for mascot window
MASCOT_WIN=""
for _ in $(seq 1 20); do
  MASCOT_WIN=$(wmctrl -l | grep -i "orbitkit-mascot" | head -n1 | awk '{print $1}' || true)
  if [ -n "$MASCOT_WIN" ]; then
    break
  fi
  sleep 0.5
done

if [ -z "$MASCOT_WIN" ]; then
  echo "Error: Mascot window not found" >&2
  exit 1
fi

xdotool mousemove 20 20
sleep 0.5
echo "--- Before drag window geometry ---"
wmctrl -l -G | tee "$RAW_DIR/01-before-drag-wmctrl.txt"
import -window root "$RAW_DIR/01-before-drag.png"

# Parse initial mascot window position and size
BEFORE_LINE=$(grep "orbitkit-mascot" "$RAW_DIR/01-before-drag-wmctrl.txt")
BEFORE_X=$(echo "$BEFORE_LINE" | awk '{print $3}')
BEFORE_Y=$(echo "$BEFORE_LINE" | awk '{print $4}')
BEFORE_W=$(echo "$BEFORE_LINE" | awk '{print $5}')
BEFORE_H=$(echo "$BEFORE_LINE" | awk '{print $6}')

START_CX=$(( BEFORE_X + BEFORE_W / 2 ))
START_CY=$(( BEFORE_Y + BEFORE_H / 2 ))
echo "Mascot before drag: pos=($BEFORE_X, $BEFORE_Y), size=(${BEFORE_W}x${BEFORE_H}), center=($START_CX, $START_CY)"

# Step 3: Perform drag from center (1108, 627) to (700, 400) in 10 steps
echo "--- Step 3: Dragging mascot from ($START_CX, $START_CY) to (700, 400) in 10 steps ---"
xdotool windowactivate "$MASCOT_WIN"
sleep 0.5
xdotool mousemove "$START_CX" "$START_CY"
sleep 0.2
xdotool mousedown 1
sleep 0.2

for i in $(seq 1 10); do
  cur_x=$(( START_CX + (700 - START_CX) * i / 10 ))
  cur_y=$(( START_CY + (400 - START_CY) * i / 10 ))
  xdotool mousemove "$cur_x" "$cur_y"
  sleep 0.05
done

sleep 0.2
xdotool mouseup 1
sleep 1.0

xdotool mousemove 20 20
sleep 0.5

echo "--- After drag window geometry ---"
wmctrl -l -G | tee "$RAW_DIR/02-after-drag-wmctrl.txt"
import -window root "$RAW_DIR/02-after-drag.png"

AFTER_LINE=$(grep "orbitkit-mascot" "$RAW_DIR/02-after-drag-wmctrl.txt")
AFTER_X=$(echo "$AFTER_LINE" | awk '{print $3}')
AFTER_Y=$(echo "$AFTER_LINE" | awk '{print $4}')
AFTER_W=$(echo "$AFTER_LINE" | awk '{print $5}')
AFTER_H=$(echo "$AFTER_LINE" | awk '{print $6}')

DX=$(( AFTER_X - BEFORE_X ))
DY=$(( AFTER_Y - BEFORE_Y ))
echo "Mascot after drag: pos=($AFTER_X, $AFTER_Y), delta=($DX, $DY)"

# Assertion: Window moved by >= 40px in either axis
ABS_DX=${DX#-}
ABS_DY=${DY#-}
if [ "$ABS_DX" -lt 40 ] && [ "$ABS_DY" -lt 40 ]; then
  echo "ASSERTION FAILED: Window delta is less than 40px (|DX|=$ABS_DX, |DY|=$ABS_DY)" >&2
  exit 1
fi
echo "ASSERTION PASSED: Window moved by >= 40px (|DX|=$ABS_DX, |DY|=$ABS_DY)"

NEW_CX=$(( AFTER_X + AFTER_W / 2 ))
NEW_CY=$(( AFTER_Y + AFTER_H / 2 ))
echo "Mascot new center: ($NEW_CX, $NEW_CY)"
# Step 4: Click mascot center at its NEW position to open radial menu
echo "--- Step 4: Click mascot at new center ($NEW_CX, $NEW_CY) to open radial menu ---"
xdotool windowactivate "$MASCOT_WIN"
sleep 0.5
xdotool mousemove "$NEW_CX" "$NEW_CY" click 1
sleep 1.5
xdotool mousemove 20 20
sleep 0.5
import -window root "$RAW_DIR/03-menu-open-after-drag.png"

# Assertion: Radial menu opened on first click after drag (Step 4)
if [ ! -f "$APP_LOG" ]; then
  echo "ASSERTION FAILED: APP_LOG not found at $APP_LOG" >&2
  exit 1
fi
if ! grep -q '"menuOpenAfter":true' "$APP_LOG"; then
  echo "ASSERTION FAILED: Radial menu did not open on first click after drag (Step 4)" >&2
  exit 1
fi
echo "ASSERTION PASSED: Radial menu opened on first click after drag (Step 4)"
# Step 5: Click mascot center again to close radial menu
echo "--- Step 5: Click mascot at new center ($NEW_CX, $NEW_CY) to close radial menu ---"
xdotool windowactivate "$MASCOT_WIN"
sleep 0.5
xdotool mousemove "$NEW_CX" "$NEW_CY" click 1
sleep 1.5
xdotool mousemove 20 20
sleep 0.5
import -window root "$RAW_DIR/04-menu-closed-after-drag.png"

# Assertion: Radial menu closed on subsequent click (Step 5)
if [ ! -f "$APP_LOG" ]; then
  echo "ASSERTION FAILED: APP_LOG not found at $APP_LOG" >&2
  exit 1
fi
if ! tail -n 25 "$APP_LOG" | grep -q '"menuOpenAfter":false'; then
  echo "ASSERTION FAILED: Radial menu did not close on subsequent click (Step 5)" >&2
  exit 1
fi
echo "ASSERTION PASSED: Radial menu closed on subsequent click (Step 5)"
cp -f "$APP_LOG" "$RAW_DIR/09-exec-app.log"
echo "Application log copied to $RAW_DIR/09-exec-app.log"
echo "=== Mascot Drag Test Completed Successfully ==="
exit 0
