import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { normalizeConsent, openStore } from '../src/storage.mjs';
import { startServer } from '../server.mjs';

const consent = (overrides = {}) => ({
  policyVersion: '2026-11-10',
  privacy: { agreed: true, at: '2026-11-10T01:00:00.000Z' },
  terms: { agreed: true, at: '2026-11-10T01:00:00.000Z' },
  externalAi: { agreed: false, at: null },
  updatedAt: '2026-11-10T01:00:00.000Z',
  ...overrides,
});

test('normalizeConsent keeps only the known fields and rejects malformed input', () => {
  assert.equal(normalizeConsent(null), null);
  assert.equal(normalizeConsent({ policyVersion: 'v1', updatedAt: '2026-11-10' }), null);
  assert.equal(normalizeConsent({ policyVersion: '2026-11-10' }), null);
  const normalized = normalizeConsent({ ...consent(), extra: 'dropped', externalAi: { agreed: 'yes', at: '2026-11-10' } });
  assert.deepEqual(Object.keys(normalized).sort(), ['externalAi', 'policyVersion', 'privacy', 'terms', 'updatedAt']);
  assert.deepEqual(normalized.externalAi, { agreed: false, at: null });
  assert.equal(normalized.privacy.agreed, true);
});

test('consent is stored encrypted and survives reopening the store', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-consent-store-'));
  try {
    let store = openStore(dataDir);
    assert.equal(store.getSettings().consent, null);
    store.updateSettings({ consent: consent({ externalAi: { agreed: true, at: '2026-11-10T02:00:00.000Z' } }) });
    store.close();
    store = openStore(dataDir);
    const saved = store.getSettings().consent;
    assert.equal(saved.policyVersion, '2026-11-10');
    assert.equal(saved.externalAi.agreed, true);
    assert.equal(saved.externalAi.at, '2026-11-10T02:00:00.000Z');
    assert.ok(store.listAuditEvents().some((event) => event.eventType === 'consent_updated'));
    store.close();
    const raw = fs.readFileSync(path.join(dataDir, 'welfare-office.sqlite'));
    assert.equal(raw.includes(Buffer.from('externalAi')), false);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('settings API persists consent across restarts and never returns AI tokens', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-consent-api-'));
  let runtime = await startServer({ port: 0, host: '127.0.0.1', dataDir });
  try {
    const invalid = await fetch(`${runtime.url}/api/settings`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consent: { policyVersion: 'bad' } }) });
    assert.equal(invalid.status, 400);
    const patched = await fetch(`${runtime.url}/api/settings`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consent: consent() }) }).then((response) => response.json());
    assert.equal(patched.settings.consent.terms.agreed, true);
    await new Promise((resolve) => runtime.server.close(resolve));
    runtime = await startServer({ port: 0, host: '127.0.0.1', dataDir });
    const store = openStore(dataDir);
    store.updateAiConnections({ gemini: { apiKey: 'synthetic-secret-key' } });
    store.close();
    const reloaded = await fetch(`${runtime.url}/api/settings`).then((response) => response.json());
    assert.equal(reloaded.settings.consent.privacy.agreed, true);
    assert.equal(reloaded.settings.consent.externalAi.agreed, false);
    assert.equal('aiConnections' in reloaded.settings, false);
    assert.equal(JSON.stringify(reloaded).includes('synthetic-secret-key'), false);
    const withdrawn = await fetch(`${runtime.url}/api/settings`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consent: consent({ privacy: { agreed: false }, terms: { agreed: false }, updatedAt: '2026-11-11T00:00:00.000Z' }) }) }).then((response) => response.json());
    assert.equal(withdrawn.settings.consent.privacy.agreed, false);
    assert.equal(withdrawn.settings.consent.privacy.at, null);
  } finally {
    await new Promise((resolve) => runtime.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
