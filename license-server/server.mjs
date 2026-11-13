import { createServer } from 'node:http';
import { localDatabase, tursoDatabase, SCHEMA } from './database.mjs';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, statSync, createReadStream } from 'node:fs';
import { dirname, join, resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const hash = value => createHash('sha256').update(value).digest('hex');
const random = () => randomBytes(32).toString('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

export function createLicenseServer({ database = './data/licenses.sqlite', databaseAdapter, tursoUrl, tursoToken, password, publicUrl = 'http://127.0.0.1:4320', siteDirectory, now = Date.now } = {}) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('KEYZONE_ADMIN_PASSWORD cần ít nhất 12 ký tự.');
  const origin = new URL(publicUrl).origin;
  const secure = origin.startsWith('https:');
  const db = databaseAdapter || (tursoUrl || tursoToken ? tursoDatabase({ url: tursoUrl, token: tursoToken }) : localDatabase(database));
  let ready;
  const initialize = () => ready ??= Promise.resolve().then(() => db.exec(SCHEMA)).catch(error => { ready = undefined; throw error; });
  const admins = new Map();
  const rates = new Map();
  const adminHash = hash(password);
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public');
  function limit(req, name, max) {
    const key = `${req.socket.remoteAddress}:${name}`;
    const time = now();
    if (rates.size > 10000) for (const [k, v] of rates) if (v.until <= time) rates.delete(k);
    const state = rates.get(key);
    if (!state || state.until <= time) { rates.set(key, { count: 1, until: time + 60000 }); return; }
    if (++state.count > max) fail('Quá nhiều yêu cầu. Vui lòng thử lại sau một phút.', 429);
  }
  async function body(req) {
    let value = '';
    for await (const chunk of req) { value += chunk; if (Buffer.byteLength(value) > 8192) fail('Dữ liệu quá lớn.', 413); }
    try { return JSON.parse(value); } catch { fail('JSON không hợp lệ.'); }
  }
  function checkLicense(row) {
    if (!row) fail('Key hoặc phiên kích hoạt không hợp lệ.', 401);
    if (row.revoked) fail('Key đã bị thu hồi.', 403);
    if (row.expires_at <= now()) fail('Key đã hết hạn.', 403);
    return { valid: true, customer: row.customer, expiresAt: new Date(row.expires_at).toISOString() };
  }
  function admin(req) {
    const token = /(?:^|;\s*)kz_admin=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
    const expires = admins.get(token);
    if (!expires || expires <= now()) { admins.delete(token); fail('Vui lòng đăng nhập quản trị.', 401); }
    if (req.method !== 'GET' && req.headers.origin !== origin) fail('Nguồn yêu cầu không hợp lệ.', 403);
    return token;
  }
  function fields(data) {
    const expiry = Date.parse(data.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now() || expiry > now() + 10 * 366 * 86400000) fail('Hạn dùng phải trong tương lai, tối đa 10 năm.');
    if (!Number.isInteger(data.maxDevices) || data.maxDevices < 1 || data.maxDevices > 100) fail('Số thiết bị từ 1 đến 100.');
    if (typeof data.customer !== 'string' || !data.customer.trim() || data.customer.length > 120) fail('Nhập tên khách hàng (tối đa 120 ký tự).');
    return [data.customer.trim(), expiry, data.maxDevices];
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && ['/admin', '/admin/', '/admin.js', '/admin.css', ...(!siteDirectory ? ['/'] : [])].includes(url.pathname)) {
        const file = url.pathname.endsWith('.js') ? 'admin.js' : url.pathname.endsWith('.css') ? 'admin.css' : 'index.html';
        res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8' });
        return res.end(readFileSync(join(publicDir, file)));
      }
      if (req.method === 'GET' && url.pathname === '/healthz') return send({ ok: true });
      if (req.method === 'POST' && url.pathname === '/api/admin/login') {
        limit(req, 'login', 10);
        if (req.headers.origin !== origin) fail('Nguồn yêu cầu không hợp lệ.', 403);
        const data = await body(req);
        if (typeof data.password !== 'string' || !timingSafeEqual(Buffer.from(hash(data.password)), Buffer.from(adminHash))) fail('Mật khẩu không đúng.', 401);
        for (const [token, expires] of admins) if (expires <= now()) admins.delete(token);
        const token = random(); admins.set(token, now() + 8 * 3600000);
        res.setHeader('Set-Cookie', `kz_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure ? '; Secure' : ''}`);
        return send({ ok: true });
      }
      if (url.pathname.startsWith('/api/admin/')) {
        const token = admin(req);
        if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
          admins.delete(token); res.setHeader('Set-Cookie', 'kz_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send({ ok: true });
        }
        if (req.method === 'GET' && url.pathname === '/api/admin/keys') {
          await initialize();
          return send({ keys: (await db.prepare(`SELECT l.id,l.prefix,l.customer,l.expires_at,l.max_devices,l.revoked,l.created_at,
            (SELECT count(*) FROM devices d WHERE d.license_id=l.id) AS device_count FROM licenses l ORDER BY created_at DESC`).all()) });
        }
        if (req.method === 'POST' && url.pathname === '/api/admin/keys') {
          await initialize();
          const data = await body(req); const [customer, expires, devices] = fields(data);
          const key = 'KZ-' + randomBytes(20).toString('hex').toUpperCase().match(/.{1,8}/g).join('-');
          const id = random();
          (await db.prepare('INSERT INTO licenses VALUES(?,?,?,?,?,?,0,?)').run(id, hash(key), key.slice(0, 11), customer, expires, devices, now()));
          return send({ id, key }, 201);
        }
        const match = /^\/api\/admin\/keys\/([a-f0-9]{64})$/.exec(url.pathname);
        if (match && req.method === 'PATCH') {
          await initialize();
          const id = match[1]; const data = await body(req);
          if (!(await db.prepare('SELECT id FROM licenses WHERE id=?').get(id))) fail('Không tìm thấy key.', 404);
          if (data.action === 'revoke') (await db.prepare('UPDATE licenses SET revoked=1 WHERE id=?').run(id));
          else if (data.action === 'reset') (await db.prepare('DELETE FROM devices WHERE license_id=?').run(id));
          else if (data.action === 'update') {
            const [customer, expires, maxDevices] = fields(data);
            const updated = await db.prepare(`UPDATE licenses SET customer=?,expires_at=?,max_devices=?,revoked=0
              WHERE id=? AND (SELECT count(*) FROM devices WHERE license_id=licenses.id)<=?`)
              .run(customer, expires, maxDevices, id, maxDevices);
            if (!updated.changes) fail('Hãy giải phóng thiết bị trước khi giảm giới hạn.');
          } else fail('Thao tác không hợp lệ.');
          return send({ ok: true });
        }
      }
      if (req.method === 'POST' && ['/v1/activate', '/v1/verify', '/v1/deactivate'].includes(url.pathname)) {
        limit(req, url.pathname === '/v1/activate' ? 'activate' : 'verify', url.pathname === '/v1/activate' ? 20 : 600);
        await initialize();
        const data = await body(req);
        if (typeof data.device !== 'string' || !/^[a-f0-9]{64}$/.test(data.device)) fail('Thiết bị không hợp lệ.');
        if (url.pathname === '/v1/activate') {
          if (typeof data.key !== 'string' || data.key.length > 100) fail('Nhập key hợp lệ.');
          const row = (await db.prepare('SELECT * FROM licenses WHERE key_hash=?').get(hash(data.key.trim().toUpperCase())));
          const result = checkLicense(row);
          const token = random();
          const inserted = await db.prepare(`INSERT INTO devices(license_id,device,token_hash,last_seen)
            SELECT id,?,?,? FROM licenses WHERE id=? AND revoked=0 AND expires_at>? AND
            (EXISTS(SELECT 1 FROM devices WHERE license_id=licenses.id AND device=?) OR
             (SELECT count(*) FROM devices WHERE license_id=licenses.id)<max_devices)
            ON CONFLICT(license_id,device) DO UPDATE SET token_hash=excluded.token_hash,last_seen=excluded.last_seen`)
            .run(data.device, hash(token), now(), row.id, now(), data.device);
          if (!inserted.changes) fail('Key không còn hiệu lực hoặc đã đạt giới hạn thiết bị.', 403);
          return send({ ...result, token });
        }
        if (typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token)) fail('Phiên không hợp lệ.', 401);
        const row = (await db.prepare('SELECT l.*,d.token_hash FROM licenses l JOIN devices d ON l.id=d.license_id WHERE d.token_hash=? AND d.device=?').get(hash(data.token), data.device));
        if (url.pathname === '/v1/deactivate') {
          (await db.prepare('DELETE FROM devices WHERE token_hash=? AND device=?').run(hash(data.token), data.device)); return send({ ok: true });
        }
        const result = checkLicense(row);
        (await db.prepare('UPDATE devices SET last_seen=? WHERE token_hash=? AND last_seen<?').run(now(), hash(data.token), now() - 300000));
        return send(result);
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && siteDirectory && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/v1/')) {
        const root = resolve(siteDirectory);
        const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        let file = resolve(root, relative || 'index.html');
        if (!file.startsWith(root + sep)) fail('Đường dẫn không hợp lệ.', 403);
        try {
          if (statSync(file).isDirectory()) file = join(file, 'index.html');
          const stat = statSync(file);
          const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
          // The existing Next static page uses inline hydration scripts.
          res.removeHeader('Content-Security-Policy');
          res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': stat.size });
          if (req.method === 'HEAD') return res.end();
          const stream = createReadStream(file); stream.on('error', () => res.destroy()); stream.pipe(res); return;
        } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
      }
      fail('Không tìm thấy.', 404);
    } catch (error) {
      if (!error.status) console.error('License request failed:', error.message);
      if (!res.headersSent) send({ error: error.status ? error.message : 'Máy chủ gặp lỗi.' }, error.status || 500);
      else res.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4320);
  const publicUrl = process.env.KEYZONE_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${port}`;
  if (process.env.RENDER && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) throw new Error('Render Free cần TURSO_DATABASE_URL và TURSO_AUTH_TOKEN. Không lưu key trên ổ tạm của Render.');
  createLicenseServer({ database: process.env.KEYZONE_LICENSE_DB || './data/licenses.sqlite', tursoUrl: process.env.TURSO_DATABASE_URL, tursoToken: process.env.TURSO_AUTH_TOKEN, password: process.env.KEYZONE_ADMIN_PASSWORD, publicUrl, siteDirectory: process.env.KEYZONE_SITE_DIR })
    .listen(port, process.env.HOST || '127.0.0.1', () => console.log(`KeyZone Admin: ${publicUrl}/admin`));
}
