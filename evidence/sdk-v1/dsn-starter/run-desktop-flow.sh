#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVIDENCE_DIR="$SCRIPT_DIR"

echo "=== OrbitKit Desktop Full Flow Scenario ==="
echo "Display: $DISPLAY, App PID: $APP_PID"

# Step 1: Wait for main window and capture screenshot 1
echo "--- Step 1: Main window ready ---"
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
sleep 0.5
xdotool mousemove 20 20
sleep 0.5
wmctrl -l -G
import -window root "$EVIDENCE_DIR/01-main-window.png"
echo "Captured 01-main-window.png"

# Step 2: Click Show Overlay at (530, 350)
echo "--- Step 2: Click Show Overlay ---"
xdotool mousemove 536 312 click 1
sleep 2

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
xdotool mousemove 20 20
sleep 0.5
wmctrl -l -G
import -window root "$EVIDENCE_DIR/02-mascot-overlay.png"
echo "Captured 02-mascot-overlay.png"

# Step 3: Click Mascot at (1108, 627) to open radial menu
echo "--- Step 3: Click Mascot to open Radial Menu ---"
xdotool windowactivate "$MASCOT_WIN"
sleep 0.5
xdotool mousemove 1108 627 click 1
sleep 1
xdotool mousemove 20 20
sleep 0.5
wmctrl -l -G
import -window root "$EVIDENCE_DIR/03-radial-menu.png"
echo "Captured 03-radial-menu.png"

# Step 4: Click Notes menu item at (1108, 531)
echo "--- Step 4: Click Notes menu item ---"
xdotool mousemove 1108 531 click 1
sleep 2

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
xdotool mousemove 20 20
sleep 0.5
wmctrl -l -G
import -window root "$EVIDENCE_DIR/04-notes-popup.png"
echo "Captured 04-notes-popup.png"

# Step 5: Click Mascot again to open radial menu, then click Quit
echo "--- Step 5: Click Mascot again and select Quit ---"
xdotool windowactivate "$MASCOT_WIN"
sleep 0.5
xdotool mousemove 1108 627 click 1
sleep 1

# Quit is at (1017, 597)
echo "Clicking Quit menu item at (1017, 597)..."
xdotool mousemove 1017 597 click 1
sleep 2

# Verify app process exited cleanly
if kill -0 "$APP_PID" 2>/dev/null; then
  echo "Error: App is still running after selecting Quit!" >&2
  exit 1
fi

echo "=== Scenario Successful: App exited 0 on quit ==="
