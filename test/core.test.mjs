import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import JSZip from 'jszip';
import { Document, Paragraph, Packer } from 'docx';
import { buildDrafts, parseOllamaDraft } from '../src/processing.mjs';
import { parseWhisperJson, sha256 } from '../src/transcription.mjs';
import { buildDocumentDraft } from '../src/documents.mjs';
import { documentToDocx } from '../src/document-export.mjs';
import { openStore } from '../src/storage.mjs';
import { analyzeTemplate, renderTemplate } from '../src/template-engine.mjs';
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
  assert.equal(draft.counselingLog.includes('와 내담자와의'), false);
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

test('uploaded DOCX and HWPX templates are analyzed and filled locally', async () => {
  const docx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('기관: {{기관명}}'), new Paragraph('내용: {{내용}}')] }] }));
  const docxAnalysis = await analyzeTemplate({ fileName: '기관양식.docx', data: docx });
  assert.deepEqual(docxAnalysis.fields.map((field) => field.key), ['기관명', '내용']);
  const filledDocx = await renderTemplate({ fileName: '기관양식.docx', data: docx, fields: { 기관명: '합성 기관', 내용: '첫 줄\n둘째 줄' } });
  const docxZip = await JSZip.loadAsync(filledDocx);
  const documentXml = await docxZip.file('word/document.xml').async('text');
  assert.match(documentXml, /합성 기관/);
  assert.match(documentXml, /첫 줄/);
  assert.match(documentXml, /둘째 줄/);

  const hwpxZip = new JSZip();
  hwpxZip.file('Contents/section0.xml', '<section><p>기관: {{기관명}}</p><p>내용: {{내용}}</p></section>');
  const hwpx = await hwpxZip.generateAsync({ type: 'nodebuffer' });
  const hwpxAnalysis = await analyzeTemplate({ fileName: '기관양식.hwpx', data: hwpx });
  assert.equal(hwpxAnalysis.ready, true);
  const filledHwpx = await renderTemplate({ fileName: '기관양식.hwpx', data: hwpx, fields: { 기관명: '합성 기관', 내용: '합성 내용' } });
  const filledHwpxZip = await JSZip.loadAsync(filledHwpx);
  const sectionXml = await filledHwpxZip.file('Contents/section0.xml').async('text');
  assert.match(sectionXml, /합성 기관/);
  assert.match(sectionXml, /합성 내용/);

  const splitHwpxZip = new JSZip();
  splitHwpxZip.file('Contents/section0.xml', '<section><p>{{기</p><p>관명}}</p></section>');
  const splitHwpxAnalysis = await analyzeTemplate({ fileName: '분리양식.hwpx', data: await splitHwpxZip.generateAsync({ type: 'nodebuffer' }) });
  assert.equal(splitHwpxAnalysis.ready, false);
  assert.match(splitHwpxAnalysis.warnings[0], /XML 텍스트 노드로 분리/);
});

test('local transcription runs through the configured whisper CLI and preserves evidence metadata', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-whisper-'));
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-whisper-bin-'));
  const modelPath = path.join(runtimeDir, 'ggml-test.bin');
  fs.writeFileSync(modelPath, 'synthetic model');
  const fakeScript = path.join(runtimeDir, 'fake-whisper.mjs');
  fs.writeFileSync(fakeScript, `#!/usr/bin/env node\nimport fs from 'node:fs';\nconst args = process.argv.slice(2);\nconst output = args[args.indexOf('-of') + 1];\nfs.writeFileSync(output + '.txt', '친모가 다음 주에 주거 지원을 신청하기로 함.');\nfs.writeFileSync(output + '.json', JSON.stringify({ transcription: [{ timestamps: { from: '00:00:00,000', to: '00:00:02,000' }, text: '친모가 다음 주에 주거 지원을 신청하기로 함.' }] }));\n`);
  const binaryPath = process.platform === 'win32' ? path.join(runtimeDir, 'fake-whisper.cmd') : fakeScript;
  if (process.platform === 'win32') fs.writeFileSync(binaryPath, `@echo off\r\n"${process.execPath}" "%~dp0fake-whisper.mjs" %*\r\n`);
  else fs.chmodSync(fakeScript, 0o755);
  const runtime = await startServer({ port: 0, dataDir });
  try {
    await fetch(`${runtime.url}/api/settings`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ whisperBinaryPath: binaryPath, whisperModelPath: modelPath }) });
    const audio = Buffer.from('synthetic wav bytes');
    const response = await fetch(`${runtime.url}/api/transcribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName: '상담녹취.wav', dataBase64: audio.toString('base64') }) });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.match(payload.text, /주거 지원/);
    assert.equal(payload.segments.length, 1);
    assert.equal(payload.sourceHash, sha256(audio));
    assert.deepEqual(parseWhisperJson('{"transcription":[{"text":"합성 전사"}]}').text, '합성 전사');
    const audit = await fetch(`${runtime.url}/api/audit`).then((result) => result.json());
    assert.ok(audit.events.some((event) => event.eventType === 'settings_updated'));
  } finally {
    await new Promise((resolve) => runtime.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  }
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

test('retention policy purges expired local content and leaves metadata-only audit evidence', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-retention-'));
  const store = openStore(dataDir);
  const caseId = store.ensureDefaultCase();
  store.saveRecord({ caseId, kind: 'counseling', provider: 'rules', rawText: '합성 보관기간 테스트', contextText: '', draft: buildDrafts({ rawText: '합성 보관기간 테스트' }) });
  store.updateSettings({ retentionDays: 1 });
  store.close();
  const db = new DatabaseSync(path.join(dataDir, 'welfare-office.sqlite'));
  db.prepare("UPDATE records SET created_at = '2020-01-01T00:00:00.000Z'").run();
  db.close();
  const reopened = openStore(dataDir);
  assert.equal(reopened.listRecords().length, 0);
  assert.ok(reopened.listAuditEvents().some((event) => event.eventType === 'retention_purge'));
  reopened.close();
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
    const alternateLoopbackOrigin = await fetch(`${runtime.url}/api/health`, { headers: { Origin: `http://localhost:${new URL(runtime.url).port}` } });
    assert.equal(alternateLoopbackOrigin.status, 403);
    const sameOrigin = await fetch(`${runtime.url}/api/health`, { headers: { Origin: runtime.url } });
    assert.equal(sameOrigin.status, 200);
    assert.equal(sameOrigin.headers.get('content-security-policy').includes("frame-ancestors 'none'"), true);
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
    const templateData = Buffer.from('not-a-real-template').toString('base64');
    const invalidTemplate = await fetch(`${runtime.url}/api/document-templates`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName: '기관양식.pdf', dataBase64: templateData }) });
    assert.equal(invalidTemplate.status, 400);
    const uploadedTemplate = await fetch(`${runtime.url}/api/document-templates`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName: '기관양식.docx', dataBase64: (await (async () => {
      const uploadedDocx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('기관: {{기관명}}')] }] }));
      return uploadedDocx.toString('base64');
    })()) }) }).then((response) => response.json());
    assert.equal(uploadedTemplate.analysis.ready, true);
    assert.equal(uploadedTemplate.analysis.fields[0].key, '기관명');
    assert.equal(uploadedTemplate.template.ready, true);
    const uploadedTemplates = await fetch(`${runtime.url}/api/document-templates`).then((response) => response.json());
    assert.equal(uploadedTemplates.uploadedTemplates[0].ready, true);
    const filledTemplate = await fetch(`${runtime.url}/api/document-templates/${encodeURIComponent(uploadedTemplate.template.id)}/render`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields: { 기관명: '합성 기관' } }) });
    assert.equal(filledTemplate.status, 200);
    assert.equal((await filledTemplate.arrayBuffer()).byteLength > 5000, true);
    const customDraft = { templateId: uploadedTemplate.template.id, title: '기관 양식 결과', fields: { 기관명: '합성 기관' }, sections: [{ id: '기관명', heading: '기관명', content: '합성 기관' }], missing: [], sourceType: '직접 입력', generatedAt: new Date().toISOString(), templateLabel: '기관양식.docx' };
    const customDocument = await fetch(`${runtime.url}/api/documents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId: customDraft.templateId, title: customDraft.title, payload: customDraft }) }).then((response) => response.json());
    const customExport = await fetch(`${runtime.url}/api/documents/${customDocument.document.id}/export?format=docx`);
    assert.equal(customExport.status, 200);
    assert.equal((await customExport.arrayBuffer()).byteLength > 5000, true);
    const preview = await fetch(`${runtime.url}/api/documents/preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId: 'business-plan', fields: { organizationName: '합성 기관', businessName: '주거지원', period: '2026년', target: '합성 가구', necessity: '합성 필요성', goals: '목표', activities: '활동', indicators: '지표' } }) }).then((response) => response.json());
    assert.equal(preview.draft.title, '주거지원 사업기획서');
    const savedDocument = await fetch(`${runtime.url}/api/documents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId: preview.draft.templateId, title: preview.draft.title, payload: preview.draft }) }).then((response) => response.json());
    assert.ok(savedDocument.document.id);
    const documents = await fetch(`${runtime.url}/api/documents`).then((response) => response.json());
    assert.equal(documents.documents.length, 2);
    const docx = await fetch(`${runtime.url}/api/documents/${savedDocument.document.id}/export?format=docx`);
    assert.equal(docx.status, 200);
    assert.equal(docx.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal((await docx.arrayBuffer()).byteLength > 5000, true);
  } finally {
    await new Promise((resolve) => runtime.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('unresponsive local model returns a usable local fallback instead of hanging', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-ollama-fallback-'));
  const runtime = await startServer({ port: 0, dataDir, ollamaTimeoutMs: 5 });
  try {
    const response = await fetch(`${runtime.url}/api/process`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'counseling', provider: 'ollama-local', model: 'gemma2:9b', rawText: '친모가 주거 지원을 신청하기로 함.' }) });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.provider, 'rules-fallback');
    assert.equal(payload.fallback.used, true);
    assert.ok(['ollama_timeout', 'ollama_unavailable'].includes(payload.fallback.reason));
    assert.match(payload.draft.counselingLog, /주거/);
  } finally {
    await new Promise((resolve) => runtime.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
