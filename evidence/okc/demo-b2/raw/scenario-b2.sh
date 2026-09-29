#!/usr/bin/env bash
# demo-b2 runtime proof (runs INSIDE the linux-desktop container with the app
# already running; DISPLAY=:77, Xvfb 1280x800). Exercises the okc_SMOKE.md B2
# items that are provable headlessly:
#   1 roam motion (geometry samples over time)
#   3 "note" x2 -> two separate anchored windows
#   4 "settings" -> one centred window, second click focuses, no duplicate
#   5 "bubble" -> bubble next to mascot, gone after TTL
#   6 "badge +1" x3 -> badge shows 3
#   7 "park" -> corner + sleep, bubble while parked -> badge +1 no bubble,
#      "unpark" -> restores position
# (B2.2 drag feel and B2.8 second monitor stay owner-manual.)
set -u
export DISPLAY=:77
RAW=/home/megastruktur/orca/workspaces/orbitkit/okc-demo-b2/evidence/okc/demo-b2/raw
mkdir -p "$RAW"


shot() { import -window root "$1"; }
# Mascot window geometry: x y w h (wmctrl -lG columns 3..6: id desktop x y w h host title).
geom() { wmctrl -lG | awk '/orbitkit-mascot/ {print $3, $4, $5, $6}'; }
logwin() { wmctrl -lG > "$1" || true; }

# Click radial item $1 (0-based: 0 notes, 2 bubble, 4 badge, 5 settings,
# 7 park) using CURRENT window geometry. Item i angle = -180 + 22.5*i deg
# (K7 arc-anchor, 9 items, radius 150, screen y down); arc centre sits
# headGap=12 above the mascot's 96px box top edge, window bottom-centred.
click_item() {
  local i=$1 pt
  read -r wx wy ww wh <<< "$(geom)"
  if [ -z "$wx" ]; then echo "no mascot window geometry"; return 1; fi
  pt=$(awk -v wx="$wx" -v wy="$wy" -v ww="$ww" -v wh="$wh" -v i="$i" 'BEGIN {
    mx = wx + ww/2; acy = wy + wh - 96 - 12;
    a = (-180 + 22.5*i) * 3.14159265/180;
    printf "%d %d", int(mx + 150*cos(a) + 0.5), int(acy + 150*sin(a) + 0.5);
  }')
  xdotool mousemove $pt
  sleep 0.4
  xdotool click 1
}

click_mascot() {
  read -r wx wy ww wh <<< "$(geom)"
  if [ -z "$wx" ]; then echo "no mascot window geometry"; return 1; fi
  xdotool mousemove $(( wx + ww/2 )) $(( wy + wh - 48 ))
  sleep 0.4
  xdotool click 1
}

open_menu() { click_mascot; sleep 2.2; }

sleep 8 # boot: fixed fit -> roam-zone placement -> roam loop running

echo "== B2.1 roam motion (x y w h over time) =="
for k in 1 2 3 4; do
  echo "t+$(( (k-1)*4 ))s: $(geom)" | tee -a "$RAW/roam-motion.log"
  sleep 4
done
shot "$RAW/demo-b2-idle-roam.png"

echo "== menu open (arc, 9 items) =="
open_menu
logwin "$RAW/menu.windows.txt"
shot "$RAW/demo-b2-menu.png"

echo "== B2.5 bubble shows, then TTL-expires =="
click_item 2
sleep 1.5
shot "$RAW/demo-b2-bubble.png"
sleep 6
shot "$RAW/demo-b2-bubble-expired.png"

echo "== B2.6 badge +1 x3 =="
for k in 1 2 3; do open_menu; click_item 4; sleep 1; done
shot "$RAW/demo-b2-badge3.png"

echo "== B2.3 note x2 (two separate anchored windows) =="
open_menu; click_item 0; sleep 2
open_menu; click_item 0; sleep 2
logwin "$RAW/notes.windows.txt"
shot "$RAW/demo-b2-notes.png"

echo "== B2.4 settings: centred singleton, second click no duplicate =="
open_menu; click_item 5; sleep 2
logwin "$RAW/settings-first.windows.txt"
open_menu; click_item 5; sleep 1.5
logwin "$RAW/settings-second.windows.txt"
shot "$RAW/demo-b2-settings.png"

echo "== B2.7 park -> corner + sleep =="
open_menu; click_item 7; sleep 3
echo "parked: $(geom)" | tee "$RAW/park.windows.txt"
shot "$RAW/demo-b2-parked.png"

echo "== parked mascot stays clickable; label flips; bubble -> badge +1 =="
open_menu
shot "$RAW/demo-b2-parked-menu.png"
click_item 2
sleep 1.2
shot "$RAW/demo-b2-parked-bubble-badge.png"

echo "== unpark -> pre-park position restored =="
open_menu; click_item 7; sleep 3
echo "unparked: $(geom)" | tee -a "$RAW/park.windows.txt"
shot "$RAW/demo-b2-unparked.png"

echo "SCENARIO_DONE"
