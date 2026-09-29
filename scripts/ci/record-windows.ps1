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
#   before every click (the mascot roams at ~24 px/s).
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

function Drag-Mouse($startX, $startY, $endX, $endY, $steps = 15, $delayMs = 25) {
    $pt = New-Object POINT
    [Win32]::GetCursorPos([ref]$pt) | Out-Null
    Move-Mouse-Smooth $pt.X $pt.Y $startX $startY 10 15
    Start-Sleep -Milliseconds 100
    [Win32]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero) # LEFTDOWN
    Start-Sleep -Milliseconds 100
    for ($i = 1; $i -le $steps; $i++) {
        $curX = [int]($startX + ($endX - $startX) * $i / $steps)
        $curY = [int]($startY + ($endY - $startY) * $i / $steps)
        [Win32]::SetCursorPos($curX, $curY) | Out-Null
        [Win32]::mouse_event(0x0001, 0, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds $delayMs
    }
    Start-Sleep -Milliseconds 100
    [Win32]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero) # LEFTUP
    Start-Sleep -Milliseconds 200
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
# the mascot's screen position, clamps the ideal window position into the
# WORK AREA and compensates the content by the clamp delta (contentShift).
# The mascot's window-local position is gNew + shift, NOT the raw pin —
# ignoring the shift moves every click point up by the clamp delta.
# The shift is boot-constant: roam placement and post-drag re-clamps move
# the WINDOW only, never the content shift (MascotView).
# ---------------------------------------------------------------------------
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
    # work area; shift = ideal - clamped.
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
    return @{ X = [int]($idealX - $cX); Y = [int]($idealY - $cY) }
}

$script:ContentShift = Get-Content-Shift $PrefitX $PrefitY $PrefitSize
$script:PinXEff = $PinX + $ContentShift.X
$script:PinYEff = $PinY + $ContentShift.Y
$script:OriginXEff = $OriginX + $ContentShift.X
$script:OriginYEff = $OriginY + $ContentShift.Y
Write-Timeline "Startup contentShift = ($($ContentShift.X), $($ContentShift.Y)); effective pin = ($PinXEff, $PinYEff), arc origin = ($OriginXEff, $OriginYEff)"

function Get-Mascot-Point {
    # Re-reads the live window rect: the mascot roams (~24 px/s), never cache.
    # Local offset = gNew pin + startup contentShift (see geometry section).
    $w = Get-Window-Info "^orbitkit-mascot$"
    if (-not $w) {
        Write-Error "Mascot window 'orbitkit-mascot' not found!"
        exit 1
    }
    $r = $w.Rect
    return @{
        X = [int]($r.Left + $script:PinXEff + $MascotSize / 2)
        Y = [int]($r.Top + $script:PinYEff + $MascotSize / 2)
        Rect = $r
    }
}

function Get-Item-Point($id) {
    $idx = $ItemIndex[$id]
    if ($null -eq $idx) {
        Write-Error "Menu item '$id' not present in starter config!"
        exit 1
    }
    $angle = $StartDeg + $idx * $StepDeg
    $rad = $angle * [Math]::PI / 180.0
    $m = Get-Mascot-Point
    return @{
        X = [int]($m.Rect.Left + $script:OriginXEff + $Radius * [Math]::Cos($rad))
        Y = [int]($m.Rect.Top + $script:OriginYEff + $Radius * [Math]::Sin($rad))
        Angle = $angle
        Rect = $m.Rect
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
    $mp = Get-Mascot-Point
    Write-Timeline "Clicking mascot at ($($mp.X), $($mp.Y)) to open menu..."
    Click-At $mp.X $mp.Y
    Park-Pointer
    # spawn stagger: openMs 260 + stepMs 40 * 8 = 580 ms; settle before clicks
    Start-Sleep -Milliseconds 900
    Log-Mascot-Rect "Menu open"
}

function Click-Item($id) {
    $p = Get-Item-Point $id
    Write-Timeline "Clicking '$id' (angle $($p.Angle)) at ($($p.X), $($p.Y))..."
    Click-At $p.X $p.Y
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

    # Step 7 (brief step 7): drag planet ~200 px. Roaming pauses during the
    # drag and resumes around the drop point; log rects before/after.
    $mp = Get-Mascot-Point
    $dragEndX = $mp.X + 200
    $dragEndY = $mp.Y - 80
    Write-Timeline "Step 7: Dragging mascot from ($($mp.X), $($mp.Y)) to ($dragEndX, $dragEndY)..."
    Log-Mascot-Rect "Step 7: drag start"
    Drag-Mouse $mp.X $mp.Y $dragEndX $dragEndY 15 25
    Start-Sleep -Milliseconds 1500
    Log-Mascot-Rect "Step 7: after drop (roam resumed)"

    # Step 8 (brief step 8): open menu, click Quit -> app exits with code 0
    Write-Timeline "Step 8: Quit..."
    Open-Menu
    Click-Item "app.quit"
    Write-Timeline "Step 8: Waiting for app process to exit..."
    $exitedCleanly = $appProc.WaitForExit(6000)
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
