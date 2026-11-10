// Publishes a Windows build: uploads the installers and latest.yml to a
// GitHub release, then points the product site at it. Committing and pushing
// the updated site/release.json and vercel.json lets Vercel's git integration
// deploy the site; no installers ever go into git.
//   npm run dist:win && npm run release && git commit -am "..." && git push
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const repo = 'dawith-ai/dawith-welfare-office';
const tag = `v${version}`;
const dist = path.join(root, 'dist-win');
const files = {
  setup: `Dawith-Welfare-Office-${version}-x64-Setup.exe`,
  portable: `Dawith-Welfare-Office-${version}-x64-Portable.exe`,
};
const feed = path.join(dist, 'latest.yml');

for (const file of [...Object.values(files).map((name) => path.join(dist, name)), feed]) {
  if (!fs.existsSync(file)) throw new Error(`Missing build output ${file}; run npm run dist:win`);
}
if (!fs.readFileSync(feed, 'utf8').includes(`version: ${version}`)) throw new Error(`dist-win/latest.yml is not for ${version}; run npm run dist:win`);

const gh = (args) => execFileSync('gh', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const assets = [...Object.values(files).map((name) => path.join(dist, name)), feed];
let exists = true;
try { gh(['release', 'view', tag, '--repo', repo, '--json', 'tagName']); } catch { exists = false; }
if (exists) {
  gh(['release', 'upload', tag, ...assets, '--repo', repo, '--clobber']);
} else {
  const notes = process.argv.find((arg) => arg.startsWith('--notes-file='))?.slice('--notes-file='.length);
  gh(['release', 'create', tag, ...assets, '--repo', repo, '--target', 'main', '--title', `Dawith Welfare Office ${tag}`, '--latest', ...(notes ? ['--notes-file', notes] : ['--notes', `Dawith Welfare Office ${version}`])]);
}

const releaseUrl = (name) => `https://github.com/${repo}/releases/download/${tag}/${name}`;
const manifest = { version, releaseDate: new Date().toISOString() };
for (const [key, name] of Object.entries(files)) manifest[key] = { file: name, url: releaseUrl(name), size: fs.statSync(path.join(dist, name)).size };
fs.writeFileSync(path.join(root, 'site', 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`);

// /download/setup and /download/portable always serve the current version.
// Everything else under /download/ (latest.yml and the installer the in-app
// updater asks for) follows the latest GitHub release, so apps already
// installed keep updating from https://welfare-office.vercel.app/download/.
const vercelPath = path.join(root, 'vercel.json');
const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
vercel.redirects = [
  { source: '/download/setup', destination: manifest.setup.url, permanent: false },
  { source: '/download/portable', destination: manifest.portable.url, permanent: false },
  { source: '/download/:file', destination: `https://github.com/${repo}/releases/latest/download/:file`, permanent: false },
];
fs.writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);

console.log(`Released ${tag} on GitHub. Commit and push site/release.json and vercel.json to publish the site.`);
