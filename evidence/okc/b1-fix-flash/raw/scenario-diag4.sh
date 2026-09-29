#!/usr/bin/env bash
# b1-fix-flash DIAGNOSTIC v4: console telemetry via log_telemetry -> app log.
set -u
export DISPLAY=:77
RAW=/home/megastruktur/orca/workspaces/orbitkit/okc-b1-fix-flash/evidence/okc/b1-fix-flash/raw

sleep 8
echo "== click1 (open) =="
xdotool mousemove 1108 728; sleep 0.3; xdotool click 1
sleep 1.5
echo "== click2 (close?) =="
xdotool mousemove 1108 728; sleep 0.3; xdotool click 1
sleep 0.4
echo "== click3 (toggle again) =="
xdotool mousemove 1108 728; sleep 0.3; xdotool click 1
sleep 1.5
import -window root "$RAW/diag4.final.png"
wmctrl -lG | grep mascot
echo diag4-done
