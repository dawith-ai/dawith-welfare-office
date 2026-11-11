// Builds the lightweight Windows release: Node runtime + app files + a tiny
// launcher, packed into a per-user NSIS installer and a portable exe, plus the
// latest.yml feed the in-app updater reads. Output goes to dist-win/.
//   npm run dist:win
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copy, pkg, root, stageApp } from './lib/stage-app.mjs';

const { version } = pkg;
const out = path.join(root, 'dist-win');
const stage = path.join(out, 'stage');
const names = {
  setup: `Dawith-Welfare-Office-${version}-x64-Setup.exe`,
  portable: `Dawith-Welfare-Office-${version}-x64-Portable.exe`,
};

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) throw new Error(`Node ${process.version} is too old to bundle; node:sqlite needs 22.12+`);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
stageApp(stage, { nodeVersion: process.version, nodeLicense: 'runtime/LICENSE.node.txt' });

// Node runtime under its own process name so the installer can stop it
// without touching other Node processes.
copy(process.execPath, path.join(stage, 'runtime', 'dawith-runtime.exe'));
// The Windows Node installer ships no LICENSE file, so the text for the
// bundled version is kept in the repo.
const nodeLicense = path.join(root, 'build', 'lite', 'LICENSE.node.txt');
if (!fs.readFileSync(nodeLicense, 'utf8').includes('Node.js is licensed')) throw new Error('build/lite/LICENSE.node.txt is missing the Node.js license');
copy(nodeLicense, path.join(stage, 'runtime', 'LICENSE.node.txt'));

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
// Antivirus scans of freshly staged files sometimes make makensis fail to read
// them; a short pause and retry gets past it.
const runMakensis = (args) => {
  for (let attempt = 1; ; attempt += 1) {
    try { return execFileSync(makensis, args, { stdio: 'inherit' }); } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`makensis failed (attempt ${attempt}); retrying`);
      execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)']);
    }
  }
};
for (const [script, outfile] of [['installer.nsi', names.setup], ['portable.nsi', names.portable]]) {
  runMakensis(['-V2', '-INPUTCHARSET', 'UTF8', `-DVERSION=${version}`, `-DSTAGE=${stage}`, `-DOUTFILE=${path.join(out, outfile)}`, path.join(root, 'build', 'lite', script)]);
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
