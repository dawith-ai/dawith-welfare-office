import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';

const REQUEST_TIMEOUT_MS = 20_000;
const OAUTH_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_TEXT = 120_000;
const CHATGPT_ISSUER = 'https://auth.openai.com';
const CHATGPT_RESOURCE = 'https://api.openai.com/v1';
const CHATGPT_PLAN_SCOPE = 'chatgpt.tokens.use.direct';
const CHATGPT_SCOPES = ['openid', 'profile', 'email', 'offline_access', 'resource.invoke', CHATGPT_PLAN_SCOPE];
const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth';
const OPENROUTER_KEYS_URL = 'https://openrouter.ai/api/v1/auth/keys';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
const OPENROUTER_FALLBACK_MODEL = 'google/gemini-2.0-flash-exp:free';

const PROVIDERS = {
  openrouter: { label: 'OpenRouter 무료', kind: 'oauth', installUrl: 'https://openrouter.ai' },
  gemini: { label: 'Google Gemini', kind: 'key', installUrl: 'https://aistudio.google.com/apikey' },
  chatgpt: { label: 'ChatGPT 구독', kind: 'oauth', installUrl: 'https://chatgpt.com' },
};

function base64url(bytes) { return Buffer.from(bytes).toString('base64url'); }
function randomToken() { return base64url(crypto.randomBytes(32)); }
function pkcePair() { const verifier = randomToken(); return { verifier, challenge: base64url(crypto.createHash('sha256').update(verifier).digest()) }; }
function bounded(value, limit = MAX_TEXT) { return String(value || '').slice(0, limit); }
function isRecord(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function safeProvider(value) { return Object.prototype.hasOwnProperty.call(PROVIDERS, value) ? value : null; }

async function fetchWithTimeout(url, options = {}) {
  const signal = options.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetch(url, { ...options, signal });
}

function openBrowser(url) {
  const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/d', '/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true, shell: false });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function waitForCallback({ authorizeUrl, expectedState = '', callbackPath = '/callback', timeoutMs = OAUTH_TIMEOUT_MS }) {
  let server;
  let timer;
  let port = 0;
  let settled = false;
  const outcome = new Promise((resolve) => {
    const finish = (result) => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };
    const handler = (request, response) => {
      let url;
      try { url = new URL(request.url || '/', 'http://127.0.0.1'); } catch { response.writeHead(400); response.end(); return; }
      const stateMatches = !expectedState || url.searchParams.get('state') === expectedState;
      if (request.method !== 'GET' || url.pathname !== callbackPath || !stateMatches || settled) { response.writeHead(404); response.end(); return; }
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
      response.end('<!doctype html><meta charset="utf-8"><title>Dawith 연결</title><p>연결 결과를 받았습니다. 이 창을 닫고 Dawith로 돌아가세요.</p>');
      finish(code ? { ok: true, code, clientId: url.searchParams.get('client_id') || '', port } : { ok: false, reason: error || 'denied' });
    };
    server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      port = server.address()?.port || 0;
      const url = authorizeUrl(port);
      if (!port || !openBrowser(url)) finish({ ok: false, reason: 'browser' });
    });
    server.once('error', () => finish({ ok: false, reason: 'loopback' }));
    timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);
  });
  const result = await outcome;
  server?.close();
  server?.closeAllConnections?.();
  return result;
}

async function openRouterConnect() {
  const { verifier, challenge } = pkcePair();
  const result = await waitForCallback({
    callbackPath: '/callback',
    authorizeUrl: (port) => `${OPENROUTER_AUTH_URL}?${new URLSearchParams({ callback_url: `http://localhost:${port}/callback`, code_challenge: challenge, code_challenge_method: 'S256' })}`,
  });
  if (!result.ok) throw new Error(`oauth_${result.reason}`);
  const response = await fetchWithTimeout(OPENROUTER_KEYS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: result.code, code_verifier: verifier, code_challenge_method: 'S256' }) });
  if (!response.ok) throw new Error('openrouter_exchange_failed');
  const payload = await response.json();
  const apiKey = typeof payload?.key === 'string' ? payload.key.trim() : '';
  if (!apiKey) throw new Error('openrouter_key_missing');
  let model = OPENROUTER_FALLBACK_MODEL;
  try {
    const models = await fetchWithTimeout(OPENROUTER_MODELS_URL).then((item) => item.ok ? item.json() : {});
    const free = Array.isArray(models?.data) ? models.data.find((item) => String(item.id || '').endsWith(':free')) : null;
    if (free?.id) model = free.id;
  } catch { /* fallback model is still user-selectable by the provider */ }
  return { apiKey, model };
}

async function geminiConnect(apiKey) {
  const key = String(apiKey || '').trim();
  if (!/^[A-Za-z0-9._-]{20,256}$/.test(key)) throw new Error('gemini_key_invalid');
  const response = await fetchWithTimeout(`${GEMINI_MODELS_URL}?key=${encodeURIComponent(key)}`);
  if (!response.ok) throw new Error('gemini_key_rejected');
  const payload = await response.json();
  const model = Array.isArray(payload?.models)
    ? payload.models.map((item) => ({ name: String(item.name || '').replace(/^models\//, ''), methods: item.supportedGenerationMethods || [] })).find((item) => item.methods.includes('generateContent') && /flash/i.test(item.name))?.name
    : '';
  return { apiKey: key, model: model || GEMINI_DEFAULT_MODEL };
}

function chatGptAuthorizeUrl({ port, challenge, state, nonce, hostId, clientId }) {
  const params = new URLSearchParams({ client_id: clientId || 'dynamic_agent_client', ext_agent_host_id: hostId, response_type: 'code', redirect_uri: `http://127.0.0.1:${port}/callback`, scope: CHATGPT_SCOPES.join(' '), resource: CHATGPT_RESOURCE, state, nonce, code_challenge_method: 'S256', code_challenge: challenge });
  if (!clientId) params.set('agent_name_hint', 'Dawith Welfare Office');
  return `${CHATGPT_ISSUER}/api/accounts/authorize?${params}`;
}

function decodeJwtPart(value) { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); }

async function verifyChatGptIdToken(idToken, { clientId, nonce }) {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = String(idToken).split('.');
    const header = decodeJwtPart(encodedHeader); const payload = decodeJwtPart(encodedPayload);
    if (!encodedSignature || payload.iss !== CHATGPT_ISSUER || payload.aud !== clientId || payload.nonce !== nonce || Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;
    const keys = await fetchWithTimeout(`${CHATGPT_ISSUER}/.well-known/jwks.json`).then((response) => response.json());
    const jwk = Array.isArray(keys?.keys) ? keys.keys.find((item) => item.kid === header.kid) : null;
    if (!jwk) return null;
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const valid = header.alg === 'RS256'
      ? crypto.verify('sha256', Buffer.from(`${encodedHeader}.${encodedPayload}`), publicKey, Buffer.from(encodedSignature, 'base64url'))
      : header.alg === 'ES256'
        ? crypto.verify('sha256', Buffer.from(`${encodedHeader}.${encodedPayload}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(encodedSignature, 'base64url'))
        : false;
    return valid && typeof payload.sub === 'string' ? { subject: payload.sub } : null;
  } catch { return null; }
}

async function chatGptConnect(existing = {}) {
  const hostId = String(existing.hostId || `urn:uuid:${crypto.randomUUID()}`);
  const { verifier, challenge } = pkcePair();
  const state = randomToken(); const nonce = randomToken();
  const callback = await waitForCallback({ expectedState: state, authorizeUrl: (port) => chatGptAuthorizeUrl({ port, challenge, state, nonce, hostId, clientId: existing.clientId }) });
  if (!callback.ok || !callback.clientId) throw new Error(`chatgpt_oauth_${callback.reason || 'incomplete'}`);
  const response = await fetchWithTimeout(`${CHATGPT_ISSUER}/api/accounts/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: callback.code, client_id: callback.clientId, code_verifier: verifier, redirect_uri: `http://127.0.0.1:${callback.port || 0}/callback`, resource: CHATGPT_RESOURCE }).toString() });
  if (!response.ok) throw new Error('chatgpt_token_rejected');
  const payload = await response.json();
  const accessToken = String(payload.access_token || ''); const refreshToken = String(payload.refresh_token || ''); const idToken = String(payload.id_token || '');
  const scopes = String(payload.scope || '').split(/\s+/).filter(Boolean);
  const identity = idToken ? await verifyChatGptIdToken(idToken, { clientId: callback.clientId, nonce }) : null;
  if (!accessToken || !refreshToken || !identity || !scopes.includes(CHATGPT_PLAN_SCOPE)) throw new Error('chatgpt_plan_not_granted');
  return { hostId, clientId: callback.clientId, subject: identity.subject, session: { accessToken, refreshToken, idToken, scopes, expiresAt: Date.now() + (Number(payload.expires_in) > 0 ? Number(payload.expires_in) * 1000 : 3600000) } };
}

async function refreshChatGpt(record) {
  const session = record?.session;
  if (!session) throw new Error('chatgpt_not_connected');
  if (Number(session.expiresAt) - Date.now() > 60_000) return record;
  const response = await fetchWithTimeout(`${CHATGPT_ISSUER}/api/accounts/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: record.clientId, refresh_token: session.refreshToken, resource: CHATGPT_RESOURCE }).toString() });
  if (!response.ok) throw new Error('chatgpt_refresh_failed');
  const payload = await response.json();
  return { ...record, session: { ...session, accessToken: String(payload.access_token || ''), refreshToken: String(payload.refresh_token || session.refreshToken), expiresAt: Date.now() + (Number(payload.expires_in) > 0 ? Number(payload.expires_in) * 1000 : 3600000) } };
}

function extractText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();
  const message = payload?.choices?.[0]?.message?.content;
  if (typeof message === 'string') return message.trim();
  if (Array.isArray(payload?.candidates?.[0]?.content?.parts)) return payload.candidates[0].content.parts.map((part) => part.text || '').join('').trim();
  return '';
}

async function chatCompletion(provider, config, prompt) {
  if (provider === 'openrouter') {
    const response = await fetchWithTimeout(OPENROUTER_CHAT_URL, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://welfare-hub.site', 'X-Title': 'Dawith Welfare Office' }, body: JSON.stringify({ model: config.model || OPENROUTER_FALLBACK_MODEL, messages: [{ role: 'user', content: prompt }], stream: false }) });
    if (!response.ok) throw new Error('openrouter_request_failed');
    return extractText(await response.json());
  }
  if (provider === 'gemini') {
    const model = config.model || GEMINI_DEFAULT_MODEL;
    const response = await fetchWithTimeout(`${GEMINI_MODELS_URL.replace('/models', `/models/${encodeURIComponent(model)}:generateContent`)}?key=${encodeURIComponent(config.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) });
    if (!response.ok) throw new Error('gemini_request_failed');
    return extractText(await response.json());
  }
  const refreshed = await refreshChatGpt(config);
  const response = await fetchWithTimeout('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${refreshed.session.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-5', input: prompt, store: false }) });
  if (!response.ok) throw new Error('chatgpt_request_failed');
  return extractText(await response.json());
}

export function createAiConnectionManager({ store } = {}) {
  const read = () => store?.getAiConnections?.() || {};
  const write = (value) => store?.updateAiConnections?.(value) || value;
  return {
    async status() {
      const saved = read();
      const providers = Object.fromEntries(Object.entries(PROVIDERS).map(([provider, meta]) => {
        const config = saved[provider];
        const connected = provider === 'chatgpt' ? Boolean(config?.session?.refreshToken) : Boolean(config?.apiKey);
        return [provider, { provider, label: meta.label, kind: meta.kind, state: connected ? 'ready' : 'not-connected', connected, model: config?.model || undefined, installUrl: meta.installUrl }];
      }));
      return { providers, policy: 'explicit-user-choice', credentials: 'encrypted-local-only' };
    },
    async connect(provider, input = {}) {
      if (!safeProvider(provider)) throw new Error('ai_provider_invalid');
      const saved = read();
      let config;
      if (provider === 'openrouter') config = await openRouterConnect();
      if (provider === 'gemini') config = await geminiConnect(input.apiKey);
      if (provider === 'chatgpt') config = await chatGptConnect(saved.chatgpt || {});
      write({ ...saved, [provider]: config });
      return { provider, connected: true, model: config.model || undefined };
    },
    async disconnect(provider) {
      if (!safeProvider(provider)) throw new Error('ai_provider_invalid');
      const saved = read(); delete saved[provider]; write(saved); return { provider, connected: false };
    },
    async assist({ provider, task, text, contextText = '' }) {
      if (!safeProvider(provider)) throw new Error('ai_provider_invalid');
      const saved = read();
      let config = saved[provider];
      if (!config || (provider === 'chatgpt' ? !config.session?.refreshToken : !config.apiKey)) throw new Error('ai_provider_not_connected');
      if (provider === 'chatgpt') { config = await refreshChatGpt(config); if (config !== saved[provider]) write({ ...saved, chatgpt: config }); }
      const prompt = [
        '당신은 사회복지기관의 문서 초안 보조자입니다.',
        '입력된 사실만 사용하고 개인정보를 추정하거나 새로 만들지 마세요.',
        '진단·법률판단·위험도 확정을 하지 말고 불확실한 내용은 [확인 필요]로 표시하세요.',
        `작업 유형: ${bounded(task, 80)}`,
        `추가 맥락:\n${bounded(contextText, 20_000) || '(없음)'}`,
        `입력 원문:\n${bounded(text)}`,
        '결과만 반환하세요. 설명과 마크다운 코드블록은 붙이지 마세요.',
      ].join('\n\n');
      const result = await chatCompletion(provider, config, prompt);
      if (!result) throw new Error('ai_provider_empty_result');
      return { result: result.slice(0, 160_000), provider, transfer: { external: true, destination: provider, userInitiated: true } };
    },
  };
}

export { PROVIDERS };
