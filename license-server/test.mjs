import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLicenseServer } from './server.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('admin authentication, activation, device limits, revocation and expiry', async () => {
  let time = Date.now();
  const origin = 'http://127.0.0.1:4320';
  const password = 'test-only-password-more-than-16';
  const server = createLicenseServer({ password, database: ':memory:', publicUrl: origin, now: () => time });
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
  } finally { await new Promise(resolve => server.close(resolve)); }
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
