"""Stage verified public release chunks and manifests for the existing download portal."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('platform', choices=['windows', 'android'])
args = parser.parse_args()
platform = args.platform
build = ROOT / ('release-build' if platform == 'windows' else 'android-build')
release = json.loads((build / 'release.json').read_text(encoding='utf-8'))
artifact = build / release['filename']
assert artifact.resolve().parent == build.resolve()
assert hashlib.sha256(artifact.read_bytes()).hexdigest() == release['sha256']
assert artifact.stat().st_size == release['bytes']
directory = ROOT / 'release-site/dist/downloads' / platform
directory.mkdir(parents=True, exist_ok=True)
parts = []
with artifact.open('rb') as source:
    index = 0
    while chunk := source.read(8 * 1024 * 1024):
        name = f'part-{index:03}.bin'
        (directory / name).write_bytes(chunk)
        parts.append({'path': f'downloads/{platform}/{name}', 'bytes': len(chunk),
                      'sha256': hashlib.sha256(chunk).hexdigest()})
        index += 1
used = {Path(part['path']).name for part in parts}
for file in directory.iterdir():
    if re.fullmatch(r'part-\d+\.bin', file.name) and file.name not in used:
        assert file.resolve().parent == directory.resolve()
        file.unlink()
manifest = {**release, 'requiresLicense': True, 'licenseServer': 'https://keyzone-6laz.onrender.com', 'parts': parts}
for folder in ['public', 'dist']:
    (ROOT / 'release-site' / folder / f'release-{platform}.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'Staged {platform} {release["version"]}: {len(parts)} parts, {release["bytes"]} bytes, {release["sha256"]}', flush=True)
