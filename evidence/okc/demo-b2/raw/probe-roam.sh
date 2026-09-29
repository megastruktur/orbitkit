#!/usr/bin/env bash
# r2 roam-motion probe: samples the mascot window geometry (x y w h) while
# the roam loop runs. FAILS the r1 symptom (byte-identical samples).
set -u
export DISPLAY=:77
geom() { wmctrl -lG | awk '/orbitkit-mascot/ {print $3, $4, $5, $6}'; }
sleep 8
for k in 1 2 3 4 5 6; do
  echo "t+$(( (k-1)*4 ))s: $(geom)"
  sleep 4
done
