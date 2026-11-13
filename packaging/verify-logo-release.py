"""Verify logo routing from an isolated real Windows installer, without customer keys/data."""
from pathlib import Path
import hashlib
import argparse
import json
import os
import socket
import subprocess
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'release-build'
INSTALL = OUT / 'QA-Logo-0.7.5'
assert INSTALL.resolve().parent == OUT.resolve()
installer = OUT / 'KeyZone-Video-Studio-Setup-0.7.5.exe'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip-install', action='store_true', help='Recheck the previously isolated test installation')
    args = parser.parse_args()
    if not args.skip_install:
        subprocess.run([str(installer), '/SILENT', '/TEST', '/NOLAUNCH', '/DIR=' + str(INSTALL)],
                       check=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=180)
    assert json.loads((INSTALL / 'release.json').read_text(encoding='utf-8'))['version'] == '0.7.5'
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1', 0))
        port = reservation.getsockname()[1]
    app = INSTALL / 'app'
    env = {**os.environ, 'PORT': str(port), 'HOSTNAME': '127.0.0.1',
           'KEYZONE_LICENSE_URL': 'https://keyzone-6laz.onrender.com',
           'KEYZONE_LICENSE_DIR': str(INSTALL / 'qa-license'),
           'DATABASE_URL': 'postgresql://qa:qa@127.0.0.1:1/qa',
           'STORAGE_DIR': str(INSTALL / 'qa-storage')}
    base = f'http://127.0.0.1:{port}'
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl): return None
    opener = urllib.request.build_opener(NoRedirect())
    def request(path, language='vi'):
        req = urllib.request.Request(base + path, headers={'Accept-Language': language})
        try:
            response = opener.open(req, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, response.headers, response.read()
    with (OUT / 'qa-logo-server.log').open('wb') as log:
        server = subprocess.Popen([str(INSTALL / 'runtime/node/node.exe'), 'server.js'], cwd=app,
                                  env=env, stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            for attempt in range(40):
                try:
                    status, headers, body = request('/brand/keyzone-logo.png')
                    break
                except OSError:
                    if server.poll() is not None: raise RuntimeError('Installed web server stopped')
                    time.sleep(0.25)
            else: raise RuntimeError('Installed web server did not become ready')
            expected = (ROOT / 'keyzone/keyzone-studio/public/brand/keyzone-logo.png').read_bytes()
            for language in ['vi', 'en']:
                for path in ['/brand/keyzone-logo.png', '/brand/keyzone-logo.png?v=0.7.5']:
                    status, headers, body = request(path, language)
                    assert status == 200, (path, status)
                    assert headers.get('Content-Type', '').startswith('image/png'), headers
                    assert body == expected, 'Installed logo differs from supplied artwork'
                    assert not headers.get('Location'), 'Logo must not redirect'
                    print('PASS installed PNG without activation or locale rewrite:', language, path, flush=True)
            status, headers, body = request('/')
            assert status in [307, 308] and '/activate' in headers.get('Location', ''), (status, headers)
            status, headers, body = request('/api/projects/qa')
            assert status == 403, status
            print('PASS application and API remain blocked before activation', flush=True)
            report = {'installer': installer.name, 'installedTo': str(INSTALL), 'version': '0.7.5',
                      'logoSha256': hashlib.sha256(expected).hexdigest(),
                      'passed': ['actual isolated installation', 'PNG bytes match original artwork',
                                 'PNG Content-Type', 'no logo redirect in vi/en, with/without query',
                                 'application activation gate', 'API license gate']}
            (OUT / 'qa-logo-0.7.5.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        finally:
            server.terminate()
            try: server.wait(timeout=10)
            except subprocess.TimeoutExpired: server.kill(); server.wait(timeout=10)

if __name__ == '__main__': main()
