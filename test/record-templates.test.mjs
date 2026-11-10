import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import { buildTemplatePrompt, buildTemplateRuleSummary, formFieldValues, matchPlaceholder, normalizeTemplate, parseTemplateReply, sectionRole } from '../src/record-templates.mjs';
import { renderTemplate } from '../src/template-engine.mjs';
import { startServer } from '../server.mjs';

const memo = '3월 12일 가정방문 상담. 내담자는 표정이 어둡고 말수가 적었음. 집 안은 정돈되어 있었음. 내담자는 월세가 두 달 밀려 퇴거가 걱정된다고 호소함. 자녀 양육은 꾸준히 하고 있으며 취업 의지가 있음. 주거급여 신청 절차를 안내하였음. 다음 주에 주민센터와 연계하여 신청서류를 확인하기로 함.';
const meetingMemo = '일시: 11월 10일 오후 2시\n장소: 2층 회의실\n참석자: 김팀장, 이사회복지사, 박간호사\n안건: 독거 어르신 겨울철 안부 확인\n어르신 12가구의 난방 상태를 점검함. 방문 횟수를 주 2회로 늘리기로 결정함. 이사회복지사가 11월 15일까지 대상 명단을 정리함.';
const observation = { name: '관찰·상담·소견형', kind: 'counseling', sections: [{ name: '관찰사항' }, { name: '상담내용' }, { name: '상담원 소견' }, { name: '향후 계획' }] };
const content = (summary, name) => summary.sections.find((section) => section.name === name).content;

test('templates are validated: names cleaned, duplicates and empties dropped', () => {
  const template = normalizeTemplate({ name: '  내 양식 ', kind: 'weird', sections: [{ name: ' 관찰{{사항}} ', guide: '표정\n태도' }, { name: '관찰 사항' }, { name: '' }, '향후 계획'] });
  assert.deepEqual(template, { name: '내 양식', kind: 'counseling', sections: [{ name: '관찰사항', guide: '표정 태도' }, { name: '향후 계획', guide: '' }] });
  assert.equal(normalizeTemplate({ sections: [] }), null);
  assert.equal(normalizeTemplate(null), null);
  assert.equal(sectionRole({ name: '상담원 소견' }), 'opinion');
  assert.equal(sectionRole({ name: '개입 내용' }), 'intervention');
  assert.equal(sectionRole({ name: '논의 내용' }), 'discussion');
  assert.equal(sectionRole({ name: '역할 분담' }), 'actions');
  assert.equal(sectionRole({ name: '종교 활동' }), 'unknown');
});

test('rule engine fills exactly the chosen sections of 관찰·상담·소견형', () => {
  const summary = buildTemplateRuleSummary({ template: observation, rawText: memo });
  assert.equal(summary.kind, 'template');
  assert.deepEqual(summary.sections.map((section) => section.name), ['관찰사항', '상담내용', '상담원 소견', '향후 계획']);
  assert.match(content(summary, '관찰사항'), /표정이 어둡고/);
  assert.match(content(summary, '관찰사항'), /정돈/);
  assert.doesNotMatch(content(summary, '관찰사항'), /월세/);
  assert.match(content(summary, '상담내용'), /퇴거가 걱정/);
  assert.match(content(summary, '상담내용'), /안내하였음/);
  assert.doesNotMatch(content(summary, '상담내용'), /표정/);
  assert.match(content(summary, '상담원 소견'), /담당자가 작성/);
  assert.match(content(summary, '상담원 소견'), /위험 단서: .*퇴거/);
  assert.match(content(summary, '향후 계획'), /주민센터/);
  assert.deepEqual(summary.unassigned, []);
  assert.equal(summary.meta.date, '3월 12일');
});

test('custom sections get topic sentences or an explicit hint, and leftovers are reported', () => {
  const summary = buildTemplateRuleSummary({ template: { name: '내 양식', sections: [{ name: '경제 상황' }, { name: '가족 관계' }, { name: '종교 활동' }] }, rawText: memo });
  assert.match(content(summary, '경제 상황'), /월세/);
  assert.match(content(summary, '가족 관계'), /자녀 양육/);
  assert.match(content(summary, '종교 활동'), /\[확인 필요\].*'종교 활동' 관련 내용을 찾지 못했습니다/);
  assert.ok(summary.unassigned.some((line) => line.includes('표정')));
});

test('meeting templates fill overview, decisions and owner/due action lines', () => {
  const summary = buildTemplateRuleSummary({ template: { name: '일반 회의록', kind: 'meeting', sections: [{ name: '회의 개요' }, { name: '논의 내용' }, { name: '결정 사항' }, { name: '할 일' }] }, rawText: meetingMemo });
  assert.match(content(summary, '회의 개요'), /장소: 2층 회의실/);
  assert.match(content(summary, '회의 개요'), /참석자: 김팀장, 이사회복지사, 박간호사/);
  assert.match(content(summary, '논의 내용'), /난방 상태/);
  assert.match(content(summary, '결정 사항'), /주 2회/);
  assert.match(content(summary, '할 일'), /명단을 정리함\. \(담당: 이사회복지사, 기한: 11월 15일까지\)/);
  assert.doesNotMatch(content(summary, '할 일'), /주 2회/);
  assert.equal(summary.meta.place, '2층 회의실');
});

test('template prompt asks for JSON keyed by the chosen section names', () => {
  const prompt = buildTemplatePrompt({ template: { name: '우리 상담일지', sections: [{ name: '관찰사항', guide: '표정과 태도' }, { name: '건강 상태' }, { name: '상담원 소견' }] }, rawText: memo, contextText: '2회기' });
  assert.match(prompt, /JSON 객체 하나만/);
  assert.match(prompt, /키는 아래 항목 이름을 글자 그대로/);
  assert.ok(prompt.includes('"관찰사항": "표정과 태도"'));
  assert.ok(prompt.includes('"건강 상태": "건강 상태에 해당하는 내용"'));
  assert.ok(prompt.includes('"상담원 소견": "원문 근거를 밝힌'));
  assert.ok(prompt.includes(memo));
  assert.ok(prompt.includes('우리 상담일지'));
  assert.ok(!prompt.includes('"overview"'));
});

test('template replies are parsed from JSON, fenced JSON, paraphrased keys or plain headings', () => {
  const json = parseTemplateReply('결과입니다.\n```json\n{"관찰 사항":"표정이 어두움","상담 내용":["월세 체납","퇴거 걱정"],"소견":"주거 위기 단서","기타":"무시"}\n```', observation);
  assert.equal(content(json, '관찰사항'), '표정이 어두움');
  assert.equal(content(json, '상담내용'), '1. 월세 체납\n2. 퇴거 걱정');
  assert.equal(content(json, '상담원 소견'), '주거 위기 단서');
  assert.equal(content(json, '향후 계획'), '[확인 필요]');

  const nested = parseTemplateReply(JSON.stringify({ result: JSON.stringify({ 향후계획: '다음 주 연계' }) }), observation);
  assert.equal(content(nested, '향후 계획'), '다음 주 연계');

  const headings = parseTemplateReply('## 관찰사항\n표정이 어두움\n집이 정돈됨\n\n**상담원 소견**: 주거 지원 필요\n향후 계획: 다음 주 주민센터 연계', observation);
  assert.equal(content(headings, '관찰사항'), '표정이 어두움\n집이 정돈됨');
  assert.equal(content(headings, '상담원 소견'), '주거 지원 필요');
  assert.equal(content(headings, '향후 계획'), '다음 주 주민센터 연계');

  assert.equal(parseTemplateReply('죄송합니다. 처리할 수 없습니다.', observation), null);
  assert.equal(parseTemplateReply('{"unrelated": "x"}', observation), null);
  assert.equal(parseTemplateReply('', observation), null);
});

test('placeholders map to sections, header fields, fuzzy names or nothing', () => {
  const names = ['관찰사항', '상담원 소견'];
  assert.deepEqual(matchPlaceholder('관찰 사항', names), { type: 'section', name: '관찰사항', label: '관찰사항' });
  assert.equal(matchPlaceholder('상담원', names).key, 'author');
  assert.equal(matchPlaceholder('소견', names).name, '상담원 소견');
  assert.equal(matchPlaceholder('상담일', names).key, 'date');
  assert.equal(matchPlaceholder('기관명', names).key, 'organization');
  assert.equal(matchPlaceholder('대상자', names), null);
  const { fields, report } = formFieldValues(['관찰사항', '상담일', '기관명', '대상자', '장소'], { sections: [{ name: '관찰사항', content: '표정 어두움' }], header: { organization: '다위복지관', date: '2026. 3. 12.' }, extra: { 대상자: '김○○' } });
  assert.deepEqual(fields, { 관찰사항: '표정 어두움', 상담일: '2026. 3. 12.', 기관명: '다위복지관', 대상자: '김○○' });
  assert.deepEqual(report.map((item) => item.filled), [true, true, true, true, false]);
});

function formDocx() {
  const row = (label, value) => new TableRow({ children: [new TableCell({ children: [new Paragraph(label)] }), new TableCell({ children: [new Paragraph(value)] })] });
  const document = new Document({ sections: [{ children: [
    new Paragraph({ children: [new TextRun('{{기관명}} 상담일지 ({{상'), new TextRun({ text: '담일}})', bold: true })] }),
    new Table({ rows: [row('관찰사항', '{{관찰사항}}'), row('상담원 소견', '{{상담원 소견}}'), row('대상자', '{{대상자}}')] }),
  ] }] });
  return Packer.toBuffer(document);
}

const documentText = async (buffer) => (await (await JSZip.loadAsync(buffer)).file('word/document.xml').async('string')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('DOCX placeholders are filled in place, including ones split across runs and multi-line values', async () => {
  const output = await renderTemplate({ fileName: 'form.docx', data: await formDocx(), fields: { 기관명: '다위복지관', 상담일: '3월 12일', 관찰사항: '1. 표정이 어두움\n2. 집이 정돈됨', '상담원 소견': '주거 지원 <필요> & 연계' } });
  const text = await documentText(output);
  assert.match(text, /다위복지관 상담일지 \( 3월 12일 \)|다위복지관 상담일지 \(3월 12일\)/);
  assert.match(text, /1\. 표정이 어두움 2\. 집이 정돈됨/);
  assert.match(text, /주거 지원 &lt;필요&gt; &amp; 연계/);
  assert.match(text, /\{\{대상자\}\}/);
  const xml = await (await JSZip.loadAsync(output)).file('word/document.xml').async('string');
  assert.match(xml, /<w:br\/>/);
});

async function withServer(options, run) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-template-'));
  const runtime = await startServer({ port: 0, dataDir, ...options });
  try { await run(runtime.url); }
  finally {
    await new Promise((resolve) => runtime.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}
const post = (url, payload) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

test('/api/process fills custom template sections with rules and with local Ollama JSON', async () => {
  const requests = [];
  const ollama = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: { content: '{"관찰사항":"표정이 어두움","상담내용":"월세 체납 호소","상담원 소견":"주거 위기 단서가 있음","향후 계획":"다음 주 연계"}' } }));
  });
  await new Promise((resolve) => ollama.listen(0, '127.0.0.1', resolve));
  try {
    await withServer({ ollamaBaseUrl: `http://127.0.0.1:${ollama.address().port}` }, async (url) => {
      const rules = await post(`${url}/api/process`, { provider: 'rules', rawText: memo, template: observation }).then((item) => item.json());
      assert.equal(rules.kind, 'template');
      assert.equal(rules.engine, 'rules');
      assert.match(content(rules.summary, '관찰사항'), /표정/);
      const local = await post(`${url}/api/process`, { provider: 'ollama-local', model: 'qwen2.5:3b', rawText: memo, template: observation }).then((item) => item.json());
      assert.equal(local.engine, 'ollama');
      assert.equal(content(local.summary, '상담원 소견'), '주거 위기 단서가 있음');
      assert.equal(local.summary.meta.date, '3월 12일');
      assert.deepEqual(local.transfer, { external: false, destination: 'local machine' });
      assert.ok(requests[0].messages[1].content.includes('"상담원 소견"'));
      const invalid = await post(`${url}/api/process`, { provider: 'rules', rawText: memo, template: { sections: [] } });
      assert.equal(invalid.status, 400);
      assert.equal((await invalid.json()).error, 'template_invalid');
    });
  } finally {
    await new Promise((resolve) => ollama.close(resolve));
  }
});

test('/api/record-form inspects and fills an uploaded DOCX form and reports what is missing', async () => {
  await withServer({}, async (url) => {
    const dataBase64 = (await formDocx()).toString('base64');
    const inspected = await post(`${url}/api/record-form/inspect`, { fileName: '상담일지.docx', dataBase64, sectionNames: ['관찰사항', '상담원 소견'] }).then((item) => item.json());
    assert.deepEqual(inspected.placeholders.map((item) => [item.token, item.source?.label || null]), [['기관명', '기관명'], ['상담일', '날짜'], ['관찰사항', '관찰사항'], ['상담원 소견', '상담원 소견'], ['대상자', null]]);
    const summary = { kind: 'template', templateName: '관찰·상담·소견형', sections: [{ name: '관찰사항', content: '표정이 어두움' }, { name: '상담원 소견', content: '주거 위기' }] };
    const filled = await post(`${url}/api/record-form/fill`, { fileName: '상담일지.docx', dataBase64, summary, header: { organization: '다위복지관', date: '3월 12일' } }).then((item) => item.json());
    assert.equal(filled.fileName, '상담일지_작성본.docx');
    assert.deepEqual(filled.missing, ['대상자']);
    assert.deepEqual(filled.filled.map((item) => item.token).sort(), ['관찰사항', '기관명', '상담원 소견', '상담일'].sort());
    const text = await documentText(Buffer.from(filled.dataBase64, 'base64'));
    assert.match(text, /표정이 어두움/);
    assert.match(text, /다위복지관/);
    const typed = await post(`${url}/api/record-form/fill`, { fileName: '상담일지.docx', dataBase64, summary, header: {}, extra: { 대상자: '김○○' } }).then((item) => item.json());
    assert.ok(!typed.missing.includes('대상자'));
    const hwp = await post(`${url}/api/record-form/inspect`, { fileName: 'form.hwp', dataBase64 });
    assert.equal(hwp.status, 400);
    const starter = await post(`${url}/api/record-form/starter`, { template: observation });
    assert.equal(starter.status, 200);
    assert.match(await documentText(Buffer.from(await starter.arrayBuffer())), /\{\{상담원 소견\}\}.*\{\{상담일\}\}/);
  });
});

test('HWPX forms get their placeholders replaced with 한글 line breaks', async () => {
  const module = await import('../public/vendor/rhwp/rhwp.js');
  await module.default({ module_or_path: fs.readFileSync(new URL('../public/vendor/rhwp/rhwp_bg.wasm', import.meta.url)) });
  const document = module.HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, '기관: {{기관명}}\n관찰: {{관찰사항}}');
  const bytes = Buffer.from(document.exportHwpx());
  document.free();
  const output = await renderTemplate({ fileName: 'form.hwpx', data: bytes, fields: { 기관명: '다위 & 복지관', 관찰사항: '첫째 줄\n둘째 줄' } });
  const section = await (await JSZip.loadAsync(output)).file('Contents/section0.xml').async('string');
  assert.match(section, /다위 &amp; 복지관/);
  assert.match(section, /첫째 줄<hp:lineBreak\/>둘째 줄/);
  const reloaded = new module.HwpDocument(new Uint8Array(output));
  const text = JSON.parse(reloaded.getTextFileUnicode?.() || reloaded.getTextFileText());
  assert.match(typeof text === 'string' ? text : text.text || text.value, /관찰: 첫째 줄\n둘째 줄/);
  reloaded.free();
});
