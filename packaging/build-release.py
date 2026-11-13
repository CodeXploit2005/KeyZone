"""Build a relocatable Windows release from explicit code/runtime inputs, never user data."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import struct
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / 'keyzone/keyzone-studio'
OUT = ROOT / 'release-build'
STAGE = OUT / 'payload'
NODE = Path(shutil.which('node'))
PYTHON = Path(sys.base_prefix)


def run(args, cwd=STUDIO, env=None):
    print('RUN', Path(str(args[0])).name, str(args[1])[:100] if len(args) > 1 else '', flush=True)
    subprocess.run([str(a) for a in args], cwd=cwd, env=env, check=True)


def copy_tree(source, target, extra=()):
    def ignore(directory, names):
        return [n for n in names if n in {'__pycache__', '.git', '.pytest_cache', *extra}
                or n.startswith('.env') or n.endswith(('.pyc', '.pyo', '.log', '.pid', '.tsbuildinfo'))]
    shutil.copytree(source, target, dirs_exist_ok=True, ignore=ignore)


def build():
    license_url = os.environ.get('KEYZONE_LICENSE_URL', '')
    if not license_url.startswith('https://'):
        raise RuntimeError('Set KEYZONE_LICENSE_URL to the public HTTPS license server before building a release.')
    OUT.mkdir(exist_ok=True)
    if STAGE.exists() and '--resume' not in sys.argv:
        # Refuse an accidental deletion outside this build's dedicated staging directory.
        assert STAGE.resolve() == (ROOT / 'release-build/payload').resolve()
        shutil.rmtree(STAGE)
    STAGE.mkdir(exist_ok=True)
    (STAGE / 'license-config.json').write_text(json.dumps({'url': license_url}), encoding='utf-8')
    env = {**os.environ, 'KEYZONE_PACKAGE': '1', 'KEYZONE_BUILD_DIR': '.next-release'}
    if '--skip-next' not in sys.argv:
        run([NODE, 'scripts/build-offline.mjs'], env=env)
    app_stage = STAGE / 'app'
    assert app_stage.resolve() == (ROOT / 'release-build/payload/app').resolve()
    if app_stage.exists(): shutil.rmtree(app_stage)
    copy_tree(STUDIO / '.next-release/standalone', app_stage, ('node_modules', 'cache'))
    server_file = STAGE / 'app/server.js'
    server = server_file.read_text(encoding='utf-8')
    server = server.replace('process.env.__NEXT_PRIVATE_STANDALONE_CONFIG =',
        "nextConfig.outputFileTracingRoot = dir; nextConfig.repoRoot = dir; if (nextConfig.turbopack) nextConfig.turbopack.root = dir;\nprocess.env.__NEXT_PRIVATE_STANDALONE_CONFIG =")
    server_file.write_text(server, encoding='utf-8')
    copy_tree(STUDIO / '.next-release/static', STAGE / 'app/.next-release/static')
    copy_tree(STUDIO / 'public', STAGE / 'app/public')
    copy_tree(STUDIO / 'assets', STAGE / 'app/assets')
    (STAGE / 'app/next.config.js').write_text("module.exports = {distDir:'.next-release',cacheComponents:true,partialPrefetching:true,serverExternalPackages:['pg-boss','pg'],experimental:{serverActions:{bodySizeLimit:'10mb'}}};\n", encoding='utf-8')
    run([NODE, ROOT / 'packaging/copy-dependencies.cjs', STUDIO, STAGE / 'app/node_modules'])
    # Turbopack emits hashed external package aliases alongside its build output.
    aliases = STUDIO / '.next-release/node_modules'
    if aliases.exists():
        for directory in aliases.iterdir():
            if directory.is_dir(): copy_tree(directory, STAGE / 'app/.next-release/node_modules' / directory.name, ('node_modules',))
    esbuild = STUDIO / 'node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/bin/esbuild'
    for entry, name in [(STUDIO / 'src/worker/index.ts', 'worker.cjs'), (ROOT / 'packaging/seed.ts', 'seed.cjs')]:
        run([NODE, esbuild, entry, '--bundle', '--platform=node', '--format=cjs', '--target=node24', '--packages=external',
             '--tsconfig=' + str(STUDIO / 'tsconfig.json'), '--outfile=' + str(STAGE / 'app' / name)])
    schema_dir = OUT / 'generated-schema'
    if not schema_dir.exists():
        run([NODE, 'node_modules/drizzle-kit/bin.cjs', 'generate', '--dialect=postgresql', '--schema=./src/db/schema.ts', '--out=' + str(schema_dir)])
    sql = sorted(schema_dir.glob('*.sql'))
    assert sql, 'Schema generation did not produce SQL'
    (STAGE / 'schema.sql').write_text('\n'.join(p.read_text(encoding='utf-8') for p in sql), encoding='utf-8')
    if '--app-only' in sys.argv:
        for binary in ('runtime/node/node.exe', 'runtime/python/python.exe', 'runtime/postgres/bin/pg_ctl.exe', 'runtime/ffmpeg/ffmpeg.exe'):
            if not (STAGE / binary).is_file(): raise RuntimeError('Missing reusable runtime: ' + binary)
        (STAGE / 'release.json').write_text(json.dumps({'product': 'KeyZone Video Studio', 'version': '0.7.4', 'platform': 'windows-x64'}), encoding='utf-8')
        package()
        return
    runtime = STAGE / 'runtime'
    (runtime / 'node').mkdir(parents=True, exist_ok=True)
    shutil.copy2(NODE, runtime / 'node/node.exe')
    if (NODE.parent / 'LICENSE').exists(): shutil.copy2(NODE.parent / 'LICENSE', runtime / 'node/LICENSE')
    py = runtime / 'python'; py.mkdir(exist_ok=True)
    for file in PYTHON.iterdir():
        if file.is_file() and (file.suffix in ('.exe', '.dll') or file.name == 'LICENSE.txt'):
            shutil.copy2(file, py / file.name)
    copy_tree(PYTHON / 'DLLs', py / 'DLLs')
    copy_tree(PYTHON / 'Lib', py / 'Lib', ('site-packages', 'test', 'tests', 'idlelib', 'turtledemo', 'ensurepip', 'tkinter'))
    copy_tree(ROOT / 'muse2api-local/.venv/Lib/site-packages', py / 'Lib/site-packages', ('pip', 'setuptools', '_distutils_hack', 'wheel'))
    (py / 'Lib/site-packages/distutils-precedence.pth').unlink(missing_ok=True)
    (py / 'python311._pth').write_text('.\nLib\nDLLs\nLib/site-packages\nimport site\n', encoding='utf-8')
    pg = Path(r'C:\Program Files\PostgreSQL\18')
    for directory in ('bin', 'lib', 'share'): copy_tree(pg / directory, runtime / 'postgres' / directory)
    for name in ('server_license.txt', 'commandlinetools_3rd_party_licenses.txt'):
        if (pg / name).exists(): shutil.copy2(pg / name, runtime / 'postgres' / name)
    # App-local Microsoft runtime DLLs keep the bundle independent of developer tools.
    system = Path(os.environ['WINDIR']) / 'System32'
    for name in ('vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll', 'concrt140.dll'):
        if (system / name).exists():
            for dest in (runtime / 'node', runtime / 'postgres/bin'):
                shutil.copy2(system / name, dest / name)
    ff = Path(shutil.which('ffmpeg')).resolve()
    (runtime / 'ffmpeg').mkdir(exist_ok=True)
    for name in ('ffmpeg.exe', 'ffprobe.exe'): shutil.copy2(ff.parent / name, runtime / 'ffmpeg' / name)
    for name in ('LICENSE', 'LICENSE.txt', 'README.txt'):
        if (ff.parent.parent / name).exists(): shutil.copy2(ff.parent.parent / name, runtime / 'ffmpeg' / name)
    muse = STAGE / 'muse'; muse.mkdir(exist_ok=True)
    for name in ('app.py', 'engine.py', 'cdp.py', 'config.py', 'store.py', 'login_bridge.py', 'admin.html', 'LICENSE', 'version.json'):
        shutil.copy2(ROOT / 'muse2api-local' / name, muse / name)
    for name in ('launcher.mjs', 'Stop-KeyZone.ps1', 'Uninstall-KeyZone.ps1'):
        shutil.copy2(ROOT / 'packaging' / name, STAGE / name)
    (STAGE / 'release.json').write_text(json.dumps({'product': 'KeyZone Video Studio', 'version': '0.7.4', 'platform': 'windows-x64'}), encoding='utf-8')
    (STAGE / 'HUONG-DAN.txt').write_text('KeyZone Video Studio\n\nMở KeyZone.exe, sau đó kết nối tài khoản Muse của bạn.\nDữ liệu được lưu riêng trong %LOCALAPPDATA%\\KeyZone Video Studio.\nCần Internet và Microsoft Edge hoặc Google Chrome để dùng Muse.\nKhông có tài khoản, API key hay video của nhà phát hành trong bộ cài.\n\nTùy chọn: cấu hình khóa ElevenLabs/AI Gateway của bạn trong providers.json tại thư mục dữ liệu.\nGỡ cài đặt giữ lại dự án và video để bạn có thể cài lại.\n', encoding='utf-8-sig')
    (STAGE / 'THIRD-PARTY-NOTICES.txt').write_text('KeyZone bundles Node.js, Python, PostgreSQL, FFmpeg and the JavaScript/Python packages included here. Their original licenses are preserved with each component.\nSource projects: https://nodejs.org/ https://python.org/ https://postgresql.org/ https://ffmpeg.org/ https://www.gyan.dev/ffmpeg/builds/ https://github.com/bynne2602/muse2api\nFFmpeg is a GPL build; its license and build information are supplied in runtime/ffmpeg.\nMicrosoft app-local runtime libraries are redistributed for use with this application.\n', encoding='utf-8')
    package()


def package():
    (STAGE / 'HUONG-DAN.txt').write_text('KeyZone Video Studio 0.7.4\n\nMo KeyZone.exe va nhap key do quan tri vien cap. Can Internet de xac minh key.\nMay chu key: https://keyzone-6laz.onrender.com\nKey het han, bi thu hoi hoac bi xoa se khong the su dung.\nDu lieu du an cu duoc giu trong thu muc du lieu rieng.\n', encoding='utf-8-sig')
    shutil.copy2(ROOT / 'packaging/branding/keyzone.ico', STAGE / 'KeyZone.ico')
    for name in ('launcher.mjs', 'Stop-KeyZone.ps1', 'Uninstall-KeyZone.ps1'):
        shutil.copy2(ROOT / 'packaging' / name, STAGE / name)
    (STAGE / 'runtime/python/Lib/site-packages/distutils-precedence.pth').unlink(missing_ok=True)
    compiler = Path(os.environ['WINDIR']) / 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    common = ['/nologo', '/target:winexe', '/platform:x64', '/win32icon:' + str(ROOT / 'packaging/branding/keyzone.ico'), '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll']
    run([compiler, *common, '/out:' + str(STAGE / 'KeyZone.exe'), ROOT / 'packaging/Launcher.cs'], cwd=ROOT)
    stub = OUT / 'SetupStub.exe'
    run([compiler, *common, '/reference:System.IO.Compression.dll', '/reference:System.IO.Compression.FileSystem.dll', '/reference:Microsoft.CSharp.dll', '/out:' + str(stub), ROOT / 'packaging/Setup.cs'], cwd=ROOT)
    inventory = []
    for file in STAGE.rglob('*'):
        if file.is_file():
            rel = file.relative_to(STAGE).as_posix()
            assert not file.name.startswith('.env'), rel
            assert rel not in ('config.json', 'muse/accounts.json', 'muse/tasks.json'), rel
            inventory.append({'path': rel, 'bytes': file.stat().st_size})
    print('Payload:', len(inventory), 'files;', sum(row['bytes'] for row in inventory), 'bytes', flush=True)
    (OUT / 'inventory.json').write_text(json.dumps(inventory, indent=2), encoding='utf-8')
    archive = OUT / 'KeyZone-Video-Studio-0.7.4-Windows-x64.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for file in STAGE.rglob('*'):
            if file.is_file(): z.write(file, file.relative_to(STAGE).as_posix())
    checksum = hashlib.sha256(archive.read_bytes()).digest()
    setup = OUT / 'KeyZone-Video-Studio-Setup-0.7.4.exe'
    with setup.open('wb') as output:
        output.write(stub.read_bytes())
        with archive.open('rb') as stream: shutil.copyfileobj(stream, output)
        output.write(checksum); output.write(struct.pack('<Q', archive.stat().st_size)); output.write(b'KZPAY001')
    release = {'filename': setup.name, 'version': '0.7.4', 'bytes': setup.stat().st_size, 'sha256': hashlib.sha256(setup.read_bytes()).hexdigest()}
    (OUT / 'release.json').write_text(json.dumps(release, indent=2), encoding='utf-8')
    print('RELEASE', json.dumps(release), flush=True)


if __name__ == '__main__':
    if '--repack-only' in sys.argv: package()
    else: build()
