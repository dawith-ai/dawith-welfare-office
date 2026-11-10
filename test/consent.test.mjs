import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { normalizeConsent, openStore } from '../src/storage.mjs';
import { startServer } from '../server.mjs';

const consent = (overrides = {}) => ({
  policyVersion: '2026-11-11',
  privacy: { agreed: true, at: '2026-11-11T01:00:00.000Z' },
  terms: { agreed: true, at: '2026-11-11T01:00:00.000Z' },
  updatedAt: '2026-11-11T01:00:00.000Z',
  ...overrides,
});

test('normalizeConsent keeps only the known fields and rejects malformed input', () => {
  assert.equal(normalizeConsent(null), null);
  assert.equal(normalizeConsent({ policyVersion: 'v1', updatedAt: '2026-11-10' }), null);
  assert.equal(normalizeConsent({ policyVersion: '2026-11-10' }), null);
  // Records written by 0.9.9 carried an optional cloud-AI consent; it is dropped.
  const normalized = normalizeConsent({ ...consent(), extra: 'dropped', externalAi: { agreed: true, at: '2026-11-10' } });
  assert.deepEqual(Object.keys(normalized).sort(), ['policyVersion', 'privacy', 'terms', 'updatedAt']);
  assert.equal(normalized.privacy.agreed, true);
  assert.equal(normalized.terms.at, '2026-11-11T01:00:00.000Z');
});

test('consent is stored encrypted and survives reopening the store', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-consent-store-'));
  try {
    let store = openStore(dataDir);
    assert.equal(store.getSettings().consent, null);
    store.updateSettings({ consent: consent({ terms: { agreed: true, at: '2026-11-11T02:00:00.000Z' } }) });
    store.close();
    store = openStore(dataDir);
    const saved = store.getSettings().consent;
    assert.equal(saved.policyVersion, '2026-11-11');
    assert.equal(saved.terms.at, '2026-11-11T02:00:00.000Z');
    assert.equal('externalAi' in saved, false);
    assert.ok(store.listAuditEvents().some((event) => event.eventType === 'consent_updated'));
    store.close();
    const raw = fs.readFileSync(path.join(dataDir, 'welfare-office.sqlite'));
    assert.equal(raw.includes(Buffer.from('policyVersion')), false);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('settings API persists consent across restarts and purges leftover cloud AI credentials', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-consent-api-'));
  let runtime = await startServer({ port: 0, host: '127.0.0.1', dataDir });
  try {
    const invalid = await fetch(`${runtime.url}/api/settings`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consent: { policyVersion: 'bad' } }) });
    assert.equal(invalid.status, 400);
    const patched = await fetch(`${runtime.url}/api/settings`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consent: consent() }) }).then((response) => response.json());
    assert.equal(patched.settings.consent.terms.agreed, true);
    await new Promise((resolve) => runtime.server.close(resolve));
    // Simulate a 0.9.9 database that still holds a cloud AI key row.
    const legacy = new DatabaseSync(path.join(dataDir, 'welfare-office.sqlite'));
    legacy.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('aiConnections', 'synthetic-secret-key', '2026-11-10T00:00:00.000Z');
    legacy.close();
    runtime = await startServer({ port: 0, host: '127.0.0.1', dataDir });
    const leftover = new DatabaseSync(path.join(dataDir, 'welfare-office.sqlite'));
    assert.equal(leftover.prepare('SELECT COUNT(*) AS count FROM settings WHERE key = ?').get('aiConnections').count, 0);
    leftover.close();
    const reloaded = await fetch(`${runtime.url}/api/settings`).then((response) => response.json());
    assert.equal(reloaded.settings.consent.privacy.agreed, true);
    assert.equal('externalAi' in reloaded.settings.consent, false);
    assert.equal('aiConnections' in reloaded.settings, false);
    assert.equal(JSON.stringify(reloaded).includes('synthetic-secret-key'), false);
    const withdrawn = await fetch(`${runtime.url}/api/settings`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consent: consent({ privacy: { agreed: false }, terms: { agreed: false }, updatedAt: '2026-11-12T00:00:00.000Z' }) }) }).then((response) => response.json());
    assert.equal(withdrawn.settings.consent.privacy.agreed, false);
    assert.equal(withdrawn.settings.consent.privacy.at, null);
  } finally {
    await new Promise((resolve) => runtime.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
