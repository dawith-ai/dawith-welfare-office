// Builds the Linux x64 release on any OS: the official Node runtime for Linux
// + app files + a shell launcher, packed as a .deb (Ubuntu, Debian, Mint …)
// and a .tar.gz for other distributions. Archives are written in-process so
// file modes are right even when building on Windows. Output: dist-linux/
//   npm run dist:linux
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { copy, pkg, root, stageApp } from './lib/stage-app.mjs';

const { version } = pkg;
const appName = 'dawith-welfare-office';
const out = path.join(root, 'dist-linux');
const stage = path.join(out, 'stage');
const names = {
  deb: `Dawith-Welfare-Office-${version}-linux-amd64.deb`,
  tar: `Dawith-Welfare-Office-${version}-linux-x64.tar.gz`,
};
const nodeVersion = process.env.DAWITH_NODE_VERSION || process.version;
const homepage = 'https://dawith-ai.github.io/dawith-welfare-office/';

// --- Node runtime for Linux, verified against the release's SHASUMS256 ---
async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function readTar(buffer) {
  const files = new Map();
  let longName = null;
  for (let offset = 0; offset + 512 <= buffer.length;) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(field(124, 12).trim() || '0', 8);
    const type = field(156, 1) || '0';
    const body = buffer.subarray(offset + 512, offset + 512 + size);
    const prefix = field(345, 155);
    let name = longName || (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
    longName = null;
    if (type === 'x') longName = /(?:^|\n)\d+ path=([^\n]*)/.exec(body.toString('utf8'))?.[1] || null;
    else if (type === 'L') longName = body.toString('utf8').replace(/\0.*$/s, '');
    else if (type === '0') files.set(name, body);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

async function linuxNode() {
  const base = `node-${nodeVersion}-linux-x64`;
  const cache = path.join(os.tmpdir(), 'dawith-build-cache', `${base}.tar.gz`);
  const sums = (await download(`https://nodejs.org/dist/${nodeVersion}/SHASUMS256.txt`)).toString('utf8');
  const expected = new RegExp(`^([0-9a-f]{64})\\s+${base}\\.tar\\.gz$`, 'm').exec(sums)?.[1];
  if (!expected) throw new Error(`No checksum for ${base}.tar.gz`);
  let archive = fs.existsSync(cache) ? fs.readFileSync(cache) : null;
  if (!archive || crypto.createHash('sha256').update(archive).digest('hex') !== expected) {
    console.log(`Downloading ${base}.tar.gz`);
    archive = await download(`https://nodejs.org/dist/${nodeVersion}/${base}.tar.gz`);
    if (crypto.createHash('sha256').update(archive).digest('hex') !== expected) throw new Error(`${base}.tar.gz checksum mismatch`);
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, archive);
  }
  const files = readTar(zlib.gunzipSync(archive));
  const binary = files.get(`${base}/bin/node`);
  const license = files.get(`${base}/LICENSE`);
  if (!binary || !license) throw new Error(`${base}.tar.gz has no bin/node or LICENSE`);
  return { binary, license };
}

// --- tar (ustar) and ar writers ---
const executable = new Set();
function tar(entries) {
  const blocks = [];
  const mtime = Math.floor(Date.now() / 1000);
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    let name = entry.name;
    let prefix = '';
    if (Buffer.byteLength(name) > 100) {
      const cut = name.lastIndexOf('/', name.length - 1 - (entry.type === 'dir' ? 1 : 0));
      prefix = name.slice(0, cut);
      name = name.slice(cut + 1);
      if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) throw new Error(`Path too long for tar: ${entry.name}`);
    }
    const data = entry.data || Buffer.alloc(0);
    const write = (value, start, length) => header.write(value, start, length, 'utf8');
    const octal = (value, length) => value.toString(8).padStart(length - 1, '0');
    write(name, 0, 100);
    write(octal(entry.mode, 8), 100, 8);
    write(octal(0, 8), 108, 8);
    write(octal(0, 8), 116, 8);
    write(octal(entry.type === 'file' ? data.length : 0, 12), 124, 12);
    write(octal(mtime, 12), 136, 12);
    header.fill(' ', 148, 156);
    write({ file: '0', dir: '5', symlink: '2' }[entry.type], 156, 1);
    if (entry.link) write(entry.link, 157, 100);
    write('ustar\u000000', 257, 8);
    write('root', 265, 32);
    write('root', 297, 32);
    write(prefix, 345, 155);
    let sum = 0;
    for (const byte of header) sum += byte;
    write(`${octal(sum, 7)}\0 `, 148, 8);
    blocks.push(header);
    if (entry.type === 'file') blocks.push(data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

// Every file and folder under dir as tar entries named <into>/<relative path>.
function tree(dir, into) {
  const entries = [{ name: `${into}/`, type: 'dir', mode: 0o755 }];
  for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, item.name);
    const name = `${into}/${item.name}`;
    if (item.isDirectory()) entries.push(...tree(full, name));
    else entries.push({ name, type: 'file', mode: executable.has(full) ? 0o755 : 0o644, data: fs.readFileSync(full) });
  }
  return entries;
}

function ar(members) {
  const parts = [Buffer.from('!<arch>\n')];
  const mtime = String(Math.floor(Date.now() / 1000));
  for (const [name, data] of members) {
    const header = `${name.padEnd(16)}${mtime.padEnd(12)}${'0'.padEnd(6)}${'0'.padEnd(6)}${'100644'.padEnd(8)}${String(data.length).padEnd(10)}\`\n`;
    parts.push(Buffer.from(header), data);
    if (data.length % 2) parts.push(Buffer.from('\n'));
  }
  return Buffer.concat(parts);
}

const gzip = (buffer) => zlib.gzipSync(buffer, { level: 9 });
// zstd -19 makes the .deb about a third smaller than gzip (the Node binary
// dominates). dpkg reads it on Ubuntu 21.10+ and Debian 12+.
const zstd = (buffer) => zlib.zstdCompressSync(buffer, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 } });
const dirsOf = (paths) => [...new Set(paths.flatMap((file) => file.split('/').slice(1, -1).map((_, index, parts) => `./${parts.slice(0, index + 1).join('/')}/`)))].sort();

// --- stage ---
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
stageApp(stage, { nodeVersion, nodeLicense: 'runtime/LICENSE.node.txt' });
const { binary, license } = await linuxNode();
fs.mkdirSync(path.join(stage, 'runtime'), { recursive: true });
// Own process name, as on Windows, so it is easy to tell apart in a task list.
fs.writeFileSync(path.join(stage, 'runtime', 'dawith-runtime'), binary);
fs.writeFileSync(path.join(stage, 'runtime', 'LICENSE.node.txt'), license);
copy(path.join(root, 'public', 'dawith-ci.png'), path.join(stage, `${appName}.png`));
copy(path.join(root, 'LICENSE'), path.join(stage, 'LICENSE'));
fs.writeFileSync(path.join(stage, appName), `#!/bin/sh
# Starts Dawith Welfare Office: the bundled Node runtime serves the app on
# 127.0.0.1 and opens it in a Chrome/Chromium/Edge app window (or the default
# browser). Records stay in ~/.config/Dawith Welfare Office.
here="$(dirname "$(readlink -f "$0")")"
exec "$here/runtime/dawith-runtime" --no-warnings "$here/app/desktop/lite.mjs" "$@"
`);
const desktopEntry = (exec, icon) => `[Desktop Entry]
Type=Application
Name=Dawith 복지 업무 도구함
Name[en]=Dawith Welfare Office
Comment=사회복지 서류 업무를 이 PC에서 처리하는 도구 모음
Comment[en]=Local-first toolbox for social welfare paperwork
Exec=${exec}
Icon=${icon}
Terminal=false
Categories=Office;Utility;
Keywords=welfare;social work;pdf;hwp;복지;상담;
`;
fs.writeFileSync(path.join(stage, 'install.sh'), `#!/bin/sh
# Adds Dawith Welfare Office to this user's application menu without root.
# Run it from the extracted folder: ./install.sh   (remove: ./install.sh --uninstall)
set -e
here="$(dirname "$(readlink -f "$0")")"
apps="\${XDG_DATA_HOME:-$HOME/.local/share}/applications"
entry="$apps/${appName}.desktop"
if [ "$1" = "--uninstall" ]; then
  rm -f "$entry"
  echo "메뉴에서 지웠습니다. 기록은 ~/.config/Dawith Welfare Office 에 남아 있습니다."
  exit 0
fi
mkdir -p "$apps"
cat > "$entry" <<EOF
${desktopEntry('"$here/' + appName + '"', '$here/' + appName + '.png').trim()}
EOF
chmod 644 "$entry"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q "$apps" || true
echo "앱 메뉴에 'Dawith 복지 업무 도구함'을 추가했습니다. 바로 실행: $here/${appName}"
`);
for (const file of [appName, 'install.sh', path.join('runtime', 'dawith-runtime')]) executable.add(path.join(stage, file));

// --- .tar.gz: one folder, run in place or ./install.sh for a menu entry ---
const folder = `${appName}-${version}`;
fs.writeFileSync(path.join(out, names.tar), gzip(tar(tree(stage, folder))));

// --- .deb: /opt/dawith-welfare-office + menu entry + dawith-welfare-office command ---
const installDir = `/opt/${appName}`;
const payload = tree(stage, `.${installDir}`).filter((entry) => entry.name !== `.${installDir}/install.sh`);
const extra = [
  { name: `./usr/bin/${appName}`, type: 'symlink', mode: 0o777, link: `${installDir}/${appName}` },
  { name: `./usr/share/applications/${appName}.desktop`, type: 'file', mode: 0o644, data: Buffer.from(desktopEntry(`${installDir}/${appName}`, appName)) },
  { name: `./usr/share/pixmaps/${appName}.png`, type: 'file', mode: 0o644, data: fs.readFileSync(path.join(root, 'public', 'dawith-ci.png')) },
];
const parents = dirsOf([...payload, ...extra].map((entry) => entry.name)).filter((dir) => !payload.some((entry) => entry.name === dir));
const dataTar = tar([{ name: './', type: 'dir', mode: 0o755 }, ...parents.map((name) => ({ name, type: 'dir', mode: 0o755 })), ...payload, ...extra]);
const installedKb = Math.ceil([...payload, ...extra].reduce((sum, entry) => sum + (entry.data?.length || 0), 0) / 1024);
const control = `Package: ${appName}
Version: ${version}
Section: utils
Priority: optional
Architecture: amd64
Maintainer: Dawith AI <dawith-ai@users.noreply.github.com>
Installed-Size: ${installedKb}
Recommends: chromium | chromium-browser | google-chrome-stable | microsoft-edge-stable
Homepage: ${homepage}
Description: Dawith 복지 업무 도구함 (Dawith Welfare Office)
 사회복지사가 매일 하는 서류 일(상담 기록 정리, 기관 양식 채우기,
 PDF 합치기, 개인정보 가리기, 가계도·생태도)을 인터넷 없이 이 PC에서
 처리하는 무료 도구 모음입니다. 기록은 PC 밖으로 나가지 않습니다.
`;
const postinst = '#!/bin/sh\nset -e\ncommand -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q /usr/share/applications || true\n';
const controlTar = tar([
  { name: './', type: 'dir', mode: 0o755 },
  { name: './control', type: 'file', mode: 0o644, data: Buffer.from(control) },
  { name: './postinst', type: 'file', mode: 0o755, data: Buffer.from(postinst) },
  { name: './postrm', type: 'file', mode: 0o755, data: Buffer.from(postinst) },
]);
fs.writeFileSync(path.join(out, names.deb), ar([['debian-binary', Buffer.from('2.0\n')], ['control.tar.gz', gzip(controlTar)], ['data.tar.zst', zstd(dataTar)]]));

for (const file of Object.values(names)) console.log(`${file}  ${(fs.statSync(path.join(out, file)).size / 1048576).toFixed(1)}MB`);
