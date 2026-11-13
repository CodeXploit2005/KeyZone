import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const data = path.resolve(option('--data-dir') || process.env.KEYZONE_DATA_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local'), 'KeyZone Video Studio'));
const noBrowser = args.includes('--no-browser') || process.env.KEYZONE_NO_BROWSER === '1';
fs.mkdirSync(path.join(data, 'logs'), { recursive: true });
const logFile = path.join(data, 'logs/startup.log');
function log(message) { fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`); console.log(message); }
function execute(file, argv, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, argv, { windowsHide: true, ...options });
    let output = '';
    child.stdout?.on('data', chunk => { output += chunk; });
    child.stderr?.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('exit', code => {
      // pg_ctl may leave inherited pipe handles with its background server on Windows.
      child.stdout?.destroy(); child.stderr?.destroy();
      code === 0 ? resolve(output) : reject(new Error(`${path.basename(file)} failed (${code}): ${output.slice(-1800)}`));
    });
  });
}
async function json(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok ? await r.json() : null; }
  catch { return null; }
}
async function freePort(preferred) {
  return new Promise((resolve, reject) => {
    const s = net.createServer(); s.once('error', () => {
      const fallback = net.createServer(); fallback.once('error', reject);
      fallback.listen(0, '127.0.0.1', () => { const p = fallback.address().port; fallback.close(() => resolve(p)); });
    });
    s.listen(preferred, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}
const configFile = path.join(data, 'config.json');
let config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : null;
const node = path.join(root, 'runtime/node/node.exe');
const postgres = name => path.join(root, 'runtime/postgres/bin', name + '.exe');
const app = path.join(root, 'app');
const pgData = path.join(data, 'postgres');
const stateFile = path.join(data, 'processes.json');
const openBrowser = url => spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const lockFile = path.join(data, 'startup.lock');
let lockOwned = false;
try {
  if (config) {
    const live = await json(`http://localhost:${config.web}/api/local-instance`);
    if (live?.instance === config.instance) {
      if (!noBrowser) openBrowser(`http://localhost:${config.web}`);
      log('KeyZone is already running.'); process.exit(0);
    }
  }
  try { fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' }); lockOwned = true; }
  catch {
    const oldPid = Number(fs.readFileSync(lockFile, 'utf8'));
    try { process.kill(oldPid, 0); throw new Error('KeyZone đang khởi động. Vui lòng chờ vài giây.'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    fs.unlinkSync(lockFile); fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' }); lockOwned = true;
  }
  if (fs.existsSync(stateFile)) {
    await execute('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'Stop-KeyZone.ps1'), '-InstallRoot', root, '-DataDir', data]);
  }
  config ||= { apiKey: crypto.randomBytes(32).toString('hex'), password: crypto.randomBytes(32).toString('hex'), instance: crypto.randomUUID() };
  const [web, muse, cdp] = await Promise.all([freePort(config.web || Number(option('--web-port')) || 3210), freePort(config.muse || 18611), freePort(config.cdp || 19211)]);
  config.web = web; config.muse = muse; config.cdp = cdp;
  if (!config.db) config.db = await freePort(54329);
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
  const env = { ...process.env, NODE_ENV: 'production',
    KEYZONE_LICENSE_URL: process.env.KEYZONE_LICENSE_URL || JSON.parse(fs.readFileSync(path.join(root, 'license-config.json'), 'utf8')).url,
    KEYZONE_LICENSE_DIR: path.join(data, 'license'),
    DATABASE_URL: `postgres://keyzone:${config.password}@127.0.0.1:${config.db}/keyzone`,
    MUSE2API_KEY: config.apiKey, MUSE2API_BASE_URL: `http://127.0.0.1:${muse}`,
    STORAGE_DIR: path.join(data, 'storage'), NICHES_DIR: path.join(data, 'niches'),
    KEYZONE_INSTANCE_ID: config.instance, PORT: String(web), HOSTNAME: 'localhost',
    PATH: path.join(root, 'runtime/ffmpeg') + path.delimiter + process.env.PATH,
    PYTHONUTF8: '1', PYTHONNOUSERSITE: '1', MUSE2API_HOME: path.join(root, 'muse'),
    MUSE2API_DATA_DIR: path.join(data, 'muse'), MUSE2API_PROFILE_ROOT: path.join(data, 'profiles'),
    MUSE2API_CDP_PORT: String(cdp), MUSE2API_HOST: '127.0.0.1', MUSE_CONCURRENCY: '1',
  };
  // Optional provider keys belong to the recipient, never to the release publisher.
  const custom = path.join(data, 'providers.json');
  if (fs.existsSync(custom)) {
    const settings = JSON.parse(fs.readFileSync(custom, 'utf8'));
    for (const key of ['ELEVENLABS_API_KEY', 'ELEVENLABS_MODEL', 'CF_AIG_ACCOUNT_ID', 'CF_AIG_GATEWAY_ID', 'CF_AIG_BASE_URL', 'CF_AIG_TOKEN', 'CF_AIG_PROVIDER_KEY', 'CF_AIG_BYOK_ALIAS', 'SCRIPT_MODEL']) {
      if (typeof settings[key] === 'string') env[key] = settings[key];
    }
  }
  for (const dir of ['storage', 'niches', 'muse', 'profiles']) fs.mkdirSync(path.join(data, dir), { recursive: true });
  if (!fs.existsSync(path.join(pgData, 'PG_VERSION'))) {
    log('Đang chuẩn bị dữ liệu lần đầu…');
    const pwFile = path.join(data, '.database-password'); fs.writeFileSync(pwFile, config.password, { mode: 0o600 });
    try { await execute(postgres('initdb'), ['-D', pgData, '-U', 'keyzone', '-A', 'scram-sha-256', '--encoding=UTF8', '--locale=C', '--pwfile=' + pwFile], { env }); }
    finally { fs.rmSync(pwFile, { force: true }); }
    fs.appendFileSync(path.join(pgData, 'postgresql.conf'), `\nlisten_addresses = '127.0.0.1'\nport = ${config.db}\n`);
  }
  try { await execute(postgres('pg_ctl'), ['-D', pgData, 'status'], { env }); }
  catch { await execute(postgres('pg_ctl'), ['-D', pgData, '-l', path.join(data, 'logs/postgres.log'), '-w', 'start'], { env }); }
  const requireApp = createRequire(path.join(app, 'package.json'));
  const { Client } = requireApp('pg');
  const admin = new Client({ host: '127.0.0.1', port: config.db, user: 'keyzone', password: config.password, database: 'postgres', connectionTimeoutMillis: 10000 });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname='keyzone'");
    if (!exists.rowCount) await admin.query('CREATE DATABASE keyzone');
  } finally { await admin.end(); }
  const database = new Client({ connectionString: env.DATABASE_URL }); await database.connect();
  try {
    await database.query('CREATE TABLE IF NOT EXISTS keyzone_release (version text PRIMARY KEY)');
    const installed = await database.query("SELECT 1 FROM keyzone_release WHERE version='0.7.0'");
    if (!installed.rowCount) {
      await database.query('BEGIN');
      try {
        await database.query(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
        await database.query("INSERT INTO keyzone_release VALUES ('0.7.0')"); await database.query('COMMIT');
      } catch (error) { await database.query('ROLLBACK'); throw error; }
    }
  } finally { await database.end(); }
  await execute(node, [path.join(app, 'seed.cjs')], { env, cwd: app });
  const chrome = [path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'), path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft/Edge/Application/msedge.exe'), path.join(process.env.PROGRAMFILES || '', 'Microsoft/Edge/Application/msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')].find(file => fs.existsSync(file));
  if (!chrome) throw new Error('Cần có Microsoft Edge hoặc Google Chrome để kết nối Muse. Hãy cài một trình duyệt rồi mở lại KeyZone.');
  env.MUSE2API_CHROMIUM = chrome;
  const children = [];
  function background(name, file, argv, cwd) {
    const out = fs.openSync(path.join(data, 'logs', name + '.log'), 'a');
    const child = spawn(file, argv, { cwd, env, detached: true, windowsHide: true, stdio: ['ignore', out, out] });
    child.on('error', error => log(name + ': ' + error.message));
    child.unref(); fs.closeSync(out); children.push({ name, pid: child.pid, executable: file });
    fs.writeFileSync(stateFile, JSON.stringify({ root, data, children }, null, 2));
    return child;
  }
  log('Đang mở KeyZone Video Studio…');
  const workerLog = path.join(data, 'logs/worker.log');
  const workerOffset = fs.existsSync(workerLog) ? fs.statSync(workerLog).size : 0;
  background('muse', path.join(root, 'runtime/python/python.exe'), ['-X', 'utf8', '-m', 'uvicorn', 'app:app', '--app-dir', path.join(root, 'muse'), '--host', '127.0.0.1', '--port', String(muse)], path.join(root, 'muse'));
  background('web', node, [path.join(app, 'node_modules/next/dist/bin/next'), 'start', '--hostname', 'localhost', '--port', String(web)], app);
  const worker = background('worker', node, [path.join(app, 'worker.cjs')], app);
  let ready = false;
  for (let i = 0; i < 90; i++) {
    const [site, api] = await Promise.all([json(`http://localhost:${web}/api/local-instance`), json(`http://127.0.0.1:${muse}/healthz`)]);
    const workerOutput = fs.existsSync(workerLog) ? fs.readFileSync(workerLog).subarray(workerOffset).toString('utf8') : '';
    if (worker.exitCode !== null) throw new Error('Bộ xử lý video chưa khởi động được. Xem logs/worker.log để biết chi tiết.');
    if (site?.instance === config.instance && api?.status === 'ok' && workerOutput.includes('Worker ready')) { ready = true; break; }
    await wait(500);
  }
  if (!ready) throw new Error('Chưa mở được KeyZone. Xem thư mục logs: ' + path.join(data, 'logs'));
  if (!noBrowser) openBrowser(`http://localhost:${web}`);
  log(`KeyZone sẵn sàng: http://localhost:${web}`);
} catch (error) {
  log(error.message); process.exitCode = 1;
} finally {
  if (lockOwned) fs.rmSync(lockFile, { force: true });
}
