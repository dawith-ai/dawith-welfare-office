import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.ogg', '.flac', '.aac', '.webm']);

function safeFileName(fileName = 'audio.wav') {
  const original = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const extension = path.extname(original).toLowerCase() || '.wav';
  return `${crypto.randomUUID()}${AUDIO_EXTENSIONS.has(extension) ? extension : '.wav'}`;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function parseWhisperJson(value) {
  try {
    const payload = typeof value === 'string' ? JSON.parse(value) : value;
    const rows = Array.isArray(payload?.transcription) ? payload.transcription : Array.isArray(payload?.segments) ? payload.segments : [];
    const segments = rows.map((row, index) => {
      const text = String(row.text ?? '').trim();
      const from = row.timestamps?.from ?? row.start ?? row.offsets?.from ?? null;
      const to = row.timestamps?.to ?? row.end ?? row.offsets?.to ?? null;
      return { index, text, from, to };
    }).filter((row) => row.text);
    return { text: segments.map((row) => row.text).join(' ').trim(), segments };
  } catch {
    return { text: '', segments: [] };
  }
}

function runWhisper({ binary, model, inputPath, outputBase }) {
  return new Promise((resolve, reject) => {
    const args = ['-m', model, '-f', inputPath, '-l', 'ko', '-nt', '-otxt', '-oj', '-of', outputBase];
    const usesWindowsScript = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(binary);
    const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, shell: usesWindowsScript });
    let error = '';
    child.stderr.on('data', (chunk) => { error += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) return reject(new Error(`whisper_exit_${code}:${error.slice(-500)}`));
      const textPath = `${outputBase}.txt`;
      const jsonPath = `${outputBase}.json`;
      const text = fs.existsSync(textPath) ? fs.readFileSync(textPath, 'utf8').trim() : '';
      const parsed = fs.existsSync(jsonPath) ? parseWhisperJson(fs.readFileSync(jsonPath, 'utf8')) : { text: '', segments: [] };
      resolve({ text: parsed.text || text, segments: parsed.segments });
    });
  });
}

export async function transcribeAudio({ fileName = 'audio.wav', data, binary, model }) {
  if (!binary || !model || !fs.existsSync(model)) throw new Error('whisper_model_not_configured');
  if (!Buffer.isBuffer(data) || !data.length || data.length > 50 * 1024 * 1024) throw new Error('audio_size_invalid');
  const extension = path.extname(String(fileName)).toLowerCase();
  if (extension && !AUDIO_EXTENSIONS.has(extension)) throw new Error('audio_format_unsupported');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-transcription-'));
  const inputPath = path.join(tempDir, safeFileName(fileName));
  const outputBase = path.join(tempDir, 'transcript');
  fs.writeFileSync(inputPath, data, { mode: 0o600 });
  try {
    const result = await runWhisper({ binary, model, inputPath, outputBase });
    return {
      text: result.text,
      segments: result.segments,
      sourceName: String(fileName).slice(0, 240),
      sourceHash: sha256(data),
      backend: 'whisper.cpp-local',
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
