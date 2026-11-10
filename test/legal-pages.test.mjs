import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { legalPages, renderLegalPages } from '../scripts/build-legal-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n');

test('generated policy pages match docs/legal (run npm run legal:build)', () => {
  for (const [relative, html] of renderLegalPages()) assert.equal(read(relative), html, `${relative} is out of date`);
});

test('app and site copies carry the same policy text', () => {
  const body = (html) => html.slice(html.indexOf('<section id='), html.lastIndexOf('</section>')).replace(/\s+/g, ' ');
  for (const page of legalPages) {
    const app = read(path.join('public', page.file));
    const site = read(path.join('site', page.file));
    assert.equal(body(app), body(site), page.file);
    assert.match(app, /시행일 2026년 11월 10일/);
    assert.match(app, /dawith0ai@gmail\.com|개인정보처리방침/);
  }
});

test('policy pages ship with the app and are linked from every site page', () => {
  const files = JSON.parse(read('package.json')).build.files;
  for (const page of legalPages) assert.ok(files.includes(`public/${page.file}`), `${page.file} missing from build.files`);
  assert.ok(files.includes('public/styles-legal.css'));
  for (const file of fs.readdirSync(path.join(root, 'site')).filter((name) => name.endsWith('.html'))) {
    const html = read(path.join('site', file));
    for (const page of legalPages) assert.ok(html.includes(`href="./${page.file}"`), `site/${file} does not link ${page.file}`);
    assert.ok(html.includes('© 2024-2026 Dawith AI. All rights reserved.'), `site/${file} lacks the copyright line`);
  }
  const app = read('public/index.html');
  for (const page of legalPages) assert.ok(app.includes(`href="./${page.file}"`), `public/index.html does not link ${page.file}`);
});
