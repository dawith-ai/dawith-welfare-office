// Builds the lightweight Windows release: Node runtime + app files + a tiny
// launcher, packed into a per-user NSIS installer and a portable exe, plus the
// latest.yml feed the in-app updater reads. Output goes to dist-win/.
//   npm run dist:win
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const { version } = pkg;
const out = path.join(root, 'dist-win');
const stage = path.join(out, 'stage');
const names = {
  setup: `Dawith-Welfare-Office-${version}-x64-Setup.exe`,
  portable: `Dawith-Welfare-Office-${version}-x64-Portable.exe`,
};

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) throw new Error(`Node ${process.version} is too old to bundle; node:sqlite needs 22.12+`);

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
};

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
const appDir = path.join(stage, 'app');

// App files: the same list the Electron build packages, minus Electron-only
// modules, plus the lightweight runtime entry.
const electronOnly = new Set(['desktop/main.mjs', 'desktop/updater.mjs']);
for (const pattern of pkg.build.files) {
  if (pattern.startsWith('!') || electronOnly.has(pattern) || pattern === 'package.json') continue;
  if (pattern === 'src/**/*.mjs') {
    for (const file of fs.readdirSync(path.join(root, 'src')).filter((name) => name.endsWith('.mjs'))) copy(path.join(root, 'src', file), path.join(appDir, 'src', file));
    continue;
  }
  copy(path.join(root, pattern), path.join(appDir, pattern));
}
for (const file of ['desktop/lite.mjs', 'desktop/lite-updater.mjs']) copy(path.join(root, file), path.join(appDir, file));
fs.writeFileSync(path.join(appDir, 'package.json'), `${JSON.stringify({ name: pkg.name, version, private: true, license: pkg.license }, null, 2)}\n`);

// Runtime dependencies only (electron-updater belongs to the Electron build).
const runtimeDeps = Object.keys(pkg.dependencies).filter((name) => name !== 'electron-updater');
// Walk dependencies the way Node resolves them: nearest node_modules first,
// then each parent up to the project root.
function resolvePackage(name, fromDir) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (dir === root || dir === path.dirname(dir)) throw new Error(`Cannot resolve ${name} from ${fromDir}`);
  }
}
const packages = new Set();
const pending = runtimeDeps.map((name) => resolvePackage(name, root));
while (pending.length) {
  const dir = pending.pop();
  if (packages.has(dir)) continue;
  packages.add(dir);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  for (const dep of Object.keys(manifest.dependencies || {})) pending.push(resolvePackage(dep, dir));
}
for (const dir of packages) {
  const relative = path.relative(root, dir);
  fs.cpSync(dir, path.join(appDir, relative), { recursive: true, filter: (source) => !path.relative(dir, source).startsWith('node_modules') });
}
// Only the ESM build of docx is imported; drop the other formats, browser
// bundles and type definitions.
const prune = (dir, keep) => {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) if (!keep(name)) fs.rmSync(path.join(dir, name), { recursive: true, force: true });
};
prune(path.join(appDir, 'node_modules', 'docx', 'dist'), (name) => name.endsWith('.mjs'));
for (const dir of ['jszip/dist', 'pako/dist']) fs.rmSync(path.join(appDir, 'node_modules', dir), { recursive: true, force: true });

// Node runtime under its own process name so the installer can stop it
// without touching other Node processes.
copy(process.execPath, path.join(stage, 'runtime', 'dawith-runtime.exe'));
const nodeLicense = path.join(path.dirname(process.execPath), 'LICENSE');
if (fs.existsSync(nodeLicense)) copy(nodeLicense, path.join(stage, 'runtime', 'LICENSE.node.txt'));

const csc = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
execFileSync(csc, ['/nologo', '/optimize+', '/target:winexe', '/r:System.Windows.Forms.dll', `/out:${path.join(stage, 'Dawith Welfare Office.exe')}`, path.join(root, 'build', 'lite', 'Launcher.cs')], { stdio: 'inherit' });

function findMakensis() {
  const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'electron-builder', 'Cache');
  const stack = [cache];
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'makensis.exe') return full;
      if (entry.isDirectory() && dir.split(path.sep).length - cache.split(path.sep).length < 3) stack.push(full);
    }
  }
  throw new Error('makensis.exe not found; run an electron-builder Windows build once to download NSIS');
}
const makensis = findMakensis();
for (const [script, outfile] of [['installer.nsi', names.setup], ['portable.nsi', names.portable]]) {
  execFileSync(makensis, ['-V2', '-INPUTCHARSET', 'UTF8', `-DVERSION=${version}`, `-DSTAGE=${stage}`, `-DOUTFILE=${path.join(out, outfile)}`, path.join(root, 'build', 'lite', script)], { stdio: 'inherit' });
}

// Same shape electron-builder writes, so both runtimes read one feed.
const setupPath = path.join(out, names.setup);
const sha512 = crypto.createHash('sha512').update(fs.readFileSync(setupPath)).digest('base64');
const size = fs.statSync(setupPath).size;
fs.writeFileSync(path.join(out, 'latest.yml'), [
  `version: ${version}`,
  'files:',
  `  - url: ${names.setup}`,
  `    sha512: ${sha512}`,
  `    size: ${size}`,
  `path: ${names.setup}`,
  `sha512: ${sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  '',
].join('\n'));

for (const file of [names.setup, names.portable]) console.log(`${file}  ${(fs.statSync(path.join(out, file)).size / 1048576).toFixed(1)}MB`);
