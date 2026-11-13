param([Parameter(Mandatory=$true)][string]$InstallRoot)
$ErrorActionPreference = 'Stop'
$target = [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\')
$registration = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyZoneVideoStudio'
if ([IO.Path]::GetFullPath($registration.InstallLocation).TrimEnd('\') -ne $target) { throw 'Installation path does not match its registration.' }
if (-not (Test-Path -LiteralPath (Join-Path $target 'release.json'))) { throw 'Not a KeyZone installation.' }
& (Join-Path $target 'Stop-KeyZone.ps1') -InstallRoot $target
$shortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'KeyZone Video Studio.lnk'
if (Test-Path -LiteralPath $shortcut) { Remove-Item -LiteralPath $shortcut -Force }
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'KeyZone Video Studio'
if (Test-Path -LiteralPath $menu) { Remove-Item -LiteralPath $menu -Recurse -Force }
# The verified application directory is removed; user projects in LocalAppData are retained.
Remove-Item -LiteralPath $target -Recurse -Force
Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyZoneVideoStudio' -Force
