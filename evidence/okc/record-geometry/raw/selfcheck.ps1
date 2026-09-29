# okc-record-geometry self-check: parse gate + numeric check of the REAL
# Get-Content-Shift (extracted verbatim from scripts/ci/record-windows.ps1)
# against the failed run 36573470644 inputs.
$ErrorActionPreference = 'Stop'
$path = '/ws/scripts/ci/record-windows.ps1'

# --- 1) Parse gate -----------------------------------------------------------
$err = $null
$null = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$null, [ref]$err)
if ($err) { $err | ForEach-Object { $_.Message }; exit 1 }
Write-Output 'PARSE OK'

# --- 2) Extract the REAL function and run it --------------------------------
$lines = Get-Content $path
$fnStart = ($lines | Select-String -Pattern '^function Get-Content-Shift').LineNumber
$fnEnd = $null
for ($i = $fnStart; $i -lt $lines.Count; $i++) { if ($lines[$i] -eq '}') { $fnEnd = $i; break } }
if ($null -eq $fnEnd) { Write-Output 'FN NOT FOUND'; exit 1 }
Invoke-Expression (($lines[($fnStart - 1)..$fnEnd]) -join "`n")
Write-Output "extracted lines $fnStart..$($fnEnd + 1) (1-based, inclusive)"

# Failed-run inputs: pre-fit 404x404 at (596,340), work area (0,0,1024,720).
$MascotSize = 96; $WinW = 360; $WinH = 288; $PinX = 132; $PinY = 192
$HeadGap = 12; $Radius = 150; $ItemSize = 44
$WorkArea = @{ X = 0; Y = 0; Width = 1024; Height = 720 }

$shift = Get-Content-Shift 596 340 404
Write-Output ("new Get-Content-Shift: shift = ({0}, {1})" -f $shift.X, $shift.Y)
$PinXEff = $PinX + $shift.X; $PinYEff = $PinY + $shift.Y
$OriginXEff = $PinX + $MascotSize / 2 + $shift.X; $OriginYEff = $PinY - $HeadGap + $shift.Y
Write-Output ("effective pin = ({0}, {1}); arc origin = ({2}, {3})" -f $PinXEff, $PinYEff, $OriginXEff, $OriginYEff)

# app.notes disc: angle -180 deg (first item, span 180 centred at -90).
$rad = -180 * [Math]::PI / 180.0
$discX = [int]($OriginXEff + $Radius * [Math]::Cos($rad))
$discY = [int]($OriginYEff + $Radius * [Math]::Sin($rad))
Write-Output "app.notes disc local = ($discX, $discY)"

# Old uncapped model for contrast (the failed run's logged values).
$gY = 340 + 404 - $MascotSize; $idealY = $gY - $PinY; $cY = 720 - $WinH
Write-Output ("old uncapped model: shift.y = {0} -> pin (132, {1}), origin (180, {2}) [24 px too low]" -f ($idealY - $cY), ($PinY + $idealY - $cY), ($PinY - $HeadGap + $idealY - $cY))

# --- 3) Assertions -----------------------------------------------------------
if ($shift.X -ne 0 -or $shift.Y -ne 0) { Write-Output 'FAIL shift != (0,0)'; exit 1 }
if ($PinXEff -ne 132 -or $PinYEff -ne 192) { Write-Output 'FAIL effective pin != (132,192)'; exit 1 }
if ($OriginXEff -ne 180 -or $OriginYEff -ne 180) { Write-Output 'FAIL origin != (180,180)'; exit 1 }
if ($discX -ne 30 -or $discY -ne 180) { Write-Output 'FAIL app.notes disc != (30,180)'; exit 1 }

# Post-fit window-rect invariant with the real post-fit rect (618,432) 360x288.
$winTop = 432; $winH = 288
$mascotBottom = $winTop + $PinYEff + $MascotSize
if ($mascotBottom -ne ($winTop + $winH)) { Write-Output "FAIL mascot bottom $mascotBottom != window bottom $($winTop + $winH)"; exit 1 }
if ($winTop + $winH -gt 720 -or 618 + $WinW -gt 1024) { Write-Output 'FAIL window outside work area'; exit 1 }
Write-Output ("post-fit invariant OK: mascot screen bottom {0} == window bottom {1}; window inside work area" -f $mascotBottom, ($winTop + $winH))
Write-Output 'SELFCHECK PASS'
