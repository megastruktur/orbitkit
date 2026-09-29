#!/usr/bin/env bash
# demo-b1 round-2 runtime proof (runs INSIDE the linux-desktop container with
# the app already running; DISPLAY=:77, Xvfb 1280x800):
#   1. wait for auto-show + idle fitContent to settle
#   2. record window geometry (pre-click)
#   3. click Glim (centre of the idle-fit window's mascot box)
#   4. record window geometry (post-click: menu-open fit)
#   5. capture the full screen (arc menu must be OPEN above an UNMOVED mascot)
set -u
RAW=/home/megastruktur/orca/workspaces/orbitkit/okc-demo-b1/evidence/okc/demo-b1/raw

sleep 8

echo "== pre-click geometry =="
DISPLAY=:77 wmctrl -lG | tee "$RAW/out-r2-menu.pre.windows.txt"

# Idle-fit window is 144x96 at (1036,680); mascot box = its centre 96x96.
DISPLAY=:77 xdotool mousemove 1108 728
sleep 0.3
DISPLAY=:77 xdotool click 1

sleep 3

echo "== post-click geometry =="
DISPLAY=:77 wmctrl -lG | tee "$RAW/out-r2-menu.post.windows.txt"

DISPLAY=:77 import -window root "$RAW/out-r2-menu.png"
echo "captured $RAW/out-r2-menu.png"
