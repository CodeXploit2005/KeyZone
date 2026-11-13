from pathlib import Path
import hashlib
import json
import zipfile
import requests

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / 'android-build/tools'
TOOLS.mkdir(parents=True, exist_ok=True)
PACKAGES = [
    ('platform', 'https://dl.google.com/android/repository/platform-35_r02.zip', 'sha1', '0bb560a90a7a2cbd0dd8348224d518b638fe7949'),
    ('build-tools', 'https://dl.google.com/android/repository/build-tools_r35_windows.zip', 'sha1', 'af059bb67cf7786f45ee0db85e2d24985df1b4b6'),
    ('jdk', 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-jdk_x64_windows_hotspot_21.0.13_9.zip', 'sha256', 'a4dbaa05fca4bd89d84584e58c459bd732efebb1722af80ab13c6516832004f9'),
]


def fetch(url, dest, algorithm=None, checksum=None):
    if not dest.exists() or (checksum and hashlib.new(algorithm, dest.read_bytes()).hexdigest() != checksum):
        print('Downloading', dest.name, flush=True)
        with requests.get(url, stream=True, timeout=(20, 120)) as response:
            response.raise_for_status()
            with dest.open('wb') as stream:
                for block in response.iter_content(1024 * 1024): stream.write(block)
    if checksum and hashlib.new(algorithm, dest.read_bytes()).hexdigest() != checksum:
        raise RuntimeError('Checksum mismatch: ' + dest.name)
    return dest


for name, url, algorithm, checksum in PACKAGES:
    archive = fetch(url, TOOLS / (name + '.zip'), algorithm, checksum)
    target = TOOLS / name
    if not (target / '.complete').exists():
        target.mkdir(exist_ok=True)
        with zipfile.ZipFile(archive) as zipped: zipped.extractall(target)
        (target / '.complete').write_text(checksum)
    print('Verified', name, flush=True)

for artifact, url in [
    ('ffmpeg-kit-full-8.1.9.aar', 'https://repo.maven.apache.org/maven2/dev/ffmpegkit-maintained/ffmpeg-kit-full/8.1.9/ffmpeg-kit-full-8.1.9.aar'),
    ('smart-exception-java-0.2.1.jar', 'https://repo.maven.apache.org/maven2/com/arthenica/smart-exception-java/0.2.1/smart-exception-java-0.2.1.jar'),
]:
    check = requests.get(url + '.sha1', timeout=20); check.raise_for_status()
    checksum = check.text.strip().split()[0]
    archive = fetch(url, TOOLS / artifact, 'sha1', checksum)
    if artifact.endswith('.aar'):
        target = TOOLS / 'ffmpeg'; target.mkdir(exist_ok=True)
        with zipfile.ZipFile(archive) as zipped: zipped.extractall(target)
    print('Verified', artifact, flush=True)
(TOOLS / 'sources.json').write_text(json.dumps([{'name': n, 'url': u, 'hash': h, 'algorithm': a} for n, u, a, h in PACKAGES], indent=2), encoding='utf-8')
print('Android build tools ready', flush=True)
