# scripts/ci/record-windows.ps1
# Full flow driver for the OrbitKit 0.2.0 starter on a Windows GitHub Actions runner.
#
# 0.2.0 notes (vs the 0.1.0 script):
# - The overlay auto-shows on desktop start (MainView.svelte onMount calls
#   handleShowOverlay), so there is no "Show overlay" click any more.
# - The mascot window is a FIXED Design-B surface sized once to the open-menu
#   content union (windowFit.ts demoWindowFit). The mascot is pinned
#   bottom-centre INSIDE the window, so the window centre is NOT the mascot:
#   every click point below is derived from the real orbitkit.config.json +
#   windowFit/geometry math, and the window rect is re-read from the OS right
#   before every click. The app CAPS the boot-fit y shift at the mascot's
#   bottom edge (mirrored in Get-Content-Shift): the bottom-pinned mascot is
#   never pushed past the window bottom — near work-area edges it moves up
#   WITH the window. The mascot is STATIC by default (no roam in the starter
#   config; roaming is an opt-in library feature), so the rect only changes
#   on drags and one-shot re-clamps.
# - The K7 arc-anchor menu arc centre sits headGap px above the mascot's top
#   edge; discs are centred at origin + radius*(cos, sin) for angle
#   -180 + i * span/(n-1)  (RadialMenu translates its container by the origin
#   and centres each disc with translate(-50%, -50%)).
# - B1: menu open/close never resizes or moves the window (fixed surface);
#   we log window rects before/after a toggle so the video reviewer can verify.
# - Flow: idle 2s -> menu open/close -> Alert -> Notes x2 -> Badge x2 ->
#   drag ~200 px -> Quit (exit 0). Stills keep the 01..04 names.
$ErrorActionPreference = "Continue"

function Write-Timeline($msg) {
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path "timeline.txt" -Value $line
}

# Clear / init timeline.txt
if (Test-Path "timeline.txt") { Remove-Item "timeline.txt" }
Write-Timeline "Starting OrbitKit Desktop Video Recording (Windows, 0.2.0 starter)"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Timeline "Screen bounds: $($screen.Width)x$($screen.Height)"

# Check ffmpeg
$ffmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpegCmd) {
    Write-Host "Installing ffmpeg via choco..."
    choco install ffmpeg -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Compile Win32 helpers
$source = @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
    public int Width { get { return Right - Left; } }
    public int Height { get { return Bottom - Top; } }
}

public struct POINT {
    public int X;
    public int Y;
}

public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@
Add-Type -TypeDefinition $source

function Move-Mouse-Smooth($startX, $startY, $targetX, $targetY, $steps = 15, $delayMs = 20) {
    for ($i = 1; $i -le $steps; $i++) {
        $curX = [int]($startX + ($targetX - $startX) * $i / $steps)
        $curY = [int]($startY + ($targetY - $startY) * $i / $steps)
        [Win32]::SetCursorPos($curX, $curY) | Out-Null
        [Win32]::mouse_event(0x0001, 0, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds $delayMs
    }
    [Win32]::SetCursorPos($targetX, $targetY) | Out-Null
}

function Click-At($x, $y) {
    $pt = New-Object POINT
    [Win32]::GetCursorPos([ref]$pt) | Out-Null
    Move-Mouse-Smooth $pt.X $pt.Y $x $y 12 15
    Start-Sleep -Milliseconds 80
    [Win32]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero) # LEFTDOWN
    Start-Sleep -Milliseconds 80
    [Win32]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero) # LEFTUP
    Start-Sleep -Milliseconds 150
}

# r5: mascot rect watch (proves/disproves the OS edge-snap hypothesis).
# Sampled ~every 100 ms during the drag and the post-drop settle; a compact
# line is logged whenever position OR size changes.
$script:WatchOn = $false
$script:WatchSw = $null
$script:WatchLastSampleMs = -1000
$script:WatchLast = ""
$script:WatchHist = New-Object System.Collections.ArrayList

function Start-Rect-Watch {
    $script:WatchSw = [System.Diagnostics.Stopwatch]::StartNew()
    $script:WatchLastSampleMs = -1000
    $script:WatchLast = ""
    $script:WatchHist = New-Object System.Collections.ArrayList
    $script:WatchOn = $true
    Watch-Sample
}

function Watch-Sample {
    if (-not $script:WatchOn) { return }
    $ms = $script:WatchSw.ElapsedMilliseconds
    if (($ms - $script:WatchLastSampleMs) -lt 100) { return }
    $script:WatchLastSampleMs = $ms
    $w = Get-Window-Info "^orbitkit-mascot$"
    if ($w) {
        $r = $w.Rect
        $cur = "($($r.Left),$($r.Top)) $($r.Width)x$($r.Height)"
    } else {
        $cur = "(window not found)"
    }
    if ($cur -ne $script:WatchLast) {
        $line = "t+${ms}ms $cur"
        [void]$script:WatchHist.Add($line)
        Write-Timeline "Rect watch: $line"
        $script:WatchLast = $cur
    }
}

function Stop-Rect-Watch {
    Watch-Sample
    $script:WatchOn = $false
    return @($script:WatchHist)
}

function Sample-Sleep($ms) {
    # Sleep $ms, sampling the watch every ~100 ms (plain sleep when off).
    if (-not $script:WatchOn) { Start-Sleep -Milliseconds $ms; return }
    $end = (Get-Date).AddMilliseconds($ms)
    while ((Get-Date) -lt $end) {
        Watch-Sample
        Start-Sleep -Milliseconds 20
    }
}

function Test-App-Err-Log($needle) {
    # Non-destructive read of the (possibly locked) redirected stderr log.
    if (-not (Test-Path "app-err.log")) { return "no app-err.log" }
    try {
        $fs = [System.IO.File]::Open((Join-Path $PWD "app-err.log"), [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        try {
            $sr = New-Object System.IO.StreamReader($fs)
            $txt = $sr.ReadToEnd()
        } finally { $fs.Dispose() }
        return [string]($txt.Contains($needle))
    } catch {
        return "unreadable ($($_.Exception.Message))"
    }
}

function Drag-Mouse($startX, $startY, $endX, $endY, $steps = 15, $delayMs = 25) {
    $pt = New-Object POINT
    [Win32]::GetCursorPos([ref]$pt) | Out-Null
    Move-Mouse-Smooth $pt.X $pt.Y $startX $startY 10 15
    Sample-Sleep 100
    [Win32]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero) # LEFTDOWN
    Sample-Sleep 100
    for ($i = 1; $i -le $steps; $i++) {
        $curX = [int]($startX + ($endX - $startX) * $i / $steps)
        $curY = [int]($startY + ($endY - $startY) * $i / $steps)
        [Win32]::SetCursorPos($curX, $curY) | Out-Null
        [Win32]::mouse_event(0x0001, 0, 0, 0, [UIntPtr]::Zero)
        Sample-Sleep $delayMs
    }
    Sample-Sleep 100
    [Win32]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero) # LEFTUP
    Sample-Sleep 200
}

function Park-Pointer {
    $pt = New-Object POINT
    [Win32]::GetCursorPos([ref]$pt) | Out-Null
    Move-Mouse-Smooth $pt.X $pt.Y 20 20 10 15
}

function Capture-Still($filename) {
    $bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
    $bmp.Save($filename, [System.Drawing.Imaging.ImageFormat]::Png)
    $gfx.Dispose()
    $bmp.Dispose()
    Write-Timeline "Captured still: $filename"
}

function Get-Window-Info($titleMatch) {
    $script:matchedWindow = $null
    $callback = [Win32+EnumWindowsProc]{
        param($hWnd, $lParam)
        if ([Win32]::IsWindowVisible($hWnd)) {
            $sb = New-Object System.Text.StringBuilder 256
            $len = [Win32]::GetWindowText($hWnd, $sb, $sb.Capacity)
            if ($len -gt 0) {
                $t = $sb.ToString()
                if ($t -match $titleMatch) {
                    $r = New-Object RECT
                    [Win32]::GetWindowRect($hWnd, [ref]$r) | Out-Null
                    $script:matchedWindow = [PSCustomObject]@{
                        hWnd = $hWnd
                        Title = $t
                        Rect = $r
                    }
                    return $false
                }
            }
        }
        return $true
    }
    [Win32]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
    return $script:matchedWindow
}

function Count-Windows($titleMatch) {
    $script:matchCount = 0
    $callback = [Win32+EnumWindowsProc]{
        param($hWnd, $lParam)
        if ([Win32]::IsWindowVisible($hWnd)) {
            $sb = New-Object System.Text.StringBuilder 256
            $len = [Win32]::GetWindowText($hWnd, $sb, $sb.Capacity)
            if ($len -gt 0 -and ($sb.ToString() -match $titleMatch)) {
                $script:matchCount++
            }
        }
        return $true
    }
    [Win32]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
    return $script:matchCount
}

function Wait-For-Window($titleMatch, $maxSec = 15) {
    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $maxSec) {
        $w = Get-Window-Info $titleMatch
        if ($w) { return $w }
        Start-Sleep -Milliseconds 250
    }
    return $null
}

function Wait-For-Window-Count($titleMatch, $minCount, $maxSec = 15) {
    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $maxSec) {
        if ((Count-Windows $titleMatch) -ge $minCount) { return $true }
        Start-Sleep -Milliseconds 250
    }
    return $false
}

# ---------------------------------------------------------------------------
# 0.2.0 geometry: derive every click point from the real starter config
# (mirrors examples/starter/src/lib/windowFit.ts demoWindowFit + the
# K7 arc-anchor math in packages/orbitkit/src/geometry.ts; MENU_PAD=8 is the
# MascotView.svelte constant). The derivation script and its output live in
# evidence/okc/demo-video/raw/.
# ---------------------------------------------------------------------------
$cfgPath = Join-Path $PSScriptRoot "..\..\examples\starter\src\orbitkit.config.json"
if (-not (Test-Path $cfgPath)) {
    Write-Error "Starter config not found at $cfgPath!"
    exit 1
}
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$sheetProp = ($cfg.mascot.sheets.PSObject.Properties | Select-Object -First 1)
$MascotSize = [int]($sheetProp.Value.frameWidth * $cfg.mascot.scale)
$HeadGap = 12; if ($cfg.menu.arc.headGap) { $HeadGap = [int]$cfg.menu.arc.headGap }
$Span = 180;  if ($cfg.menu.arc.span)   { $Span   = [int]$cfg.menu.arc.span }
$MenuPad = 8 # MascotView.svelte MENU_PAD
$Radius = [int]$cfg.menu.radius
$ItemSize = 44; if ($cfg.menu.itemSize) { $ItemSize = [int]$cfg.menu.itemSize }

# demoWindowFit content union -> fixed window size + bottom-centre mascot pin
$Reach = $Radius + $ItemSize / 2
$MinXp = $MascotSize / 2 - $Reach - $MenuPad
$MinYp = -($HeadGap + $Reach) - $MenuPad
$MaxXp = $MascotSize / 2 + $Reach + $MenuPad
$MaxY = [Math]::Max($MascotSize, $ItemSize / 2 - $HeadGap)
$WinW = [int][Math]::Ceiling($MaxXp - $MinXp)
$WinH = [int][Math]::Ceiling($MaxY - $MinYp)
$PinX = [int](($WinW - $MascotSize) / 2)
$PinY = $WinH - $MascotSize
# K7 arc-anchor origin: centred on the mascot bounds, headGap above its top edge
$OriginX = $PinX + $MascotSize / 2
$OriginY = $PinY - $HeadGap
# resolveMenuAngles for arc-anchor: centre -90 (top arc), half-span each side
$StartDeg = -90 - $Span / 2
$ItemCount = @($cfg.menu.items).Count
$StepDeg = $Span / ($ItemCount - 1)
$ItemIndex = @{}
for ($i = 0; $i -lt $ItemCount; $i++) { $ItemIndex[$cfg.menu.items[$i].id] = $i }

Write-Timeline "Geometry: mascot=$MascotSize window=${WinW}x${WinH} pin=($PinX,$PinY) origin=($OriginX,$OriginY) radius=$Radius items=$ItemCount step=$StepDeg"

# ---------------------------------------------------------------------------
# Startup contentShift (Design B). crates/tauri-plugin-orbitkit desktop.rs
# creates the mascot window small and square (calculate_overlay_size:
# max(mascot, 2*(radius+itemSize)) + 16) at the PRIMARY MONITOR BOTTOM-RIGHT
# (calculate_overlay_position default, margin 24, config x/y override), then
# MascotView's demoWindowFit sizes it to the content union (360x288), keeps
# WORK AREA and compensates the content by the clamp delta (contentShift) —
# EXCEPT downward: the app caps the y shift at the mascot's bottom edge
# (windowFit.ts: shift.y = min(idealY - cY, WinH - MascotSize - PinY), the
# padding slack below the pinned mascot — 0 with the starter numbers), so
# the mascot never moves past the window bottom; near work-area edges it
# moves up WITH the window. (Run 36573470644 failed because this script
# modelled the OLD uncapped shift and aimed every disc 24 px too low.)
# The mascot's window-local position is gNew + shift, NOT the raw pin —
# ignoring the shift moves every click point by the clamp delta.
# The shift is boot-constant: the mascot is STATIC by default (no roam in
# the starter config) and post-drag re-clamps move the WINDOW only, never
# the content shift (MascotView).
$MonitorBounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$WorkArea = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
Write-Timeline "Monitor $($MonitorBounds.Width)x$($MonitorBounds.Height); work area ($($WorkArea.X),$($WorkArea.Y)) $($WorkArea.Width)x$($WorkArea.Height)"
$OverlayMargin = 24 # desktop.rs show_overlay margin constant
$PrefitSize = [Math]::Max($MascotSize, 2 * ($Radius + $ItemSize)) + 16
$PrefitX = $MonitorBounds.X + $MonitorBounds.Width - $PrefitSize - $OverlayMargin
$PrefitY = $MonitorBounds.Y + $MonitorBounds.Height - $PrefitSize - $OverlayMargin
if ($cfg.windows.mascotWindow.x) { $PrefitX = [double]$cfg.windows.mascotWindow.x }
if ($cfg.windows.mascotWindow.y) { $PrefitY = [double]$cfg.windows.mascotWindow.y }
Write-Timeline "Pre-fit mascot window model: ${PrefitSize}x${PrefitSize} at ($PrefitX, $PrefitY)"

function Get-Content-Shift($preX, $preY, $preSize) {
    # demoWindowFit: mascot screen pos = pre-fit rect + CSS bottom-centre pin;
    # ideal window pos = mascotScreen - gNew (= PinX,PinY); clamp into the
    # work area; shift = ideal - clamped, EXCEPT the y component is capped
    # at the mascot's bottom edge (the padding slack below the pinned
    # mascot) — mirrors the windowFit.ts cap so the model can never aim
    # below the window bottom.
    $gX = $preX + ($preSize - $MascotSize) / 2
    $gY = $preY + $preSize - $MascotSize
    $idealX = $gX - $PinX
    $idealY = $gY - $PinY
    $cX = $idealX
    if ($WinW -lt $WorkArea.Width) {
        if ($idealX -lt $WorkArea.X) { $cX = $WorkArea.X }
        elseif ($idealX + $WinW -gt $WorkArea.X + $WorkArea.Width) { $cX = $WorkArea.X + $WorkArea.Width - $WinW }
    } else { $cX = $WorkArea.X }
    $cY = $idealY
    if ($WinH -lt $WorkArea.Height) {
        if ($idealY -lt $WorkArea.Y) { $cY = $WorkArea.Y }
        elseif ($idealY + $WinH -gt $WorkArea.Y + $WorkArea.Height) { $cY = $WorkArea.Y + $WorkArea.Height - $WinH }
    } else { $cY = $WorkArea.Y }
    # windowFit.ts y-cap. Equals the padding slack below the pinned mascot
    # when maxY == mascot and MinYp is integral (the starter's numbers); in
    # general it is WinH - mascot - pin (any ceil slack included).
    $capY = $WinH - $MascotSize - $PinY
    return @{ X = [int]($idealX - $cX); Y = [int][Math]::Min($idealY - $cY, $capY) }
}

$script:ContentShift = Get-Content-Shift $PrefitX $PrefitY $PrefitSize
$script:PinXEff = $PinX + $ContentShift.X
$script:PinYEff = $PinY + $ContentShift.Y
$script:OriginXEff = $OriginX + $ContentShift.X
$script:OriginYEff = $OriginY + $ContentShift.Y
Write-Timeline "Startup contentShift = ($($ContentShift.X), $($ContentShift.Y)); effective pin = ($PinXEff, $PinYEff), arc origin = ($OriginXEff, $OriginYEff)"
# r4: measured move-to-button-down latency of Click-At's phase sequence
# (Move-Mouse-Smooth 12 x 15 ms + 80 ms + 80 ms ~= 350 ms).
$script:ClickLatencyMs = 350

function Get-Orbitkit-Window-Titles {
    # Diagnostics: every visible top-level window title containing 'orbitkit'.
    $script:okTitles = New-Object System.Collections.Generic.List[string]
    $callback = [Win32+EnumWindowsProc]{
        param($hWnd, $lParam)
        if ([Win32]::IsWindowVisible($hWnd)) {
            $sb = New-Object System.Text.StringBuilder 256
            $len = [Win32]::GetWindowText($hWnd, $sb, $sb.Capacity)
            if ($len -gt 0) {
                $t = $sb.ToString()
                if ($t -match "orbitkit") { $script:okTitles.Add($t) }
            }
        }
        return $true
    }
    [Win32]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
    if ($script:okTitles.Count -eq 0) { return "(none)" }
    return ($script:okTitles -join " | ")
}

function Get-App-Error-Tail {
    # Diagnostics: last 30 lines of the app's stderr log (r4 primary instrument).
    if (-not (Test-Path "app-err.log")) { return "(no app-err.log)" }
    $lines = Get-Content "app-err.log" -Tail 30
    if (@($lines).Count -eq 0) { return "(app-err.log empty)" }
    return ($lines -join " `| ")
}

function Get-Mascot-Rect-Twice {
    # Two rect reads 60 ms apart -> per-tick velocity in px/s (r4: instrument,
    # don't guess — the static-by-default mascot reads v=(0,0), but drags and
    # one-shot settle re-clamps move the window (and an opt-in roam would
    # move it continuously); a click computed from a single read drifts by
    # velocity * click latency).
    $a = Get-Window-Info "^orbitkit-mascot$"
    if (-not $a) { return $null }
    Start-Sleep -Milliseconds 60
    $b = Get-Window-Info "^orbitkit-mascot$"
    if (-not $b) { return $null }
    return @{
        Rect = $b.Rect
        VX = ($b.Rect.Left - $a.Rect.Left) / 0.06
        VY = ($b.Rect.Top - $a.Rect.Top) / 0.06
    }
}

function Get-Mascot-Predicted {
    # Predicted window top-left at button-down: current rect + velocity *
    # measured click latency (Move-Mouse-Smooth 12x15 ms + 80 ms + 80 ms
    # ~= 350 ms). Bounded not-found retry: on each miss log (a) app process
    # alive, (b) all visible window titles containing 'orbitkit', (c) the
    # last 30 lines of app-err.log; only fail after the 5 s budget.
    $deadline = (Get-Date).AddSeconds(5)
    while ($true) {
        $t = Get-Mascot-Rect-Twice
        if ($t) {
            $lead = $script:ClickLatencyMs / 1000.0
            return @{
                PredX = [int]($t.Rect.Left + $t.VX * $lead)
                PredY = [int]($t.Rect.Top + $t.VY * $lead)
                VX = [int]$t.VX
                VY = [int]$t.VY
                Rect = $t.Rect
            }
        }
        $alive = $true
        if ($appProc) { $alive = -not $appProc.HasExited }
        $titles = Get-Orbitkit-Window-Titles
        $errTail = Get-App-Error-Tail
        Write-Timeline "Mascot window miss (retrying): app alive=$alive; orbitkit windows: $titles; app-err tail: $errTail"
        if (-not $alive -or (Get-Date) -gt $deadline) {
            Write-Error "Mascot window 'orbitkit-mascot' not found within retry budget (app alive=$alive; orbitkit windows: $titles)!"
            exit 1
        }
        Start-Sleep -Milliseconds 250
    }
}

function Click-Mascot-Anchored($localX, $localY, $label) {
    # Velocity-predicted click at window-local ($localX, $localY) with
    # post-move verification: re-read the rect once after the move and
    # compare the settled cursor-to-anchor offset; if the error is > 6 px,
    # re-aim with a fresh prediction (up to 3 attempts), then proceed anyway
    # and log the achieved offset. Exactly ONE button press per call.
    $offset = -1
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $t = Get-Mascot-Predicted
        $tx = [int]($t.PredX + $localX)
        $ty = [int]($t.PredY + $localY)
        $pt = New-Object POINT
        [Win32]::GetCursorPos([ref]$pt) | Out-Null
        Move-Mouse-Smooth $pt.X $pt.Y $tx $ty 12 15
        $now = Get-Window-Info "^orbitkit-mascot$"
        if ($now) {
            $errX = ($now.Rect.Left + $localX) - $tx
            $errY = ($now.Rect.Top + $localY) - $ty
            $offset = [int][Math]::Sqrt($errX * $errX + $errY * $errY)
        } else {
            $offset = -1
        }
        Write-Timeline "$label attempt ${attempt}: aim ($tx, $ty), post-move offset ${offset} px (v=($($t.VX), $($t.VY)) px/s)"
        if (($offset -ge 0 -and $offset -le 6) -or $offset -lt 0) { break }
        if ($attempt -lt 3) { Start-Sleep -Milliseconds 60 }
        else { Write-Timeline "$label proceeding after $attempt attempts with ${offset} px offset" }
    }
    Start-Sleep -Milliseconds 80
    [Win32]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero) # LEFTDOWN
    Start-Sleep -Milliseconds 80
    [Win32]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero) # LEFTUP
    Start-Sleep -Milliseconds 150
}

function Get-Mascot-Point {
    # Velocity-predicted mascot centre point (fresh read per call — the rect
    # can change on drags/re-clamps; never cache).
    $t = Get-Mascot-Predicted
    return @{
        X = $t.PredX + $script:PinXEff + $MascotSize / 2
        Y = $t.PredY + $script:PinYEff + $MascotSize / 2
        Rect = $t.Rect
    }
}

function Log-Mascot-Rect($tag) {
    $w = Get-Window-Info "^orbitkit-mascot$"
    if ($w) {
        $r = $w.Rect
        Write-Timeline "$tag rect: ($($r.Left),$($r.Top)) $($r.Width)x$($r.Height)"
    } else {
        Write-Timeline "$tag rect: mascot window not found"
    }
}

function Open-Menu {
    Write-Timeline "Clicking mascot to open menu..."
    Click-Mascot-Anchored ($script:PinXEff + $MascotSize / 2) ($script:PinYEff + $MascotSize / 2) "Open menu"
    Park-Pointer
    # spawn stagger: openMs 260 + stepMs 40 * 8 = 580 ms; settle before clicks
    Start-Sleep -Milliseconds 900
    Log-Mascot-Rect "Menu open"
}

function Click-Item($id) {
    $idx = $ItemIndex[$id]
    if ($null -eq $idx) {
        Write-Error "Menu item '$id' not present in starter config!"
        exit 1
    }
    $angle = $StartDeg + $idx * $StepDeg
    $rad = $angle * [Math]::PI / 180.0
    $localX = [int]($script:OriginXEff + $Radius * [Math]::Cos($rad))
    $localY = [int]($script:OriginYEff + $Radius * [Math]::Sin($rad))
    Write-Timeline "Clicking '$id' (angle $angle) at window-local ($localX, $localY)..."
    Click-Mascot-Anchored $localX $localY "Click $id"
    Park-Pointer
}

function Close-Menu-By-Clicking-Away {
    # Click the main window's TITLE BAR centre: deterministic focus change
    # (no interactive controls on the title strip), so the overlay window
    # blurs and the menu closes (the passthrough-mode close signal).
    $awayX = [int]($script:MainRect.Left + $script:MainRect.Width / 2)
    $awayY = $script:MainRect.Top + 12
    Write-Timeline "Clicking away on main window title bar at ($awayX, $awayY) to close menu..."
    Click-At $awayX $awayY
    Start-Sleep -Milliseconds 800
    Log-Mascot-Rect "Menu closed"
}

# Start ffmpeg recorder
$videoPath = Join-Path $PWD "video-windows.mp4"
$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = "ffmpeg"
$pinfo.Arguments = "-y -f gdigrab -framerate 30 -i desktop -c:v libx264 -preset ultrafast -pix_fmt yuv420p -movflags +faststart `"$videoPath`""
$pinfo.UseShellExecute = $false
$pinfo.RedirectStandardInput = $true
$pinfo.RedirectStandardOutput = $false
$pinfo.RedirectStandardError = $false

$recProc = [System.Diagnostics.Process]::Start($pinfo)
Write-Timeline "Started screen recorder (PID $($recProc.Id))"
Start-Sleep -Seconds 2

# Park pointer initially
Park-Pointer

# Launch app
$binPath = "target\debug\starter.exe"
if (-not (Test-Path $binPath)) {
    Write-Error "Binary not found at $binPath!"
    exit 1
}

$appProc = Start-Process -FilePath $binPath -WindowStyle Hidden -RedirectStandardOutput "app.log" -RedirectStandardError "app-err.log" -PassThru
Write-Timeline "Launched starter app with -WindowStyle Hidden (PID $($appProc.Id))"

try {
    # Step 1: Main window ready; the overlay auto-shows from onMount, so just
    # hold ~2 s of idle while the planet appears.
    Write-Timeline "Step 1: Waiting for main window..."
    $mainWin = Wait-For-Window "^orbitkit$" 15
    if (-not $mainWin) {
        Write-Error "Main window 'orbitkit' not found!"
        exit 1
    }
    $script:MainRect = $mainWin.Rect

    # Hide any debug console window so it does not occlude the app
    $consoleWin = Get-Window-Info "starter\.exe"
    if ($consoleWin) {
        Write-Timeline "Hiding debug console window..."
        [Win32]::ShowWindow($consoleWin.hWnd, 0) | Out-Null # SW_HIDE = 0
    }

    [Win32]::ShowWindow($mainWin.hWnd, 9) | Out-Null # SW_RESTORE = 9
    [Win32]::BringWindowToTop($mainWin.hWnd) | Out-Null
    [Win32]::SetForegroundWindow($mainWin.hWnd) | Out-Null
    Write-Timeline "Step 1: Main window ready at ($($mainWin.Rect.Left), $($mainWin.Rect.Top)) size $($mainWin.Rect.Width)x$($mainWin.Rect.Height); holding 2 s idle while the overlay auto-shows"
    Start-Sleep -Seconds 2
    Capture-Still "01-main.png"

    # Step 2: wait for the mascot overlay (auto-shown; no click needed).
    # Fast poll (25 ms): the plugin first creates a small square window
    # (404x404, primary-monitor bottom-right) and demoWindowFit resizes it to
    # the fixed 360x288 union moments later. Capture the pre-fit rect when
    # seen to derive the content shift from OBSERVED boot data; if the poll
    # misses it, the model shift from the geometry section stands.
    Write-Timeline "Step 2: Waiting for mascot overlay window (auto-show)..."
    $mascotWin = $null
    $prefitObserved = $null
    $mascotWaitStart = Get-Date
    while (((Get-Date) - $mascotWaitStart).TotalSeconds -lt 15) {
        $w = Get-Window-Info "^orbitkit-mascot$"
        if ($w) {
            if ($null -eq $prefitObserved -and $w.Rect.Width -gt $WinW) {
                $prefitObserved = $w.Rect
                Write-Timeline "Step 2: captured pre-fit mascot window $($prefitObserved.Width)x$($prefitObserved.Height) at ($($prefitObserved.Left), $($prefitObserved.Top))"
            }
            if ($w.Rect.Width -eq $WinW -and $w.Rect.Height -eq $WinH) {
                $mascotWin = $w
                break
            }
        }
        Start-Sleep -Milliseconds 25
    }
    if (-not $mascotWin) {
        Write-Error "Mascot window 'orbitkit-mascot' did not reach the derived fixed size ${WinW}x${WinH} (overlay auto-show or boot fit failed; DPI scale likely not 100%)!"
        exit 1
    }
    if ($prefitObserved) {
        $obsShift = Get-Content-Shift $prefitObserved.Left $prefitObserved.Top $prefitObserved.Width
        if ($obsShift.X -ne $ContentShift.X -or $obsShift.Y -ne $ContentShift.Y) {
            Write-Timeline "Step 2: observed pre-fit rect disagrees with the placement model; overriding model shift ($($ContentShift.X), $($ContentShift.Y)) with observed ($($obsShift.X), $($obsShift.Y))"
        }
        $script:ContentShift = $obsShift
        $script:PinXEff = $PinX + $ContentShift.X
        $script:PinYEff = $PinY + $ContentShift.Y
        $script:OriginXEff = $OriginX + $ContentShift.X
        $script:OriginYEff = $OriginY + $ContentShift.Y
    } else {
        Write-Timeline "Step 2: pre-fit rect not captured (fit landed between polls); using model shift ($($ContentShift.X), $($ContentShift.Y))"
    }
    Write-Timeline "Step 2: mascot window $($mascotWin.Rect.Width)x$($mascotWin.Rect.Height) == derived ${WinW}x${WinH}; shift ($($ContentShift.X), $($ContentShift.Y)); effective pin ($PinXEff, $PinYEff), origin ($OriginXEff, $OriginYEff)"
    # Post-fit ground truth (the script cannot see the DOM): the only APP
    # truth observable here is the WINDOW rect. (1) It must sit fully inside
    # the work area — a violation is an app regression, fail loudly.
    # (2) Ground truth for the clamp the app applied: the ideal window pos
    # is pure geometry from the pre-fit rect (mascot screen pos - pin), so
    # the delta ideal -> OBSERVED final rect is the clamp the app ACTUALLY
    # applied, logged next to the model shift. The mascot-bottom ==
    # window-bottom relation is deliberately NOT asserted: the pin is
    # model-derived (DOM invisible), so that check could only compare the
    # model with itself — a model/app content-shift mismatch shows up only
    # as missed discs, which the r4 miss diagnostics catch.
    $pfL = $mascotWin.Rect.Left; $pfT = $mascotWin.Rect.Top
    $pfR = $pfL + $mascotWin.Rect.Width; $pfB = $pfT + $mascotWin.Rect.Height
    if ($pfL -lt $WorkArea.X -or $pfT -lt $WorkArea.Y -or $pfR -gt ($WorkArea.X + $WorkArea.Width) -or $pfB -gt ($WorkArea.Y + $WorkArea.Height)) {
        Write-Error "Post-fit invariant broken: window rect ($pfL,$pfT)-($pfR,$pfB) outside the work area ($($WorkArea.X),$($WorkArea.Y)) $($WorkArea.Width)x$($WorkArea.Height) (app regression, not a script issue)!"
        exit 1
    }
    $fitSrc = "model"
    $fitRect = @{ Left = $PrefitX; Top = $PrefitY; Width = $PrefitSize; Height = $PrefitSize }
    if ($prefitObserved) { $fitRect = $prefitObserved; $fitSrc = "observed" }
    $fgX = $fitRect.Left + ($fitRect.Width - $MascotSize) / 2
    $fgY = $fitRect.Top + $fitRect.Height - $MascotSize
    $appliedX = [int](($fgX - $PinX) - $pfL); $appliedY = [int](($fgY - $PinY) - $pfT)
    Write-Timeline "Step 2: post-fit ground truth: window ($pfL,$pfT)-($pfR,$pfB) inside work area; app applied clamp delta = ($appliedX, $appliedY) [$fitSrc pre-fit -> observed final]; model content shift = ($($ContentShift.X), $($ContentShift.Y)) (y capped at capY=$($WinH - $MascotSize - $PinY))"
    Park-Pointer
    Start-Sleep -Milliseconds 1500
    Capture-Still "02-overlay.png"
    Log-Mascot-Rect "Step 2: mascot overlay ready"

    # Step 3 (brief step 2): click planet -> arc menu opens (centre-first stagger)
    Write-Timeline "Step 3: Opening radial menu..."
    Open-Menu
    Start-Sleep -Milliseconds 600
    Capture-Still "03-menu-open.png"
    Log-Mascot-Rect "Step 3: before close"
    Close-Menu-By-Clicking-Away
    Start-Sleep -Milliseconds 700

    # Step 4 (brief step 4): open menu, click Alert (~3 s alert animation,
    # alert pool ttlMs=8000 reverts to idle on its own)
    Write-Timeline "Step 4: Alert..."
    Open-Menu
    Click-Item "app.alert"
    Start-Sleep -Milliseconds 3500

    # Step 5 (brief step 5): open menu, click Notes twice -> two Notes windows
    Write-Timeline "Step 5: Notes x2..."
    Open-Menu
    Click-Item "app.notes"
    if (-not (Wait-For-Window-Count "^Notes$" 1 15)) {
        Write-Error "First Notes popup window not found!"
        exit 1
    }
    Write-Timeline "Step 5: first Notes window up (count $(Count-Windows '^Notes$'))"
    Start-Sleep -Milliseconds 1000
    Open-Menu
    Click-Item "app.notes"
    if (-not (Wait-For-Window-Count "^Notes$" 2 15)) {
        Write-Error "Second Notes popup window not found!"
        exit 1
    }
    Write-Timeline "Step 5: second Notes window up (count $(Count-Windows '^Notes$'))"
    Start-Sleep -Milliseconds 1200
    Capture-Still "04-notes-popup.png"

    # Step 6 (brief step 6): open menu, click Badge +1 twice -> badge shows 2
    Write-Timeline "Step 6: Badge +1 x2..."
    Open-Menu
    Click-Item "app.badge"
    Start-Sleep -Milliseconds 1000
    Open-Menu
    Click-Item "app.badge"
    Start-Sleep -Milliseconds 1500

    # Step 7 (brief step 7): drag planet ~200 px. The window follows the
    # drag; after the drop the one-shot settle re-clamp moves it (window
    # only) back inside the work area; log rects before/after.
    # r5: the end point is chosen from the ACTUAL work area and must stay
    # >= $DragMargin px inside every work-area edge (r4 run dropped the
    # mascot 9 px from the right edge and the window came back 512x360).
    $mp = Get-Mascot-Point
    $DragMargin = 150
    $waL = $WorkArea.X; $waT = $WorkArea.Y
    $waR = $WorkArea.X + $WorkArea.Width; $waB = $WorkArea.Y + $WorkArea.Height
    $sx = [int]$mp.X; $sy = [int]$mp.Y
    $dragEndX = $sx + 200
    $dragEndY = $sy - 80
    $inside = ($dragEndX -ge $waL + $DragMargin) -and ($dragEndX -le $waR - $DragMargin) -and ($dragEndY -ge $waT + $DragMargin) -and ($dragEndY -le $waB - $DragMargin)
    $dragMode = "preferred (+200,-80)"
    if (-not $inside) {
        # Drag ~200 px toward the work-area centre instead.
        $cxw = $waL + $WorkArea.Width / 2.0
        $cyw = $waT + $WorkArea.Height / 2.0
        $vx = $cxw - $sx; $vy = $cyw - $sy
        $vlen = [Math]::Sqrt($vx * $vx + $vy * $vy)
        if ($vlen -lt 1) { $vx = 200; $vy = 0; $vlen = 200 }
        $travel = [Math]::Min(200.0, $vlen)
        $dragEndX = [int][Math]::Round($sx + $vx / $vlen * $travel)
        $dragEndY = [int][Math]::Round($sy + $vy / $vlen * $travel)
        $dragMode = "toward work-area centre"
    }
    # Final clamp into the inset rectangle (never near an edge).
    $dragEndX = [int][Math]::Max($waL + $DragMargin, [Math]::Min($waR - $DragMargin, $dragEndX))
    $dragEndY = [int][Math]::Max($waT + $DragMargin, [Math]::Min($waB - $DragMargin, $dragEndY))
    Write-Timeline "Step 7: drag geometry ($dragMode): start ($sx, $sy) end ($dragEndX, $dragEndY); end margins to work area L=$($dragEndX - $waL) R=$($waR - $dragEndX) T=$($dragEndY - $waT) B=$($waB - $dragEndY) (min required $DragMargin); work area ($waL,$waT)-($waR,$waB)"
    Log-Mascot-Rect "Step 7: drag start"
    Start-Rect-Watch
    Drag-Mouse $sx $sy $dragEndX $dragEndY 15 25
    Sample-Sleep 2000
    $dragHist = Stop-Rect-Watch
    Start-Sleep -Milliseconds 300
    Log-Mascot-Rect "Step 7: after drop (settle re-clamp done)"
    $afterDrag = Get-Window-Info "^orbitkit-mascot$"
    if (-not $afterDrag -or $afterDrag.Rect.Width -ne $WinW -or $afterDrag.Rect.Height -ne $WinH) {
        $got = "(window not found)"
        if ($afterDrag) { $got = "$($afterDrag.Rect.Width)x$($afterDrag.Rect.Height) at ($($afterDrag.Rect.Left),$($afterDrag.Rect.Top))" }
        Write-Timeline "Step 7: FAIL mascot window is $got, expected ${WinW}x${WinH}; work area ($waL,$waT)-($waR,$waB); drag ($sx,$sy)->($dragEndX,$dragEndY); rect history (change lines): $($dragHist -join ' || ')"
        Write-Timeline "Step 7: app-err.log 'Menu action' present: $(Test-App-Err-Log 'Menu action')"
        Stop-Process -Id $appProc.Id -Force -ErrorAction SilentlyContinue
        Write-Error "Mascot window size changed during drag: got $got, expected ${WinW}x${WinH} (see rect history in timeline)!"
        exit 1
    }
    Write-Timeline "Step 7: post-drag size OK ${WinW}x${WinH}; $(@($dragHist).Count) rect change(s) logged"

    # Step 8 (brief step 8): open menu, click Quit -> app exits with code 0
    Write-Timeline "Step 8: Quit..."
    Open-Menu
    # r5: fresh rect + derived local point right before the click (the size
    # was asserted above; Click-Mascot-Anchored re-reads the rect itself).
    $qIdx = $ItemIndex["app.quit"]
    if ($null -ne $qIdx) {
        $qRad = ($StartDeg + $qIdx * $StepDeg) * [Math]::PI / 180.0
        $qLX = [int]($script:OriginXEff + $Radius * [Math]::Cos($qRad))
        $qLY = [int]($script:OriginYEff + $Radius * [Math]::Sin($qRad))
        $qw = Get-Window-Info "^orbitkit-mascot$"
        if ($qw) {
            Write-Timeline "Step 8: fresh mascot rect ($($qw.Rect.Left),$($qw.Rect.Top)) $($qw.Rect.Width)x$($qw.Rect.Height); quit local ($qLX, $qLY) -> screen ($($qw.Rect.Left + $qLX), $($qw.Rect.Top + $qLY))"
            if ($qw.Rect.Width -ne $WinW -or $qw.Rect.Height -ne $WinH) {
                Write-Timeline "Step 8: FAIL mascot window is $($qw.Rect.Width)x$($qw.Rect.Height), expected ${WinW}x${WinH}; refusing to aim with startup geometry"
                Stop-Process -Id $appProc.Id -Force -ErrorAction SilentlyContinue
                Write-Error "Mascot window size differs from ${WinW}x${WinH} before Quit click!"
                exit 1
            }
        } else {
            Write-Timeline "Step 8: fresh mascot rect: window not found"
        }
    }
    Click-Item "app.quit"
    Write-Timeline "Step 8: Waiting for app process to exit..."
    $exitedCleanly = $appProc.WaitForExit(6000)
    Write-Timeline "Step 8: app-err.log 'Menu action: app.quit' present: $(Test-App-Err-Log 'Menu action: app.quit')"
    if ($exitedCleanly) {
        Write-Timeline "Step 8: App exited with code $($appProc.ExitCode)"
        if ($appProc.ExitCode -ne 0) {
            Write-Error "App exit code was $($appProc.ExitCode), expected 0!"
            exit 1
        }
    } else {
        Write-Timeline "Step 8: App did not exit within 6s, terminating..."
        Stop-Process -Id $appProc.Id -Force -ErrorAction SilentlyContinue
        Write-Error "App did not quit from menu!"
        exit 1
    }
} finally {
    # Stop screen recorder cleanly
    Write-Timeline "Stopping screen recorder..."
    try {
        $recProc.StandardInput.WriteLine("q")
        $recProc.StandardInput.Flush()
        if (-not $recProc.WaitForExit(10000)) {
            $recProc.Kill()
        }
    } catch {
        $recProc.Kill()
    }
    Write-Timeline "Screen recorder finished"
}

# Verify files
Write-Timeline "=== Output Verification ==="
if (Test-Path $videoPath) {
    $vItem = Get-Item $videoPath
    Write-Timeline "Video file: $($vItem.FullName) ($($vItem.Length) bytes)"
    ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,r_frame_rate,nb_frames -of default=noprint_wrappers=1 "$videoPath"
} else {
    Write-Timeline "ERROR: Video file not found!"
}

Write-Timeline "Completed OrbitKit Desktop Video Recording (Windows)"
