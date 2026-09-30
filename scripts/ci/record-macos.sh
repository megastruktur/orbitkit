#!/usr/bin/env bash
# scripts/ci/record-macos.sh
# Full flow driver for the OrbitKit 0.2.0 starter on a macOS GitHub Actions runner.
#
# 0.2.0 port (was the 0.1.0 hard-coded flow; see evidence/okc/demo-video/REPORT.md
# for why the old script failed on 0.2.0):
# - The overlay auto-shows on desktop start (MainView.svelte onMount), so there
#   is no "Show overlay" click any more.
# - The mascot window is a FIXED Design-B surface sized once to the open-menu
#   content union (windowFit.ts demoWindowFit; 360x288 with the starter
#   numbers). The mascot is pinned bottom-centre INSIDE the window, so the
#   window centre is NOT the mascot: every click point is derived from the
#   real orbitkit.config.json + windowFit/arc-anchor math and the window rect
#   is re-read from the OS right before every click.
# - Since the coordinator directive for okv_demo-and-video the starter ships
#   STATIC (no `windows.mascotWindow.roam` block — roaming is an opt-in
#   library feature and must not be default, and recordings show the static
#   mascot). The rect only changes on drags/one-shot re-clamps, but every
#   click still uses velocity prediction (two rect reads 60 ms apart ->
#   px/s -> predicted button-down position) with post-move verification,
#   mirroring the proven record-windows.ps1 r4/r5 approach, so a consumer
#   config with roam would be handled correctly too.
# - Tooling: precompiled Swift helper (CGWindowListCopyWindowInfo), cliclick
#   for synthetic input, screencapture -x for stills, ffmpeg avfoundation for
#   the recording (clean FIFO "q" shutdown).
#
# Flow: idle 2s -> roam watch (axis proof in timeline) -> menu open/close ->
# Alert -> Notes x2 -> Badge x2 -> drag ~200 px (best effort on macOS:
# synthetic Quartz drags do not drive AppKit's native window move; the
# runtime re-query logs the outcome and continues, same as the 0.1.0 run) ->
# Quit (exit 0). Stills keep the 01..04 names.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWIFT_HELPER="$SCRIPT_DIR/get_window.swift"
TALK="cliclick"

function write_timeline() {
    local msg="$1"
    local ts
    ts=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$ts] $msg" | tee -a timeline.txt
}

# Clear / init timeline.txt
rm -f timeline.txt
write_timeline "Starting OrbitKit Desktop Video Recording (macOS, 0.2.0 starter)"

# --- dependencies -----------------------------------------------------------
if ! command -v ffmpeg &>/dev/null; then
    write_timeline "Installing ffmpeg via Homebrew..."
    brew install ffmpeg
fi
if ! command -v "$TALK" &>/dev/null; then
    write_timeline "Installing cliclick via Homebrew..."
    brew install cliclick
fi

# Precompile swift helper for fast polling
if [ ! -f "$SCRIPT_DIR/get_window" ] || [ "$SWIFT_HELPER" -nt "$SCRIPT_DIR/get_window" ]; then
    write_timeline "Precompiling get_window.swift with swiftc..."
    swiftc -O "$SWIFT_HELPER" -o "$SCRIPT_DIR/get_window"
fi
GET_WINDOW_BIN="$SCRIPT_DIR/get_window"

# Detect avfoundation screen index
SCREEN_INDEX="0"
DEVICE_OUT=$(ffmpeg -f avfoundation -list_devices true -i "" 2>&1 || true)
if echo "$DEVICE_OUT" | grep -q "Capture screen 0"; then
    SCREEN_INDEX=$(echo "$DEVICE_OUT" | grep "Capture screen 0" | head -n1 | sed -E 's/.*\[([0-9]+)\].*/\1/')
fi
write_timeline "AVFoundation screen index: $SCREEN_INDEX"

# --- window helpers ---------------------------------------------------------
# rect: echoes "x y w h"; returns non-zero when not found.
function win_rect() {
    "$GET_WINDOW_BIN" "$1" 2>/dev/null
}

function win_count() {
    "$GET_WINDOW_BIN" "$1" --all 2>/dev/null | grep -c . || true
}

function wait_window() {
    local target="$1" max_sec="$2"
    local deadline=$((SECONDS + max_sec))
    while [ $SECONDS -lt $deadline ]; do
        if win_rect "$target"; then return 0; fi
        sleep 0.25
    done
    return 1
}

# Two rect reads 60 ms apart -> velocity components in px/s (vx vy) plus the
# second rect. Echoes "x y w h vx vy".
function rect_velocity() {
    local a b
    a=$(win_rect "orbitkit-mascot") || return 1
    sleep 0.06
    b=$(win_rect "orbitkit-mascot") || return 1
    local ax ay bx by vw vh
    read -r ax ay _vw _vh <<< "$a"
    read -r bx by vw vh <<< "$b"
    echo "$bx $by $vw $vh $(( (bx - ax) * 1000 / 60 )) $(( (by - ay) * 1000 / 60 ))"
}

# Predicted-velocity click at mascot-window-local (lx, ly). Post-move
# verification with fresh rect read; > 6 px error re-aims (up to 3 attempts),
# then proceeds and logs the achieved offset. Exactly ONE click per call.
#
# macOS passthrough race: K10 toggles ignore_cursor_events by POLLING the OS
# cursor every 150 ms (DEFAULT_PASSTHROUGH_INTERVAL_MS). A click that lands
# within one poll cycle of the move can arrive while the window still
# ignores cursor events and fall through (run 36733228980: menu clicks #2+
# never reached the DOM). Settle >= 2 poll cycles between the move and the
# click so the hit-region flip is guaranteed to have run.
CLICK_LATENCY_S_MS=200
function click_mascot_anchored() {
    local lx="$1" ly="$2" label="$3"
    local attempt rv ax ay vw vh vx vy pred_x pred_y tx ty now nowx nowy err
    local offset=-1
    tx=""; ty=""
    for attempt in 1 2 3; do
        rv=$(rect_velocity) || { write_timeline "$label: mascot rect read failed (attempt $attempt)"; sleep 0.3; continue; }
        read -r ax ay vw vh vx vy <<< "$rv"
        pred_x=$(( ax + vx * CLICK_LATENCY_S_MS / 1000 ))
        pred_y=$(( ay + vy * CLICK_LATENCY_S_MS / 1000 ))
        tx=$(( pred_x + lx ))
        ty=$(( pred_y + ly ))
        "$TALK" m:"$tx","$ty"
        sleep 0.08
        offset=-1
        if now=$(win_rect "orbitkit-mascot"); then
            read -r nowx nowy _w _h <<< "$now"
            local ex ey
            ex=$(( nowx + lx - tx )); ey=$(( nowy + ly - ty ))
            offset=$(python3 -c "import math; print(round(math.hypot($ex, $ey)))")
        fi
        write_timeline "$label attempt ${attempt}: aim ($tx, $ty), post-move offset ${offset} px (v=($vx, $vy) px/s)"
        if [ "$offset" -ge 0 ] && [ "$offset" -le 6 ]; then break; fi
        if [ "$attempt" -lt 3 ]; then sleep 0.06; fi
    done
    if [ -z "$tx" ]; then
        # All rect reads failed; fall back to the last known overlay rect so
        # the flow can still proceed (logged for the reviewer).
        write_timeline "$label: falling back to last known rect ($MASCOT_GEOM) for local ($lx, $ly)"
        local fx fy
        read -r fx fy _fw _fh <<< "$MASCOT_GEOM"
        if [ -z "${fx:-}" ]; then
            write_timeline "$label: no mascot rect known at all; skipping click"
            return 1
        fi
        tx=$(( fx + lx )); ty=$(( fy + ly ))
    fi
    # >= 2 passthrough poll cycles after the move (see CLICK_SETTLE_MS above).
    sleep 0.4
    "$TALK" c:"$tx","$ty"
    sleep 0.15
}

function click_at() {
    "$TALK" m:"$1","$2"
    sleep 0.08
    "$TALK" c:"$1","$2"
    sleep 0.15
}

function park_pointer() {
    "$TALK" m:20,20 2>/dev/null || true
}

function capture_still() {
    screencapture -x "$1"
    write_timeline "Captured still: $1"
}

# --- 0.2.0 geometry from the real starter config ----------------------------
CFG="$SCRIPT_DIR/../../examples/starter/src/orbitkit.config.json"
if [ ! -f "$CFG" ]; then
    echo "Starter config not found at $CFG!" >&2
    exit 1
fi
eval "$(python3 - "$CFG" <<'PYEOF'
import json, math, sys

cfg = json.load(open(sys.argv[1]))
mascot = cfg["mascot"]
sheet = next(iter(mascot["sheets"].values()))
mascot_size = int(sheet["frameWidth"] * mascot["scale"])
head_gap = int(cfg["menu"].get("arc", {}).get("headGap", 12))
span = int(cfg["menu"].get("arc", {}).get("span", 180))
menu_pad = 8  # MascotView.svelte MENU_PAD
radius = int(cfg["menu"]["radius"])
item_size = int(cfg["menu"].get("itemSize", 44))

# demoWindowFit content union -> fixed window size + bottom-centre mascot pin
reach = radius + item_size / 2
min_xp = mascot_size / 2 - reach - menu_pad
min_yp = -(head_gap + reach) - menu_pad
max_xp = mascot_size / 2 + reach + menu_pad
max_y = max(mascot_size, item_size / 2 - head_gap)
win_w = int(math.ceil(max_xp - min_xp))
win_h = int(math.ceil(max_y - min_yp))
pin_x = int((win_w - mascot_size) / 2)
pin_y = win_h - mascot_size
origin_x = pin_x + mascot_size / 2
origin_y = pin_y - head_gap
start_deg = -90 - span / 2
items = cfg["menu"]["items"]
step_deg = span / (len(items) - 1)
print(f"MASCOT_SIZE={mascot_size} HEADGAP={head_gap} SPAN={span} RADIUS={radius} ITEM_SIZE={item_size}")
print(f"WIN_W={win_w} WIN_H={win_h} PIN_X={pin_x} PIN_Y={pin_y} ORIGIN_X={int(origin_x)} ORIGIN_Y={int(origin_y)}")
print(f"START_DEG={start_deg} STEP_DEG={step_deg} ITEM_COUNT={len(items)}")
print("ITEM_IDS=\"" + " ".join(i["id"] for i in items) + "\"")
PYEOF
)" || { echo "Geometry derivation failed" >&2; exit 1; }
write_timeline "Geometry: mascot=$MASCOT_SIZE window=${WIN_W}x${WIN_H} pin=($PIN_X,$PIN_Y) origin=($ORIGIN_X,$ORIGIN_Y) radius=$RADIUS items=$ITEM_COUNT step=$STEP_DEG"

function item_index() {
    local i=0 id
    for id in $ITEM_IDS; do
        if [ "$id" = "$1" ]; then echo "$i"; return 0; fi
        i=$((i + 1))
    done
    return 1
}

# Startup contentShift (Design B; mirrors Get-Content-Shift in the proven
# Windows driver incl. the y cap at the mascot's bottom edge).
# Screen bounds via the compiled helper (--screen mode).
read -r SCR_X SCR_Y SCR_W SCR_H <<< "$("$GET_WINDOW_BIN" --screen)"
write_timeline "Screen bounds: (${SCR_X},${SCR_Y}) ${SCR_W}x${SCR_H}"

OVERLAY_MARGIN=24  # desktop.rs show_overlay margin constant
PREFIT_SIZE=$(( MASCOT_SIZE > 2 * (RADIUS + ITEM_SIZE) ? MASCOT_SIZE : 2 * (RADIUS + ITEM_SIZE) ))
PREFIT_SIZE=$(( PREFIT_SIZE + 16 ))
PREFIT_X=$(( SCR_X + SCR_W - PREFIT_SIZE - OVERLAY_MARGIN ))
PREFIT_Y=$(( SCR_Y + SCR_H - PREFIT_SIZE - OVERLAY_MARGIN ))

function content_shift() {
    # $1=pre_x $2=pre_y $3=pre_size -> echoes "sx sy" (y capped at mascot bottom)
    local pre_x="$1" pre_y="$2" pre_size="$3"
    local gx gy ideal_x ideal_y cx cy cap_y
    gx=$(( pre_x + (pre_size - MASCOT_SIZE) / 2 ))
    gy=$(( pre_y + pre_size - MASCOT_SIZE ))
    ideal_x=$(( gx - PIN_X ))
    ideal_y=$(( gy - PIN_Y ))
    cx=$ideal_x
    if [ $(( ideal_x )) -lt $SCR_X ]; then cx=$SCR_X; fi
    if [ $(( ideal_x + WIN_W )) -gt $(( SCR_X + SCR_W )) ]; then cx=$(( SCR_X + SCR_W - WIN_W )); fi
    cy=$ideal_y
    if [ $(( ideal_y )) -lt $SCR_Y ]; then cy=$SCR_Y; fi
    if [ $(( ideal_y + WIN_H )) -gt $(( SCR_Y + SCR_H )) ]; then cy=$(( SCR_Y + SCR_H - WIN_H )); fi
    cap_y=$(( WIN_H - MASCOT_SIZE - PIN_Y ))
    local sx sy
    sx=$(( ideal_x - cx ))
    sy=$(( ideal_y - cy ))
    # cap (bash has no min())
    if [ $sy -gt $cap_y ]; then sy=$cap_y; fi
    echo "$sx $sy"
}

read -r SHIFT_X SHIFT_Y <<< "$(content_shift "$PREFIT_X" "$PREFIT_Y" "$PREFIT_SIZE")"
PIN_X_EFF=$(( PIN_X + SHIFT_X ))
PIN_Y_EFF=$(( PIN_Y + SHIFT_Y ))
ORIGIN_X_EFF=$(( ORIGIN_X + SHIFT_X ))
ORIGIN_Y_EFF=$(( ORIGIN_Y + SHIFT_Y ))
write_timeline "Model contentShift = ($SHIFT_X, $SHIFT_Y); effective pin = ($PIN_X_EFF, $PIN_Y_EFF), arc origin = ($ORIGIN_X_EFF, $ORIGIN_Y_EFF)"

function log_mascot_rect() {
    local r
    if r=$(win_rect "orbitkit-mascot"); then
        write_timeline "$1 rect: ($r)"
    else
        write_timeline "$1 rect: mascot window not found"
    fi
}

# --- recording --------------------------------------------------------------
FIFO="/tmp/ffmpeg_macos_fifo"
rm -f "$FIFO" timeline_fp
mkfifo "$FIFO"
exec 3<> "$FIFO"

VIDEO_PATH="video-macos.mp4"
rm -f "$VIDEO_PATH"

write_timeline "Starting screen recorder..."
ffmpeg -y -f avfoundation -capture_cursor 1 -framerate 30 -i "${SCREEN_INDEX}:none" \
       -c:v libx264 -preset ultrafast -pix_fmt yuv420p -movflags +faststart "$VIDEO_PATH" <&3 &
REC_PID=$!

sleep 2
park_pointer

# Launch app (VITE_ORBITKIT_DEBUG is baked at build time by the workflow; the
# runtime console forward + MascotView boot line land in app.log).
APP_BIN="target/debug/starter"
if [ ! -f "$APP_BIN" ]; then
    echo "Error: Binary not found at $APP_BIN" >&2
    exit 1
fi
chmod +x "$APP_BIN"

write_timeline "Launching starter desktop app..."
"$APP_BIN" > app.log 2> app-err.log &
APP_PID=$!
write_timeline "App launched with PID $APP_PID"

FAIL=0
cleanup() {
    if kill -0 "$APP_PID" 2>/dev/null; then
        write_timeline "Cleanup: terminating app..."
        kill -TERM "$APP_PID" 2>/dev/null || kill -9 "$APP_PID" 2>/dev/null || true
    fi
    write_timeline "Stopping screen recorder..."
    echo "q" >&3
    exec 3>&-
    for _ in 1 2 3 4 5 6 7 8; do
        kill -0 "$REC_PID" 2>/dev/null || break
        sleep 1
    done
    if kill -0 "$REC_PID" 2>/dev/null; then
        kill -INT "$REC_PID" 2>/dev/null || true
        sleep 2
    fi
    wait "$REC_PID" 2>/dev/null || true
    rm -f "$FIFO"
    write_timeline "Screen recorder stopped"
    if [ -f "$VIDEO_PATH" ]; then
        write_timeline "Video file: $VIDEO_PATH ($(wc -c < "$VIDEO_PATH" | tr -d ' ') bytes)"
        ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,r_frame_rate,nb_frames \
            -of default=noprint_wrappers=1 "$VIDEO_PATH" >> timeline.txt 2>&1 || true
    else
        write_timeline "ERROR: Video file not found!"
        FAIL=1
    fi
}
trap cleanup EXIT

# Step 1: main window ready; overlay auto-shows from onMount.
write_timeline "Step 1: Waiting for main window 'orbitkit'..."
if ! MAIN_GEOM=$(wait_window "orbitkit" 15); then
    echo "Error: Main window not found" >&2
    exit 1
fi
read -r MAIN_X MAIN_Y MAIN_W MAIN_H <<< "$MAIN_GEOM"
write_timeline "Step 1: Main window ready at ($MAIN_X, $MAIN_Y) size ${MAIN_W}x${MAIN_H}; holding 2 s idle while the overlay auto-shows"

# macOS client-vs-frame: the main window frame includes the title bar.
TITLEBAR=$(( MAIN_H - 600 ))
if [ "$TITLEBAR" -lt 0 ] || [ "$TITLEBAR" -gt 40 ]; then
    write_timeline "Step 1: unexpected titlebar height ${TITLEBAR}px (frame ${MAIN_W}x${MAIN_H} vs 800x600 client); continuing with 0"
    TITLEBAR=0
fi
write_timeline "Step 1: derived titlebar offset ${TITLEBAR}px"

sleep 2
capture_still "01-main.png"

# Step 2: wait for the mascot overlay (auto-shown). Fast poll: the plugin
# first creates a small square window (404x404) and demoWindowFit resizes it
# to the fixed 360x288 moments later; capture the pre-fit rect when seen and
# prefer the OBSERVED shift over the model.
write_timeline "Step 2: Waiting for mascot overlay window (auto-show)..."
MASCOT_GEOM=""
PREFIT_OBSERVED=""
deadline=$((SECONDS + 15))
while [ $SECONDS -lt $deadline ]; do
    if geom=$(win_rect "orbitkit-mascot"); then
        read -r _gx _gy gw gh <<< "$geom"
        if [ -z "$PREFIT_OBSERVED" ] && [ "$gw" -gt "$WIN_W" ]; then
            PREFIT_OBSERVED="$geom"
            write_timeline "Step 2: captured pre-fit mascot window $geom"
        fi
        if [ "$gw" -eq "$WIN_W" ] && [ "$gh" -eq "$WIN_H" ]; then
            MASCOT_GEOM="$geom"
            break
        fi
    fi
    sleep 0.05
done
if [ -z "$MASCOT_GEOM" ]; then
    echo "Error: Mascot window did not reach the derived fixed size ${WIN_W}x${WIN_H} (overlay auto-show or boot fit failed; DPI scale likely not 100%)!" >&2
    exit 1
fi
if [ -n "$PREFIT_OBSERVED" ]; then
    read -r pfx pfy pfw pfh <<< "$PREFIT_OBSERVED"
    read -r OBS_X OBS_Y <<< "$(content_shift "$pfx" "$pfy" "$pfw")"
    if [ "$OBS_X" != "$SHIFT_X" ] || [ "$OBS_Y" != "$SHIFT_Y" ]; then
        write_timeline "Step 2: observed pre-fit rect disagrees with the placement model; overriding model shift ($SHIFT_X, $SHIFT_Y) with observed ($OBS_X, $OBS_Y)"
    fi
    SHIFT_X=$OBS_X; SHIFT_Y=$OBS_Y
    PIN_X_EFF=$(( PIN_X + SHIFT_X )); PIN_Y_EFF=$(( PIN_Y + SHIFT_Y ))
    ORIGIN_X_EFF=$(( ORIGIN_X + SHIFT_X )); ORIGIN_Y_EFF=$(( ORIGIN_Y + SHIFT_Y ))
else
    write_timeline "Step 2: pre-fit rect not captured (fit landed between polls); using model shift ($SHIFT_X, $SHIFT_Y)"
fi
read -r MX MY MW MH <<< "$MASCOT_GEOM"
write_timeline "Step 2: mascot window ${MW}x${MH} == derived ${WIN_W}x${WIN_H} at ($MX, $MY); shift ($SHIFT_X, $SHIFT_Y); effective pin ($PIN_X_EFF, $PIN_Y_EFF), origin ($ORIGIN_X_EFF, $ORIGIN_Y_EFF)"
park_pointer
sleep 1.5
capture_still "02-overlay.png"
log_mascot_rect "Step 2: mascot overlay ready"

# Step 2b: STATIC-BY-DEFAULT PROOF. Roaming is opt-in and the starter demo
# does NOT opt in (coordinator directive: roaming must not be the default
# behaviour, and recordings show the static mascot). Sample the rect for 4 s:
# zero rect changes is the expected, asserted outcome.
write_timeline "Step 2b: Static watch (4 s) — expecting NO window movement (roam is opt-in, starter ships static)..."
LAST_ROAM=""
roam_samples=0
roam_changes=0
watch_start=$SECONDS
while [ $(( SECONDS - watch_start )) -lt 4 ]; do
    if geom=$(win_rect "orbitkit-mascot"); then
        roam_samples=$((roam_samples + 1))
        if [ -n "$LAST_ROAM" ] && [ "$geom" != "$LAST_ROAM" ]; then
            write_timeline "Static watch: UNEXPECTED movement t+$(( SECONDS - watch_start ))s $LAST_ROAM -> $geom"
            roam_changes=$((roam_changes + 1))
        fi
        LAST_ROAM="$geom"
    fi
    sleep 0.2
done
if [ "$roam_changes" -ne 0 ]; then
    write_timeline "Step 2b: FAIL mascot moved $roam_changes time(s) without roam config — default must be static!"
    FAIL=1
else
    write_timeline "Step 2b: static watch OK ($roam_samples samples, 0 movements; renderer/axis wiring recorded by the app.log boot line)"
fi

# Step 3: click planet -> arc menu opens (centre-first stagger)
write_timeline "Step 3: Opening radial menu..."
CX_LOCAL=$(( PIN_X_EFF + MASCOT_SIZE / 2 ))
CY_LOCAL=$(( PIN_Y_EFF + MASCOT_SIZE / 2 ))
click_mascot_anchored "$CX_LOCAL" "$CY_LOCAL" "Open menu"
park_pointer
sleep 0.9
log_mascot_rect "Step 3: menu open"
sleep 0.6
capture_still "03-menu-open.png"
log_mascot_rect "Step 3: before close"

# Close by clicking the main window's title bar centre (deterministic focus
# change -> overlay blur -> menu close).
AWAY_X=$(( MAIN_X + MAIN_W / 2 ))
AWAY_Y=$(( MAIN_Y + 12 ))
write_timeline "Step 3: clicking main title bar at ($AWAY_X, $AWAY_Y) to close menu..."
click_at "$AWAY_X" "$AWAY_Y"
sleep 0.7
log_mascot_rect "Step 3: menu closed"

function click_item() {
    local id="$1" idx angle rad lx ly
    idx=$(item_index "$id") || { echo "Menu item '$id' not present in starter config!" >&2; exit 1; }
    angle=$(python3 -c "print($START_DEG + $idx * $STEP_DEG)")
    lx=$(python3 -c "import math; print(int($ORIGIN_X_EFF + $RADIUS * math.cos(math.radians($angle))))")
    ly=$(python3 -c "import math; print(int($ORIGIN_Y_EFF + $RADIUS * math.sin(math.radians($angle))))")
    write_timeline "Clicking '$id' (angle $angle) at window-local ($lx, $ly)..."
    click_mascot_anchored "$lx" "$ly" "Click $id"
    park_pointer
}

function open_menu() {
    write_timeline "Opening menu..."
    click_mascot_anchored "$CX_LOCAL" "$CY_LOCAL" "Open menu"
    park_pointer
    sleep 0.9
    log_mascot_rect "Menu open"
}

# Step 4: Alert (~3 s animation; alert pool ttlMs 8000 self-reverts)
write_timeline "Step 4: Alert..."
open_menu
click_item "app.alert"
sleep 3.5

# Step 5: Notes x2 -> two Notes windows
write_timeline "Step 5: Notes x2..."
open_menu
click_item "app.notes"
notes_deadline=$((SECONDS + 15))
until [ "$(win_count "Notes")" -ge 1 ]; do
    [ $SECONDS -ge $notes_deadline ] && { echo "Error: first Notes popup not found" >&2; exit 1; }
    sleep 0.25
done
write_timeline "Step 5: first Notes window up (count $(win_count Notes))"
sleep 1
open_menu
click_item "app.notes"
notes_deadline=$((SECONDS + 15))
until [ "$(win_count "Notes")" -ge 2 ]; do
    [ $SECONDS -ge $notes_deadline ] && { echo "Error: second Notes popup not found" >&2; exit 1; }
    sleep 0.25
done
write_timeline "Step 5: second Notes window up (count $(win_count Notes))"
sleep 1.2
capture_still "04-notes-popup.png"

# Step 6: Badge +1 x2 -> badge shows 2
write_timeline "Step 6: Badge +1 x2..."
open_menu
click_item "app.badge"
sleep 1
open_menu
click_item "app.badge"
sleep 1.5

# Step 7: drag planet ~200 px (best effort on macOS: synthetic Quartz events
# do not drive AppKit's native window move, so the rect may stay put; log the
# outcome and continue — the roam keeps the video lively regardless).
write_timeline "Step 7: drag..."
if rv=$(rect_velocity); then
    read -r sx sy _w _h _vx _vy <<< "$rv"
    DRAG_MARGIN=40
    waL=$SCR_X; waT=$SCR_Y; waR=$(( SCR_X + SCR_W )); waB=$(( SCR_Y + SCR_H ))
    drag_end_x=$(( sx + 200 )); drag_end_y=$(( sy - 80 ))
    if [ $drag_end_x -lt $(( waL + DRAG_MARGIN )) ] || [ $drag_end_x -gt $(( waR - DRAG_MARGIN )) ] || \
       [ $drag_end_y -lt $(( waT + DRAG_MARGIN )) ] || [ $drag_end_y -gt $(( waB - DRAG_MARGIN )) ]; then
        cxw=$(( (waL + waR) / 2 )); cyw=$(( (waT + waB) / 2 ))
        vxs=$(( cxw - sx )); vys=$(( cyw - sy ))
        vlen=$(python3 -c "import math; print(max(1, round(math.hypot($vxs, $vys))))")
        drag_end_x=$(python3 -c "print(round($sx + $vxs / $vlen * min(200, $vlen)))")
        drag_end_y=$(python3 -c "print(round($sy + $vys / $vlen * min(200, $vlen)))")
        write_timeline "Step 7: preferred end out of inset; dragging toward centre instead"
    fi
    # Clamp into the inset rectangle (sequential ifs; bash 3.2 has no min()).
    if [ "$drag_end_x" -gt $(( waR - DRAG_MARGIN )) ]; then drag_end_x=$(( waR - DRAG_MARGIN )); fi
    if [ "$drag_end_x" -lt $(( waL + DRAG_MARGIN )) ]; then drag_end_x=$(( waL + DRAG_MARGIN )); fi
    if [ "$drag_end_y" -lt $(( waT + DRAG_MARGIN )) ]; then drag_end_y=$(( waT + DRAG_MARGIN )); fi
    if [ "$drag_end_y" -gt $(( waB - DRAG_MARGIN )) ]; then drag_end_y=$(( waB - DRAG_MARGIN )); fi
    write_timeline "Step 7: drag from ($sx, $sy) to ($drag_end_x, $drag_end_y) (start re-read; mac synthetic drag may not move the window — logging outcome)"
    log_mascot_rect "Step 7: drag start"
    "$TALK" m:"$sx","$sy"
    sleep 0.4
    "$TALK" dd:"$sx","$sy"
    sleep 0.1
    steps=15
    for ((s=1; s<=steps; s++)); do
        cur_x=$(( sx + (drag_end_x - sx) * s / steps ))
        cur_y=$(( sy + (drag_end_y - sy) * s / steps ))
        "$TALK" m:"$cur_x","$cur_y"
        sleep 0.03
    done
    sleep 0.1
    "$TALK" du:"$drag_end_x","$drag_end_y"
    sleep 2
    log_mascot_rect "Step 7: after drop"
else
    write_timeline "Step 7: mascot rect unavailable; skipping drag"
fi

# Step 8: Quit -> app exits with code 0
write_timeline "Step 8: Quit..."
open_menu
click_item "app.quit"
write_timeline "Step 8: Waiting for app process to exit..."
app_exited=0
for _ in 1 2 3 4 5 6; do
    if ! kill -0 "$APP_PID" 2>/dev/null; then app_exited=1; break; fi
    sleep 1
done
if [ "$app_exited" -eq 1 ]; then
    wait "$APP_PID" 2>/dev/null
    write_timeline "Step 8: App exited with code $?"
else
    write_timeline "Step 8: App did not quit within 6s, terminating..."
    kill -TERM "$APP_PID" 2>/dev/null || kill -9 "$APP_PID" 2>/dev/null || true
    FAIL=1
    echo "Error: App did not quit from menu!" >&2
fi

if grep -q "Menu action: app.quit" app-err.log 2>/dev/null; then
    write_timeline "Step 8: app-err.log 'Menu action: app.quit' present: True"
else
    write_timeline "Step 8: app-err.log 'Menu action: app.quit' present: False"
fi

write_timeline "Completed OrbitKit Desktop Video Recording (macOS)"
exit $FAIL
