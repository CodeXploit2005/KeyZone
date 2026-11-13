from pathlib import Path
import hashlib,json,os,shutil,struct,subprocess
root=Path(__file__).resolve().parents[1]
out=root/'release-build';stage=out/'payload'
csc=Path(os.environ['WINDIR'])/'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
icon=root/'packaging/branding/keyzone.ico'
common=['/nologo','/target:winexe','/platform:x64','/win32icon:'+str(icon),'/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll']
subprocess.run([str(csc),*common,'/out:'+str(stage/'KeyZone.exe'),str(root/'packaging/Launcher.cs')],check=True)
subprocess.run([str(csc),*common,'/reference:System.IO.Compression.dll','/reference:System.IO.Compression.FileSystem.dll','/reference:Microsoft.CSharp.dll','/out:'+str(out/'SetupStub.exe'),str(root/'packaging/Setup.cs')],check=True)
subprocess.run([str(csc),'/nologo','/target:exe','/reference:System.IO.Compression.dll','/reference:System.IO.Compression.FileSystem.dll','/out:'+str(out/'UpdateZip.exe'),str(root/'packaging/UpdateZip.cs')],check=True)
shutil.copy2(icon,stage/'KeyZone.ico')
archive=out/'KeyZone-Video-Studio-0.7.0-Windows-x64.zip'
subprocess.run([str(out/'UpdateZip.exe'),str(archive),'KeyZone.exe',str(stage/'KeyZone.exe'),'KeyZone.ico',str(stage/'KeyZone.ico')],check=True)
checksum=hashlib.sha256(archive.read_bytes()).digest()
setup=out/'KeyZone-Video-Studio-Setup-0.7.0.exe'
with setup.open('wb') as target:
 target.write((out/'SetupStub.exe').read_bytes())
 with archive.open('rb') as source:shutil.copyfileobj(source,target)
 target.write(checksum);target.write(struct.pack('<Q',archive.stat().st_size));target.write(b'KZPAY001')
release={'filename':setup.name,'version':'0.7.0','bytes':setup.stat().st_size,'sha256':hashlib.sha256(setup.read_bytes()).hexdigest()}
(out/'release.json').write_text(json.dumps(release,indent=2),encoding='utf-8')
print(json.dumps(release))
