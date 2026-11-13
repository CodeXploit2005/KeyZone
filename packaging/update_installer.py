"""Patch installer-only files into an existing verified release without recompressing runtimes."""
from pathlib import Path
import hashlib, json, os, shutil, struct, subprocess

root = Path(__file__).resolve().parents[1]
out = root / 'release-build'
stage = out / 'payload'
version = '0.7.2'
csc = Path(os.environ['WINDIR']) / 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
icon = root / 'packaging/branding/keyzone.ico'
common = ['/nologo', '/target:winexe', '/platform:x64', '/win32icon:' + str(icon), '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll']
subprocess.run([str(csc), *common, '/reference:System.IO.Compression.dll', '/reference:System.IO.Compression.FileSystem.dll', '/reference:Microsoft.CSharp.dll', '/out:' + str(out / 'SetupStub.exe'), str(root / 'packaging/Setup.cs')], check=True)
subprocess.run([str(csc), '/nologo', '/target:exe', '/reference:System.IO.Compression.dll', '/reference:System.IO.Compression.FileSystem.dll', '/out:' + str(out / 'UpdateZip.exe'), str(root / 'packaging/UpdateZip.cs')], check=True)
shutil.copy2(root / 'packaging/Stop-KeyZone.ps1', stage / 'Stop-KeyZone.ps1')
(stage / 'release.json').write_text(json.dumps({'product': 'KeyZone Video Studio', 'version': version, 'platform': 'windows-x64'}), encoding='utf-8')
app_manifest = stage / 'app/package.json'
manifest = json.loads(app_manifest.read_text(encoding='utf-8')); manifest['version'] = version
app_manifest.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
source = out / 'KeyZone-Video-Studio-0.7.1-Windows-x64.zip'
archive = out / f'KeyZone-Video-Studio-{version}-Windows-x64.zip'
if not archive.exists(): shutil.copy2(source, archive)
subprocess.run([str(out / 'UpdateZip.exe'), str(archive), 'Stop-KeyZone.ps1', str(stage / 'Stop-KeyZone.ps1'), 'release.json', str(stage / 'release.json'), 'app/package.json', str(app_manifest)], check=True)
checksum = hashlib.sha256(archive.read_bytes()).digest()
setup = out / f'KeyZone-Video-Studio-Setup-{version}.exe'
with setup.open('wb') as target:
    target.write((out / 'SetupStub.exe').read_bytes())
    with archive.open('rb') as source: shutil.copyfileobj(source, target)
    target.write(checksum); target.write(struct.pack('<Q', archive.stat().st_size)); target.write(b'KZPAY001')
release = {'filename': setup.name, 'version': version, 'bytes': setup.stat().st_size, 'sha256': hashlib.sha256(setup.read_bytes()).hexdigest()}
(out / 'release.json').write_text(json.dumps(release, indent=2), encoding='utf-8')
print(json.dumps(release), flush=True)
