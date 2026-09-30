# Supplementary: opt-in horizontal roam exercised live on dark-desire (superseded commit 10a84dd)

Before the coordinator directive ("roaming MUST NOT be the default"), commit 10a84dd
shipped a temporary starter config with `windows.mascotWindow.roam = { width 1600,
height 200, margin 24, corner bottom-right, speed 32, axis horizontal }`. The build was
deployed to the macOS peer (~/Downloads/okv-demo-10a84dd, VITE_ORBITKIT_DEBUG=1) and
launched in the GUI session (pid 67215, 2026-09-30 ~17:53 local). Verbatim session
transcript (tool output; fish-free bash -lc remote shell):

    ## app-err.log (full)
    [telemetry] [console.log] [MascotView] boot: renderer=canvas kind=sheets roamAxis=horizontal roamSpeed=32

    ## window sample (get_window --pid 67215), 1 Hz / 12 s; screen 0 0 5120 1440
    t=1s |4089 928 360 288 |2160 233 800 600 
    t=2s |4123 928 360 288 |2160 233 800 600 
    t=3s |4157 928 360 288 |2160 233 800 600 
    t=4s |4192 928 360 288 |2160 233 800 600 
    t=5s |4225 928 360 288 |2160 233 800 600 
    t=6s |4260 928 360 288 |2160 233 800 600 
    t=7s |4293 928 360 288 |2160 233 800 600 
    t=8s |4328 928 360 288 |2160 233 800 600 
    t=9s |4362 928 360 288 |2160 233 800 600 
    t=10s |4396 928 360 288 |2160 233 800 600 
    t=11s |4430 928 360 288 |2160 233 800 600 
    t=12s |4465 928 360 288 |2160 233 800 600 

Reading: mascot window 360x288, x advances 4089 -> 4465 (+376 px / 11 s ~= 34 px/s
nominal speed 32 + step rounding), y FROZEN at 928 across all 12 samples — the
`axis: "horizontal"` lock (vy = 0) holding live on macOS. This proves the
okv_horizontal-roam feature end-to-end on the peer; the shipped default (d33da11)
does NOT enable it (see dark-desire-proof-d33da11.txt).
