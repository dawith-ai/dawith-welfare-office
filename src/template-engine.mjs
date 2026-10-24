import path from 'node:path';
import JSZip from 'jszip';
import { PatchType, TextRun, patchDocument } from 'docx';

const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['.docx', '.hwpx']);
const labelHints = [
  [/기관|organization/i, '기관명'],
  [/사업명|program|business/i, '사업명'],
  [/기간|period|date/i, '기간'],
  [/대상|인원|participant|target/i, '대상·인원'],
  [/필요|배경|necessity|background/i, '추진 배경·필요성'],
  [/목표|goal|objective/i, '사업 목표'],
  [/활동|내용|activity|content/i, '주요 활동'],
  [/일정|schedule|timeline/i, '추진 일정'],
  [/예산|budget/i, '예산 계획'],
  [/성과|지표|indicator|outcome/i, '성과지표·평가방법'],
  [/회의|meeting/i, '회의명'],
  [/참석|attendee/i, '참석자'],
  [/안건|agenda/i, '주요 안건'],
  [/논의|discussion/i, '논의 내용'],
  [/결정|decision/i, '결정사항'],
  [/후속|action|next/i, '후속 실행 항목'],
];

function extension(fileName) {
  return path.extname(String(fileName || '')).toLowerCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character]));
}

function humanizeToken(token) {
  const normalized = String(token || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const hint = labelHints.find(([pattern]) => pattern.test(normalized))?.[1];
  return hint || normalized || '입력 항목';
}

function validateData(data) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data || '');
  if (!buffer.length || buffer.length > MAX_TEMPLATE_BYTES) throw new Error('template_size_invalid');
  return buffer;
}

async function xmlEntries(data) {
  const zip = await JSZip.loadAsync(validateData(data));
  const entries = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || !name.endsWith('.xml')) continue;
    entries.push({ name, text: await entry.async('text') });
  }
  return { zip, entries };
}

function findTokens(xmlText) {
  const tokens = new Set();
  const rawPattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
  const withoutTags = String(xmlText).replace(/<[^>]+>/g, '');
  for (const match of withoutTags.matchAll(rawPattern)) tokens.add(match[1].trim());
  return [...tokens].filter((token) => token.length > 0 && token.length < 120);
}

function hasExactToken(xmlText, token) {
  const escaped = escapeRegExp(token);
  return new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`).test(String(xmlText));
}

function fieldDescriptors(tokens) {
  return tokens.map((token, index) => ({
    key: token,
    token,
    label: humanizeToken(token),
    placeholder: `{{${token}}}`,
    required: true,
    order: index + 1,
  }));
}

export async function analyzeTemplate({ fileName, data } = {}) {
  const format = extension(fileName);
  if (!SUPPORTED_EXTENSIONS.has(format)) throw new Error('template_format_unsupported');
  const buffer = validateData(data);
  const { entries } = await xmlEntries(buffer);
  const tokens = [...new Set(entries.flatMap((entry) => findTokens(entry.text)))];
  const unsupportedTokens = format === '.hwpx' ? tokens.filter((token) => !entries.some((entry) => hasExactToken(entry.text, token))) : [];
  const fields = fieldDescriptors(tokens.filter((token) => !unsupportedTokens.includes(token)));
  return {
    format: format.slice(1),
    fileName: path.basename(String(fileName || '기관 양식')),
    size: buffer.length,
    fields,
    fieldCount: fields.length,
    ready: fields.length > 0 && unsupportedTokens.length === 0,
    warnings: unsupportedTokens.length ? [`${unsupportedTokens.map((token) => `{{${token}}}`).join(', ')} 태그가 XML 텍스트 노드로 분리되어 있습니다. 한 덩어리의 텍스트로 다시 입력하세요.`] : fields.length ? [] : ['양식에서 {{항목명}} 태그를 찾지 못했습니다. 원본 문서에 태그를 넣거나 항목 매핑을 수동으로 설정하세요.'],
    guidance: 'Word 또는 한글 양식의 입력 위치에 {{기관명}}, {{사업명}}, {{회의일시}}처럼 태그를 넣으면 원본 서식과 표를 유지한 채 값을 주입할 수 있습니다.',
  };
}

function textRunChildren(value) {
  const lines = String(value ?? '').split(/\r?\n/);
  return lines.flatMap((line, index) => [new TextRun({ text: line, break: index ? 1 : 0 })]);
}

async function renderDocx(data, fields) {
  const patches = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { type: PatchType.PARAGRAPH, children: textRunChildren(value) }]));
  return patchDocument({
    outputType: 'nodebuffer',
    data: validateData(data),
    patches,
    keepOriginalStyles: true,
  });
}

async function renderHwpx(data, fields) {
  const { zip, entries } = await xmlEntries(data);
  for (const entry of entries) {
    let replaced = entry.text;
    for (const [key, value] of Object.entries(fields)) {
      const token = escapeRegExp(key);
      replaced = replaced.replace(new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, 'g'), escapeXml(value));
    }
    if (replaced !== entry.text) zip.file(entry.name, replaced);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function renderTemplate({ fileName, data, fields = {} } = {}) {
  const format = extension(fileName);
  if (format === '.docx') return renderDocx(data, fields);
  if (format === '.hwpx') return renderHwpx(data, fields);
  throw new Error('template_format_unsupported');
}

export function uploadedTemplateId(id) {
  return `uploaded:${String(id || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export function isUploadedTemplateId(id) {
  return String(id || '').startsWith('uploaded:');
}

export { MAX_TEMPLATE_BYTES, SUPPORTED_EXTENSIONS };
