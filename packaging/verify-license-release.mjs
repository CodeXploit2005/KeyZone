import fs from 'node:fs';
import path from 'node:path';

const data = path.resolve(process.argv[2]);
const config = JSON.parse(fs.readFileSync(path.join(data, 'config.json'), 'utf8'));
const local = `http://localhost:${config.web}`;
const remote = 'https://keyzone-6laz.onrender.com';
if (!process.stdin.isTTY) throw new Error('Use a private interactive input for the admin password.');
process.stdin.setRawMode(true); process.stdin.resume();
console.log('Ready for private admin password input');
const password = await new Promise(resolve => {
  let input = '';
  const onData = chunk => {
    input += chunk.toString();
    if (/[\r\n]/.test(input)) { process.stdin.removeListener('data', onData); process.stdin.pause(); resolve(input.trim()); }
  };
  process.stdin.on('data', onData);
});
let adminCookie, keyId;
const passed = [];
function check(condition, label) { if (!condition) throw new Error(label); passed.push(label); console.log('PASS: ' + label); }
async function request(base, pathname, method = 'GET', value, cookie) {
  const response = await fetch(base + pathname, { method, redirect: 'manual', headers: { Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: value === undefined ? undefined : JSON.stringify(value), signal: AbortSignal.timeout(30000) });
  return response;
}
try {
  const blocked = await request(local, '/accounts');
  check(blocked.status >= 300 && blocked.status < 400 && blocked.headers.get('location')?.includes('/activate'), 'Installed app redirects to key activation before use');
  const gate = await request(local, '/activate');
  check(gate.ok && (await gate.text()).includes('license-key'), 'Activation input form is included in installed build');
  const noApi = await request(local, '/api/projects/test');
  check(noApi.status === 403, 'Unlicensed app API is blocked');
  const login = await request(remote, '/api/admin/login', 'POST', { password });
  if (!login.ok) throw new Error('Cannot sign into remote admin for release QA');
  adminCookie = login.headers.get('set-cookie').split(';')[0];
  const created = await request(remote, '/api/admin/keys', 'POST', { customer: 'QA Windows 0.7.1 - temporary', maxDevices: 1, expiresAt: new Date(Date.now() + 3600000).toISOString() }, adminCookie);
  const issued = await created.json(); keyId = issued.id;
  check(created.status === 201 && Boolean(issued.key), 'Live Render and Turso issue a temporary test key');
  const copy = await request(remote, `/api/admin/keys/${keyId}/copy`, 'POST', {}, adminCookie);
  check(copy.ok && (await copy.json()).key === issued.key, 'Admin can copy the entire issued key');
  const activate = await request(local, '/api/license', 'POST', { key: issued.key });
  check(activate.ok, 'Installed Windows app activates against the live license server');
  const clientCookie = activate.headers.get('set-cookie').split(';')[0];
  const verified = await request(local, '/api/license', 'GET', undefined, clientCookie);
  check(verified.ok && (await verified.json()).valid === true, 'Activated device session verifies online');
  const accounts = await request(local, '/accounts', 'GET', undefined, clientCookie);
  check(accounts.ok, 'A valid key unlocks the installed studio');
  await accounts.arrayBuffer();
  const revoke = await request(remote, `/api/admin/keys/${keyId}`, 'PATCH', { action: 'revoke' }, adminCookie);
  check(revoke.ok, 'Admin revokes the test key');
  const invalidated = await request(local, '/api/license', 'GET', undefined, clientCookie);
  check((await invalidated.json()).valid === false, 'Revocation invalidates the already activated Windows session');
  const locked = await request(local, '/accounts', 'GET', undefined, clientCookie);
  check(locked.status >= 300 && locked.status < 400 && locked.headers.get('location')?.includes('/activate'), 'Revoked session cannot enter the installed studio');
  const deleted = await request(remote, `/api/admin/keys/${keyId}`, 'DELETE', undefined, adminCookie);
  check(deleted.ok, 'Admin deletes the key and its device sessions');
  keyId = undefined;
  fs.writeFileSync(path.join(data, 'license-qa-report.json'), JSON.stringify({ checkedAt: new Date().toISOString(), local, remote, passed }, null, 2));
} catch (error) { console.error('Release QA failed: ' + error.message); process.exitCode = 1; }
finally {
  if (keyId && adminCookie) await request(remote, `/api/admin/keys/${keyId}`, 'DELETE', undefined, adminCookie).catch(() => {});
  if (adminCookie) await request(remote, '/api/admin/logout', 'POST', {}, adminCookie).catch(() => {});
}
