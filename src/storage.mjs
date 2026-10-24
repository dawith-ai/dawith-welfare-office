import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createFieldCipher } from './crypto.mjs';

export function openStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'welfare-office.sqlite'));
  const cipher = createFieldCipher(dataDir);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      provider TEXT NOT NULL,
      source_name TEXT,
      raw_text TEXT NOT NULL,
      context_text TEXT,
      draft_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(case_id) REFERENCES cases(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const now = () => new Date().toISOString();
  const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const ensureDefaultCase = () => {
    const row = db.prepare('SELECT id FROM cases ORDER BY created_at LIMIT 1').get();
    if (row) return row.id;
    const caseId = id('case');
    db.prepare('INSERT INTO cases (id, label, created_at) VALUES (?, ?, ?)').run(caseId, cipher.seal('데모 사례 · 합성 데이터'), now());
    return caseId;
  };

  return {
    listCases() {
      return db.prepare('SELECT id, label, created_at AS createdAt FROM cases ORDER BY created_at DESC').all().map((row) => ({ ...row, label: cipher.open(row.label) }));
    },
    ensureDefaultCase,
    listRecords({ query = '', kind = '' } = {}) {
      const rows = db.prepare('SELECT id, case_id AS caseId, kind, provider, source_name AS sourceName, raw_text AS rawText, context_text AS contextText, draft_json AS draftJson, created_at AS createdAt FROM records ORDER BY created_at DESC').all().map((row) => ({ ...row, sourceName: cipher.open(row.sourceName || ''), rawText: cipher.open(row.rawText), contextText: cipher.open(row.contextText || ''), draft: JSON.parse(cipher.open(row.draftJson)), draftJson: undefined }));
      const normalizedQuery = String(query).trim().toLowerCase();
      return rows.filter((row) => (!kind || row.kind === kind) && (!normalizedQuery || [row.sourceName, row.rawText, row.draft?.typeLabel, row.draft?.counselingLog, row.draft?.assessment, row.draft?.servicePlan].join(' ').toLowerCase().includes(normalizedQuery))).map((row) => ({ ...row, rawText: undefined, contextText: undefined }));
    },
    getRecord(recordId) {
      return this.exportRecord(recordId);
    },
    saveRecord({ caseId, kind, provider, sourceName = '', rawText, contextText = '', draft }) {
      const recordId = id('record');
      const selectedCase = caseId || ensureDefaultCase();
      db.prepare('INSERT INTO records (id, case_id, kind, provider, source_name, raw_text, context_text, draft_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(recordId, selectedCase, kind, provider, cipher.seal(sourceName), cipher.seal(rawText), cipher.seal(contextText), cipher.seal(JSON.stringify(draft)), now());
      return { id: recordId, caseId: selectedCase, createdAt: now() };
    },
    updateRecord(recordId, input) {
      const existing = this.exportRecord(recordId);
      if (!existing) return null;
      const rawText = String(input.rawText ?? existing.rawText).trim();
      const contextText = String(input.contextText ?? existing.contextText ?? '').trim();
      const draft = input.draft && typeof input.draft === 'object' ? input.draft : existing.draft;
      if (!rawText || !draft) throw new Error('record_payload_invalid');
      db.prepare('UPDATE records SET raw_text = ?, context_text = ?, draft_json = ? WHERE id = ?').run(cipher.seal(rawText), cipher.seal(contextText), cipher.seal(JSON.stringify(draft)), recordId);
      return this.exportRecord(recordId);
    },
    getSettings() {
      const defaults = { organizationName: 'Dawith Welfare Office', retentionDays: 0, whisperModelPath: '', whisperBinaryPath: '' };
      for (const row of db.prepare('SELECT key, value FROM settings').all()) defaults[row.key] = row.key === 'retentionDays' ? Number(row.value) || 0 : cipher.open(row.value);
      return defaults;
    },
    updateSettings(input = {}) {
      const allowed = ['organizationName', 'retentionDays', 'whisperModelPath', 'whisperBinaryPath'];
      const current = this.getSettings();
      for (const key of allowed) {
        if (!(key in input)) continue;
        const value = key === 'retentionDays' ? String(Math.max(0, Math.min(3650, Number(input[key]) || 0))) : String(input[key] || '').trim();
        db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(key, cipher.seal(value), now());
        current[key] = key === 'retentionDays' ? Number(value) : value;
      }
      return current;
    },
    exportRecord(recordId) {
      const row = db.prepare('SELECT id, case_id AS caseId, kind, provider, source_name AS sourceName, raw_text AS rawText, context_text AS contextText, draft_json AS draftJson, created_at AS createdAt FROM records WHERE id = ?').get(recordId);
      if (!row) return null;
      return { ...row, sourceName: cipher.open(row.sourceName || ''), rawText: cipher.open(row.rawText), contextText: cipher.open(row.contextText), draft: JSON.parse(cipher.open(row.draftJson)), draftJson: undefined };
    },
    close() {
      db.close();
    },
  };
}
