// Publishes the product site together with the current Windows builds.
// The installers are too large for git, so they are copied into
// site/download/ only for the duration of a CLI deploy:
//   npm run dist:win:setup && npm run dist:win:lite && npm run site:deploy
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const vercelFileLimit = 100 * 1024 * 1024;
const downloadDir = path.join(root, 'site', 'download');

const sources = {
  setup: path.join(root, 'dist', `Dawith-Welfare-Office-${version}-x64-Setup.exe`),
  portable: path.join(root, 'dist-lite', `Dawith-Welfare-Office-${version}-x64-Portable.exe`),
  feed: path.join(root, 'dist', 'latest.yml'),
};
for (const [key, file] of Object.entries(sources)) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${key} build: ${file}`);
  if (fs.statSync(file).size > vercelFileLimit) throw new Error(`${path.basename(file)} is over Vercel's 100MB file limit`);
}
const feed = fs.readFileSync(sources.feed, 'utf8');
if (!feed.includes(`version: ${version}`)) throw new Error(`dist/latest.yml is not for ${version}; rebuild the installer`);

fs.rmSync(downloadDir, { recursive: true, force: true });
fs.mkdirSync(downloadDir, { recursive: true });
const manifest = { version, releaseDate: new Date().toISOString() };
for (const key of ['setup', 'portable']) {
  const name = path.basename(sources[key]);
  fs.copyFileSync(sources[key], path.join(downloadDir, name));
  manifest[key] = { file: name, url: `/download/${name}`, size: fs.statSync(sources[key]).size };
}
fs.copyFileSync(sources.feed, path.join(downloadDir, 'latest.yml'));
fs.writeFileSync(path.join(downloadDir, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

// Stable links (/download/setup, /download/portable) always point at the
// current files.
const vercelPath = path.join(root, 'vercel.json');
const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
vercel.redirects = [
  { source: '/download/setup', destination: manifest.setup.url, permanent: false },
  { source: '/download/portable', destination: manifest.portable.url, permanent: false },
];
fs.writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);

console.log(`Deploying ${version}: ${manifest.setup.file} (${Math.round(manifest.setup.size / 1048576)}MB), ${manifest.portable.file} (${Math.round(manifest.portable.size / 1048576)}MB)`);
if (!process.argv.includes('--dry-run')) execFileSync('vercel', ['deploy', '--prod', '--yes'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
