import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createFieldCipher } from './crypto.mjs';
import { sha256 } from './transcription.mjs';

export function openStore(dataDir, { encryptionKey } = {}) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'welfare-office.sqlite'));
  const cipher = createFieldCipher(dataDir, { encryptionKey });
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
      source_hash TEXT,
      draft_hash TEXT,
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
    CREATE TABLE IF NOT EXISTS document_templates (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      format TEXT NOT NULL,
      file_data TEXT NOT NULL,
      fields_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_users (
      username TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      disabled INTEGER NOT NULL DEFAULT 0
    );
  `);
  try { db.exec('ALTER TABLE records ADD COLUMN source_hash TEXT'); } catch { /* Existing database already migrated. */ }
  try { db.exec('ALTER TABLE records ADD COLUMN draft_hash TEXT'); } catch { /* Existing database already migrated. */ }

  const now = () => new Date().toISOString();
  const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const audit = (eventType, entityType, entityId = '', metadata = {}) => {
    db.prepare('INSERT INTO audit_events (id, event_type, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id('audit'), eventType, entityType, entityId, cipher.seal(JSON.stringify(metadata)), now());
  };
  const purgeExpired = () => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('retentionDays');
    const retentionDays = row ? Number(cipher.open(row.value)) || 0 : 0;
    if (!retentionDays) return { records: 0, documents: 0, templates: 0 };
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const records = db.prepare('DELETE FROM records WHERE created_at < ?').run(cutoff).changes;
    const documents = db.prepare('DELETE FROM documents WHERE updated_at < ?').run(cutoff).changes;
    const templates = db.prepare('DELETE FROM document_templates WHERE updated_at < ?').run(cutoff).changes;
    if (records || documents || templates) audit('retention_purge', 'maintenance', '', { retentionDays, records, documents, templates });
    return { records, documents, templates };
  };
  const ensureDefaultCase = () => {
    const row = db.prepare('SELECT id FROM cases ORDER BY created_at LIMIT 1').get();
    if (row) return row.id;
    const caseId = id('case');
    db.prepare('INSERT INTO cases (id, label, created_at) VALUES (?, ?, ?)').run(caseId, cipher.seal('데모 사례 · 합성 데이터'), now());
    return caseId;
  };

  return {
    countUsers() {
      return Number(db.prepare('SELECT COUNT(*) AS count FROM auth_users WHERE disabled = 0').get().count || 0);
    },
    getUser(username) {
      const row = db.prepare('SELECT username, role, password_hash AS passwordHash, created_at AS createdAt, disabled FROM auth_users WHERE username = ?').get(String(username));
      return row ? { ...row, disabled: Boolean(row.disabled) } : null;
    },
    createUser({ username, role, passwordHash }) {
      const createdAt = now();
      db.prepare('INSERT INTO auth_users (username, role, password_hash, created_at, disabled) VALUES (?, ?, ?, ?, 0)').run(String(username), String(role), String(passwordHash), createdAt);
      audit('user_created', 'user', String(username), { role: String(role) });
      return { username: String(username), role: String(role), createdAt };
    },
    listUsers() {
      return db.prepare('SELECT username, role, created_at AS createdAt, disabled FROM auth_users ORDER BY username').all().map((row) => ({ ...row, disabled: Boolean(row.disabled) }));
    },
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
      purgeExpired();
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
      const draftJson = JSON.stringify(draft);
      db.prepare('INSERT INTO records (id, case_id, kind, provider, source_name, raw_text, context_text, draft_json, source_hash, draft_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(recordId, selectedCase, kind, provider, cipher.seal(sourceName), cipher.seal(rawText), cipher.seal(contextText), cipher.seal(draftJson), sha256(rawText), sha256(draftJson), now());
      audit('record_created', 'record', recordId, { kind, provider, sourceName: String(sourceName).slice(0, 240) });
      return { id: recordId, caseId: selectedCase, createdAt: now() };
    },
    updateRecord(recordId, input) {
      const existing = this.exportRecord(recordId);
      if (!existing) return null;
      const rawText = String(input.rawText ?? existing.rawText).trim();
      const contextText = String(input.contextText ?? existing.contextText ?? '').trim();
      const draft = input.draft && typeof input.draft === 'object' ? input.draft : existing.draft;
      if (!rawText || !draft) throw new Error('record_payload_invalid');
      const draftJson = JSON.stringify(draft);
      db.prepare('UPDATE records SET raw_text = ?, context_text = ?, draft_json = ?, source_hash = ?, draft_hash = ? WHERE id = ?').run(cipher.seal(rawText), cipher.seal(contextText), cipher.seal(draftJson), sha256(rawText), sha256(draftJson), recordId);
      audit('record_updated', 'record', recordId, {});
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
      purgeExpired();
      audit('settings_updated', 'settings', '', { keys: Object.keys(input).filter((key) => allowed.includes(key)) });
      return current;
    },
    exportRecord(recordId) {
      const row = db.prepare('SELECT records.id, records.case_id AS caseId, cases.label AS caseLabel, records.kind, records.provider, records.source_name AS sourceName, records.raw_text AS rawText, records.context_text AS contextText, records.draft_json AS draftJson, records.source_hash AS sourceHash, records.draft_hash AS draftHash, records.created_at AS createdAt FROM records LEFT JOIN cases ON cases.id = records.case_id WHERE records.id = ?').get(recordId);
      if (!row) return null;
      const rawText = cipher.open(row.rawText);
      const draft = JSON.parse(cipher.open(row.draftJson));
      const draftJson = JSON.stringify(draft);
      const sourceHash = row.sourceHash || sha256(rawText);
      const draftHash = row.draftHash || sha256(draftJson);
      return { ...row, caseLabel: cipher.open(row.caseLabel || ''), sourceName: cipher.open(row.sourceName || ''), rawText, contextText: cipher.open(row.contextText), draft, sourceHash, draftHash, integrity: { sourceHash, draftHash, verified: sourceHash === sha256(rawText) && draftHash === sha256(draftJson) }, draftJson: undefined };
    },
    listAuditEvents({ limit = 100 } = {}) {
      return db.prepare('SELECT id, event_type AS eventType, entity_type AS entityType, entity_id AS entityId, metadata_json AS metadataJson, created_at AS createdAt FROM audit_events ORDER BY created_at DESC LIMIT ?').all(Math.max(1, Math.min(500, Number(limit) || 100))).map((row) => ({ ...row, metadata: JSON.parse(cipher.open(row.metadataJson)), metadataJson: undefined }));
    },
    purgeExpired,
    listDocuments() {
      purgeExpired();
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
      audit('document_created', 'document', documentId, { templateId: String(templateId) });
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
      audit('document_updated', 'document', documentId, { templateId: String(templateId || existing.templateId) });
      return this.getDocument(documentId);
    },
    listDocumentTemplates() {
      purgeExpired();
      return db.prepare('SELECT id, file_name AS fileName, format, fields_json AS fieldsJson, created_at AS createdAt, updated_at AS updatedAt FROM document_templates ORDER BY updated_at DESC').all().map((row) => ({
        ...(() => {
          const parsed = JSON.parse(cipher.open(row.fieldsJson));
          return { fields: Array.isArray(parsed) ? parsed : parsed.fields || [], ready: Array.isArray(parsed) ? true : parsed.ready !== false, warnings: Array.isArray(parsed) ? [] : parsed.warnings || [] };
        })(),
        id: row.id,
        fileName: cipher.open(row.fileName),
        format: row.format,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    },
    saveDocumentTemplate({ templateId, fileName, format, data, fields, ready = true, warnings = [] }) {
      const timestamp = now();
      const encoded = Buffer.from(data).toString('base64');
      db.prepare('INSERT INTO document_templates (id, file_name, format, file_data, fields_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET file_name = excluded.file_name, format = excluded.format, file_data = excluded.file_data, fields_json = excluded.fields_json, updated_at = excluded.updated_at').run(String(templateId), cipher.seal(String(fileName)), String(format), cipher.seal(encoded), cipher.seal(JSON.stringify({ fields: fields || [], ready, warnings })), timestamp, timestamp);
      audit('template_saved', 'document_template', String(templateId), { fileName: String(fileName).slice(0, 240), format: String(format) });
      return this.getDocumentTemplate(templateId);
    },
    getDocumentTemplate(templateId) {
      const row = db.prepare('SELECT id, file_name AS fileName, format, file_data AS fileData, fields_json AS fieldsJson, created_at AS createdAt, updated_at AS updatedAt FROM document_templates WHERE id = ?').get(templateId);
      if (!row) return null;
      const parsed = JSON.parse(cipher.open(row.fieldsJson));
      return { id: row.id, fileName: cipher.open(row.fileName), format: row.format, data: Buffer.from(cipher.open(row.fileData), 'base64'), fields: Array.isArray(parsed) ? parsed : parsed.fields || [], ready: Array.isArray(parsed) ? true : parsed.ready !== false, warnings: Array.isArray(parsed) ? [] : parsed.warnings || [], createdAt: row.createdAt, updatedAt: row.updatedAt };
    },
    close() {
      db.close();
    },
  };
}
