# scripts/ci/record-windows.ps1
# Full flow driver for Windows GitHub Actions runner
$ErrorActionPreference = "Continue"

function Write-Timeline($msg) {
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path "timeline.txt" -Value $line
}

# Clear / init timeline.txt
if (Test-Path "timeline.txt") { Remove-Item "timeline.txt" }
Write-Timeline "Starting OrbitKit Desktop Video Recording (Windows)"

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
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

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

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
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
                    $wPid = 0
                    [Win32]::GetWindowThreadProcessId($hWnd, [ref]$wPid) | Out-Null
                    $script:matchedWindow = [PSCustomObject]@{
                        hWnd = $hWnd
                        Title = $t
                        PID = $wPid
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

function Wait-For-Window($titleMatch, $maxSec = 15) {
    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $maxSec) {
        $w = Get-Window-Info $titleMatch
        if ($w) { return $w }
        Start-Sleep -Milliseconds 250
    }
    return $null
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
    # Step 1: Main window ready
    Write-Timeline "Step 1: Waiting for main window..."
    $mainWin = Wait-For-Window "^orbitkit$" 15
    if (-not $mainWin) {
        Write-Error "Main window 'orbitkit' not found!"
        exit 1
    }

    # Hide any debug console window so it does not occlude the app
    $consoleWin = Get-Window-Info "starter\.exe"
    if ($consoleWin) {
        Write-Timeline "Hiding debug console window (hWnd $($consoleWin.hWnd))..."
        [Win32]::ShowWindow($consoleWin.hWnd, 0) | Out-Null # SW_HIDE = 0
    }

    # Bring main app window to front
    [Win32]::ShowWindow($mainWin.hWnd, 9) | Out-Null # SW_RESTORE = 9
    [Win32]::BringWindowToTop($mainWin.hWnd) | Out-Null
    [Win32]::SetForegroundWindow($mainWin.hWnd) | Out-Null
    Start-Sleep -Milliseconds 1200
    Capture-Still "01-main.png"
    Write-Timeline "Step 1: Main window ready at ($($mainWin.Rect.Left), $($mainWin.Rect.Top)) size $($mainWin.Rect.Width)x$($mainWin.Rect.Height)"
# Step 2: Click Show Overlay
# Client area offset: border 8px, titlebar 31px. Button center is at dx=295, dy=215 inside client area.
$showBtnX = $mainWin.Rect.Left + 8 + 295
$showBtnY = $mainWin.Rect.Top + 31 + 212
Write-Timeline "Step 2: Clicking Show Overlay at ($showBtnX, $showBtnY)..."
Click-At $showBtnX $showBtnY
Write-Timeline "Step 2: Clicked Show Overlay"

# Step 3: Wait for mascot window
Write-Timeline "Step 3: Waiting for mascot window..."
$mascotWin = $null
for ($try = 1; $try -le 30; $try++) {
    $mascotWin = Get-Window-Info "^orbitkit-mascot$"
    if ($mascotWin) { break }
    if ($try -eq 10) {
        Write-Timeline "Retry clicking Show Overlay..."
        Click-At $showBtnX $showBtnY
    }
    Start-Sleep -Milliseconds 300
}
if (-not $mascotWin) {
    Write-Error "Mascot window 'orbitkit-mascot' not found!"
    exit 1
}
Park-Pointer
Start-Sleep -Milliseconds 1500
Capture-Still "02-overlay.png"
Write-Timeline "Step 3: Mascot overlay ready at ($($mascotWin.Rect.Left), $($mascotWin.Rect.Top)) size $($mascotWin.Rect.Width)x$($mascotWin.Rect.Height)"

# Step 4 & 5: Click Mascot -> radial menu opens (spawn animation)
$cx = [int]($mascotWin.Rect.Left + ($mascotWin.Rect.Width / 2))
$cy = [int]($mascotWin.Rect.Top + ($mascotWin.Rect.Height / 2))
Write-Timeline "Step 4: Clicking mascot at center ($cx, $cy) to open radial menu..."
Click-At $cx $cy
Park-Pointer
Write-Timeline "Step 5: Waiting 1.5s for radial menu spawn animation..."
Start-Sleep -Milliseconds 1500
Capture-Still "03-menu-open.png"
Write-Timeline "Step 5: Radial menu open"

# Step 6: Click mascot -> menu closes
Write-Timeline "Step 6: Clicking mascot at ($cx, $cy) to close radial menu..."
Click-At $cx $cy
Park-Pointer
Start-Sleep -Milliseconds 1500
Write-Timeline "Step 6: Radial menu closed"

# Step 7: Click mascot again -> click Notes -> Notes popup appears
Write-Timeline "Step 7: Clicking mascot at ($cx, $cy) to reopen menu..."
Click-At $cx $cy
Start-Sleep -Milliseconds 800
# Notes menu item is at (cx, cy - 96)
$notesX = $cx
$notesY = $cy - 96
Write-Timeline "Step 7: Clicking Notes menu item at ($notesX, $notesY)..."
Click-At $notesX $notesY

Write-Timeline "Step 7: Waiting for Notes popup window..."
$notesWin = Wait-For-Window "^Notes$" 15
if (-not $notesWin) {
    Write-Error "Notes popup window not found!"
    exit 1
}
Park-Pointer
Start-Sleep -Milliseconds 1500
Capture-Still "04-notes-popup.png"
Write-Timeline "Step 7: Notes popup displayed at ($($notesWin.Rect.Left), $($notesWin.Rect.Top)) size $($notesWin.Rect.Width)x$($notesWin.Rect.Height)"

# Step 8: Drag mascot about 200 px
Write-Timeline "Step 8: Dragging mascot from ($cx, $cy) by (-200, -80)..."
$dragEndX = $cx - 200
$dragEndY = $cy - 80
Drag-Mouse $cx $cy $dragEndX $dragEndY 15 25
Start-Sleep -Milliseconds 1500

# Re-query mascot window geometry
$mascotWinAfterDrag = Get-Window-Info "^orbitkit-mascot$"
if ($mascotWinAfterDrag) {
    $newCx = [int]($mascotWinAfterDrag.Rect.Left + ($mascotWinAfterDrag.Rect.Width / 2))
    $newCy = [int]($mascotWinAfterDrag.Rect.Top + ($mascotWinAfterDrag.Rect.Height / 2))
    Write-Timeline "Step 8: Mascot dragged successfully. Old center: ($cx, $cy), New center: ($newCx, $newCy)"
} else {
    $newCx = $dragEndX
    $newCy = $dragEndY
    Write-Timeline "Step 8: Mascot dragged to approximate center ($newCx, $newCy)"
}

# Step 9: Click mascot -> menu opens at new position
Write-Timeline "Step 9: Clicking mascot at ($newCx, $newCy) to open menu..."
Click-At $newCx $newCy
Park-Pointer
Start-Sleep -Milliseconds 1500
Write-Timeline "Step 9: Radial menu opened at new position"

# Step 10: Click Quit -> app exits
# Quit menu item is at (newCx - 91, newCy - 30)
$quitX = $newCx - 91
$quitY = $newCy - 30
Write-Timeline "Step 10: Clicking Quit menu item at ($quitX, $quitY)..."
Click-At $quitX $quitY

Write-Timeline "Step 10: Waiting for app process to exit..."
$exitedCleanly = $appProc.WaitForExit(6000)
if ($exitedCleanly) {
    Write-Timeline "Step 10: App exited cleanly with exit code $($appProc.ExitCode)"
} else {
    Write-Timeline "Step 10: App did not exit within 6s, terminating..."
    Stop-Process -Id $appProc.Id -Force -ErrorAction SilentlyContinue
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
Copy-Item "01-main.png" "main.png" -Force -ErrorAction SilentlyContinue
Copy-Item "02-overlay.png" "overlay.png" -Force -ErrorAction SilentlyContinue
Copy-Item "03-menu-open.png" "menu-open.png" -Force -ErrorAction SilentlyContinue
Copy-Item "04-notes-popup.png" "notes-popup.png" -Force -ErrorAction SilentlyContinue

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
