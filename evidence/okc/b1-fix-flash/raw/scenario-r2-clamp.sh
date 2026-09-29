#!/usr/bin/env bash
# b1-fix-flash ROUND-2 runtime proof: setPosition-only edge re-clamp.
# Reviewer's F1 repro: push the fixed mascot window off the left edge
# (x=-60), let the settle clamp fire, then open the radial menu — the arc
# must be centred on the mascot (constant window-local pin; contentShift /
# anchorRect are boot-constant and never touched by the clamp).
# Runs INSIDE the linux-desktop container (DISPLAY=:77, Xvfb 1280x800).
set -u
export DISPLAY=:77
RAW=/home/megastruktur/orca/workspaces/orbitkit/okc-b1-fix-flash/evidence/okc/b1-fix-flash/raw

sleep 8
WID=$(xdotool search --name '^orbitkit-mascot$' | head -1)
echo "mascot window id: $WID"

echo "== idle (fixed boot fit) =="
wmctrl -lG | grep mascot | tee "$RAW/r2-clamp.pre.windows.txt"
import -window root "$RAW/r2-clamp.idle.png"

# Reviewer repro: drag the window so x = -60 (native drag equivalent).
xdotool windowmove "$WID" -60 541
echo "== moved off-screen (x=-60), waiting for settle clamp (500ms debounce + margin) =="
sleep 1.5
wmctrl -lG | grep mascot | tee "$RAW/r2-clamp.post.windows.txt"
import -window root "$RAW/r2-clamp.reclamped.png"

# Mascot is pinned inside the clamped window at local (78..174, 138..234):
# with the window re-clamped to x=0 its centre is at (126, 728). Open the menu.
xdotool mousemove 126 728
sleep 0.3
xdotool click 1
sleep 1.5
echo "== menu open after edge clamp =="
wmctrl -lG | grep mascot | tee "$RAW/r2-clamp.menu.windows.txt"
import -window root "$RAW/r2-clamp.menu.png"
echo r2-clamp-done
