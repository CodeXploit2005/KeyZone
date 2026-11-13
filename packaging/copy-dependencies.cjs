const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const source = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const installed = new Map();
const processing = new Set();
function locate(name, from) {
  const requireFrom = createRequire(path.join(from, 'package.json'));
  for (const search of requireFrom.resolve.paths(name) || []) {
    const manifest = path.join(search, name, 'package.json');
    if (fs.existsSync(manifest)) return fs.realpathSync(path.dirname(manifest));
  }
  let resolved;
  try { resolved = requireFrom.resolve(name + '/package.json'); }
  catch { resolved = requireFrom.resolve(name); }
  let dir = fs.realpathSync(path.dirname(resolved));
  while (true) {
    const file = path.join(dir, 'package.json');
    if (fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).name === name) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Cannot locate package ' + name);
    dir = parent;
  }
}
function install(name, from, ancestry = new Map(), parentModules = output) {
  const root = locate(name, from);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const identity = name + '@' + pkg.version;
  if (ancestry.get(name) === identity) return;
  let dest;
  if (!installed.has(name)) {
    dest = path.join(output, name); installed.set(name, { identity, dest });
  } else if (installed.get(name).identity === identity) {
    dest = installed.get(name).dest;
  } else dest = path.join(parentModules, name);
  const key = dest + '|' + identity;
  if (processing.has(key)) return;
  processing.add(key);
  fs.cpSync(root, dest, { recursive: true, dereference: true,
    filter: src => path.basename(src) !== 'node_modules' && path.basename(src) !== '.git' });
  const chain = new Map(ancestry); chain.set(name, identity);
  const optional = new Set(Object.keys(pkg.optionalDependencies || {}));
  const dependencies = { ...pkg.dependencies, ...pkg.optionalDependencies };
  for (const dep of Object.keys(dependencies)) {
    try { install(dep, root, chain, path.join(dest, 'node_modules')); }
    catch (error) { if (!optional.has(dep)) throw error; }
  }
  for (const peer of Object.keys(pkg.peerDependencies || {})) {
    try { install(peer, root, chain, path.join(dest, 'node_modules')); }
    catch { /* Only installed optional/peer packages are redistributed. */ }
  }
}
for (const name of ['next', 'react', 'react-dom', 'pg', 'pg-boss', 'sharp', '@resvg/resvg-js', 'drizzle-orm', 'zod', 'satori']) install(name, source);
console.log('Copied portable production dependencies:', processing.size);
