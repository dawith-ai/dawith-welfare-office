import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { Document, Paragraph, Packer } from 'docx';
import { startServer } from '../server.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = path.join(root, 'dist', 'proof-v0.2.5');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-proof-'));
const synthetic = {
  counseling: '합성 내담자는 2026년 11월 이사를 앞두고 있으며 주거비 부담과 자녀의 학교 적응을 걱정함. 담당자는 임대주택 신청 자격과 지역 아동 지원 서비스를 확인하기로 함.',
  meeting: '사례회의에서 합성 가구의 주거 지원을 논의함. 김담당자는 11월 5일까지 임대주택 신청 자격을 확인하고 이팀장은 학교 상담 연계를 검토하기로 결정함.',
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, options);
  const contentType = response.headers.get('content-type') || '';
  const value = contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${route} ${response.status} ${JSON.stringify(value)}`);
  return value;
}

function write(name, data) {
  const target = path.join(outputDir, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  return { name, bytes: Buffer.byteLength(data), sha256: sha256(data) };
}

const runtime = await startServer({ port: 0, dataDir });
const base = runtime.url;
const files = [];
const checks = [];
try {
  fs.mkdirSync(outputDir, { recursive: true });
  const health = await request(base, '/api/health');
  checks.push({ check: 'local boundary', pass: health.mode === 'local-only' && health.externalProviders === 'blocked' });
  const createdCase = await request(base, '/api/cases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: '합성 사례 · 결과 검증' }) });

  const counseling = await request(base, '/api/process', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'counseling', provider: 'rules', caseId: createdCase.case.id, rawText: synthetic.counseling, contextText: '합성 한부모 가구' }) });
  const savedCounseling = await request(base, '/api/records', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId: createdCase.case.id, kind: 'counseling', provider: 'rules', rawText: synthetic.counseling, contextText: '합성 한부모 가구', draft: counseling.draft }) });
  const counselingJson = await request(base, `/api/records/${savedCounseling.saved.id}/export?format=json`);
  const counselingMarkdown = await request(base, `/api/records/${savedCounseling.saved.id}/export?format=markdown`);
  const counselingHtml = await request(base, `/api/records/${savedCounseling.saved.id}/export?format=html`);
  files.push(write('01-counseling-record.json', JSON.stringify(counselingJson, null, 2)));
  files.push(write('01-counseling-record.md', counselingMarkdown));
  files.push(write('01-counseling-record.html', counselingHtml));
  checks.push({ check: 'counseling draft and exports', pass: counseling.draft.facts.topics.includes('주거') && counselingMarkdown.includes('주거') && counselingHtml.includes('검토') });

  const meeting = await request(base, '/api/process', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'meeting', provider: 'rules', caseId: createdCase.case.id, rawText: synthetic.meeting }) });
  const savedMeeting = await request(base, '/api/records', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId: createdCase.case.id, kind: 'meeting', provider: 'rules', rawText: synthetic.meeting, draft: meeting.draft }) });
  const meetingMarkdown = await request(base, `/api/records/${savedMeeting.saved.id}/export?format=markdown`);
  files.push(write('02-meeting-minutes.md', meetingMarkdown));
  checks.push({ check: 'meeting decisions and actions', pass: meeting.draft.assessment.includes('논의 및 결정사항') && meeting.draft.servicePlan.includes('후속 실행 항목') });

  const businessPlan = await request(base, '/api/documents/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId: 'business-plan', fields: { organizationName: '합성 사회복지관', businessName: '주거안정 지원사업', period: '2026년 11월', target: '주거취약 합성 가구', necessity: '합성 상담기록에서 주거비 부담과 이사 예정 사실을 확인하였다.', goals: '임대주택 신청 자격 1회 확인\n지역 아동 지원서비스 1건 연계', activities: '신청 자격 및 필요 서류 안내\n학교 상담 연계 검토', schedule: '2026년 11월 5일까지', budget: '합성 예산 1,000,000원', indicators: '자격 확인 완료 여부\n서비스 연계 여부', notes: '담당자 최종 검토 필요' }, source: { rawText: synthetic.counseling, draft: counseling.draft } }) });
  const savedBusinessPlan = await request(base, '/api/documents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId: businessPlan.draft.templateId, title: businessPlan.draft.title, payload: businessPlan.draft }) });
  const businessDocx = await request(base, `/api/documents/${savedBusinessPlan.document.id}/export?format=docx`);
  files.push(write('03-business-plan.docx', businessDocx));
  const businessZip = await JSZip.loadAsync(businessDocx);
  const businessXml = await businessZip.file('word/document.xml').async('text');
  checks.push({ check: 'business plan DOCX export', pass: businessXml.includes('주거안정 지원사업') && businessXml.includes('합성 사회복지관') });

  const uploadedTemplate = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('기관명: {{기관명}}'), new Paragraph('사업명: {{사업명}}'), new Paragraph('추진내용: {{추진내용}}')] }] }));
  const uploaded = await request(base, '/api/document-templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName: '합성기관-공식양식.docx', dataBase64: uploadedTemplate.toString('base64') }) });
  const filled = await request(base, `/api/document-templates/${encodeURIComponent(uploaded.template.id)}/render`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields: { 기관명: '합성 사회복지관', 사업명: '주거안정 지원사업', 추진내용: '임대주택 자격 확인 및 학교 상담 연계' } }) });
  files.push(write('04-institution-template-filled.docx', filled));
  const filledZip = await JSZip.loadAsync(filled);
  const filledXml = await filledZip.file('word/document.xml').async('text');
  checks.push({ check: 'institution DOCX template fill', pass: uploaded.analysis.ready && filledXml.includes('합성 사회복지관') && filledXml.includes('학교 상담 연계') });

  const audit = await request(base, '/api/audit?limit=100');
  files.push(write('05-audit-metadata.json', JSON.stringify(audit, null, 2)));
  checks.push({ check: 'metadata-only audit', pass: audit.events.some((event) => event.eventType === 'record_created') && !JSON.stringify(audit).includes(synthetic.counseling) });
  const manifest = { generatedAt: new Date().toISOString(), mode: 'synthetic-local-proof', runtime: base, files, checks, allPassed: checks.every((item) => item.pass) };
  files.push(write('manifest.json', JSON.stringify(manifest, null, 2)));
  write('README.md', `# Dawith Welfare Office v0.2.5 실제 결과 검증\n\n합성 데이터만 사용한 로컬 API 결과물입니다.\n\n- 상담기록: 01-counseling-record.*\n- 회의록: 02-meeting-minutes.md\n- 사업기획서: 03-business-plan.docx\n- 기관 양식 작성본: 04-institution-template-filled.docx\n- 감사 메타데이터: 05-audit-metadata.json\n- 검증 매니페스트: manifest.json\n\n전체 검증: ${manifest.allPassed ? 'PASS' : 'FAIL'}\n`);
  console.log(JSON.stringify({ outputDir, files, checks, allPassed: manifest.allPassed }, null, 2));
} finally {
  await new Promise((resolve) => runtime.server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
}
