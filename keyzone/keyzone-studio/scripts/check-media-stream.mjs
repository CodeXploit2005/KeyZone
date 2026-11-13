import assert from "node:assert/strict";
import { open, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";

// Read-only integration check against a running local web server and existing media.
const origin = "http://127.0.0.1:3000";
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 5000 });
let key;
try {
  await client.connect();
  const result = await client.query("SELECT final_video_path FROM projects WHERE final_video_path IS NOT NULL LIMIT 1");
  key = result.rows[0]?.final_video_path;
} finally {
  await client.end();
}
assert.ok(key, "A completed video is required for this read-only check");
const filename = path.resolve(process.env.STORAGE_DIR ?? path.join(os.homedir(), ".moonreel", "storage"), key);
const { size } = await stat(filename);
const url = `${origin}/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
const end = Math.min(66047, size - 1);
const start = Math.min(512, end);
const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
assert.equal(response.status, 206);
assert.equal(response.headers.get("content-range"), `bytes ${start}-${end}/${size}`);
const handle = await open(filename, "r");
try {
  const expected = Buffer.alloc(end - start + 1);
  await handle.read(expected, 0, expected.length, start);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
} finally { await handle.close(); }
assert.equal((await fetch(url, { headers: { Range: `bytes=${size}-` } })).status, 416);
for (let i = 0; i < 20; i++) {
  const abort = new AbortController();
  const video = await fetch(url, { signal: abort.signal });
  assert.equal(video.status, 200);
  const reader = video.body.getReader();
  await reader.read();
  abort.abort();
  try { await reader.cancel(); } catch (error) { if (error.name !== "AbortError") throw error; }
}
for (let i = 0; i < 3; i++) {
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);
}
console.log("Media ranges verified; 20 interrupted downloads completed; health OK (3 requests).");
