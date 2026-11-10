import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

// The app is local-AI only: records never leave the PC. These tests pin that the
// cloud/subscription AI surface (removed after 0.9.9) stays gone.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir, extensions) {
  const found = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['vendor', 'node_modules'].includes(entry.name)) found.push(...sourceFiles(relative, extensions));
    } else if (extensions.includes(path.extname(entry.name))) found.push(relative);
  }
  return found;
}

const appSources = () => ['server.mjs', ...sourceFiles('src', ['.mjs']), ...sourceFiles('desktop', ['.mjs']), ...sourceFiles('public', ['.js'])];

test('removed cloud AI routes answer 404', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-local-only-'));
  const runtime = await startServer({ port: 0, dataDir });
  try {
    const routes = [
      ['GET', '/api/ai/subscription/status'],
      ['POST', '/api/ai/subscription/login'],
      ['POST', '/api/ai/subscription/assist'],
      ['POST', '/api/ai/connect'],
      ['POST', '/api/ai/disconnect'],
    ];
    for (const [method, route] of routes) {
      const response = await fetch(`${runtime.url}${route}`, method === 'GET' ? {} : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'openrouter', text: '합성 원문', confirmExternal: true }) });
      assert.equal(response.status, 404, `${method} ${route}`);
      await response.arrayBuffer();
    }
    const health = await fetch(`${runtime.url}/api/health`).then((response) => response.json());
    assert.equal(health.externalProviders, 'blocked');
  } finally {
    await new Promise((resolve) => runtime.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('local assist accepts only the Ollama tasks and models, whatever provider is requested', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-local-assist-'));
  const runtime = await startServer({ port: 0, dataDir });
  try {
    const post = (payload) => fetch(`${runtime.url}/api/ai/assist`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const badModel = await post({ provider: 'gemini', task: 'text-clean', text: '합성 원문', model: 'gpt-4o' });
    assert.equal(badModel.status, 400);
    assert.equal((await badModel.json()).error, 'ollama_model_not_allowed');
    const badTask = await post({ provider: 'claude-code', task: 'anything', text: '합성 원문' });
    assert.equal(badTask.status, 400);
    assert.equal((await badTask.json()).error, 'ollama_assist_task_not_allowed');
  } finally {
    await new Promise((resolve) => runtime.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('no module imports or ships the removed subscription / ai-connections bridges', () => {
  assert.equal(fs.existsSync(path.join(root, 'src', 'subscription.mjs')), false);
  assert.equal(fs.existsSync(path.join(root, 'src', 'ai-connections.mjs')), false);
  const sources = appSources();
  assert.ok(sources.includes('server.mjs') && sources.some((file) => file.endsWith('toolbox.js')));
  for (const file of [...sources, ...sourceFiles('test', ['.mjs']), ...sourceFiles(path.join('tests', 'e2e'), ['.mjs'])]) {
    if (file === path.join('test', 'local-only.test.mjs')) continue;
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(text, /(?:subscription|ai-connections)\.mjs/, file);
    assert.doesNotMatch(text, /createSubscriptionBridge|createAiConnectionManager/, file);
  }
});

test('app code holds no cloud AI endpoints', () => {
  const cloudHosts = /api\.openai\.com|auth\.openai\.com|chatgpt\.com|openrouter\.ai|generativelanguage\.googleapis\.com|api\.anthropic\.com|\/api\/ai\/(?:subscription|connect|disconnect)|value="cloud"|cloud:\$\{|ensureExternalAi/;
  for (const file of appSources()) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), cloudHosts, file);
  }
});
