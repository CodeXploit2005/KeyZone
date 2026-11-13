import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileStream } from "./file-stream";

test("file responses preserve bytes/ranges and tolerate cancellation during I/O", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "moonreel-stream-"));
  const filename = path.join(dir, "media.bin");
  const bytes = Buffer.alloc(200_000);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  await writeFile(filename, bytes);
  try {
    assert.deepEqual(Buffer.from(await new Response(fileStream(filename, 0, bytes.length - 1)).arrayBuffer()), bytes);
    assert.deepEqual(Buffer.from(await new Response(fileStream(filename, 99, 70_000)).arrayBuffer()), bytes.subarray(99, 70_001));
    assert.equal((await new Response(fileStream(filename, 0, -1)).arrayBuffer()).byteLength, 0);
    for (let i = 0; i < 30; i++) {
      const reader = fileStream(filename, 0, bytes.length - 1).getReader();
      const reading = reader.read();
      await reader.cancel();
      await reading;
    }
    const reader = fileStream(filename, 0, bytes.length - 1).getReader();
    assert.equal((await reader.read()).done, false);
    const nextRead = reader.read();
    await reader.cancel();
    await nextRead;
    const aborted = new AbortController();
    aborted.abort();
    assert.equal((await fileStream(filename, 0, bytes.length - 1, aborted.signal).getReader().read()).done, true);
    const active = new AbortController();
    const activeReader = fileStream(filename, 0, bytes.length - 1, active.signal).getReader();
    const activeRead = activeReader.read();
    active.abort();
    assert.equal((await activeRead).done, true);
    await activeReader.cancel();
    await assert.rejects(new Response(fileStream(path.join(dir, "missing"), 0, 100)).arrayBuffer(), /ENOENT/);
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith("moonreel-stream-"));
    await rm(dir, { recursive: true, force: true });
  }
});
