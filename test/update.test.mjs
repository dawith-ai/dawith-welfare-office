import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { isNewerVersion } from '../desktop/version.mjs';
import { startServer } from '../server.mjs';

test('isNewerVersion compares release versions numerically', () => {
  assert.equal(isNewerVersion('0.9.7', '0.9.6'), true);
  assert.equal(isNewerVersion('0.10.0', '0.9.6'), true);
  assert.equal(isNewerVersion('0.9.6', '0.9.6'), false);
  assert.equal(isNewerVersion('0.4.9', '0.9.6'), false);
});

test('update API proxies the desktop updater and is unsupported without one', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-update-'));
  const calls = [];
  const updater = {
    status: () => ({ supported: true, status: 'idle' }),
    check: async () => { calls.push('check'); return { supported: true, status: 'available', latestVersion: '0.9.7' }; },
    download: () => { calls.push('download'); return { supported: true, status: 'downloading' }; },
    install: () => { calls.push('install'); return { supported: true, status: 'installing' }; },
  };
  const withUpdater = await startServer({ port: 0, dataDir, updater });
  const plain = await startServer({ port: 0, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-update-')) });
  try {
    assert.deepEqual(await (await fetch(`${withUpdater.url}/api/update/status`)).json(), { supported: true, status: 'idle' });
    assert.equal((await (await fetch(`${withUpdater.url}/api/update/check`, { method: 'POST' })).json()).latestVersion, '0.9.7');
    await fetch(`${withUpdater.url}/api/update/download`, { method: 'POST' });
    await fetch(`${withUpdater.url}/api/update/install`, { method: 'POST' });
    assert.deepEqual(calls, ['check', 'download', 'install']);
    assert.deepEqual(await (await fetch(`${plain.url}/api/update/status`)).json(), { supported: false });
  } finally {
    withUpdater.server.close();
    plain.server.close();
  }
});

test('lite updater reads the feed and rejects an installer with the wrong checksum', async () => {
  const { createLiteUpdater, parseFeed } = await import('../desktop/lite-updater.mjs');
  const feedText = "version: 0.9.8\nfiles:\n  - url: Setup.exe\n    sha512: bm90LXRoZS1yZWFsLWhhc2g=\n    size: 5\npath: Setup.exe\nsha512: bm90LXRoZS1yZWFsLWhhc2g=\nreleaseDate: '2026-11-10T00:00:00.000Z'\n";
  assert.deepEqual(parseFeed(feedText), { version: '0.9.8', path: 'Setup.exe', sha512: 'bm90LXRoZS1yZWFsLWhhc2g=', size: 5 });
  const fetchImpl = async (url) => (url.endsWith('latest.yml') ? new Response(feedText) : new Response('bytes', { headers: { 'content-length': '5' } }));
  const updater = createLiteUpdater({ version: '0.9.7', portable: false, fetchImpl, feedUrl: 'https://example.test/download/', launch: () => assert.fail('must not launch') });
  assert.equal((await updater.check()).status, 'available');
  updater.download();
  for (let i = 0; i < 50 && updater.status().status === 'downloading'; i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(updater.status().status, 'error');
  assert.equal(updater.status().error, 'update_checksum_mismatch');
  assert.equal(updater.install().status, 'error');
});
