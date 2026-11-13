import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLicenseServer } from './server.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { tursoDatabase } from './database.mjs';
import { formatDate, parseDate, relativeExpiry, DAY } from './public/admin-time.js';

test('typed expiry dates reject impossible dates and preserve local time', () => {
  const leap = parseDate('29/02/2028 18:35');
  assert.ok(leap); assert.equal(formatDate(leap), '29/02/2028 18:35');
  for (const input of ['31/02/2028 12:00', '29/02/2027 12:00', '01/13/2028 12:00', '01/01/2028 24:00', '01/01/2028 12:70', 'tomorrow']) assert.equal(parseDate(input), null, input);
  assert.equal(relativeExpiry('45', 'days', 0).getTime(), 45 * DAY);
  assert.equal(relativeExpiry('12', 'hours', 0).getTime(), DAY / 2);
  for (const value of ['', '0', '-1', '1.5', '3661']) assert.equal(relativeExpiry(value, 'days'), null);
});

function tursoFixture() {
  const sqlite = new DatabaseSync(':memory:');
  const driver = tursoDatabase({ url: 'libsql://fixture.turso.io', token: 'fixture-token', transport: async (url, request) => {
    assert.equal(url.href, 'https://fixture.turso.io/v2/pipeline');
    assert.equal(request.headers.Authorization, 'Bearer fixture-token');
    await Promise.resolve();
    const results = JSON.parse(request.body).requests.map(operation => {
      if (operation.type === 'close') return { type: 'ok', response: { type: 'close' } };
      try {
        const { sql, args = [] } = operation.stmt;
        const values = args.map(a => a.type === 'integer' || a.type === 'float' ? Number(a.value) : a.type === 'null' ? null : a.value);
        const statement = sqlite.prepare(sql);
        const cols = statement.columns().map(c => ({ name: c.name }));
        const rows = cols.length ? statement.all(...values) : [];
        const changed = cols.length ? 0 : statement.run(...values).changes;
        const encode = v => v === null ? { type: 'null' } : typeof v === 'number' ? { type: 'integer', value: String(v) } : { type: 'text', value: v };
        return { type: 'ok', response: { type: 'execute', result: { cols, rows: rows.map(r => cols.map(c => encode(r[c.name]))), affected_row_count: changed } } };
      } catch { return { type: 'error', error: { message: 'SQL fixture failure' } }; }
    });
    return Response.json({ results });
  } });
  return { driver, close: () => sqlite.close() };
}

for (const remote of [false, true]) test(`admin authentication, activation, device limits, revocation and expiry (${remote ? 'Turso protocol fixture' : 'local SQLite'})`, async () => {
  let time = Date.now();
  const origin = 'http://127.0.0.1:4320';
  const password = 'test-only-pass';
  const fixture = remote ? tursoFixture() : undefined;
  const server = createLicenseServer({ password, database: ':memory:', databaseAdapter: fixture?.driver, publicUrl: origin, now: () => time });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = async (path, method = 'GET', data, authenticated = true, requestOrigin = origin) => {
    const res = await fetch(base + path, { method, headers: { Origin: requestOrigin, 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    return { status: res.status, body: await res.json() };
  };
  try {
    assert.equal((await request('/api/admin/keys')).status, 401);
    assert.equal((await request('/api/admin/login', 'POST', { password: 'wrong' })).status, 401);
    assert.equal((await request('/api/admin/login', 'POST', { password }, true, 'https://evil.example')).status, 403);
    assert.equal((await request('/api/admin/login', 'POST', { password })).status, 200);
    const fields = { customer: '<script>customer</script>', expiresAt: new Date(time + 86400000).toISOString(), maxDevices: 1 };
    const created = await request('/api/admin/keys', 'POST', fields);
    assert.equal(created.status, 201);
    const key = created.body.key, id = created.body.id, device = 'a'.repeat(64), other = 'b'.repeat(64);
    assert.equal((await request('/api/admin/keys', 'POST', { ...fields, customKey: 'short' })).status, 400);
    const custom = await request('/api/admin/keys', 'POST', { ...fields, customKey: 'kz-customer-manual-2026' });
    assert.equal(custom.status, 201); assert.equal(custom.body.key, 'KZ-CUSTOMER-MANUAL-2026');
    assert.equal((await request('/api/admin/keys', 'POST', { ...fields, customKey: 'KZ-CUSTOMER-MANUAL-2026' })).status, 409);
    const customSession = await request('/v1/activate', 'POST', { key: custom.body.key, device: other });
    assert.equal(customSession.body.valid, true);
    assert.equal((await request('/api/admin/keys/' + custom.body.id + '/copy', 'POST', {})).body.key, custom.body.key);
    assert.equal((await request('/api/admin/keys/' + custom.body.id, 'DELETE')).status, 200);
    assert.equal((await request('/v1/verify', 'POST', { token: customSession.body.token, device: other })).status, 401);
    assert.equal((await request('/api/admin/keys/' + custom.body.id + '/copy', 'POST', {})).status, 404);
    assert.equal((await request('/api/admin/keys')).body.keys[0].key, undefined);
    assert.equal((await request('/v1/activate', 'POST', { key: 'WRONG', device })).status, 401);
    const activated = await request('/v1/activate', 'POST', { key, device });
    assert.equal(activated.body.valid, true);
    const token = activated.body.token;
    assert.equal((await request('/v1/activate', 'POST', { key, device: other })).status, 403);
    assert.equal((await request('/v1/verify', 'POST', { token, device: other })).status, 401);
    assert.equal((await request('/v1/verify', 'POST', { token, device })).body.valid, true);
    await request('/api/admin/keys/' + id, 'PATCH', { action: 'revoke' });
    assert.equal((await request('/v1/verify', 'POST', { token, device })).status, 403);
    await request('/api/admin/keys/' + id, 'PATCH', { action: 'update', ...fields });
    assert.equal((await request('/v1/verify', 'POST', { token, device })).body.valid, true);
    time += 86400001;
    assert.equal((await request('/v1/verify', 'POST', { token, device })).status, 403);
    await request('/api/admin/login', 'POST', { password });
    await request('/api/admin/keys/' + id, 'PATCH', { action: 'update', ...fields, expiresAt: new Date(time + 86400000).toISOString() });
    await request('/api/admin/keys/' + id, 'PATCH', { action: 'reset' });
    assert.equal((await request('/v1/verify', 'POST', { token, device })).status, 401);
    const again = await request('/v1/activate', 'POST', { key, device: other });
    assert.equal(again.body.valid, true);
    await request('/v1/deactivate', 'POST', { token: again.body.token, device: other });
    assert.equal((await request('/v1/verify', 'POST', { token: again.body.token, device: other })).status, 401);
    await request('/api/admin/logout', 'POST', {});
    assert.equal((await request('/api/admin/keys')).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); fixture?.close(); }
});

test('existing hash-only keys are preserved during upgrade and deletion removes their sessions', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`PRAGMA foreign_keys=ON; CREATE TABLE licenses(id TEXT PRIMARY KEY,key_hash TEXT UNIQUE NOT NULL,prefix TEXT NOT NULL,customer TEXT NOT NULL,expires_at INTEGER NOT NULL,max_devices INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
    CREATE TABLE devices(license_id TEXT NOT NULL REFERENCES licenses(id),device TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,last_seen INTEGER NOT NULL,PRIMARY KEY(license_id,device));`);
  const id = 'd'.repeat(64);
  sqlite.prepare('INSERT INTO licenses VALUES(?,?,?,?,?,?,0,?)').run(id,'legacy-hash','KZ-OLD','Existing customer',Date.now()+86400000,1,Date.now());
  sqlite.prepare('INSERT INTO devices VALUES(?,?,?,?)').run(id,'device','token',Date.now());
  const password='migration-test-password';
  const server = createLicenseServer({databaseAdapter:sqlite,password});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:'http://127.0.0.1:4320'},body:JSON.stringify({password})});
    const headers={Origin:'http://127.0.0.1:4320',Cookie:login.headers.get('set-cookie').split(';')[0]};
    const list=await fetch(base+'/api/admin/keys',{headers});
    const row=(await list.json()).keys[0]; assert.equal(row.customer,'Existing customer');assert.equal(row.can_copy,0);
    assert.equal((await fetch(base+'/api/admin/keys/'+id+'/copy',{method:'POST',headers,body:'{}'})).status,409);
    assert.equal((await fetch(base+'/api/admin/keys/'+id,{method:'DELETE',headers})).status,200);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM devices').get().n,0);
  } finally {await new Promise(r=>server.close(r));}
});

test('remote database failures return 503 and schema setup retries on recovery', async () => {
  const fixture = tursoFixture();
  let down = true;
  const driver = tursoDatabase({ url: 'https://fixture.turso.io', token: 'test-secret', transport: async () => { throw new Error('provider leaked secret'); } });
  const adapter = { ...fixture.driver, exec: async sql => { if (down) return driver.exec(sql); return fixture.driver.exec(sql); } };
  const server = createLicenseServer({ password: 'test-database-outage', databaseAdapter: adapter });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const request = () => fetch(base + '/v1/verify', { method: 'POST', body: JSON.stringify({ device: 'a'.repeat(64), token: 'b'.repeat(64) }) });
    let result = await request(); assert.equal(result.status, 503); assert.ok(!(await result.text()).includes('test-secret'));
    down = false; result = await request(); assert.equal(result.status, 401);
  } finally { await new Promise(r => server.close(r)); fixture.close(); }
});

test('simultaneous remote activations respect the device limit', async () => {
  const fixture = tursoFixture(), password = 'test-concurrent-key-password';
  const server = createLicenseServer({ password, databaseAdapter: fixture.driver });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(base + '/api/admin/login', { method: 'POST', headers: { Origin: 'http://127.0.0.1:4320' }, body: JSON.stringify({ password }) });
    const created = await fetch(base + '/api/admin/keys', { method: 'POST', headers: { Origin: 'http://127.0.0.1:4320', Cookie: login.headers.get('set-cookie').split(';')[0] }, body: JSON.stringify({ customer: 'Concurrent test', maxDevices: 1, expiresAt: new Date(Date.now() + 86400000).toISOString() }) });
    const { key } = await created.json();
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => fetch(base + '/v1/activate', { method: 'POST', body: JSON.stringify({ key, device: String(i).repeat(64) }) })));
    assert.equal(results.filter(r => r.status === 200).length, 1);
    assert.equal(results.filter(r => r.status === 403).length, 9);
  } finally { await new Promise(r => server.close(r)); fixture.close(); }
});

test('licenses and device sessions survive server restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'keyzone-license-test-'));
  const options = { database: join(dir, 'licenses.sqlite'), password: 'test-only-persistence-password' };
  let server;
  const start = async () => { server = createLicenseServer(options); await new Promise(r => server.listen(0, '127.0.0.1', r)); return `http://127.0.0.1:${server.address().port}`; };
  try {
    let base = await start();
    const login = await fetch(base + '/api/admin/login', { method: 'POST', headers: { Origin: 'http://127.0.0.1:4320' }, body: JSON.stringify({ password: options.password }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const created = await fetch(base + '/api/admin/keys', { method: 'POST', headers: { Origin: 'http://127.0.0.1:4320', Cookie: cookie }, body: JSON.stringify({ customer: 'Restart test', maxDevices: 1, expiresAt: new Date(Date.now() + 86400000).toISOString() }) });
    const key = (await created.json()).key, device = 'c'.repeat(64);
    const activation = await fetch(base + '/v1/activate', { method: 'POST', body: JSON.stringify({ key, device }) });
    const token = (await activation.json()).token;
    assert.ok(token);
    await new Promise(r => server.close(r));
    base = await start();
    const check = await fetch(base + '/v1/verify', { method: 'POST', body: JSON.stringify({ token, device }) });
    assert.equal((await check.json()).valid, true);
  } finally { if (server?.listening) await new Promise(r => server.close(r)); rmSync(dir, { recursive: true, force: true }); }
});

test('download website, admin assets and installer parts are served from one origin', async () => {
  const siteDirectory = fileURLToPath(new URL('../release-site/dist/', import.meta.url));
  const server = createLicenseServer({ database: ':memory:', password: 'test-only-static-site-password', siteDirectory });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/', '/admin', '/admin.js', '/admin.css', '/healthz', '/release-windows.json', '/release-android.json']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      const content = await response.text();
      assert.ok(content.length > 0);
      if (path === '/') assert.ok(content.includes('KeyZone'));
      if (path === '/admin') { assert.ok(content.includes('id="login"')); assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'")); }
    }
    const download = await fetch(base + '/downloads/windows/part-000.bin', { method: 'HEAD' });
    assert.equal(download.status, 200);
    assert.equal(Number(download.headers.get('content-length')), 8388608);
    assert.equal((await fetch(base + '/missing-file.bin')).status, 404);
    assert.equal((await fetch(base + '/api/admin/keys')).status, 401);
  } finally { await new Promise(r => server.close(r)); }
});

test('Windows client activates against the real API and loses access after admin revocation', async () => {
  const { activation, licenseRequest, saveActivation, requireLicense } = await import('../keyzone/keyzone-studio/src/lib/license.ts');
  const dir = mkdtempSync(join(tmpdir(), 'keyzone-client-test-'));
  const oldUrl = process.env.KEYZONE_LICENSE_URL, oldDir = process.env.KEYZONE_LICENSE_DIR;
  const password = 'test-only-client-admin-password';
  const server = createLicenseServer({ database: ':memory:', password });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.KEYZONE_LICENSE_URL = base; process.env.KEYZONE_LICENSE_DIR = dir;
  try {
    const login = await fetch(base + '/api/admin/login', { method: 'POST', headers: { Origin: 'http://127.0.0.1:4320' }, body: JSON.stringify({ password }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const headers = { Origin: 'http://127.0.0.1:4320', Cookie: cookie };
    const created = await fetch(base + '/api/admin/keys', { method: 'POST', headers, body: JSON.stringify({ customer: 'Windows client', maxDevices: 1, expiresAt: new Date(Date.now() + 86400000).toISOString() }) });
    const { id, key } = await created.json();
    assert.equal((await licenseRequest('verify')).valid, false);
    const activated = await licenseRequest('activate', { key });
    assert.equal(activated.valid, true);
    await saveActivation({ device: (await activation()).device, token: activated.token });
    assert.equal((await requireLicense()).customer, 'Windows client');
    await fetch(base + '/api/admin/keys/' + id, { method: 'PATCH', headers, body: JSON.stringify({ action: 'revoke' }) });
    await assert.rejects(requireLicense, /thu hồi/);
    await new Promise(r => server.close(r));
    assert.equal((await licenseRequest('verify')).valid, false);
  } finally {
    if (server.listening) await new Promise(r => server.close(r));
    if (oldUrl === undefined) delete process.env.KEYZONE_LICENSE_URL; else process.env.KEYZONE_LICENSE_URL = oldUrl;
    if (oldDir === undefined) delete process.env.KEYZONE_LICENSE_DIR; else process.env.KEYZONE_LICENSE_DIR = oldDir;
    rmSync(dir, { recursive: true, force: true });
  }
});
