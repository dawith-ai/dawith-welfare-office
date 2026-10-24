import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildDrafts, buildOllamaPrompt, parseOllamaDraft } from './src/processing.mjs';
import { openStore } from './src/storage.mjs';
import { getCapabilities, whisperConfiguration } from './src/capabilities.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const defaultPort = Number(process.env.PORT || 4387);
const defaultDataDir = process.env.WELFARE_DATA_DIR || path.join(root, '.data');

const json = (response, status, body, extraHeaders = {}) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  response.end(JSON.stringify(body));
};

const body = async (request, limit = 8 * 1024 * 1024) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

const safeJson = (value) => (typeof value === 'object' && value !== null ? value : {});

async function ollamaDraft(input) {
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model: input.model || 'gemma2:9b',
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: '개인정보를 외부로 전송하지 않는 기관 PC의 로컬 모델입니다. 입력 사실을 만들지 말고 JSON만 반환하세요.' },
        { role: 'user', content: buildOllamaPrompt(input) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`ollama_http_${response.status}`);
  const payload = await response.json();
  return payload.message?.content || '';
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const type = extension === '.css' ? 'text/css; charset=utf-8' : extension === '.js' ? 'text/javascript; charset=utf-8' : extension === '.svg' ? 'image/svg+xml' : 'text/html; charset=utf-8';
  response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(filePath).pipe(response);
}

function runWhisper(inputPath, outputBase, config) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.binary, ['-m', config.model, '-f', inputPath, '-otxt', '-of', outputBase, '-l', 'ko', '-np', '-nt'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', (chunk) => { error += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve(`${outputBase}.txt`) : reject(new Error(`whisper_exit_${code}:${error.slice(-500)}`)));
  });
}

async function transcribe(payload, store) {
  const config = whisperConfiguration(store);
  if (!config.binary || !config.model || !fs.existsSync(config.model)) throw new Error('whisper_model_not_configured');
  const name = String(payload.fileName || 'audio').replace(/[^a-zA-Z0-9._-]/g, '_');
  const bytes = Buffer.from(String(payload.dataBase64 || ''), 'base64');
  if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new Error('audio_size_invalid');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-'));
  const inputPath = path.join(tempDir, `${crypto.randomUUID()}-${name}`);
  const outputBase = path.join(tempDir, crypto.randomUUID());
  fs.writeFileSync(inputPath, bytes, { mode: 0o600 });
  try {
    const outputPath = await runWhisper(inputPath, outputBase, config);
    return { text: fs.readFileSync(outputPath, 'utf8').trim(), sourceName: name };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function createServer({ dataDir = defaultDataDir } = {}) {
  const store = openStore(dataDir);
  store.ensureDefaultCase();
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const origin = request.headers.origin;
      if (origin && origin !== 'null' && !/^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin)) return json(response, 403, { error: 'origin_not_allowed' });
      if (url.pathname === '/api/health') return json(response, 200, { ok: true, mode: 'local-only', host: '127.0.0.1', externalProviders: 'blocked' });
      if (url.pathname === '/api/capabilities' && request.method === 'GET') return json(response, 200, await getCapabilities(store));
      if (url.pathname === '/api/cases' && request.method === 'POST') {
        const input = safeJson(await body(request));
        const created = store.createCase({ label: input.label });
        return json(response, 201, { case: created });
      }
      if (url.pathname === '/api/settings' && request.method === 'GET') return json(response, 200, { settings: store.getSettings() });
      if (url.pathname === '/api/settings' && request.method === 'PATCH') {
        const input = safeJson(await body(request));
        const settings = store.updateSettings(input);
        return json(response, 200, { settings });
      }
      if (url.pathname === '/api/cases' && request.method === 'GET') return json(response, 200, { cases: store.listCases() });
      if (url.pathname === '/api/records' && request.method === 'GET') return json(response, 200, { records: store.listRecords({ query: url.searchParams.get('q') || '', kind: url.searchParams.get('kind') || '' }) });
      if (url.pathname === '/api/process' && request.method === 'POST') {
        const input = safeJson(await body(request));
        const rawText = String(input.rawText || '').trim();
        const contextText = String(input.contextText || '').trim();
        const kind = ['counseling', 'meeting', 'audio'].includes(input.kind) ? input.kind : 'counseling';
        const provider = input.provider || 'rules';
        if (!rawText) return json(response, 400, { error: 'raw_text_required' });
        if (!['rules', 'ollama-local'].includes(provider)) return json(response, 400, { error: 'external_provider_blocked', message: '외부 provider는 제품 경계에서 차단되어 있습니다.' });
        const fallback = buildDrafts({ kind, rawText, contextText });
        let draft = fallback;
        if (provider === 'ollama-local') draft = parseOllamaDraft(await ollamaDraft({ kind, rawText, contextText, model: String(input.model || '') }), fallback);
        return json(response, 200, { draft, provider: draft.provider || provider, transfer: { external: false, destination: 'local machine' } });
      }
      if (url.pathname === '/api/records' && request.method === 'POST') {
        const input = safeJson(await body(request));
        if (!String(input.rawText || '').trim() || !input.draft) return json(response, 400, { error: 'record_payload_invalid' });
        const saved = store.saveRecord({ caseId: input.caseId, kind: input.kind || 'counseling', provider: input.provider || 'rules', sourceName: input.sourceName || '', rawText: String(input.rawText), contextText: String(input.contextText || ''), draft: input.draft });
        return json(response, 201, { saved });
      }
      const recordMatch = url.pathname.match(/^\/api\/records\/([^/]+)$/);
      if (recordMatch && request.method === 'GET') {
        const record = store.getRecord(recordMatch[1]);
        return record ? json(response, 200, { record }) : json(response, 404, { error: 'record_not_found' });
      }
      if (recordMatch && request.method === 'PATCH') {
        const input = safeJson(await body(request));
        const record = store.updateRecord(recordMatch[1], input);
        return record ? json(response, 200, { record }) : json(response, 404, { error: 'record_not_found' });
      }
      if (url.pathname === '/api/transcribe' && request.method === 'POST') {
        const result = await transcribe(safeJson(await body(request, 70 * 1024 * 1024)), store);
        return json(response, 200, result);
      }
      const exportMatch = url.pathname.match(/^\/api\/records\/([^/]+)\/export$/);
      if (exportMatch && request.method === 'GET') {
        const record = store.exportRecord(exportMatch[1]);
        if (!record) return json(response, 404, { error: 'record_not_found' });
        const format = url.searchParams.get('format') || 'json';
        if (format === 'markdown') {
          const markdown = recordToMarkdown(record);
          response.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="dawith-record-${record.id}.md"` });
          return response.end(markdown);
        }
        if (format === 'html') {
          const html = recordToHtml(record);
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="dawith-record-${record.id}.html"` });
          return response.end(html);
        }
        return json(response, 200, record, { 'Content-Disposition': `attachment; filename="dawith-record-${record.id}.json"` });
      }
      const relative = url.pathname === '/' ? '/index.html' : url.pathname;
      const publicRoot = path.resolve(path.join(root, 'public'));
      const filePath = path.resolve(path.join(publicRoot, relative.replace(/^\//, '')));
      if (!filePath.startsWith(publicRoot)) return response.writeHead(404).end();
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return sendFile(response, filePath);
      return response.writeHead(404).end('Not found');
    } catch (error) {
      const status = error.message === 'payload_too_large' ? 413 : error.message === 'whisper_model_not_configured' ? 409 : ['case_label_required', 'case_not_found'].includes(error.message) ? 400 : 500;
      return json(response, status, { error: error.message || 'internal_error' });
    }
  });
  server.on('close', () => store.close());
  return { server, store };
}

function recordToMarkdown(record) {
  const draft = record.draft || {};
  return `# ${draft.typeLabel || '복지 기록'}\n\n- 작성일: ${record.createdAt}\n- 처리 방식: ${record.provider}\n- 원본: ${record.sourceName || '직접 입력'}\n\n## 초안\n\n### ${draft.typeLabel || '기록'}\n${draft.counselingLog || ''}\n\n### 사정·논의\n${draft.assessment || ''}\n\n### 서비스계획·후속 실행\n${draft.servicePlan || ''}\n\n### 후속 확인\n${draft.followUp || ''}\n\n## 원문\n\n${record.rawText}\n`;
}

function recordToHtml(record) {
  const escape = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  const draft = record.draft || {};
  return `<!doctype html><meta charset="utf-8"><title>${escape(draft.typeLabel || 'Dawith 복지 기록')}</title><style>body{font-family:Arial,sans-serif;max-width:820px;margin:40px auto;line-height:1.7;color:#26382f}pre{white-space:pre-wrap;background:#f4f7f4;padding:16px;border-radius:8px}h1{color:#1d6a50}</style><h1>${escape(draft.typeLabel || '복지 기록')}</h1><p>작성일: ${escape(record.createdAt)} · 처리 방식: ${escape(record.provider)}</p><h2>초안</h2><h3>기록</h3><pre>${escape(draft.counselingLog)}</pre><h3>사정·논의</h3><pre>${escape(draft.assessment)}</pre><h3>서비스계획·후속 실행</h3><pre>${escape(draft.servicePlan)}</pre><h3>후속 확인</h3><pre>${escape(draft.followUp)}</pre><h2>원문</h2><pre>${escape(record.rawText)}</pre>`;
}

export function startServer({ port = 0, dataDir = defaultDataDir } = {}) {
  const { server } = createServer({ dataDir });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  startServer({ port: defaultPort }).then(({ port }) => {
    console.log(`Dawith Welfare Office: http://127.0.0.1:${port}`);
    console.log(`Local data: ${defaultDataDir}`);
  });
}
