import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import { buildRuleSummary, buildSummaryPrompt, normalizeSummary, parseSummaryReply, summaryToLegacyDraft } from '../src/record-summary.mjs';
import { summaryToDocx } from '../src/document-export.mjs';
import { startServer } from '../server.mjs';

const counselingText = '3월 12일 내담자는 월세가 두 달 밀려 퇴거가 걱정된다고 호소함. 자녀 양육은 꾸준히 하고 있으며 취업 의지가 있음. 주거급여 신청 절차를 안내하였음. 다음 주에 주민센터와 연계하여 신청서류를 확인하기로 함.';
const meetingText = '일시: 11월 10일 오후 2시\n장소: 2층 회의실\n참석자: 김팀장, 이사회복지사, 박간호사\n안건: 독거 어르신 겨울철 안부 확인\n어르신 12가구의 난방 상태를 점검함. 방문 횟수를 주 2회로 늘리기로 결정함. 이사회복지사가 11월 15일까지 대상 명단을 정리함.';

test('rule engine splits a counseling memo into the five 상담 sections', () => {
  const summary = buildRuleSummary({ kind: 'counseling', rawText: counselingText, contextText: '가정방문' });
  assert.equal(summary.kind, 'counseling');
  assert.match(summary.overview, /3월 12일/);
  assert.match(summary.overview, /가정방문/);
  assert.match(summary.complaint, /퇴거가 걱정/);
  assert.match(summary.assessment.strengths, /취업 의지/);
  assert.match(summary.assessment.risks, /밀려|퇴거/);
  assert.match(summary.intervention, /안내하였음/);
  assert.doesNotMatch(summary.intervention, /다음 주/);
  assert.match(summary.plan, /주민센터/);
});

test('rule engine builds 회의 개요, decisions and an owner/due action table', () => {
  const summary = buildRuleSummary({ kind: 'meeting', rawText: meetingText });
  assert.deepEqual(summary.overview, { datetime: '11월 10일 오후 2시', place: '2층 회의실', attendees: '김팀장, 이사회복지사, 박간호사', agenda: '독거 어르신 겨울철 안부 확인' });
  assert.match(summary.decisions, /주 2회/);
  assert.doesNotMatch(summary.discussion, /장소:/);
  const listing = summary.actions.find((item) => item.task.includes('명단'));
  assert.equal(listing.owner, '이사회복지사');
  assert.equal(listing.due, '11월 15일까지');
});

test('summary prompt asks for JSON in the section schema and carries the text verbatim', () => {
  const meeting = buildSummaryPrompt({ kind: 'meeting', rawText: meetingText, contextText: '통합사례회의' });
  assert.match(meeting, /JSON 객체 하나만/);
  for (const key of ['"overview"', '"datetime"', '"attendees"', '"decisions"', '"actions"', '"owner"', '"due"']) assert.ok(meeting.includes(key), key);
  assert.ok(meeting.includes(meetingText));
  assert.ok(meeting.includes('통합사례회의'));
  const counseling = buildSummaryPrompt({ kind: 'counseling', rawText: '합성 원문' });
  for (const key of ['"complaint"', '"needs"', '"strengths"', '"risks"', '"intervention"', '"plan"']) assert.ok(counseling.includes(key), key);
  assert.match(counseling, /\[확인 필요\]/);
});

test('reply parser tolerates fences, prose, nested Codex text and Korean keys', () => {
  const fenced = parseSummaryReply('다음은 결과입니다.\n```json\n{"overview":{"datetime":"11월 10일"},"discussion":["난방 점검","방문 확대"],"decisions":"주 2회 방문","actions":[{"task":"명단 정리","owner":"이사회복지사","due":"11/15"},"2. 보호자 연락"]}\n```\n확인 바랍니다.', 'meeting');
  assert.equal(fenced.overview.datetime, '11월 10일');
  assert.equal(fenced.discussion, '1. 난방 점검\n2. 방문 확대');
  assert.deepEqual(fenced.actions[0], { task: '명단 정리', owner: '이사회복지사', due: '11/15' });
  assert.equal(fenced.actions[1].task, '보호자 연락');

  const nested = parseSummaryReply(JSON.stringify({ text: JSON.stringify({ overview: '개요', complaint: '호소', assessment: { needs: '욕구' }, plan: ['다음 주 방문'] }) }), 'counseling');
  assert.equal(nested.complaint, '호소');
  assert.equal(nested.assessment.needs, '욕구');
  assert.equal(nested.plan, '다음 주 방문');

  const korean = parseSummaryReply('{"상담 개요":"가정방문","주요 호소":"주거비","향후 계획":"신청 지원"}', 'counseling');
  assert.equal(korean.overview, '가정방문');
  assert.equal(korean.plan, '신청 지원');

  assert.equal(parseSummaryReply('죄송합니다. 요청을 처리할 수 없습니다.', 'counseling'), null);
  assert.equal(parseSummaryReply('{"unrelated": true}', 'meeting'), null);
  assert.equal(parseSummaryReply('', 'meeting'), null);
});

test('normalized summaries map to legacy record fields and a Word document with a 할 일 table', async () => {
  const summary = normalizeSummary({ overview: { datetime: '11월 10일', place: '회의실', attendees: '김팀장', agenda: '안부 확인' }, discussion: '논의', decisions: '결정', actions: [{ task: '명단 정리', owner: '이사회복지사', due: '11/15' }] }, 'meeting');
  const legacy = summaryToLegacyDraft(summary);
  assert.equal(legacy.typeLabel, '회의록');
  assert.match(legacy.servicePlan, /담당: 이사회복지사/);
  const buffer = await summaryToDocx(summary, { organization: '합성 복지관', author: '김담당' });
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  assert.match(xml, /<w:tbl>/);
  assert.match(xml, /명단 정리/);
  assert.match(xml, /합성 복지관/);
});

async function withServer(options, run) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-summary-'));
  const runtime = await startServer({ port: 0, dataDir, ...options });
  try { await run(runtime.url); }
  finally {
    await new Promise((resolve) => runtime.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

const post = (url, payload, headers = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload) });

test('/api/process returns structured summaries for the rule engine and keeps legacy fields', async () => {
  await withServer({}, async (url) => {
    const response = await post(`${url}/api/process`, { kind: 'meeting', provider: 'rules', rawText: meetingText });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.engine, 'rules');
    assert.equal(payload.summary.overview.place, '2층 회의실');
    assert.equal(payload.draft.typeLabel, '회의록');
    assert.deepEqual(payload.transfer, { external: false, destination: 'local machine' });
    const crossOrigin = await post(`${url}/api/process`, { kind: 'meeting', provider: 'rules', rawText: meetingText }, { Origin: 'https://example.invalid' });
    assert.equal(crossOrigin.status, 403);
  });
});

test('/api/process is local only: cloud providers are refused before anything is sent', async () => {
  await withServer({}, async (url) => {
    for (const provider of ['cloud:codex', 'cloud:openrouter', 'openrouter', 'chatgpt']) {
      const response = await post(`${url}/api/process`, { kind: 'counseling', provider, rawText: '합성 원문', confirmExternal: true });
      assert.equal(response.status, 400, provider);
      assert.equal((await response.json()).error, 'external_provider_blocked');
    }
  });
});

test('local Ollama summaries stay on loopback and fall back with a reason when unavailable', async () => {
  const requests = [];
  const ollama = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: { content: JSON.stringify({ overview: '가정방문 상담', complaint: '주거비 부담', assessment: { needs: '주거 지원', strengths: '취업 의지', risks: '체납' }, intervention: '주거급여 안내', plan: '다음 주 주민센터 연계' }) } }));
  });
  await new Promise((resolve) => ollama.listen(0, '127.0.0.1', resolve));
  const ollamaBaseUrl = `http://127.0.0.1:${ollama.address().port}`;
  try {
    await withServer({ ollamaBaseUrl }, async (url) => {
      const payload = await post(`${url}/api/process`, { kind: 'counseling', provider: 'ollama-local', model: 'qwen2.5:3b', rawText: counselingText }).then((item) => item.json());
      assert.equal(payload.engine, 'ollama');
      assert.equal(payload.summary.assessment.strengths, '취업 의지');
      assert.equal(payload.transfer.external, false);
      assert.equal(requests[0].model, 'qwen2.5:3b');
      assert.ok(requests[0].messages[1].content.includes(counselingText));
      const unknownModel = await post(`${url}/api/process`, { kind: 'counseling', provider: 'ollama-local', model: 'https://evil/model', rawText: counselingText }).then((item) => item.json());
      assert.equal(unknownModel.engine, 'ollama');
      assert.equal(requests[1].model, 'qwen2.5:7b');
    });
  } finally {
    await new Promise((resolve) => ollama.close(resolve));
  }
  await withServer({ ollamaBaseUrl }, async (url) => {
    const payload = await post(`${url}/api/process`, { kind: 'meeting', provider: 'ollama-local', rawText: meetingText }).then((item) => item.json());
    assert.equal(payload.engine, 'rules');
    assert.equal(payload.fallback.reason, 'ollama_unavailable');
    assert.match(payload.fallback.message, /Ollama가 실행 중이 아니어서/);
    assert.equal(payload.summary.overview.place, '2층 회의실');
  });
  assert.throws(() => startServer({ ollamaBaseUrl: 'http://example.com:11434' }), /ollama_must_be_loopback/);
});

test('/api/summary/export returns an editable Word file', async () => {
  await withServer({}, async (url) => {
    const summary = buildRuleSummary({ kind: 'counseling', rawText: counselingText });
    const response = await post(`${url}/api/summary/export`, { kind: 'counseling', summary });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    assert.match(await zip.file('word/document.xml').async('string'), /주요 호소/);
  });
});
