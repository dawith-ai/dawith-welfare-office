import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildDrafts, buildOllamaAssistPrompt, parseOllamaAssist } from './src/processing.mjs';
import { openStore } from './src/storage.mjs';
import { getCapabilities, whisperConfiguration } from './src/capabilities.mjs';
import { buildDocumentDraft, documentTemplates } from './src/documents.mjs';
import { documentToDocx, documentToHtml, documentToMarkdown, recordFormStarterDocx, summaryToDocx } from './src/document-export.mjs';
import { MAX_SUMMARY_INPUT, SUMMARY_KINDS, buildRuleSummary, buildSummaryPrompt, normalizeSummary, parseSummaryReply, summaryToLegacyDraft } from './src/record-summary.mjs';
import { analyzeTemplate, isUploadedTemplateId, renderTemplate, uploadedTemplateId } from './src/template-engine.mjs';
import { buildTemplatePrompt, buildTemplateRuleSummary, extractRecordMeta, formFieldValues, matchPlaceholder, normalizeTemplate, normalizeTemplateSummary, parseTemplateReply } from './src/record-templates.mjs';
import { transcribeAudio } from './src/transcription.mjs';
import { authPolicy, can, createSession, hashPassword, publicUser, roles, validatePassword, validateUsername, verifyPassword } from './src/auth.mjs';
import { createSubscriptionBridge } from './src/subscription.mjs';
import { createAiConnectionManager } from './src/ai-connections.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const defaultPort = Number(process.env.PORT || 4387);
const defaultHost = process.env.WELFARE_BIND_HOST || '127.0.0.1';
const defaultDataDir = process.env.WELFARE_DATA_DIR || path.join(root, '.data');
const defaultOllamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 45000);
const defaultAuthRequired = process.env.WELFARE_AUTH_REQUIRED === '1';
const defaultOllamaUrl = 'http://127.0.0.1:11434';
const localSecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

const isLoopbackAddress = (value) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(String(value || ''));
const isLoopbackHost = (value) => ['127.0.0.1', 'localhost', '::1'].includes(String(value || '').toLowerCase());
const parseCookies = (header = '') => Object.fromEntries(String(header).split(';').map((part) => part.trim().split('='))
  .filter(([key, value]) => key && value).map(([key, value]) => [key, decodeURIComponent(value)]));

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

const binaryBody = async (request, limit = 512 * 1024 * 1024) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

function convertWebmToMp4(input) {
  return new Promise((resolve, reject) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-video-'));
    const inputPath = path.join(tempDir, 'input.webm');
    const outputPath = path.join(tempDir, 'output.mp4');
    fs.writeFileSync(inputPath, input, { mode: 0o600 });
    const cleanup = () => { try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort cleanup */ } };
    const ffmpeg = spawn(process.env.FFMPEG_BIN || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-i', inputPath,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', outputPath,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const errors = [];
    ffmpeg.stderr.on('data', (chunk) => errors.push(chunk));
    ffmpeg.on('error', (error) => { cleanup(); reject(error); });
    ffmpeg.on('close', (code) => {
      if (code !== 0) { cleanup(); reject(new Error(Buffer.concat(errors).toString('utf8').trim() || `ffmpeg_exit_${code}`)); return; }
      try { const output = fs.readFileSync(outputPath); cleanup(); resolve(output); } catch (error) { cleanup(); reject(error); }
    });
  });
}

const safeJson = (value) => (typeof value === 'object' && value !== null ? value : {});
const routeParam = (value) => {
  try { return decodeURIComponent(value); } catch { return value; }
};

async function ollamaSummary(input, timeoutMs = defaultOllamaTimeoutMs, baseUrl = defaultOllamaUrl) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: input.model || 'qwen2.5:7b',
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: '개인정보를 외부로 전송하지 않는 기관 PC의 로컬 모델입니다. 입력 사실을 만들지 말고 JSON만 반환하세요.' },
        { role: 'user', content: input.prompt || buildSummaryPrompt(input) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`ollama_http_${response.status}`);
  const payload = await response.json();
  return payload.message?.content || '';
}

const ollamaFallbackMessages = {
  ollama_unavailable: 'Ollama가 실행 중이 아니어서 규칙으로 정리했습니다. Ollama를 켠 뒤 다시 시도하거나 AI 보조·연결에서 설치 상태를 확인하세요.',
  ollama_http_404: '선택한 로컬 모델이 이 PC에 설치되어 있지 않아 규칙으로 정리했습니다. AI 보조·연결에서 모델을 준비하세요.',
  ollama_timeout: '로컬 모델 응답이 너무 오래 걸려 규칙으로 정리했습니다. 더 작은 모델을 쓰거나 원문을 나눠 보세요.',
  ollama_invalid_result: '로컬 모델 응답을 읽지 못해 규칙으로 정리했습니다. 다시 시도하거나 다른 모델을 선택하세요.',
};

async function ollamaAssist(input, timeoutMs = defaultOllamaTimeoutMs) {
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: input.model || 'qwen2.5:7b',
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: '로컬 PC 안에서만 동작하는 사회복지 행정 문서 보조자입니다. 입력 밖의 사실을 만들지 말고 JSON만 반환하세요.' },
        { role: 'user', content: buildOllamaAssistPrompt(input) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`ollama_http_${response.status}`);
  const payload = await response.json();
  return parseOllamaAssist(payload.message?.content || '');
}

const allowedOllamaModels = new Set(['qwen3:4b', 'qwen3.5:4b-mlx', 'qwen2.5:3b', 'qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:32b', 'gemma3:4b', 'gemma2:2b', 'gemma2:9b', 'llama3.2:1b', 'llama3.2:3b']);
const allowedOllamaAssistTasks = new Set(['text-clean', 'document-draft', 'hwp-summary']);

async function pullOllamaModel(model) {
  const response = await fetch('http://127.0.0.1:11434/api/pull', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(Number(process.env.OLLAMA_PULL_TIMEOUT_MS || 45 * 60 * 1000)),
    body: JSON.stringify({ model, stream: false }),
  });
  if (!response.ok) throw new Error(`ollama_http_${response.status}`);
  return response.json();
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const type = extension === '.css' ? 'text/css; charset=utf-8' : extension === '.js' ? 'text/javascript; charset=utf-8' : extension === '.svg' ? 'image/svg+xml' : extension === '.wasm' ? 'application/wasm' : extension === '.webmanifest' ? 'application/manifest+json' : 'text/html; charset=utf-8';
  response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(filePath).pipe(response);
}

async function transcribe(payload, store) {
  const config = whisperConfiguration(store);
  const name = String(payload.fileName || 'audio.wav');
  const bytes = Buffer.from(String(payload.dataBase64 || ''), 'base64');
  return transcribeAudio({ fileName: name, data: bytes, binary: config.binary, model: config.model });
}

// subscriptionBridge / aiConnectionManager / ollamaBaseUrl are test seams; the
// app always uses the real bridges and the loopback Ollama address.
export function createServer({ dataDir = defaultDataDir, ollamaTimeoutMs = defaultOllamaTimeoutMs, host = defaultHost, authRequired = defaultAuthRequired, encryptionKey, updater = null, onHeartbeat = null, subscriptionBridge = null, aiConnectionManager = null, ollamaBaseUrl = defaultOllamaUrl } = {}) {
  if (!isLoopbackHost(host) && host !== '0.0.0.0' && !authRequired) throw new Error('network_bind_requires_auth');
  if (host === '0.0.0.0' && !authRequired) throw new Error('network_bind_requires_auth');
  if (!isLoopbackHost(new URL(ollamaBaseUrl).hostname)) throw new Error('ollama_must_be_loopback');
  const store = openStore(dataDir, { encryptionKey });
  const sessions = new Map();
  const loginFailures = new Map();
  const subscription = subscriptionBridge || createSubscriptionBridge();
  const aiConnections = aiConnectionManager || createAiConnectionManager({ store });
  const sessionUser = (request) => {
    const token = parseCookies(request.headers.cookie).dawith_session;
    if (!token) return null;
    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    const user = store.getUser(session.username);
    if (!user || user.disabled) {
      sessions.delete(token);
      return null;
    }
    return publicUser(user);
  };
  const setSession = (response, username) => {
    const token = createSession();
    sessions.set(token, { username, expiresAt: Date.now() + authPolicy.sessionHours * 60 * 60 * 1000 });
    response.setHeader('Set-Cookie', `dawith_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${authPolicy.sessionHours * 60 * 60}`);
  };
  const clearSession = (request, response) => {
    const token = parseCookies(request.headers.cookie).dawith_session;
    if (token) sessions.delete(token);
    response.setHeader('Set-Cookie', 'dawith_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  };
  const requireUser = (request, response, requiredRole = 'viewer') => {
    if (!authRequired) return { username: 'local-user', role: 'admin' };
    const user = sessionUser(request);
    if (!user) {
      json(response, 401, { error: 'authentication_required' });
      return null;
    }
    if (!can(user.role, requiredRole)) {
      json(response, 403, { error: 'insufficient_role', requiredRole });
      return null;
    }
    return user;
  };
  const requestRole = (request, url) => {
    if (url.pathname === '/api/audit' || url.pathname === '/api/auth/users') return 'admin';
    if (request.method !== 'GET' && request.method !== 'HEAD') return 'editor';
    return 'viewer';
  };
  store.ensureDefaultCase();
  const server = http.createServer(async (request, response) => {
    for (const [header, value] of Object.entries(localSecurityHeaders)) response.setHeader(header, value);
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const origin = request.headers.origin;
      if (origin) {
        const staticAssetRequest = !url.pathname.startsWith('/api/') && ['GET', 'HEAD'].includes(request.method);
        let sameLocalOrigin = false;
        try {
          const parsedOrigin = new URL(origin);
          sameLocalOrigin = parsedOrigin.protocol === 'http:'
            && parsedOrigin.host === String(request.headers.host || '').toLowerCase()
            && (isLoopbackHost(parsedOrigin.hostname) || authRequired);
        } catch {
          sameLocalOrigin = false;
        }
        // Static assets can be delivered through an HTTPS preview proxy. API requests
        // remain loopback/origin restricted so a preview cannot expose local data.
        if (!sameLocalOrigin && !staticAssetRequest) return json(response, 403, { error: 'origin_not_allowed' });
      }
      if (url.pathname === '/api/health') return json(response, 200, { ok: true, mode: authRequired ? 'institution-network' : 'local-only', host, externalProviders: 'blocked', authentication: authRequired ? 'required' : 'disabled' });
      if (url.pathname === '/api/auth/status' && request.method === 'GET') {
        const user = sessionUser(request);
        return json(response, 200, { required: authRequired, authenticated: Boolean(user), user, needsSetup: authRequired && store.countUsers() === 0, passwordPolicy: { minLength: authPolicy.minPasswordLength } });
      }
      if (url.pathname === '/api/auth/setup' && request.method === 'POST') {
        if (!authRequired) return json(response, 400, { error: 'authentication_not_required' });
        if (store.countUsers() > 0) return json(response, 409, { error: 'admin_already_initialized' });
        if (!isLoopbackAddress(request.socket.remoteAddress)) return json(response, 403, { error: 'initial_setup_must_be_local' });
        const input = safeJson(await body(request, 32 * 1024));
        const username = validateUsername(input.username);
        const password = validatePassword(input.password);
        const user = store.createUser({ username, role: 'admin', passwordHash: hashPassword(password) });
        setSession(response, username);
        return json(response, 201, { user: publicUser(user) });
      }
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        if (!authRequired) return json(response, 400, { error: 'authentication_not_required' });
        const loginKey = String(request.socket.remoteAddress || 'unknown');
        const failure = loginFailures.get(loginKey);
        if (failure && failure.resetAt > Date.now() && failure.count >= 10) {
          response.setHeader('Retry-After', String(Math.ceil((failure.resetAt - Date.now()) / 1000)));
          return json(response, 429, { error: 'login_rate_limited' });
        }
        const input = safeJson(await body(request, 32 * 1024));
        const username = validateUsername(input.username);
        const user = store.getUser(username);
        if (!user || user.disabled || !verifyPassword(input.password, user.passwordHash)) {
          const current = failure && failure.resetAt > Date.now() ? failure : { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
          loginFailures.set(loginKey, { count: current.count + 1, resetAt: current.resetAt });
          return json(response, 401, { error: 'invalid_credentials' });
        }
        loginFailures.delete(loginKey);
        setSession(response, username);
        return json(response, 200, { user: publicUser(user) });
      }
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        clearSession(request, response);
        return json(response, 200, { ok: true });
      }
      if (url.pathname.startsWith('/api/')) {
        const user = requireUser(request, response, requestRole(request, url));
        if (!user) return;
      }
      if (url.pathname === '/api/video/convert' && request.method === 'POST') {
        const input = await binaryBody(request);
        if (!input.length) return json(response, 400, { error: 'video_payload_empty' });
        try {
          const output = await convertWebmToMp4(input);
          response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': output.length, 'Content-Disposition': 'attachment; filename="dawith-video.mp4"', 'Cache-Control': 'no-store' });
          return response.end(output);
        } catch (error) {
          if (error.code === 'ENOENT') return json(response, 501, { error: 'ffmpeg_unavailable', message: '이 PC에 FFmpeg가 설치되어 있지 않습니다.' });
          return json(response, 422, { error: 'video_conversion_failed', message: error.message || 'MP4 변환에 실패했습니다.' });
        }
      }
      if (url.pathname === '/api/capabilities' && request.method === 'GET') return json(response, 200, await getCapabilities(store));
      // Only the desktop app passes an updater; the browser build reports unsupported.
      if (url.pathname === '/api/update/status' && request.method === 'GET') return json(response, 200, updater ? updater.status() : { supported: false });
      if (url.pathname === '/api/update/check' && request.method === 'POST') return json(response, 200, updater ? await updater.check() : { supported: false });
      if (url.pathname === '/api/update/download' && request.method === 'POST') return json(response, 200, updater ? updater.download() : { supported: false });
      if (url.pathname === '/api/desktop/heartbeat' && request.method === 'POST') { onHeartbeat?.(); return json(response, 200, { ok: true }); }
      if (url.pathname === '/api/update/install' && request.method === 'POST') return json(response, 200, updater ? updater.install() : { supported: false });
      if (url.pathname === '/api/ollama/pull' && request.method === 'POST') {
        const input = safeJson(await body(request, 32 * 1024));
        const model = String(input.model || '');
        if (!allowedOllamaModels.has(model)) return json(response, 400, { error: 'ollama_model_not_allowed', message: 'Dawith가 추천하는 로컬 모델만 설치할 수 있습니다.' });
        try {
          await pullOllamaModel(model);
          return json(response, 200, { ok: true, model, transfer: { external: false, destination: '127.0.0.1:11434' } });
        } catch (error) {
          const reason = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'ollama_pull_timeout' : String(error.message || '').startsWith('ollama_http_') ? error.message : 'ollama_unavailable';
          return json(response, 503, { error: reason, message: 'Ollama가 실행 중인지 확인한 뒤 다시 시도하세요.' });
        }
      }
      if (url.pathname === '/api/ai/assist' && request.method === 'POST') {
        const input = safeJson(await body(request, 2 * 1024 * 1024));
        const task = String(input.task || '');
        const text = String(input.text || '').trim();
        const contextText = String(input.contextText || '').trim();
        const model = String(input.model || '');
        if (!allowedOllamaAssistTasks.has(task)) return json(response, 400, { error: 'ollama_assist_task_not_allowed' });
        if (!text) return json(response, 400, { error: 'assist_text_required' });
        if (model && !allowedOllamaModels.has(model)) return json(response, 400, { error: 'ollama_model_not_allowed' });
        try {
          const result = await ollamaAssist({ task, text, contextText, model }, ollamaTimeoutMs);
          if (!result) return json(response, 502, { error: 'ollama_invalid_result', message: '로컬 모델이 읽을 수 있는 결과를 반환하지 않았습니다.' });
          return json(response, 200, { result, task, provider: 'ollama-local', transfer: { external: false, destination: 'local machine' } });
        } catch (error) {
          const reason = error.name === 'TimeoutError' || error.name === 'AbortError'
            ? 'ollama_timeout'
            : String(error.message || '').startsWith('ollama_http_') ? error.message : 'ollama_unavailable';
          return json(response, 503, { error: reason, message: 'Ollama가 실행 중이고 선택한 모델이 준비되어 있는지 확인하세요.' });
        }
      }
      if (url.pathname === '/api/ai/subscription/status' && request.method === 'GET') {
        const [subscriptionStatus, connectionStatus] = await Promise.all([subscription.status(), aiConnections.status()]);
        return json(response, 200, { providers: { ...subscriptionStatus.providers, ...connectionStatus.providers }, policy: 'explicit-user-choice', credentials: connectionStatus.credentials });
      }
      if (url.pathname === '/api/ai/connect' && request.method === 'POST') {
        const input = safeJson(await body(request, 32 * 1024));
        if (input.confirmExternal !== true) return json(response, 400, { error: 'external_transfer_confirmation_required', message: '외부 연결 동의가 필요합니다.' });
        try {
          return json(response, 200, { ...(await aiConnections.connect(String(input.provider || ''), input)), transfer: { external: true, destination: String(input.provider || ''), userInitiated: true } });
        } catch (error) {
          const known = new Set(['ai_provider_invalid', 'gemini_key_invalid', 'gemini_key_rejected', 'openrouter_exchange_failed', 'openrouter_key_missing', 'chatgpt_plan_not_granted', 'chatgpt_token_rejected']);
          return json(response, known.has(error.message) ? 400 : 502, { error: error.message || 'ai_connect_failed', message: 'AI 연결을 완료하지 못했습니다. 브라우저 로그인 또는 키 상태를 확인하세요.' });
        }
      }
      if (url.pathname === '/api/ai/disconnect' && request.method === 'POST') {
        const input = safeJson(await body(request, 16 * 1024));
        try { return json(response, 200, await aiConnections.disconnect(String(input.provider || ''))); }
        catch (error) { return json(response, 400, { error: error.message || 'ai_disconnect_failed' }); }
      }
      if (url.pathname === '/api/ai/subscription/login' && request.method === 'POST') {
        const input = safeJson(await body(request, 16 * 1024));
        try { return json(response, 200, await subscription.login(String(input.provider || ''))); }
        catch (error) { return json(response, error.message === 'subscription_not_installed' ? 409 : 400, { error: error.message || 'subscription_login_failed', message: '공식 CLI 로그인 창을 열지 못했습니다.' }); }
      }
      if (url.pathname === '/api/ai/subscription/assist' && request.method === 'POST') {
        const input = safeJson(await body(request, 2 * 1024 * 1024));
        if (input.confirmExternal !== true) return json(response, 400, { error: 'external_transfer_confirmation_required', message: '외부 전송 동의가 필요합니다.' });
        try {
          const provider = String(input.provider || '');
          const result = ['openrouter', 'gemini', 'chatgpt'].includes(provider) ? await aiConnections.assist(input) : await subscription.assist(input);
          return json(response, 200, result);
        } catch (error) {
          const known = new Set(['assist_text_required', 'assist_text_too_large', 'subscription_provider_invalid', 'subscription_not_installed', 'subscription_empty_result', 'subscription_request_failed', 'subscription_process_timeout', 'ai_provider_invalid', 'ai_provider_not_connected', 'ai_provider_empty_result', 'chatgpt_not_connected', 'chatgpt_refresh_failed', 'openrouter_request_failed', 'gemini_request_failed', 'chatgpt_request_failed']);
          const status = known.has(error.message) ? (error.message === 'subscription_not_installed' ? 409 : 400) : 502;
          return json(response, status, { error: error.message || 'subscription_assist_failed', message: error.message === 'subscription_not_installed' ? '선택한 구독 프로그램이 설치되어 있지 않습니다.' : '구독 프로그램에서 결과를 받지 못했습니다.' });
        }
      }
      if (url.pathname === '/api/auth/users' && request.method === 'GET') return json(response, 200, { users: store.listUsers() });
      if (url.pathname === '/api/auth/users' && request.method === 'POST') {
        const input = safeJson(await body(request, 32 * 1024));
        const username = validateUsername(input.username);
        const password = validatePassword(input.password);
        const role = roles.includes(input.role) ? input.role : 'viewer';
        if (store.getUser(username)) return json(response, 409, { error: 'username_taken' });
        return json(response, 201, { user: store.createUser({ username, role, passwordHash: hashPassword(password) }) });
      }
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
      if (url.pathname === '/api/audit' && request.method === 'GET') return json(response, 200, { events: store.listAuditEvents({ limit: url.searchParams.get('limit') || 100 }) });
      if (url.pathname === '/api/records' && request.method === 'GET') return json(response, 200, { records: store.listRecords({ query: url.searchParams.get('q') || '', kind: url.searchParams.get('kind') || '' }) });
      if (url.pathname === '/api/document-templates' && request.method === 'GET') return json(response, 200, { templates: documentTemplates, uploadedTemplates: store.listDocumentTemplates() });
      if (url.pathname === '/api/document-templates' && request.method === 'POST') {
        const input = safeJson(await body(request, 40 * 1024 * 1024));
        const data = Buffer.from(String(input.dataBase64 || ''), 'base64');
        const analysis = await analyzeTemplate({ fileName: input.fileName, data });
        const templateId = uploadedTemplateId(`template_${crypto.randomUUID()}`);
        const saved = store.saveDocumentTemplate({ templateId, fileName: analysis.fileName, format: analysis.format, data, fields: analysis.fields, ready: analysis.ready, warnings: analysis.warnings });
        return json(response, 201, { template: { ...saved, data: undefined }, analysis });
      }
      const templateRenderMatch = url.pathname.match(/^\/api\/document-templates\/([^/]+)\/render$/);
      if (templateRenderMatch && request.method === 'POST') {
        const template = store.getDocumentTemplate(routeParam(templateRenderMatch[1]));
        if (!template) return json(response, 404, { error: 'document_template_not_found' });
        const input = safeJson(await body(request, 40 * 1024 * 1024));
        const output = await renderTemplate({ fileName: template.fileName, data: template.data, fields: input.fields || {} });
        const extension = template.format === 'hwpx' ? 'hwpx' : 'docx';
        response.writeHead(200, { 'Content-Type': template.format === 'hwpx' ? 'application/zip' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="dawith-filled-template-${template.id}.${extension}"` });
        return response.end(output);
      }
      const templateMatch = url.pathname.match(/^\/api\/document-templates\/([^/]+)$/);
      if (templateMatch && request.method === 'GET') {
        const template = store.getDocumentTemplate(routeParam(templateMatch[1]));
        return template ? json(response, 200, { template: { ...template, data: undefined } }) : json(response, 404, { error: 'document_template_not_found' });
      }
      if (url.pathname === '/api/documents/preview' && request.method === 'POST') {
        const input = safeJson(await body(request));
        if (!documentTemplates.some((template) => template.id === input.templateId)) return json(response, 400, { error: 'document_template_invalid' });
        return json(response, 200, { draft: buildDocumentDraft({ templateId: input.templateId, fields: input.fields, source: input.source }) });
      }
      if (url.pathname === '/api/documents' && request.method === 'GET') return json(response, 200, { documents: store.listDocuments() });
      if (url.pathname === '/api/documents' && request.method === 'POST') {
        const input = safeJson(await body(request));
        if ((!documentTemplates.some((template) => template.id === input.templateId) && !store.getDocumentTemplate(input.templateId)) || !input.payload) return json(response, 400, { error: 'document_payload_invalid' });
        const saved = store.saveDocument({ templateId: input.templateId, title: input.title, payload: input.payload });
        return json(response, 201, { document: saved });
      }
      if (url.pathname === '/api/process' && request.method === 'POST') {
        const input = safeJson(await body(request));
        const rawText = String(input.rawText || '').trim();
        const contextText = String(input.contextText || '').trim();
        const kind = ['counseling', 'meeting', 'audio'].includes(input.kind) ? input.kind : 'counseling';
        const summaryKind = SUMMARY_KINDS.includes(kind) ? kind : 'counseling';
        const provider = String(input.provider || 'rules');
        if (!rawText) return json(response, 400, { error: 'raw_text_required', message: '정리할 원문을 입력하세요.' });
        if (rawText.length > MAX_SUMMARY_INPUT) return json(response, 413, { error: 'raw_text_too_large', message: '원문이 너무 깁니다. 나눠서 정리하세요.' });
        // Local only: rules on this PC or Ollama on loopback. Anything else
        // (including the retired cloud:<provider> values) is refused.
        if (!['rules', 'ollama-local'].includes(provider)) return json(response, 400, { error: 'external_provider_blocked', message: '이 PC 안에서만 정리합니다. 규칙 또는 로컬 AI(Ollama)를 선택하세요.' });
        const template = input.template === undefined || input.template === null ? null : normalizeTemplate(input.template);
        if (input.template && !template) return json(response, 400, { error: 'template_invalid', message: '기록 양식에 항목이 하나 이상 있어야 합니다.' });
        const localTransfer = { external: false, destination: 'local machine' };
        if (template) {
          const ruleSummary = buildTemplateRuleSummary({ template, rawText, contextText });
          const base = { kind: 'template', transfer: localTransfer };
          if (provider === 'rules') return json(response, 200, { ...base, summary: ruleSummary, provider: 'rules', engine: 'rules', fallback: null });
          const model = allowedOllamaModels.has(String(input.model || '')) ? String(input.model) : '';
          let reason;
          try {
            const reply = await ollamaSummary({ model, prompt: buildTemplatePrompt({ template, rawText, contextText }) }, ollamaTimeoutMs, ollamaBaseUrl);
            const summary = parseTemplateReply(reply, template);
            if (summary) return json(response, 200, { ...base, summary: { ...summary, meta: ruleSummary.meta }, provider: 'ollama-local', engine: 'ollama', model: model || 'qwen2.5:7b', fallback: null });
            reason = 'ollama_invalid_result';
          } catch (error) {
            reason = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'ollama_timeout' : String(error.message || '').startsWith('ollama_http_') ? error.message : 'ollama_unavailable';
          }
          return json(response, 200, { ...base, summary: ruleSummary, provider: 'rules-fallback', engine: 'rules', fallback: { used: true, reason, message: ollamaFallbackMessages[reason] || '로컬 모델 응답이 없어 규칙으로 정리했습니다.' } });
        }
        const fallback = buildDrafts({ kind, rawText, contextText });
        const ruleSummary = buildRuleSummary({ kind: summaryKind, rawText, contextText });
        if (provider === 'rules') return json(response, 200, { draft: fallback, summary: ruleSummary, kind: summaryKind, provider: 'rules', engine: 'rules', fallback: null, transfer: localTransfer });
        const model = allowedOllamaModels.has(String(input.model || '')) ? String(input.model) : '';
        let reason;
        try {
          const summary = parseSummaryReply(await ollamaSummary({ kind: summaryKind, rawText, contextText, model }, ollamaTimeoutMs, ollamaBaseUrl), summaryKind);
          if (summary) return json(response, 200, { draft: { ...fallback, ...summaryToLegacyDraft(summary), provider: 'ollama-local' }, summary, kind: summaryKind, provider: 'ollama-local', engine: 'ollama', model: model || 'qwen2.5:7b', fallback: null, transfer: localTransfer });
          reason = 'ollama_invalid_result';
        } catch (error) {
          reason = error.name === 'TimeoutError' || error.name === 'AbortError'
            ? 'ollama_timeout'
            : String(error.message || '').startsWith('ollama_http_') ? error.message : 'ollama_unavailable';
        }
        const message = ollamaFallbackMessages[reason] || '로컬 모델 응답이 없어 로컬 규칙·템플릿으로 초안을 만들었습니다.';
        return json(response, 200, { draft: { ...fallback, provider: 'rules-fallback' }, summary: ruleSummary, kind: summaryKind, provider: 'rules-fallback', engine: 'rules', fallback: { used: true, reason, message }, transfer: localTransfer });
      }
      // Institution forms for 상담 기록·회의록: inspect the {{표식}} in an
      // uploaded DOCX/HWPX and fill them. Stateless — the form is never stored.
      if (url.pathname === '/api/record-form/inspect' && request.method === 'POST') {
        const input = safeJson(await body(request, 40 * 1024 * 1024));
        const analysis = await analyzeTemplate({ fileName: input.fileName, data: Buffer.from(String(input.dataBase64 || ''), 'base64') });
        const sectionNames = (Array.isArray(input.sectionNames) ? input.sectionNames : []).map((name) => String(name || '')).filter(Boolean).slice(0, 30);
        const placeholders = analysis.fields.map((field) => ({ token: field.token, source: matchPlaceholder(field.token, sectionNames) }));
        return json(response, 200, { format: analysis.format, fileName: analysis.fileName, placeholders, warnings: analysis.fields.length ? analysis.warnings : ['양식에서 {{표식}}을 찾지 못했습니다. 내용이 들어갈 자리에 {{관찰사항}}처럼 적은 뒤 다시 올려 주세요.'] });
      }
      if (url.pathname === '/api/record-form/fill' && request.method === 'POST') {
        const input = safeJson(await body(request, 42 * 1024 * 1024));
        const data = Buffer.from(String(input.dataBase64 || ''), 'base64');
        const analysis = await analyzeTemplate({ fileName: input.fileName, data });
        const tokens = analysis.fields.map((field) => field.token);
        if (!tokens.length) return json(response, 400, { error: 'record_form_no_placeholders', message: '양식에서 {{표식}}을 찾지 못했습니다.' });
        const summary = normalizeTemplateSummary(input.summary);
        const header = Object.fromEntries(['organization', 'author', 'date', 'place', 'attendees', 'agenda'].map((key) => [key, String(input.header?.[key] || '').slice(0, 500)]));
        const meta = extractRecordMeta(String(input.rawText || '').slice(0, MAX_SUMMARY_INPUT), String(input.contextText || '').slice(0, 4000));
        const { fields, report } = formFieldValues(tokens, { sections: summary.sections, header, meta, templateName: summary.templateName, extra: safeJson(input.extra) });
        const output = await renderTemplate({ fileName: input.fileName, data, fields });
        const remaining = new Set((await analyzeTemplate({ fileName: input.fileName, data: output })).fields.map((field) => field.token));
        const filled = report.filter((item) => item.filled && !remaining.has(item.token)).map((item) => ({ token: item.token, source: item.source?.label || '' }));
        const missing = tokens.filter((token) => remaining.has(token));
        const base = String(analysis.fileName).replace(/\.(docx|hwpx)$/i, '');
        return json(response, 200, { fileName: `${base}_작성본.${analysis.format}`, format: analysis.format, dataBase64: Buffer.from(output).toString('base64'), filled, missing, transfer: { external: false, destination: 'local machine' } });
      }
      if (url.pathname === '/api/record-form/starter' && request.method === 'POST') {
        const input = safeJson(await body(request, 256 * 1024));
        const template = normalizeTemplate(input.template);
        if (!template) return json(response, 400, { error: 'template_invalid' });
        const buffer = await recordFormStarterDocx(template);
        const fileName = encodeURIComponent(`${template.name}_양식.docx`);
        response.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="dawith-record-form.docx"; filename*=UTF-8''${fileName}`, 'Cache-Control': 'no-store' });
        return response.end(buffer);
      }
      if (url.pathname === '/api/summary/export' && request.method === 'POST') {
        const input = safeJson(await body(request, 2 * 1024 * 1024));
        const kind = input.kind === 'template' || input.summary?.kind === 'template' ? 'template' : SUMMARY_KINDS.includes(input.kind) ? input.kind : 'counseling';
        const summary = kind === 'template' ? normalizeTemplateSummary(input.summary) : normalizeSummary(input.summary, kind);
        const header = { organization: String(input.header?.organization || '').slice(0, 200), author: String(input.header?.author || '').slice(0, 100), date: String(input.header?.date || '').slice(0, 100) };
        const buffer = await summaryToDocx(summary, header);
        const fileName = encodeURIComponent(`${kind === 'template' ? summary.templateName.replace(/[\\/:*?"<>|]+/g, '_') : kind === 'meeting' ? '회의록' : '상담기록'}.docx`);
        response.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="dawith-${kind}.docx"; filename*=UTF-8''${fileName}`, 'Cache-Control': 'no-store' });
        return response.end(buffer);
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
      const documentMatch = url.pathname.match(/^\/api\/documents\/([^/]+)$/);
      if (documentMatch && request.method === 'GET') {
        const document = store.getDocument(documentMatch[1]);
        return document ? json(response, 200, { document }) : json(response, 404, { error: 'document_not_found' });
      }
      if (documentMatch && request.method === 'PATCH') {
        const input = safeJson(await body(request));
        if (input.templateId && !documentTemplates.some((template) => template.id === input.templateId) && !store.getDocumentTemplate(input.templateId)) return json(response, 400, { error: 'document_template_invalid' });
        const document = store.updateDocument(documentMatch[1], input);
        return document ? json(response, 200, { document }) : json(response, 404, { error: 'document_not_found' });
      }
      const documentExportMatch = url.pathname.match(/^\/api\/documents\/([^/]+)\/export$/);
      if (documentExportMatch && request.method === 'GET') {
        const document = store.getDocument(documentExportMatch[1]);
        if (!document) return json(response, 404, { error: 'document_not_found' });
        const format = url.searchParams.get('format') || 'docx';
        if (format === 'markdown') {
          response.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="dawith-document-${document.id}.md"` });
          return response.end(documentToMarkdown(document));
        }
        if (format === 'html' || format === 'pdf') {
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `inline; filename="dawith-document-${document.id}.html"` });
          return response.end(documentToHtml(document));
        }
        if (format === 'docx') {
          if (isUploadedTemplateId(document.templateId)) {
            const template = store.getDocumentTemplate(document.templateId);
            if (!template) return json(response, 404, { error: 'document_template_not_found' });
            const output = await renderTemplate({ fileName: template.fileName, data: template.data, fields: document.payload?.fields || {} });
            const extension = template.format === 'hwpx' ? 'hwpx' : 'docx';
            response.writeHead(200, { 'Content-Type': template.format === 'hwpx' ? 'application/zip' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="dawith-document-${document.id}.${extension}"` });
            return response.end(output);
          }
          const buffer = await documentToDocx(document);
          response.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="dawith-document-${document.id}.docx"` });
          return response.end(buffer);
        }
        return json(response, 400, { error: 'document_export_format_invalid' });
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
      const status = error.message === 'payload_too_large' ? 413 : error.message === 'whisper_model_not_configured' ? 409 : ['case_label_required', 'case_not_found', 'document_payload_invalid', 'document_template_invalid', 'template_size_invalid', 'template_format_unsupported', 'audio_size_invalid', 'audio_format_unsupported', 'username_invalid', 'password_policy', 'authentication_not_required', 'consent_invalid'].includes(error.message) ? 400 : 500;
      return json(response, status, { error: error.message || 'internal_error' });
    }
  });
  server.on('close', () => { sessions.clear(); loginFailures.clear(); subscription.close?.(); store.close(); });
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

export function startServer({ port = 0, host = defaultHost, dataDir = defaultDataDir, ollamaTimeoutMs = defaultOllamaTimeoutMs, authRequired = defaultAuthRequired, encryptionKey, updater, onHeartbeat, subscriptionBridge, aiConnectionManager, ollamaBaseUrl } = {}) {
  const { server } = createServer({ dataDir, host, ollamaTimeoutMs, authRequired, encryptionKey, updater, onHeartbeat, subscriptionBridge, aiConnectionManager, ollamaBaseUrl });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;
      resolve({ server, port: server.address().port, host, url: `http://${displayHost}:${server.address().port}` });
    });
  });
}

// Desktop runtimes keep one fixed port: localStorage (saved forms, relationship
// maps, recent tools) is scoped to the origin, so a new port on every launch
// would make that data disappear. Falls back to any free port if it is taken.
export const desktopPort = 43871;
export async function startDesktopServer(options = {}) {
  try {
    return await startServer({ ...options, port: desktopPort });
  } catch (error) {
    if (error?.code !== 'EADDRINUSE') throw error;
    return startServer({ ...options, port: 0 });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  startServer({ port: defaultPort, host: defaultHost, authRequired: defaultAuthRequired }).then(({ port, host }) => {
    console.log(`Dawith Welfare Office: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`);
    console.log(`Local data: ${defaultDataDir}`);
    console.log(`Authentication: ${defaultAuthRequired ? 'required' : 'disabled (loopback only)'}`);
  });
}
