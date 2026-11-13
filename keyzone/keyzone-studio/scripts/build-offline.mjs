import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(fs.realpathSync(path.join(root, 'node_modules/@tailwindcss/turbopack/package.json')));
const { compile, optimize } = require('@tailwindcss/node');
const { Scanner } = require('@tailwindcss/oxide');
const source = path.join(root, 'src/app/globals.css');
const entry = path.join(root, 'src/app/style-entry.css');
const previous = fs.readFileSync(entry, 'utf8');
const compiler = await compile(fs.readFileSync(source, 'utf8'), { from: source, base: path.dirname(source), shouldRewriteUrls: true, onDependency: () => {} });
const scanner = new Scanner({ sources: [{ base: path.join(root, 'src'), pattern: '**/*', negated: false }] });
try {
  fs.writeFileSync(entry, optimize(compiler.build([...scanner.scan()]), { minify: true }).code);
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, KEYZONE_PRECOMPILED_CSS: '1' },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { fs.writeFileSync(entry, previous); }
