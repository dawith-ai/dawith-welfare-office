import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const PROVIDERS = {
  'claude-code': {
    label: 'Claude 구독',
    commands: ['claude', 'claude.cmd', 'claude.exe'],
    installUrl: 'https://code.claude.com/docs/en/setup',
  },
  codex: {
    label: 'Codex 구독',
    commands: ['codex', 'codex.cmd', 'codex.exe'],
    installUrl: 'https://developers.openai.com/codex/cli',
  },
  'gemini-cli': {
    label: 'Gemini 무료 · Google 로그인',
    commands: ['gemini', 'gemini.cmd', 'gemini.exe'],
    installUrl: 'https://github.com/google-gemini/gemini-cli',
  },
};

const MAX_PROMPT_LENGTH = 120_000;
const MAX_OUTPUT_LENGTH = 160_000;
const STATUS_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 120_000;
const activeChildren = new Set();

function isProvider(value) {
  return value === 'claude-code' || value === 'codex' || value === 'gemini-cli';
}

function cleanEnv(command) {
  const blocked = new Set([
    'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL',
    'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN',
    'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY',
    'CLAUDE_CODE_USE_MANTLE', 'CLAUDE_CODE_USE_ANTHROPIC_AWS',
    'CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD', 'ANTHROPIC_CUSTOM_HEADERS',
  ]);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !blocked.has(key.toUpperCase())));
  env.NO_COLOR = '1';
  env.DISABLE_AUTOUPDATER = '1';
  env.DISABLE_TELEMETRY = '1';
  if (command) env.PATH = `${path.dirname(command)}${path.delimiter}${env.PATH || ''}`;
  return env;
}

function pathCandidates(command) {
  const names = process.platform === 'win32' && !path.extname(command)
    ? [command, `${command}.cmd`, `${command}.exe`, `${command}.ps1`]
    : [command];
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) dirs.push(path.join(appData, 'npm'));
  }
  return dirs.flatMap((dir) => names.map((name) => path.resolve(dir, name)));
}

async function isFile(filePath) {
  try { return (await fs.stat(filePath)).isFile(); } catch { return false; }
}

async function locate(provider) {
  if (!isProvider(provider)) return null;
  for (const name of PROVIDERS[provider].commands) {
    if (path.isAbsolute(name) && await isFile(name)) return { command: name, prefixArgs: [] };
    for (const candidate of pathCandidates(name)) {
      if (await isFile(candidate)) return { command: candidate, prefixArgs: [] };
    }
  }
  return null;
}

function bounded(value, limit) {
  return String(value || '').slice(0, limit);
}

function finishProcess(child) {
  activeChildren.delete(child);
}

function stopProcess(child) {
  if (!child || child.killed) return;
  try { child.kill('SIGTERM'); } catch { /* already closed */ }
  setTimeout(() => { try { if (!child.killed) child.kill('SIGKILL'); } catch { /* best effort */ } }, 2_000).unref?.();
}

function spawnSpec(program, args) {
  if (process.platform === 'win32' && /\.cmd$/i.test(program.command)) {
    return { command: program.command, args: [...(program.prefixArgs || []), ...args], shell: true };
  }
  return { command: program.command, args: [...(program.prefixArgs || []), ...args], shell: false };
}

function runChild(program, args, { input = '', timeoutMs = REQUEST_TIMEOUT_MS, cwd = os.tmpdir() } = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer;
    let child;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      finishProcess(child);
      if (error) reject(error); else resolve(result);
    };
    try {
      const invocation = spawnSpec(program, args);
      child = spawn(invocation.command, invocation.args, {
        cwd,
        env: cleanEnv(program.command),
        shell: invocation.shell,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      activeChildren.add(child);
    } catch (error) {
      finish(error);
      return;
    }
    child.stdout.on('data', (chunk) => { if (stdout.length < MAX_OUTPUT_LENGTH) stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { if (stderr.length < 16_000) stderr += chunk.toString('utf8'); });
    child.once('error', (error) => finish(error));
    child.once('close', (code, signal) => finish(null, { code, signal, stdout, stderr }));
    timer = setTimeout(() => { stopProcess(child); finish(new Error('subscription_process_timeout')); }, timeoutMs);
    timer.unref?.();
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

function statusFrom(provider, program, result) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (provider === 'gemini-cli') {
    return {
      provider,
      label: PROVIDERS[provider].label,
      installed: Boolean(program),
      loggedIn: Boolean(program && result.code === 0),
      state: !program ? 'not-installed' : result.code === 0 ? 'ready' : 'signed-out',
      authHint: '처음 사용할 때 Gemini CLI 화면에서 Google로 로그인합니다.',
      installUrl: PROVIDERS[provider].installUrl,
    };
  }
  if (provider === 'claude-code') {
    let parsed = null;
    const start = result.stdout.indexOf('{');
    const end = result.stdout.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { parsed = JSON.parse(result.stdout.slice(start, end + 1)); } catch { /* fixed fallback below */ }
    }
    const loggedIn = parsed?.loggedIn === true;
    return {
      provider,
      label: PROVIDERS[provider].label,
      installed: Boolean(program),
      loggedIn,
      state: !program ? 'not-installed' : loggedIn ? 'ready' : 'signed-out',
      version: parsed?.version || undefined,
      installUrl: PROVIDERS[provider].installUrl,
    };
  }
  const loggedIn = /Logged in using\s+ChatGPT\b/i.test(output);
  const signedOut = /Not logged in/i.test(output);
  return {
    provider,
    label: PROVIDERS[provider].label,
    installed: Boolean(program),
    loggedIn,
    state: !program ? 'not-installed' : loggedIn ? 'ready' : signedOut ? 'signed-out' : 'unknown',
    installUrl: PROVIDERS[provider].installUrl,
  };
}

async function providerStatus(provider) {
  const program = await locate(provider);
  if (!program) return statusFrom(provider, null, { stdout: '', stderr: '' });
  try {
    const args = provider === 'claude-code' ? ['auth', 'status', '--json'] : provider === 'codex' ? ['login', 'status'] : ['--version'];
    const result = await runChild(program, args, { timeoutMs: STATUS_TIMEOUT_MS });
    return statusFrom(provider, program, result);
  } catch (error) {
    return {
      provider,
      label: PROVIDERS[provider].label,
      installed: true,
      loggedIn: false,
      state: 'error',
      error: error.message === 'subscription_process_timeout' ? 'status-timeout' : 'status-failed',
      installUrl: PROVIDERS[provider].installUrl,
    };
  }
}

function promptFor({ task, text, contextText }) {
  const tasks = {
    'text-clean': '사실과 의미를 바꾸지 말고 사회복지 기록에 맞는 간결한 문장으로 다듬으세요.',
    'document-draft': '입력된 메모를 기관 문서 초안으로 정리하세요. 제목과 문단을 읽기 쉽게 나누고 확인이 필요한 내용은 [확인 필요]로 표시하세요.',
    'hwp-summary': '입력된 양식 텍스트에서 사실, 결정사항, 후속조치만 추려서 정리하세요.',
  };
  if (!tasks[task]) throw new Error('subscription_assist_task_not_allowed');
  const content = bounded(text, MAX_PROMPT_LENGTH);
  const context = bounded(contextText, 20_000);
  return [
    '당신은 사회복지기관의 문서 초안 작성 보조자입니다.',
    '입력된 사실만 사용하고 개인정보를 새로 만들거나 추정하지 마세요.',
    '진단·법률판단·위험도 확정을 하지 말고, 불확실한 내용은 [확인 필요]로 표시하세요.',
    tasks[task],
    `추가 맥락:\n${context || '(없음)'}`,
    `입력 원문:\n${content}`,
    '결과 문장만 반환하세요. 설명이나 마크다운 코드블록은 붙이지 마세요.',
  ].join('\n\n');
}

async function claudeAssist(program, prompt) {
  const args = ['-p', '--input-format', 'text', '--output-format', 'text', '--tools', '', '--restricted', '--strict-mcp-config', '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence'];
  const result = await runChild(program, args, { input: prompt });
  if (result.code !== 0) throw new Error('subscription_request_failed');
  return result.stdout.trim();
}

async function geminiCliAssist(program, prompt) {
  const result = await runChild(program, ['-p', '', '--output-format', 'text', '--approval-mode', 'plan'], { input: prompt, cwd: os.tmpdir() });
  if (result.code !== 0) throw new Error('subscription_request_failed');
  return result.stdout.trim();
}

function objectValue(value) { return value && typeof value === 'object' ? value : {}; }

async function codexAssist(program, prompt) {
  const args = ['app-server', '-c', 'features.hooks=false', '-c', 'features.plugins=false', '-c', 'features.apps=false', '-c', 'features.memories=false', '-c', 'history.persistence="none"', '-c', 'web_search="disabled"', '--listen', 'stdio://'];
  const invocation = spawnSpec(program, args);
  const child = spawn(invocation.command, invocation.args, {
    cwd: os.tmpdir(), env: cleanEnv(program.command), shell: invocation.shell, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  activeChildren.add(child);
  let pending = new Map();
  let nextId = 1;
  let buffer = '';
  let stderr = '';
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('subscription_process_timeout')); }, REQUEST_TIMEOUT_MS);
    timer.unref?.();
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
  });
  let finalText = '';
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('subscription_process_closed')); }
    pending.clear();
    finishProcess(child);
  };
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (typeof message.id === 'number' && pending.has(message.id)) {
        const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timer);
        if (message.error) item.reject(new Error('subscription_rpc_failed')); else item.resolve(message.result);
      }
      if (message.method === 'turn/completed') {
        const turn = objectValue(objectValue(message.params).turn);
        const items = Array.isArray(turn.items) ? turn.items : [];
        const item = [...items].reverse().find((entry) => objectValue(entry).type === 'agentMessage');
        if (typeof item?.text === 'string') finalText = item.text;
      }
    }
  });
  child.stderr.on('data', (chunk) => { stderr = bounded(`${stderr}${chunk.toString('utf8')}`, 8_000); });
  child.once('close', close);
  child.once('error', () => close());
  try {
    await send('initialize', { clientInfo: { name: 'dawith-welfare-office', title: 'Dawith Welfare Office', version: '0.9.0' }, capabilities: { experimentalApi: false, requestAttestation: false } });
    child.stdin.write('{"method":"initialized"}\n');
    const thread = await send('thread/start', { cwd: os.tmpdir(), approvalPolicy: 'never', sandbox: 'read-only', serviceName: 'dawith-welfare-office', baseInstructions: 'Do not use tools, read files, browse, run commands, or call MCP. Return only the requested document result.', ephemeral: true, model: undefined });
    const threadId = objectValue(objectValue(thread).thread).id;
    if (typeof threadId !== 'string') throw new Error('subscription_rpc_failed');
    await send('turn/start', { threadId, input: [{ type: 'text', text: prompt, text_elements: [] }], outputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('subscription_process_timeout')), REQUEST_TIMEOUT_MS);
      timer.unref?.();
      const poll = () => { if (finalText) { clearTimeout(timer); resolve(); } else if (closed) { clearTimeout(timer); reject(new Error(stderr ? 'subscription_request_failed' : 'subscription_process_closed')); } else setTimeout(poll, 40); };
      poll();
    });
    return finalText.trim();
  } finally {
    stopProcess(child);
    close();
  }
}

export function createSubscriptionBridge() {
  return {
    async status() {
      const entries = await Promise.all(Object.keys(PROVIDERS).map((provider) => providerStatus(provider)));
      return { providers: Object.fromEntries(entries.map((entry) => [entry.provider, entry])), policy: 'explicit-user-choice' };
    },
    async assist(input) {
      const provider = String(input.provider || '');
      if (!isProvider(provider)) throw new Error('subscription_provider_invalid');
      const text = String(input.text || '').trim();
      if (!text) throw new Error('assist_text_required');
      if (text.length > MAX_PROMPT_LENGTH) throw new Error('assist_text_too_large');
      const program = await locate(provider);
      if (!program) throw new Error('subscription_not_installed');
      const prompt = promptFor({ task: String(input.task || ''), text, contextText: String(input.contextText || '') });
      const result = provider === 'claude-code' ? await claudeAssist(program, prompt) : provider === 'codex' ? await codexAssist(program, prompt) : await geminiCliAssist(program, prompt);
      if (!result) throw new Error('subscription_empty_result');
      return { result: result.slice(0, MAX_OUTPUT_LENGTH), provider, transfer: { external: true, destination: provider, userInitiated: true } };
    },
    async login(provider) {
      if (!isProvider(provider)) throw new Error('subscription_provider_invalid');
      const program = await locate(provider);
      if (!program) throw new Error('subscription_not_installed');
      const args = provider === 'claude-code' ? ['auth', 'login'] : provider === 'codex' ? ['login'] : [];
      const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'x-terminal-emulator';
      const commandArgs = process.platform === 'win32' ? ['/d', '/k', program.command, ...args] : process.platform === 'darwin' ? ['-a', 'Terminal', '--args', program.command, ...args] : ['-e', program.command, ...args];
      try {
        const child = spawn(command, commandArgs, { detached: true, stdio: 'ignore', windowsHide: false, shell: false });
        child.unref();
        return { provider, started: true };
      } catch { throw new Error('subscription_login_launch_failed'); }
    },
    close() {
      for (const child of [...activeChildren]) stopProcess(child);
      activeChildren.clear();
    },
  };
}

export { PROVIDERS };
