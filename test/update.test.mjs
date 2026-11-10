import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { isNewerVersion } from '../desktop/updater.mjs';
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
