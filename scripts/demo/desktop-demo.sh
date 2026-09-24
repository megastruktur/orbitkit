#!/usr/bin/env bash
set -euo pipefail

echo "=== OrbitKit Desktop Demo Recording Scenario ==="
echo "Display: $DISPLAY, App PID: $APP_PID"

move_smooth() {
  local target_x="$1"
  local target_y="$2"
  local steps="${3:-15}"
  local delay="${4:-0.02}"

  eval "$(xdotool getmouselocation --shell 2>/dev/null || echo "X=20;Y=20")"
  local cur_x="${X:-20}"
  local cur_y="${Y:-20}"

  for i in $(seq 1 "$steps"); do
    local nx=$(( cur_x + (target_x - cur_x) * i / steps ))
    local ny=$(( cur_y + (target_y - cur_y) * i / steps ))
    xdotool mousemove "$nx" "$ny"
    sleep "$delay"
  done
  xdotool mousemove "$target_x" "$target_y"
}

# Initial state: Park pointer at 20,20
xdotool mousemove 20 20

# Step 1: Wait for main window to be ready
echo "--- Step 1: Main window ready (~2s) ---"
MAIN_WIN=""
for _ in $(seq 1 30); do
  if MAIN_WIN=$(xdotool search --name "orbitkit" 2>/dev/null | head -n1); then
    if [ -n "$MAIN_WIN" ]; then break; fi
  fi
  sleep 0.2
done

if [ -z "$MAIN_WIN" ]; then
  echo "Error: Main window not found" >&2
  exit 1
fi

xdotool windowactivate "$MAIN_WIN"
xdotool mousemove 20 20
sleep 2.0

# Step 2: Smoothly move to Show Overlay (536, 312) and click
echo "--- Step 2: Click Show Overlay (~2s) ---"
move_smooth 536 312 15 0.02
sleep 0.1
xdotool click 1
sleep 0.2

MASCOT_WIN=""
for _ in $(seq 1 20); do
  if MASCOT_WIN=$(xdotool search --name "orbitkit-mascot" 2>/dev/null | head -n1); then
    if [ -n "$MASCOT_WIN" ]; then break; fi
  fi
  sleep 0.2
done

if [ -z "$MASCOT_WIN" ]; then
  echo "Error: Mascot window not found after clicking Show Overlay" >&2
  exit 1
fi

# Park pointer smoothly away so mascot overlay is clearly visible
move_smooth 20 20 12 0.02
sleep 1.8

# Step 3: Smoothly move to Mascot at (1108, 627) to open radial menu
echo "--- Step 3: Open Radial Menu (~2.5s) ---"
xdotool windowactivate "$MASCOT_WIN"
sleep 0.2
move_smooth 1108 627 15 0.02
sleep 0.1
xdotool click 1
sleep 0.2

# Park pointer away so menu icons in discs are unobscured
move_smooth 20 20 12 0.02
sleep 2.2

# Step 4: Smoothly move to Notes menu item at (1108, 531) and click
echo "--- Step 4: Click Notes menu item (~3s) ---"
move_smooth 1108 531 15 0.02
sleep 0.1
xdotool click 1
sleep 0.2

NOTES_WIN=""
for _ in $(seq 1 20); do
  if NOTES_WIN=$(xdotool search --name "Notes" 2>/dev/null | head -n1); then
    if [ -n "$NOTES_WIN" ]; then break; fi
  fi
  sleep 0.2
done

if [ -z "$NOTES_WIN" ]; then
  echo "Error: Notes popup window not found after selecting Notes" >&2
  exit 1
fi

# Park pointer away so notes popup is clearly visible
move_smooth 20 20 12 0.02
sleep 2.7

# Step 5: Click Mascot again to open radial menu, then click Quit
echo "--- Step 5: Quit application ---"
xdotool windowactivate "$MASCOT_WIN"
sleep 0.2
move_smooth 1108 627 12 0.02
sleep 0.1
xdotool click 1
sleep 0.3

# Quit is at (1017, 597)
move_smooth 1017 597 10 0.02
sleep 0.1
xdotool click 1
sleep 1.0

# Verify app process exited cleanly
if kill -0 "$APP_PID" 2>/dev/null; then
  echo "Error: App is still running after selecting Quit!" >&2
  exit 1
fi

echo "=== Demo Recording Scenario Successful ==="
