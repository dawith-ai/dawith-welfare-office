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
    return { available: true, models: (payload.models ?? []).map((model) => model.name) };
  } catch {
    return { available: false, models: [] };
  }
}

function platformLabel() {
  return { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[process.platform] || process.platform;
}

export function recommendOllamaModel(memoryGB, cpuCores) {
  if (memoryGB < 8 || cpuCores < 4) return { model: 'qwen2.5:3b', label: '가벼운 작업용', reason: '이 PC에서는 가벼운 모델이 멈춤 없이 사용하는 데 유리합니다.', workload: '짧은 상담 메모·정형 요약', experience: '가벼운 편', download: '부담 낮음', fit: '권장' };
  if (memoryGB < 24) return { model: 'qwen2.5:7b', label: '복지 기록 기본형', reason: '일반 사무용 PC에서 상담·회의록 품질과 속도의 균형이 가장 좋습니다.', workload: '상담일지·회의록·후속조치', experience: '무난한 편', download: '보통', fit: '권장' };
  if (memoryGB < 48) return { model: 'qwen2.5:14b', label: '긴 맥락 분석형', reason: '메모리 여유가 있어 긴 상담 기록과 여러 문단의 맥락을 더 안정적으로 다룹니다.', workload: '긴 상담 기록·문서 재작성', experience: '조금 느릴 수 있음', download: '큼', fit: '권장' };
  return { model: 'qwen2.5:32b', label: '고품질 분석형', reason: '충분한 메모리에서 긴 맥락과 재작성 품질을 우선할 수 있습니다.', workload: '긴 문서·복합 사례 분석', experience: '품질 우선·처리시간 김', download: '매우 큼', fit: '권장' };
}

export function localRuntime() {
  const memoryGB = Math.max(1, Math.round(os.totalmem() / (1024 ** 3)));
  const cpuCores = Math.max(1, os.cpus().length);
  return { platform: process.platform, platformLabel: platformLabel(), arch: process.arch, memoryGB, cpuCores, recommendation: recommendOllamaModel(memoryGB, cpuCores) };
}

export async function getCapabilities(store) {
  const settings = store?.getSettings?.() ?? {};
  const system = localRuntime();
  const whisperPath = commandPath('whisper-cli') || commandPath('whisper');
  const modelPath = settings.whisperModelPath || process.env.WHISPER_MODEL_PATH || '';
  return {
    system,
    storage: { available: true, name: 'SQLite local file' },
    rules: { available: true, name: '로컬 규칙·템플릿' },
    ollama: {
      ...(await localOllama()),
      name: 'Ollama loopback',
      install: {
        url: 'https://ollama.com/download',
        downloadUrl: system.platform === 'win32' ? 'https://ollama.com/download/OllamaSetup.exe' : system.platform === 'darwin' ? 'https://ollama.com/download/Ollama.dmg' : 'https://ollama.com/download',
        command: system.platform === 'win32' ? 'irm https://ollama.com/install.ps1 | iex' : 'curl -fsSL https://ollama.com/install.sh | sh',
      },
      recommendation: system.recommendation,
    },
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
