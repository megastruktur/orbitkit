# scripts/ci/probe-windows.ps1
# Probe script for Windows GitHub Actions runner: screen recording, window detection, and synthetic input
$ErrorActionPreference = "Continue"

Write-Host "=== Windows Probe: System & Display Info ==="
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Host "Screen bounds: $($screen.Width)x$($screen.Height) at ($($screen.X), $($screen.Y))"

# Check ffmpeg
Write-Host "=== Checking ffmpeg ==="
$ffmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpegCmd) {
    Write-Host "ffmpeg not found in PATH, installing via choco..."
    choco install ffmpeg -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}
ffmpeg -version | Select-Object -First 2

# Compile Win32 helpers
Write-Host "=== Compiling Win32 Native Helpers ==="
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

# Test synthetic input
Write-Host "=== Testing Synthetic Input ==="
$targetX = 150
$targetY = 150
$setOk = [Win32]::SetCursorPos($targetX, $targetY)
$pt = New-Object POINT
[Win32]::GetCursorPos([ref]$pt) | Out-Null
Write-Host "SetCursorPos to ($targetX, $targetY) result=$setOk; actual position=($($pt.X), $($pt.Y))"

# Test mouse click
$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP   = 0x0004
[Win32]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 50
[Win32]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
Write-Host "mouse_event click executed successfully"

# Start ffmpeg recording
Write-Host "=== Starting Screen Recording ==="
$videoPath = Join-Path $PWD "video-windows.mp4"
$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = "ffmpeg"
$pinfo.Arguments = "-y -f gdigrab -framerate 30 -i desktop -c:v libx264 -preset ultrafast -pix_fmt yuv420p -movflags +faststart `"$videoPath`""
$pinfo.UseShellExecute = $false
$pinfo.RedirectStandardInput = $true
$pinfo.RedirectStandardOutput = $false
$pinfo.RedirectStandardError = $false

$recProc = [System.Diagnostics.Process]::Start($pinfo)
Write-Host "ffmpeg recording process started with PID $($recProc.Id)"
Start-Sleep -Seconds 2

# Launch the app
Write-Host "=== Launching starter desktop app ==="
$binPath = "target\debug\starter.exe"
if (-not (Test-Path $binPath)) {
    Write-Error "Binary not found at $binPath!"
    exit 1
}

$appProc = Start-Process -FilePath $binPath -RedirectStandardOutput "app.log" -RedirectStandardError "app-err.log" -PassThru
Write-Host "App started with PID $($appProc.Id)"

# Wait for window to appear
Start-Sleep -Seconds 4

# Query windows
Write-Host "=== Querying Windows ==="
$foundWindows = @()
$enumCallback = [Win32+EnumWindowsProc]{
    param($hWnd, $lParam)
    if ([Win32]::IsWindowVisible($hWnd)) {
        $sb = New-Object System.Text.StringBuilder 256
        $len = [Win32]::GetWindowText($hWnd, $sb, $sb.Capacity)
        if ($len -gt 0) {
            $title = $sb.ToString()
            $rect = New-Object RECT
            [Win32]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
            $pid = 0
            [Win32]::GetWindowThreadProcessId($hWnd, [ref]$pid) | Out-Null
            if ($title -match "orbitkit" -or $title -match "starter" -or $pid -eq $appProc.Id) {
                Write-Host "Found matching window: hWnd=$hWnd, PID=$pid, Title='$title', Rect=($($rect.Left),$($rect.Top))-($($rect.Right),$($rect.Bottom)) Size=$($rect.Width)x$($rect.Height)"
                $script:foundWindows += [PSCustomObject]@{
                    hWnd = $hWnd
                    Title = $title
                    PID = $pid
                    Rect = $rect
                }
            }
        }
    }
    return $true
}

[Win32]::EnumWindows($enumCallback, [IntPtr]::Zero) | Out-Null

# Take screenshot
Write-Host "=== Capturing Screenshot ==="
$screenShotPath = Join-Path $PWD "probe-screenshot.png"
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save($screenShotPath, [System.Drawing.Imaging.ImageFormat]::Png)
$gfx.Dispose()
$bmp.Dispose()
Write-Host "Screenshot saved to $screenShotPath"

# Keep app running a bit longer
Start-Sleep -Seconds 5

# Stop recording cleanly
Write-Host "=== Stopping Screen Recording ==="
try {
    $recProc.StandardInput.WriteLine("q")
    $recProc.StandardInput.Flush()
    Write-Host "Sent 'q' to ffmpeg, waiting for exit..."
    if (-not $recProc.WaitForExit(10000)) {
        Write-Host "ffmpeg did not exit within 10s, killing..."
        $recProc.Kill()
    } else {
        Write-Host "ffmpeg exited cleanly with code $($recProc.ExitCode)"
    }
} catch {
    Write-Host "Error stopping ffmpeg: $_"
    $recProc.Kill()
}

# Stop app
Write-Host "=== Stopping App ==="
Stop-Process -Id $appProc.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Check outputs
Write-Host "=== Probe Output Verification ==="
$summary = @()
$summary += "=== Windows Probe Summary ==="
$summary += "Screen bounds: $($screen.Width)x$($screen.Height)"
$summary += "Synthetic input test: SetCursorPos result=$setOk, final pos=($($pt.X), $($pt.Y))"

if (Test-Path $videoPath) {
    $vItem = Get-Item $videoPath
    $summary += "Video file: $($vItem.FullName), Size: $($vItem.Length) bytes"
    Write-Host "Video file exists: $($vItem.Length) bytes"
    ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,r_frame_rate,nb_frames -of default=noprint_wrappers=1 "$videoPath"
} else {
    $summary += "Video file NOT found!"
    Write-Host "Video file NOT found!"
}

if (Test-Path $screenShotPath) {
    $sItem = Get-Item $screenShotPath
    $summary += "Screenshot file: $($sItem.FullName), Size: $($sItem.Length) bytes"
}

$summary += "Found windows count: $($foundWindows.Count)"
foreach ($w in $foundWindows) {
    $summary += "Window: '$($w.Title)' at ($($w.Rect.Left), $($w.Rect.Top)) size $($w.Rect.Width)x$($w.Rect.Height)"
}

$summary | Set-Content "probe-summary.txt"
$summary | ForEach-Object { Write-Host $_ }
Write-Host "=== Windows Probe Finished ==="
