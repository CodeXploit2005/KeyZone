import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromTurbo = createRequire(
  path.join(root, 'node_modules/@tailwindcss/turbopack/package.json')
);
const { compile, optimize } = requireFromTurbo('@tailwindcss/node');
const { Scanner } = requireFromTurbo('@tailwindcss/oxide');

// 1. Compile Tailwind CSS v4 source -> src/app/globals.css
const cssSourcePath = path.join(root, 'src/app/tailwind.source.css');
const cssOutPath = path.join(root, 'src/app/globals.css');
const cssInput = fs.readFileSync(cssSourcePath, 'utf8');

const compiler = await compile(cssInput, {
  from: cssSourcePath,
  base: path.dirname(cssSourcePath),
  shouldRewriteUrls: true,
  onDependency: () => {},
});

const scanner = new Scanner({
  sources: [{ base: path.join(root, 'src'), pattern: '**/*', negated: false }],
});

const candidates = [...scanner.scan()];
const rawCss = compiler.build(candidates);
const optimizedCss = optimize(rawCss, { minify: true }).code;
fs.writeFileSync(cssOutPath, optimizedCss, 'utf8');
console.log(`Compiled Tailwind CSS v4 (${candidates.length} candidates) -> src/app/globals.css`);

// 2. Run Next.js static export build
const outDir = path.join(root, 'out');
const distDir = path.join(root, 'dist');

execFileSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build'], {
  cwd: root,
  stdio: 'inherit',
});

if (!fs.existsSync(outDir)) {
  throw new Error('Next static export folder "out" was not generated.');
}

// 3. Sync out/ into dist/ while strictly preserving dist/downloads/
fs.mkdirSync(distDir, { recursive: true });
for (const entry of fs.readdirSync(distDir)) {
  if (entry === 'downloads') continue;
  fs.rmSync(path.join(distDir, entry), { recursive: true, force: true });
}

for (const entry of fs.readdirSync(outDir)) {
  fs.cpSync(path.join(outDir, entry), path.join(distDir, entry), { recursive: true });
}

console.log('Synced Next.js + React + Tailwind + TypeScript static export to dist/!');
