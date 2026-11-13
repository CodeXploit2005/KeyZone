import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS licenses(id TEXT PRIMARY KEY, key_hash TEXT UNIQUE NOT NULL, prefix TEXT NOT NULL,
  customer TEXT NOT NULL, expires_at INTEGER NOT NULL, max_devices INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS devices(license_id TEXT NOT NULL REFERENCES licenses(id), device TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL, last_seen INTEGER NOT NULL, PRIMARY KEY(license_id,device));`;

const encode = value => value === null ? { type: 'null' } : typeof value === 'number'
  ? { type: Number.isInteger(value) ? 'integer' : 'float', value: Number.isInteger(value) ? String(value) : value }
  : { type: 'text', value: String(value) };
const decode = value => value.type === 'null' ? null : ['integer', 'float'].includes(value.type) ? Number(value.value) : value.value;

// Turso SQL-over-HTTP protocol. No native dependencies or local replica on Render.
export function tursoDatabase({ url, token, transport = fetch }) {
  if (!url || !token) throw new Error('Cần TURSO_DATABASE_URL và TURSO_AUTH_TOKEN để lưu dữ liệu key trên Turso.');
  const endpoint = new URL(url.replace(/^(libsql|turso):\/\//, 'https://'));
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('URL Turso phải dùng HTTPS, libsql:// hoặc turso://.');
  const pipeline = new URL('/v2/pipeline', endpoint);
  async function execute(sql, args = []) {
    try {
      const response = await transport(pipeline, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args: args.map(encode), want_rows: true } }, { type: 'close' }] }),
        signal: AbortSignal.timeout(10000), redirect: 'error',
      });
      if (!response.ok) throw new Error('Database HTTP failure');
      const data = await response.json();
      const operation = data.results?.[0];
      if (operation?.type !== 'ok' || !operation.response?.result || data.results.some(r => r.type === 'error')) throw new Error('Database SQL failure');
      const result = operation.response.result;
      return {
        rows: (result.rows || []).map(row => Object.fromEntries(result.cols.map((col, i) => [col.name, decode(row[i])]))),
        changes: Number(result.affected_row_count || 0),
      };
    } catch {
      // Do not log provider messages, SQL arguments, or tokens.
      throw Object.assign(new Error('Không kết nối được cơ sở dữ liệu key. Kiểm tra cấu hình Turso rồi thử lại.'), { status: 503 });
    }
  }
  return {
    async exec(sql) { for (const statement of sql.split(';').filter(s => s.trim())) await execute(statement); },
    prepare(sql) { return {
      all: async (...args) => (await execute(sql, args)).rows,
      get: async (...args) => (await execute(sql, args)).rows[0],
      run: async (...args) => ({ changes: (await execute(sql, args)).changes }),
    }; },
    close() {},
  };
}

export function localDatabase(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const database = new DatabaseSync(file);
  database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  return database;
}
