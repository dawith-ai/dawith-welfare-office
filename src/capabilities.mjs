import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function commandPath(command) {
  const result = process.platform === 'win32'
    ? spawnSync('where', [command], { encoding: 'utf8', windowsHide: true })
    : spawnSync('sh', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

async function localOllama() {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(700) });
    if (!response.ok) return { available: false, models: [] };
    const payload = await response.json();
    return { available: true, models: (payload.models ?? []).map((model) => model.name) };
  } catch {
    return { available: false, models: [] };
  }
}

export async function getCapabilities(store) {
  const settings = store?.getSettings?.() ?? {};
  const whisperPath = commandPath('whisper-cli') || commandPath('whisper');
  const modelPath = settings.whisperModelPath || process.env.WHISPER_MODEL_PATH || '';
  return {
    storage: { available: true, name: 'SQLite local file' },
    rules: { available: true, name: '로컬 규칙·템플릿' },
    ollama: { ...(await localOllama()), name: 'Ollama loopback' },
    whisper: { available: Boolean(whisperPath && modelPath && fs.existsSync(modelPath)), binary: whisperPath || null, modelConfigured: Boolean(modelPath && fs.existsSync(modelPath)), name: 'whisper.cpp local CLI' },
    cloud: { available: false, name: '외부 클라우드 LLM (차단됨)' },
  };
}

export function whisperConfiguration(store) {
  const settings = store?.getSettings?.() ?? {};
  const binary = settings.whisperBinaryPath || commandPath('whisper-cli') || commandPath('whisper');
  const model = settings.whisperModelPath || process.env.WHISPER_MODEL_PATH || '';
  return { binary, model };
}
