#!/usr/bin/env bash
# b1-fix-flash DIAGNOSTIC v3: window-title channel for webview events.
# App built with VITE_ORBITKIT_DEBUG=1; debugLog mirrors to document.title.
set -u
export DISPLAY=:77
RAW=/home/megastruktur/orca/workspaces/orbitkit/okc-b1-fix-flash/evidence/okc/b1-fix-flash/raw

title() { xdotool search --name '^orbitkit-mascot' getwindowname 2>/dev/null || wmctrl -l | grep mascot; }

sleep 8
echo "== boot title: $(title)"

xdotool mousemove 1108 728; sleep 0.3; xdotool click 1
sleep 1.2
echo "== after click1: $(title)"

xdotool mousemove 1108 728; sleep 0.3; xdotool click 1
sleep 0.25
echo "== click2 +0.25s: $(title)"
sleep 0.5
echo "== click2 +0.75s: $(title)"
sleep 1.5
echo "== click2 +2.25s: $(title)"

xdotool mousemove 1012 668; sleep 0.3; xdotool click 1
sleep 1.0
echo "== disc click +1.0s: $(title)"
echo diag3-done
