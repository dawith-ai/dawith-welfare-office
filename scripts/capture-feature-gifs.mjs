// Records short GIFs of the main tools for the README and the product site.
//   node scripts/capture-feature-gifs.mjs [name ...]
// Drives the real app in Chromium with fictional sample data; local AI is
// pointed at a dead port so results come from the built-in rules.
// Output: site/media/<name>.gif (used by the product site and README.md)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import gifenc from 'gifenc';
import upngModule from '@pdf-lib/upng';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, Table, TableCell, TableRow } from 'docx';
import { startServer } from '../server.mjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const UPNG = upngModule.default || upngModule;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'site', 'media');
const viewport = { width: 1200, height: 760 };
const agreed = { agreed: true, at: '2026-11-11T00:00:00.000Z' };
const consent = { policyVersion: '2026-11-11', privacy: agreed, terms: agreed, updatedAt: agreed.at };

const counselingMemo = '3월 12일 내담자는 월세가 두 달 밀려 퇴거가 걱정된다고 호소함. 표정이 어둡고 말수가 적었음. 자녀 양육은 꾸준히 하고 있으며 취업 의지가 있음. 주거급여 신청 절차를 안내하였음. 다음 주에 주민센터와 연계하여 신청서류를 확인하기로 함.';

function recorder(page) {
  const frames = [];
  return {
    frames,
    async shot(delay = 700) {
      await page.waitForTimeout(150);
      const image = UPNG.decode(await page.screenshot({ type: 'png' }));
      frames.push({ rgba: new Uint8Array(UPNG.toRGBA8(image)[0]), width: image.width, height: image.height, delay });
    },
    async type(locator, text, steps = 6) {
      for (let index = 1; index <= steps; index += 1) {
        await locator.fill(text.slice(0, Math.ceil((text.length * index) / steps)));
        await this.shot(index === steps ? 800 : 180);
      }
    },
  };
}

function writeGif(name, frames) {
  const gif = GIFEncoder();
  for (const frame of frames) {
    const palette = quantize(frame.rgba, 256, { format: 'rgb565' });
    gif.writeFrame(applyPalette(frame.rgba, palette, 'rgb565'), frame.width, frame.height, { palette, delay: frame.delay });
  }
  gif.finish();
  const file = path.join(outDir, `${name}.gif`);
  fs.writeFileSync(file, gif.bytes());
  if (process.env.GIF_PREVIEW) frames.forEach((frame, index) => fs.writeFileSync(path.join(process.env.GIF_PREVIEW, `${name}-${index}.png`), Buffer.from(UPNG.encode([frame.rgba.buffer], frame.width, frame.height, 0))));
  console.log(`${name}.gif ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)}MB, ${frames.length} frames`);
}

async function institutionFormDocx() {
  const row = (label, value) => new TableRow({ children: [new TableCell({ children: [new Paragraph(label)] }), new TableCell({ children: [new Paragraph(value)] })] });
  const document = new Document({ sections: [{ children: [
    new Paragraph('{{기관명}} 상담일지'),
    new Table({ rows: [row('상담일', '{{상담일}}'), row('담당자', '{{담당자}}'), row('대상자', '{{대상자}}'), row('관찰사항', '{{관찰사항}}'), row('상담원 소견', '{{소견}}'), row('향후 계획', '{{향후 계획}}')] }),
  ] }] });
  return Buffer.from(await Packer.toBuffer(document));
}

async function samplePdf(title, pages) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index += 1) document.addPage([420, 595]).drawText(`${title} ${index + 1}`, { x: 40, y: 540, size: 22, font });
  return Buffer.from(await document.save());
}

// Keeps the drawing in view while the form on the left changes.
const showPreview = (page) => page.locator('#diagramPreview').evaluate((node) => window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 90));

const flows = {
  async records(page, rec) {
    await page.goto('/?tool=case-record');
    await page.locator('#recordTemplate').selectOption('preset-observation');
    await rec.shot(900);
    await rec.type(page.locator('#recordRaw'), counselingMemo);
    await page.locator('#recordProcess').click();
    await page.locator('.sum-section').first().waitFor();
    await page.locator('.sum-section').first().scrollIntoViewIfNeeded();
    await rec.shot(2000);
    await page.locator('[data-sum-view="combined"]').click();
    await page.locator('[data-sum-view="combined"]').scrollIntoViewIfNeeded();
    await rec.shot(2400);
  },
  async 'form-fill'(page, rec) {
    await page.goto('/?tool=case-record');
    await page.locator('#recordTemplate').selectOption('preset-observation');
    await page.locator('#recordRaw').fill(counselingMemo);
    await page.locator('#recordProcess').click();
    await page.locator('.sum-section').first().waitFor();
    await page.locator('.sum-section[data-section="상담원 소견"]').fill('주거 위기 단서가 있어 주거급여 연계가 필요함.');
    await page.locator('#recordFormInput').scrollIntoViewIfNeeded();
    await rec.shot(1200);
    await page.locator('#recordFormInput').setInputFiles({ name: '우리기관_상담일지.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await institutionFormDocx() });
    await page.locator('.record-form-summary').waitFor();
    await page.locator('.record-form-summary').scrollIntoViewIfNeeded();
    await rec.shot(2400);
    await page.locator('#recordFormFill').scrollIntoViewIfNeeded();
    await rec.shot(2000);
  },
  async genogram(page, rec) {
    await page.goto('/?tool=genogram');
    await page.locator('.diagram-source summary').click();
    await rec.shot(800);
    await rec.type(page.locator('#diagramSourceText'), '내담자(40세 여성)는 남편과 이혼 후 딸(12세), 아들(9세)과 함께 살고 있다. 어머니는 작년에 돌아가셨고 아버지와 남동생은 지방에 산다.', 5);
    await page.locator('#diagramExtract').click();
    await page.locator('.diagram-candidate').first().waitFor();
    await rec.shot(1600);
    await page.locator('#diagramAddAllCandidates').click();
    await page.locator('.geno-member').first().waitFor();
    await showPreview(page);
    await rec.shot(2800);
  },
  async ecomap(page, rec) {
    await page.goto('/?tool=ecomap');
    await page.locator('#ecoMembers').fill('본인(42), 딸(12)');
    await showPreview(page);
    await rec.shot(800);
    const add = async (name, category, strength, direction) => {
      await page.locator('#ecoName').fill(name);
      await page.locator('#ecoCategory').fill(category);
      await page.locator('#ecoStrength').selectOption(strength);
      await page.locator('#ecoDirection').selectOption(direction);
      await page.locator('#ecoResourceSubmit').click();
      await showPreview(page);
      await rec.shot(900);
    };
    await add('행정복지센터', '공공', 'strong', 'receive');
    await add('서울중학교', '아동·교육', 'conflict', 'both');
    await add('지역아동센터', '돌봄', 'normal', 'receive');
    await add('교회 친구', '이웃·친구', 'weak', 'both');
    await rec.shot(2600);
  },
  async 'pdf-merge'(page, rec) {
    await page.goto('/?tool=pdf-merge');
    await rec.shot(900);
    await page.locator('#pdfInput').setInputFiles([
      { name: '01-신청서.pdf', mimeType: 'application/pdf', buffer: await samplePdf('Application', 2) },
      { name: '02-소득증빙.pdf', mimeType: 'application/pdf', buffer: await samplePdf('Income', 1) },
      { name: '03-동의서.pdf', mimeType: 'application/pdf', buffer: await samplePdf('Consent', 1) },
    ]);
    await page.waitForTimeout(800);
    await rec.shot(2600);
  },
  async privacy(page, rec) {
    await page.goto('/?tool=text-tools');
    await rec.shot(800);
    await rec.type(page.locator('#textInput'), '대상자 김민지 연락처 010-1234-5678, 이메일 minji@example.com, 계좌 110-123-456789 로 지원금 입금 예정.', 6);
    await rec.shot(2200);
  },
  async update(page, rec) {
    let downloading = false;
    let polls = 0;
    await page.route('**/api/update/**', async (route) => {
      const action = route.request().url().split('/api/update/')[1];
      const base = { supported: true, runtime: 'lite', mode: 'installer', currentVersion: '1.0.5', latestVersion: '1.0.6', notes: ['기록 정리 결과를 항목별·한 번에 보기로 바꿔 볼 수 있습니다', '업데이트 진행률을 MB 단위로 보여 줍니다'], received: 0, total: 26_900_000, progress: 0 };
      let body = { ...base, status: 'available' };
      if (action === 'download') { downloading = true; body = { ...base, status: 'downloading' }; }
      if (action === 'status' && downloading) {
        polls += 1;
        const progress = Math.min(100, polls * 12);
        body = { ...base, status: progress < 100 ? 'downloading' : 'downloaded', progress, received: Math.round((26_900_000 * progress) / 100) };
      }
      if (action === 'install') body = { ...base, status: 'installing', progress: 100 };
      await route.fulfill({ json: body });
    });
    await page.goto('/');
    await page.locator('#updateButton.has-update').waitFor();
    await rec.shot(1400);
    await page.locator('#updateButton').click();
    await rec.shot(2200);
    await page.locator('#updateAction').click();
    for (let index = 0; index < 4; index += 1) {
      await page.waitForTimeout(1000);
      await rec.shot(500);
    }
    await page.waitForTimeout(3500);
    await rec.shot(1800);
  },
};

const wanted = process.argv.slice(2);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-gif-'));
const { server, url } = await startServer({ port: 0, dataDir, ollamaBaseUrl: 'http://127.0.0.1:9' });
const browser = await chromium.launch();
fs.mkdirSync(outDir, { recursive: true });
try {
  for (const [name, flow] of Object.entries(flows)) {
    if (wanted.length && !wanted.includes(name)) continue;
    const context = await browser.newContext({ viewport, baseURL: url, locale: 'ko-KR', deviceScaleFactor: 1 });
    await context.addInitScript((record) => localStorage.setItem('dawith-consent-v1', JSON.stringify(record)), consent);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const rec = recorder(page);
    try {
      await flow(page, rec);
      writeGif(name, rec.frames);
    } catch (error) {
      console.error(`${name} failed: ${error.message.split('\n')[0]}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* SQLite may still hold the file on Windows */ }
}
