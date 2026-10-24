import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const asLines = (value) => String(value ?? '').split(/\r?\n/).filter((line) => line.trim());

export function documentToMarkdown(document) {
  const draft = document.payload || {};
  return `# ${draft.title || document.title || '복지 문서'}\n\n- 문서 유형: ${draft.templateLabel || document.templateId}\n- 작성 시각: ${draft.generatedAt || document.updatedAt || document.createdAt}\n- 자료 출처: ${draft.sourceType || '직접 입력'}\n\n${(draft.sections || []).map((section) => `## ${section.heading}\n\n${section.content || '내용 없음'}${section.note ? `\n\n> 검토 메모: ${section.note}` : ''}`).join('\n\n')}\n`;
}

export function documentToHtml(document) {
  const draft = document.payload || {};
  const sections = (draft.sections || []).map((section) => `<section><h2>${escapeHtml(section.heading)}</h2><pre>${escapeHtml(section.content || '내용 없음')}</pre>${section.note ? `<p class="note">검토 메모: ${escapeHtml(section.note)}</p>` : ''}</section>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(draft.title || document.title || 'Dawith 복지 문서')}</title><style>@page{size:A4;margin:18mm}body{font-family:"Malgun Gothic",Arial,sans-serif;color:#26382f;line-height:1.75;max-width:760px;margin:0 auto}header{padding-bottom:22px;border-bottom:2px solid #286b56}h1{margin:0;color:#205b47;font-size:28px}header p{color:#728078;font-size:12px;margin:8px 0 0}section{break-inside:avoid;margin:26px 0}h2{font-size:17px;color:#205b47;border-bottom:1px solid #dbe9df;padding-bottom:7px}pre{font:14px/1.8 "Malgun Gothic",Arial,sans-serif;white-space:pre-wrap;margin:0}.note{padding:9px 12px;background:#fff7e6;color:#876d3f;font-size:11px}</style></head><body><header><h1>${escapeHtml(draft.title || document.title || 'Dawith 복지 문서')}</h1><p>${escapeHtml(draft.templateLabel || document.templateId)} · 자료 출처: ${escapeHtml(draft.sourceType || '직접 입력')}</p></header>${sections}</body></html>`;
}

export async function documentToDocx(document) {
  const draft = document.payload || {};
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: draft.title || document.title || 'Dawith 복지 문서', bold: true, size: 34, font: 'Malgun Gothic', color: '205B47' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: `${draft.templateLabel || document.templateId} · 자료 출처: ${draft.sourceType || '직접 입력'}`, size: 20, font: 'Malgun Gothic', color: '728078' })] }),
  ];
  for (const section of draft.sections || []) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1, spacing: { before: 220, after: 100 }, run: { font: 'Malgun Gothic', color: '205B47' } }));
    for (const line of asLines(section.content || '내용 없음')) {
      children.push(new Paragraph({ text: line, spacing: { after: 80 }, run: { font: 'Malgun Gothic', size: 22 } }));
    }
    if (section.note) children.push(new Paragraph({ text: `검토 메모: ${section.note}`, spacing: { before: 60, after: 120 }, run: { font: 'Malgun Gothic', size: 18, color: '876D3F', italics: true } }));
  }
  const output = new Document({ creator: 'Dawith Welfare Office', title: draft.title || document.title, description: '기관 내부 검토용 복지 문서 초안', styles: { default: { document: { run: { font: 'Malgun Gothic', size: 22 } } } }, sections: [{ properties: {}, children }] });
  return Packer.toBuffer(output);
}
