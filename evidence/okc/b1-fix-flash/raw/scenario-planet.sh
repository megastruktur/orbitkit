#!/usr/bin/env bash
# b1-fix-flash OWNER-REQUEST evidence: planet mascot idle + alert screenshots.
# Runs INSIDE the linux-desktop container (DISPLAY=:77, Xvfb 1280x800).
# idle shot at the boot fit; alert shot after clicking the app.alert disc
# (index 2 at -108deg -> disc centre ~(1078,576)); shot lands inside the 8s
# alert TTL.
set -u
export DISPLAY=:77
RAW=/home/megastruktur/orca/workspaces/orbitkit/okc-b1-fix-flash/evidence/okc/b1-fix-flash/raw

sleep 8
echo "== idle =="
wmctrl -lG | grep mascot
import -window root "$RAW/planet-idle.png"

# open the menu: mascot centre (1108,728)
xdotool mousemove 1108 728; sleep 0.3; xdotool click 1
sleep 1.2
import -window root "$RAW/planet-menu.png"

# click the app.alert disc (angle -108deg): (1108-30, 667-91) = (1078,576)
xdotool mousemove 1078 576; sleep 0.3; xdotool click 1
sleep 1.5
echo "== alert =="
wmctrl -lG | grep mascot
import -window root "$RAW/planet-alert.png"
echo planet-shots-done
