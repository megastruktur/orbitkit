#!/usr/bin/env bash
# b1-fix-flash FINAL evidence scenario (Design B fixed-window proof).
# Runs INSIDE the linux-desktop container with the app already running
# (DISPLAY=:77, Xvfb 1280x800, scale 1).
#
# Design-B invariant: the orbitkit-mascot window rect is IDENTICAL across
# idle / menu-open / menu-closed — no setSize/setPosition on open/close
# (342df70 showed 144x96 idle -> 252x234 open: the blink source).
# Uses the starter's log_telemetry channel (VITE_ORBITKIT_DEBUG=1 build) to
# prove the toggle state transitions in the webview at each step.
set -u
export DISPLAY=:77
RAW=/home/megastruktur/orca/workspaces/orbitkit/okc-b1-fix-flash/evidence/okc/b1-fix-flash/raw

sleep 8

echo "== idle (one-time fixed boot fit) =="
wmctrl -lG | tee "$RAW/out-designb.idle.windows.txt"
import -window root "$RAW/out-designb.idle.png"

# Mascot box (96x96) is bottom-centre in the fixed 252x234 window at
# (982,542): centre = (982+78+48, 542+138+48) = (1108,728) — the same screen
# point the pre-fix r2 scenario clicked (fit preserves the mascot position).
xdotool mousemove 1108 728; sleep 0.3; xdotool click 1
sleep 1.5

echo "== menu open (content-only transition) =="
wmctrl -lG | tee "$RAW/out-designb.open.windows.txt"
import -window root "$RAW/out-designb.open.png"

# Same point: the mascot never moved, the arc discs hover ABOVE it.
xdotool mousemove 1108 728; sleep 0.3; xdotool click 1
sleep 2

echo "== menu closed (content-only transition) =="
wmctrl -lG | tee "$RAW/out-designb.close.windows.txt"
import -window root "$RAW/out-designb.close.png"
echo "captured design-b cycle"
