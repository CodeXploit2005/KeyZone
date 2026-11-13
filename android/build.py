from pathlib import Path
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'android/app'
BUILD = ROOT / 'android-build'
TOOLS = BUILD / 'tools'
JDK = next((TOOLS / 'jdk').glob('jdk-*'))
SDK = TOOLS / 'platform/android-35/android.jar'
BIN = next(p for p in (TOOLS / 'build-tools').iterdir() if p.is_dir())
WORK = BUILD / 'work'
WORK.mkdir(parents=True, exist_ok=True)


def run(args, env=None):
    print('RUN', Path(str(args[0])).name, str(args[1])[:60] if len(args)>1 else '', flush=True)
    subprocess.run([str(a) for a in args], check=True, env=env)


def build():
    classes = WORK / 'classes'; classes.mkdir(exist_ok=True)
    generated = WORK / 'generated'; generated.mkdir(exist_ok=True)
    dex = WORK / 'dex'; dex.mkdir(exist_ok=True)
    resources = WORK / 'resources.zip'
    merged_res = WORK / 'resources'
    shutil.copytree(TOOLS / 'ffmpeg/res',merged_res,dirs_exist_ok=True)
    shutil.copytree(APP / 'res',merged_res,dirs_exist_ok=True)
    run([BIN / 'aapt2.exe', 'compile', '--dir', merged_res, '-o', resources])
    linked = WORK / 'resources.apk'
    run([BIN / 'aapt2.exe', 'link', '-o', linked, '-I', SDK, '--manifest', APP / 'AndroidManifest.xml',
         '--min-sdk-version', '29', '--target-sdk-version', '35', '--version-code', '9', '--version-name', '0.7.5-beta.1',
         '--java', generated, '--extra-packages', 'com.arthenica.ffmpegkit', '-R', resources, '--auto-add-overlay'])
    classpath = os.pathsep.join(str(p) for p in [SDK, TOOLS / 'ffmpeg/classes.jar', TOOLS / 'smart-exception-java-0.2.1.jar'])
    files = sorted((APP / 'src').rglob('*.java')) + sorted(generated.rglob('*.java'))
    argfile = WORK / 'javac.args'
    argfile.write_text('\n'.join('"' + str(p).replace('\\','/') + '"' for p in files),encoding='utf-8')
    run([JDK / 'bin/javac.exe', '-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', classpath, '-d', classes, '@' + str(argfile)])
    jar = WORK / 'application.jar'
    run([JDK / 'bin/jar.exe', '--create', '--file', jar, '-C', classes, '.'])
    run([JDK / 'bin/java.exe', '-Xmx1536m', '-cp', BIN / 'lib/d8.jar', 'com.android.tools.r8.D8', '--min-api', '29', '--lib', SDK, '--output', dex,
         jar, TOOLS / 'ffmpeg/classes.jar', TOOLS / 'smart-exception-java-0.2.1.jar'])
    unsigned = WORK / 'unsigned.apk'
    shutil.copy2(linked,unsigned)
    with zipfile.ZipFile(unsigned,'a',zipfile.ZIP_DEFLATED,compresslevel=6) as apk:
        for file in dex.glob('*.dex'): apk.write(file,file.name)
        for file in (APP / 'assets').rglob('*'):
            if file.is_file(): apk.write(file,'assets/' + file.relative_to(APP / 'assets').as_posix())
        for file in (TOOLS / 'ffmpeg/jni').rglob('*.so'):
            apk.write(file,'lib/' + file.relative_to(TOOLS / 'ffmpeg/jni').as_posix(),compress_type=zipfile.ZIP_STORED)
    aligned = WORK / 'aligned.apk'
    run([BIN / 'zipalign.exe', '-P', '16', '-f', '4', unsigned, aligned])
    private = ROOT / 'android/signing'; private.mkdir(exist_ok=True)
    password_file = private / 'keystore-password.txt'
    if not password_file.exists(): password_file.write_text(secrets.token_hex(32),encoding='ascii')
    password = password_file.read_text(encoding='ascii').strip()
    env = {**os.environ,'KEYZONE_ANDROID_KEYSTORE_PASS':password}
    keystore = private / 'keyzone-release.p12'
    if not keystore.exists():
        run([JDK / 'bin/keytool.exe', '-genkeypair', '-keystore', keystore, '-storetype', 'PKCS12', '-alias', 'keyzone', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=KeyZone Video Studio', '-storepass:env', 'KEYZONE_ANDROID_KEYSTORE_PASS', '-keypass:env', 'KEYZONE_ANDROID_KEYSTORE_PASS'],env=env)
    result = BUILD / 'KeyZone-Video-Studio-0.7.5-beta1-Android.apk'
    run([JDK / 'bin/java.exe', '-jar', BIN / 'lib/apksigner.jar', 'sign', '--ks', keystore, '--ks-key-alias', 'keyzone', '--ks-pass', 'env:KEYZONE_ANDROID_KEYSTORE_PASS', '--key-pass', 'env:KEYZONE_ANDROID_KEYSTORE_PASS', '--out', result, aligned],env=env)
    run([JDK / 'bin/java.exe', '-jar', BIN / 'lib/apksigner.jar', 'verify', '--verbose', result])
    release={'filename':result.name,'version':'0.7.5-beta.1','platform':'android','bytes':result.stat().st_size,'sha256':hashlib.sha256(result.read_bytes()).hexdigest()}
    (BUILD / 'release.json').write_text(json.dumps(release,indent=2),encoding='utf-8');print('APK',json.dumps(release),flush=True)


if __name__=='__main__':build()
