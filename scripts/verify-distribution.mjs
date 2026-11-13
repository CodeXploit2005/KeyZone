import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

if (!existsSync('release-site/dist/index.html')) throw new Error('Missing prebuilt website. Run npm run build inside release-site first.');
for (const platform of ['windows', 'android']) {
  const manifest = JSON.parse(readFileSync(`release-site/dist/release-${platform}.json`, 'utf8'));
  let bytes = 0;
  const whole = createHash('sha256');
  for (const part of manifest.parts) {
    if (!/^downloads\/(windows|android)\/part-\d+\.bin$/.test(part.path)) throw new Error('Invalid download path');
    const buffer = readFileSync(resolve('release-site/dist', part.path));
    if (buffer.length !== part.bytes || createHash('sha256').update(buffer).digest('hex') !== part.sha256) throw new Error(`Corrupt download: ${part.path}`);
    bytes += buffer.length; whole.update(buffer);
  }
  if (bytes !== manifest.bytes || whole.digest('hex') !== manifest.sha256) throw new Error(`Invalid ${platform} manifest`);
  console.log(`Verified ${platform}: ${bytes} bytes, SHA-256 OK`);
}
