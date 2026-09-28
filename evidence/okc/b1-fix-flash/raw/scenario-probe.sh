#!/usr/bin/env bash
set -u
export DISPLAY=:77
sleep 8
echo "== wmctrl -l =="
wmctrl -l
echo "== xdotool search --name orbitkit-mascot =="
xdotool search --name 'orbitkit-mascot' || echo "no such window"
echo "== getwindowname of each =="
for id in $(xdotool search --name 'orbitkit'); do
  echo "$id: $(xdotool getwindowname $id 2>/dev/null)"
done
echo probe-done
