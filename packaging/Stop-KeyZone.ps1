param([Parameter(Mandatory=$true)][string]$InstallRoot, [string]$DataDir)
$ErrorActionPreference = 'Stop'
$installPath = [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\')
if (-not (Test-Path -LiteralPath (Join-Path $installPath 'runtime\node\node.exe'))) { throw 'Invalid KeyZone installation.' }
if (-not $DataDir) { $DataDir = Join-Path $env:LOCALAPPDATA 'KeyZone Video Studio' }
$stateFile = Join-Path $DataDir 'processes.json'
if (Test-Path -LiteralPath $stateFile) {
    $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if ([IO.Path]::GetFullPath($state.root).TrimEnd('\') -ne $installPath) { throw 'Installation ownership mismatch.' }
    foreach ($child in $state.children) {
        if (-not $child.pid) { continue }
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$child.pid)" -ErrorAction SilentlyContinue
        if ($process -and $process.ExecutablePath -eq $child.executable -and $process.ExecutablePath.StartsWith($installPath + '\', [StringComparison]::OrdinalIgnoreCase)) {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    Remove-Item -LiteralPath $stateFile -Force
}
$pgData = Join-Path $DataDir 'postgres'
if (Test-Path -LiteralPath (Join-Path $pgData 'PG_VERSION')) {
    $stop = Start-Process -FilePath (Join-Path $installPath 'runtime\postgres\bin\pg_ctl.exe') -ArgumentList @('-D', ('"' + $pgData + '"'), '-m', 'fast', '-w', 'stop') -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $DataDir 'logs\stop-postgres.log') -RedirectStandardError (Join-Path $DataDir 'logs\stop-postgres-error.log')
}
exit 0
