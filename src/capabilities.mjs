import fs from 'node:fs';
import os from 'node:os';
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
    return {
      available: true,
      models: (payload.models ?? []).map((model) => ({
        name: model.name,
        size: Number(model.size || 0),
        capabilities: model.details?.families || model.capabilities || [],
      })),
    };
  } catch {
    return { available: false, models: [] };
  }
}

function platformLabel() {
  return { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[process.platform] || process.platform;
}

export function recommendOllamaModel(memoryGB, cpuCores, installedModels = [], platform = process.platform) {
  const installed = installedModels
    .map((model) => typeof model === 'string' ? model : model?.name)
    .filter((name) => name && !name.toLowerCase().includes('embed') && !name.endsWith(':cloud'));
  const preferredInstalled = platform === 'darwin'
    ? ['gemma2:9b', 'gemma3:4b', 'qwen3:4b', 'qwen2.5:7b']
    : ['qwen2.5:7b', 'qwen3:4b', 'gemma3:4b', 'gemma2:9b', 'llama3.2:3b'];
  const installedModel = preferredInstalled.find((model) => installed.includes(model)) || installed[0] || '';
  let recommendation;
  if (memoryGB < 8 || cpuCores < 4) recommendation = { model: 'qwen2.5:3b', label: '가벼운 작업용', reason: '메모리가 적거나 CPU 코어가 적어 가벼운 모델을 우선합니다.', workload: '짧은 상담 메모·정형 요약', experience: '가벼운 편', download: '약 2GB 이상', fit: '권장' };
  else if (memoryGB < 24) recommendation = { model: 'qwen2.5:7b', label: '복지 기록 기본형', reason: '일반 사무용 PC에서 상담·회의록 품질과 속도의 균형을 우선합니다.', workload: '상담일지·회의록·후속조치', experience: '무난한 편', download: '약 5GB 이상', fit: '권장' };
  else if (memoryGB < 48) recommendation = { model: 'qwen2.5:14b', label: '긴 맥락 분석형', reason: '메모리 여유가 있어 긴 상담 기록과 여러 문단의 맥락을 더 안정적으로 다룹니다.', workload: '긴 상담 기록·문서 재작성', experience: '조금 느릴 수 있음', download: '약 9GB 이상', fit: '권장' };
  else recommendation = { model: 'qwen2.5:32b', label: '고품질 분석형', reason: '충분한 메모리에서 긴 맥락과 재작성 품질을 우선합니다.', workload: '긴 문서·복합 사례 분석', experience: '품질 우선·처리시간 김', download: '약 20GB 이상', fit: '권장' };
  return { ...recommendation, installedModel, installed: Boolean(installedModel) };
}

export function localRuntime() {
  const memoryGB = Math.max(1, Math.round(os.totalmem() / (1024 ** 3)));
  const cpuCores = Math.max(1, os.cpus().length);
  return { platform: process.platform, platformLabel: platformLabel(), arch: process.arch, memoryGB, cpuCores, recommendation: recommendOllamaModel(memoryGB, cpuCores) };
}

export async function getCapabilities(store) {
  const settings = store?.getSettings?.() ?? {};
  const system = localRuntime();
  const ollama = await localOllama();
  const recommendation = recommendOllamaModel(system.memoryGB, system.cpuCores, ollama.models, system.platform);
  const whisperPath = commandPath('whisper-cli') || commandPath('whisper');
  const modelPath = settings.whisperModelPath || process.env.WHISPER_MODEL_PATH || '';
  return {
    system,
    storage: { available: true, name: 'SQLite local file' },
    rules: { available: true, name: '로컬 규칙·템플릿' },
    ollama: {
      ...ollama,
      name: 'Ollama loopback',
      apiUrl: 'http://127.0.0.1:11434',
      modelDirectory: process.env.OLLAMA_MODELS || (system.platform === 'win32' ? '%USERPROFILE%\\.ollama\\models' : system.platform === 'darwin' ? '~/.ollama/models' : '~/.ollama/models'),
      install: {
        url: 'https://ollama.com/download',
        downloadUrl: system.platform === 'win32' ? 'https://ollama.com/download/OllamaSetup.exe' : system.platform === 'darwin' ? 'https://ollama.com/download/Ollama.dmg' : 'https://ollama.com/download',
        command: system.platform === 'win32' ? 'irm https://ollama.com/install.ps1 | iex' : 'curl -fsSL https://ollama.com/install.sh | sh',
      },
      recommendation,
    },
    whisper: { available: Boolean(whisperPath && modelPath && fs.existsSync(modelPath)), binary: whisperPath || null, modelConfigured: Boolean(modelPath && fs.existsSync(modelPath)), name: 'whisper.cpp local CLI' },
    cloud: { available: false, name: '외부 클라우드 AI 없음 (로컬 전용)' },
  };
}

export function whisperConfiguration(store) {
  const settings = store?.getSettings?.() ?? {};
  const binary = settings.whisperBinaryPath || commandPath('whisper-cli') || commandPath('whisper');
  const model = settings.whisperModelPath || process.env.WHISPER_MODEL_PATH || '';
  return { binary, model };
}
