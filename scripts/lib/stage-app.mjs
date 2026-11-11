// Stages the files every lightweight build ships: the app (server, UI and the
// lite runtime entry), its runtime npm dependencies and one notices file.
// Used by build-lite.mjs (Windows) and build-linux.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

export const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
};

// Writes <stage>/app and <stage>/THIRD_PARTY_NOTICES.txt. The Node runtime
// itself is added by the caller; nodeVersion and nodeLicense describe it.
export function stageApp(stage, { nodeVersion, nodeLicense }) {
  const { version } = pkg;
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

  // One notices file with the license text of everything bundled.
  const licenseText = (dir) => {
    const file = fs.readdirSync(dir).find((name) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(name));
    return file ? fs.readFileSync(path.join(dir, file), 'utf8').trim() : null;
  };
  const noticeFor = (dir, role) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const text = licenseText(dir) || `${manifest.license} license (declared in package.json; no license file is published with this version).`;
    return `${manifest.name} ${manifest.version} — ${manifest.license}${role ? ` — ${role}` : ''}\n\n${text}`;
  };
  const notices = [
    `Dawith Welfare Office ${version} — third-party notices`,
    `Node.js ${nodeVersion} — MIT and bundled licenses — local runtime\n\nSee ${nodeLicense} for the full text.`,
    `rhwp — MIT — HWP/HWPX engine\n\n${fs.readFileSync(path.join(root, 'public', 'vendor', 'rhwp', 'LICENSE'), 'utf8').trim()}\n\nComponents bundled in rhwp are listed in app/public/vendor/rhwp/THIRD_PARTY_LICENSES.md.`,
    noticeFor(path.join(root, 'node_modules', 'pdf-lib'), 'PDF merge/split (app/public/vendor/pdf-lib.min.js)'),
    ...['@pdf-lib/standard-fonts', '@pdf-lib/upng', 'tslib'].map((name) => path.join(root, 'node_modules', name)).filter((dir) => fs.existsSync(dir)).map((dir) => noticeFor(dir, 'bundled in pdf-lib.min.js')),
    ...[...packages].sort().map((dir) => noticeFor(dir)),
  ];
  fs.writeFileSync(path.join(stage, 'THIRD_PARTY_NOTICES.txt'), `${notices.join(`\n\n${'='.repeat(72)}\n\n`)}\n`);
  return appDir;
}
