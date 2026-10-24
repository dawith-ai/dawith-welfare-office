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
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      title TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
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
    createCase({ label = '' } = {}) {
      const normalizedLabel = String(label).trim().slice(0, 160);
      if (!normalizedLabel) throw new Error('case_label_required');
      const caseId = id('case');
      db.prepare('INSERT INTO cases (id, label, created_at) VALUES (?, ?, ?)').run(caseId, cipher.seal(normalizedLabel), now());
      return { id: caseId, label: normalizedLabel, createdAt: now() };
    },
    listCases() {
      return db.prepare('SELECT id, label, created_at AS createdAt FROM cases ORDER BY created_at DESC').all().map((row) => ({ ...row, label: cipher.open(row.label) }));
    },
    ensureDefaultCase,
    listRecords({ query = '', kind = '' } = {}) {
      const rows = db.prepare('SELECT records.id, records.case_id AS caseId, cases.label AS caseLabel, records.kind, records.provider, records.source_name AS sourceName, records.raw_text AS rawText, records.context_text AS contextText, records.draft_json AS draftJson, records.created_at AS createdAt FROM records LEFT JOIN cases ON cases.id = records.case_id ORDER BY records.created_at DESC').all().map((row) => ({ ...row, caseLabel: cipher.open(row.caseLabel || ''), sourceName: cipher.open(row.sourceName || ''), rawText: cipher.open(row.rawText), contextText: cipher.open(row.contextText || ''), draft: JSON.parse(cipher.open(row.draftJson)), draftJson: undefined }));
      const normalizedQuery = String(query).trim().toLowerCase();
      return rows.filter((row) => (!kind || row.kind === kind) && (!normalizedQuery || [row.sourceName, row.rawText, row.draft?.typeLabel, row.draft?.counselingLog, row.draft?.assessment, row.draft?.servicePlan].join(' ').toLowerCase().includes(normalizedQuery))).map((row) => ({ ...row, rawText: undefined, contextText: undefined }));
    },
    getRecord(recordId) {
      return this.exportRecord(recordId);
    },
    saveRecord({ caseId, kind, provider, sourceName = '', rawText, contextText = '', draft }) {
      const recordId = id('record');
      const selectedCase = caseId || ensureDefaultCase();
      if (!db.prepare('SELECT id FROM cases WHERE id = ?').get(selectedCase)) throw new Error('case_not_found');
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
      const row = db.prepare('SELECT records.id, records.case_id AS caseId, cases.label AS caseLabel, records.kind, records.provider, records.source_name AS sourceName, records.raw_text AS rawText, records.context_text AS contextText, records.draft_json AS draftJson, records.created_at AS createdAt FROM records LEFT JOIN cases ON cases.id = records.case_id WHERE records.id = ?').get(recordId);
      if (!row) return null;
      return { ...row, caseLabel: cipher.open(row.caseLabel || ''), sourceName: cipher.open(row.sourceName || ''), rawText: cipher.open(row.rawText), contextText: cipher.open(row.contextText), draft: JSON.parse(cipher.open(row.draftJson)), draftJson: undefined };
    },
    listDocuments() {
      return db.prepare('SELECT id, template_id AS templateId, title, payload_json AS payloadJson, created_at AS createdAt, updated_at AS updatedAt FROM documents ORDER BY updated_at DESC').all().map((row) => ({
        id: row.id,
        templateId: row.templateId,
        title: cipher.open(row.title),
        payload: JSON.parse(cipher.open(row.payloadJson)),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    },
    saveDocument({ templateId, title, payload }) {
      const documentId = id('document');
      const timestamp = now();
      db.prepare('INSERT INTO documents (id, template_id, title, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(documentId, String(templateId), cipher.seal(String(title || '복지 문서')), cipher.seal(JSON.stringify(payload || {})), timestamp, timestamp);
      return { id: documentId, templateId, title: String(title || '복지 문서'), payload, createdAt: timestamp, updatedAt: timestamp };
    },
    getDocument(documentId) {
      const row = db.prepare('SELECT id, template_id AS templateId, title, payload_json AS payloadJson, created_at AS createdAt, updated_at AS updatedAt FROM documents WHERE id = ?').get(documentId);
      if (!row) return null;
      return { id: row.id, templateId: row.templateId, title: cipher.open(row.title), payload: JSON.parse(cipher.open(row.payloadJson)), createdAt: row.createdAt, updatedAt: row.updatedAt };
    },
    updateDocument(documentId, { title, payload, templateId } = {}) {
      const existing = this.getDocument(documentId);
      if (!existing) return null;
      const timestamp = now();
      db.prepare('UPDATE documents SET template_id = ?, title = ?, payload_json = ?, updated_at = ? WHERE id = ?').run(String(templateId || existing.templateId), cipher.seal(String(title || existing.title)), cipher.seal(JSON.stringify(payload || existing.payload)), timestamp, documentId);
      return this.getDocument(documentId);
    },
    close() {
      db.close();
    },
  };
}
