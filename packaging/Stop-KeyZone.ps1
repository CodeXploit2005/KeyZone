param([Parameter(Mandatory=$true)][string]$InstallRoot, [string]$DataDir)
$ErrorActionPreference = 'Stop'
$installPath = [IO.Path]::GetFullPath($InstallRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
$installPrefix = $installPath + [IO.Path]::DirectorySeparatorChar
if (-not (Test-Path -LiteralPath (Join-Path $installPath 'runtime\node\node.exe'))) { throw 'Invalid KeyZone installation.' }
if (-not $DataDir) { $DataDir = Join-Path $env:LOCALAPPDATA 'KeyZone Video Studio' }
$stateFile = Join-Path $DataDir 'processes.json'
if (Test-Path -LiteralPath $stateFile) {
    $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if ([IO.Path]::GetFullPath($state.root).TrimEnd([IO.Path]::DirectorySeparatorChar) -ne $installPath) { throw 'Installation ownership mismatch.' }
}
# Read executable paths directly; CIM/WMI may be unavailable on a recipient's PC.
# Include orphaned children, but never stop processes outside this installation.
$owned = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    try {
        $_.Path -and $_.Path.StartsWith($installPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        $_.ProcessName -in @('node','python','pythonw','ffmpeg','ffprobe','KeyZone')
    } catch { $false }
})
foreach ($process in $owned) {
    $process.Kill()
    if (-not $process.WaitForExit(15000)) { throw "Cannot stop KeyZone process $($process.Id)." }
}
if (Test-Path -LiteralPath $stateFile) { Remove-Item -LiteralPath $stateFile -Force }
$pgData = Join-Path $DataDir 'postgres'
if (Test-Path -LiteralPath (Join-Path $pgData 'PG_VERSION')) {
    $logDir = Join-Path $DataDir 'logs'
    [IO.Directory]::CreateDirectory($logDir) | Out-Null
    $stop = Start-Process -FilePath (Join-Path $installPath 'runtime\postgres\bin\pg_ctl.exe') -ArgumentList @('-D', ('"' + $pgData + '"'), '-m', 'fast', '-w', 'stop') -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $logDir 'stop-postgres.log') -RedirectStandardError (Join-Path $logDir 'stop-postgres-error.log')
}
exit 0
