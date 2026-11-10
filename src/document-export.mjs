import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { summarySections, summaryTitle } from './record-summary.mjs';
import { placeholderGuide } from './record-templates.mjs';

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

const FONT = 'Malgun Gothic';
const textParagraphs = (value, size = 22) => (asLines(value).length ? asLines(value) : ['']).map((line) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: line, font: FONT, size })] }));
const cell = (value, { bold = false, shade = false, width } = {}) => new TableCell({
  width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
  shading: shade ? { fill: 'E8F0EA' } : undefined,
  children: bold ? [new Paragraph({ children: [new TextRun({ text: String(value ?? ''), bold: true, font: FONT, size: 20 })] })] : textParagraphs(value, 20),
});

// 상담 기록 / 회의록 summary -> Word. header: { organization, author, date } (optional).
export async function summaryToDocx(summary, header = {}) {
  const title = summary.kind === 'template' ? summary.templateName || '기록' : summaryTitle(summary.kind);
  const meta = [header.organization && `기관: ${header.organization}`, header.author && `작성자: ${header.author}`, header.date ? `일자: ${header.date}` : `작성일: ${new Date().toLocaleDateString('ko-KR')}`].filter(Boolean).join(' · ');
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: title, bold: true, size: 34, font: FONT, color: '205B47' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: meta, size: 20, font: FONT, color: '728078' })] }),
  ];
  for (const section of summarySections(summary)) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [new TextRun({ text: section.heading, bold: true, font: FONT, size: 26, color: '205B47' })] }));
    if (section.rows) {
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: section.rows.map(([label, value]) => new TableRow({ children: [cell(label, { bold: true, shade: true, width: 18 }), cell(value || '-', { width: 82 })] })) }));
    } else if (section.table) {
      const rows = section.table.rows.length ? section.table.rows : [['(할 일 없음)', '', '']];
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ tableHeader: true, children: section.table.columns.map((label, index) => cell(label, { bold: true, shade: true, width: index === 0 ? 60 : 20 })) }),
        ...rows.map((row) => new TableRow({ children: row.map((value, index) => cell(value || '-', { width: index === 0 ? 60 : 20 })) })),
      ] }));
    } else {
      children.push(...textParagraphs(section.content || '-'));
    }
  }
  children.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: '이 문서는 검토용 초안입니다. 담당자가 원문과 대조한 뒤 확정하세요.', italics: true, size: 18, font: FONT, color: '876D3F' })] }));
  const output = new Document({ creator: 'Dawith Welfare Office', title, description: '기관 내부 검토용 기록 초안', styles: { default: { document: { run: { font: FONT, size: 22 } } } }, sections: [{ properties: {}, children }] });
  return Packer.toBuffer(output);
}

// A starter institution form for a record template: a two-column table with a
// {{표식}} in every value cell. Users open it in Word/한글, restyle it as they
// like, and upload it back to have the summary poured in.
export async function recordFormStarterDocx(template) {
  const rows = placeholderGuide(template).map(({ token }) => new TableRow({ children: [cell(token, { bold: true, shade: true, width: 24 }), cell(`{{${token}}}`, { width: 76 })] }));
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: template.name, bold: true, size: 34, font: FONT })] }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
    new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: '{{ }} 안의 표식은 지우지 말고, 표와 글꼴은 기관 양식에 맞게 고쳐 쓰세요.', size: 18, font: FONT, color: '728078' })] }),
  ];
  const output = new Document({ creator: 'Dawith Welfare Office', title: template.name, styles: { default: { document: { run: { font: FONT, size: 22 } } } }, sections: [{ properties: {}, children }] });
  return Packer.toBuffer(output);
}
