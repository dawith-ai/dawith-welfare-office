import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildDrafts, parseOllamaDraft } from '../src/processing.mjs';
import { buildDocumentDraft } from '../src/documents.mjs';
import { documentToDocx } from '../src/document-export.mjs';
import { openStore } from '../src/storage.mjs';
import { startServer } from '../server.mjs';

test('buildDrafts extracts welfare-record facts without a model', () => {
  const draft = buildDrafts({
    kind: 'counseling',
    rawText: '친모는 7월에 이혼할 예정이며 주거가 불안정하다고 말함. 임대주택 신청을 계획함.',
    contextText: '한부모 가구',
  });

  assert.equal(draft.typeLabel, '상담일지');
  assert.deepEqual(draft.facts.relations, ['친모']);
  assert.deepEqual(draft.facts.dates, ['7월']);
  assert.ok(draft.servicePlan.includes('신청'));
  assert.equal(draft.servicePlan.includes('논의을'), false);
  assert.equal(draft.reviewRequired, true);
});

test('meeting drafts separate decisions and actions with natural labels', () => {
  const draft = buildDrafts({
    kind: 'meeting',
    rawText: '사례회의에서 주거비 부담을 논의함. 담당자는 다음 주에 친모에게 연락하기로 결정함.',
  });

  assert.equal(draft.typeLabel, '회의록');
  assert.match(draft.assessment, /논의 및 결정사항/);
  assert.match(draft.servicePlan, /후속 실행 항목/);
  assert.equal(draft.servicePlan.includes('논의을'), false);
});

test('invalid local-model output never bypasses deterministic fallback', () => {
  const fallback = buildDrafts({ kind: 'meeting', rawText: '회의에서 주거 지원을 논의함.' });
  assert.equal(parseOllamaDraft('not-json', fallback), fallback);
  assert.equal(parseOllamaDraft(JSON.stringify({ counselingLog: 'only one field' }), fallback), fallback);
});

test('document studio builds welfare templates and a valid Word document locally', async () => {
  const draft = buildDocumentDraft({
    templateId: 'meeting-minutes',
    fields: {
      organizationName: '합성 기관',
      meetingTitle: '합성 사례회의',
      date: '2026년 10월 24일 14:00',
      attendees: '김○○, 이○○',
      agenda: '주거 지원 방향\n신청 서류 점검',
      discussion: '신청 절차와 상담 일정을 논의함.',
      decisions: '신청 자격을 확인한다.',
      actionItems: '김○○ — 10월 30일까지 자격 확인',
    },
  });
  assert.equal(draft.title, '합성 사례회의 회의록');
  assert.deepEqual(draft.missing, []);
  const buffer = await documentToDocx({ id: 'document_test', templateId: draft.templateId, title: draft.title, payload: draft });
  assert.ok(buffer.length > 5000);
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
});

test('records persist in a local SQLite file and can be exported', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-test-'));
  const store = openStore(dataDir);
  const caseId = store.ensureDefaultCase();
  const draft = buildDrafts({ kind: 'meeting', rawText: '합성 회의 메모' });
  const saved = store.saveRecord({ caseId, kind: 'meeting', provider: 'rules', rawText: '합성 회의 메모', contextText: '', draft });
  assert.equal(store.listRecords().length, 1);
  assert.equal(store.exportRecord(saved.id).draft.typeLabel, '회의록');
  const rawDatabase = fs.readFileSync(path.join(dataDir, 'welfare-office.sqlite'), 'utf8');
  assert.equal(rawDatabase.includes('합성 회의 메모'), false);
  store.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('local API supports the full review, search, edit, export flow and blocks cloud providers', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-api-'));
  const runtime = await startServer({ port: 0, dataDir });
  try {
    const health = await fetch(`${runtime.url}/api/health`).then((response) => response.json());
    assert.equal(health.mode, 'local-only');
    const crossOrigin = await fetch(`${runtime.url}/api/health`, { headers: { Origin: 'https://example.invalid' } });
    assert.equal(crossOrigin.status, 403);
    const cases = await fetch(`${runtime.url}/api/cases`).then((response) => response.json());
    assert.equal(cases.cases.length, 1);
    const createdCase = await fetch(`${runtime.url}/api/cases`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: '합성 사례 A' }) }).then((response) => response.json());
    assert.equal(createdCase.case.label, '합성 사례 A');
    const blocked = await fetch(`${runtime.url}/api/process`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'openrouter', rawText: '합성 개인정보' }) });
    assert.equal(blocked.status, 400);
    const processed = await fetch(`${runtime.url}/api/process`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'meeting', provider: 'rules', rawText: '사례회의에서 주거 지원을 논의함. 담당자는 다음 주에 연락하기로 함.' }) }).then((response) => response.json());
    const saved = await fetch(`${runtime.url}/api/records`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId: createdCase.case.id, kind: 'meeting', provider: 'rules', rawText: '사례회의에서 주거 지원을 논의함. 담당자는 다음 주에 연락하기로 함.', draft: processed.draft }) }).then((response) => response.json());
    const recordId = saved.saved.id;
    const searched = await fetch(`${runtime.url}/api/records?q=주거`).then((response) => response.json());
    assert.equal(searched.records.length, 1);
    assert.equal(searched.records[0].caseLabel, '합성 사례 A');
    const detail = await fetch(`${runtime.url}/api/records/${recordId}`).then((response) => response.json());
    assert.equal(detail.record.id, recordId);
    detail.record.draft.counselingLog = '검토자가 수정한 회의 요약';
    const updated = await fetch(`${runtime.url}/api/records/${recordId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rawText: detail.record.rawText, contextText: detail.record.contextText, draft: detail.record.draft }) }).then((response) => response.json());
    assert.equal(updated.record.draft.counselingLog, '검토자가 수정한 회의 요약');
    const markdown = await fetch(`${runtime.url}/api/records/${recordId}/export?format=markdown`).then((response) => response.text());
    assert.match(markdown, /검토자가 수정한 회의 요약/);
    const settings = await fetch(`${runtime.url}/api/settings`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationName: '합성 기관', retentionDays: 30 }) }).then((response) => response.json());
    assert.equal(settings.settings.retentionDays, 30);
    const templates = await fetch(`${runtime.url}/api/document-templates`).then((response) => response.json());
    assert.equal(templates.templates.length, 3);
    const preview = await fetch(`${runtime.url}/api/documents/preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId: 'business-plan', fields: { organizationName: '합성 기관', businessName: '주거지원', period: '2026년', target: '합성 가구', necessity: '합성 필요성', goals: '목표', activities: '활동', indicators: '지표' } }) }).then((response) => response.json());
    assert.equal(preview.draft.title, '주거지원 사업기획서');
    const savedDocument = await fetch(`${runtime.url}/api/documents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId: preview.draft.templateId, title: preview.draft.title, payload: preview.draft }) }).then((response) => response.json());
    assert.ok(savedDocument.document.id);
    const documents = await fetch(`${runtime.url}/api/documents`).then((response) => response.json());
    assert.equal(documents.documents.length, 1);
    const docx = await fetch(`${runtime.url}/api/documents/${savedDocument.document.id}/export?format=docx`);
    assert.equal(docx.status, 200);
    assert.equal(docx.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal((await docx.arrayBuffer()).byteLength > 5000, true);
  } finally {
    await new Promise((resolve) => runtime.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
