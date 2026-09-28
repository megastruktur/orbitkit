#!/usr/bin/env bash
# b1-fix-flash DIAGNOSTIC (not evidence): why does the second click not close?
# Timing probe + disc-click probe + focus tracking.
set -u
RAW=/home/megastruktur/orca/workspaces/orbitkit/okc-b1-fix-flash/evidence/okc/b1-fix-flash/raw
export DISPLAY=:77

sleep 8
echo "== boot done, active window =="
xdotool getactivewindow getwindowname || true

xdotool mousemove 1108 728; sleep 0.3; xdotool click 1
sleep 1.2
echo "== after click 1 (expect menu open) =="
xdotool getactivewindow getwindowname || true
import -window root "$RAW/diag.open.png"

xdotool mousemove 1108 728; sleep 0.3; xdotool click 1
import -window root "$RAW/diag.t030.png"
sleep 0.5
import -window root "$RAW/diag.t080.png"
sleep 1.0
import -window root "$RAW/diag.t180.png"
sleep 1.0
echo "== after click 2 sequence =="
xdotool getactivewindow getwindowname || true
wmctrl -lG | tee "$RAW/diag.windows.txt"

echo "== disc click probe (leftmost disc ~1012,668) =="
xdotool mousemove 1012 668; sleep 0.3; xdotool click 1
sleep 0.8
import -window root "$RAW/diag.afterdisc.png"
wmctrl -lG
echo diag-done
