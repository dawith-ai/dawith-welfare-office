import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Document, Paragraph, Packer } from 'docx';
import { test, expect } from '@playwright/test';

test('social-work meeting workflow can be completed locally', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Dawith Welfare Office/);
  await page.getByRole('button', { name: /사례회의 기록/ }).click();
  await page.getByRole('button', { name: '예시 넣기' }).click();
  await page.getByRole('button', { name: /초안 만들기/ }).click();
  await expect(page.locator('#outputContent')).toBeVisible();
  await expect(page.locator('#meetingBoard')).toBeVisible();
  await expect(page.locator('#standardEditor')).toBeHidden();
  await expect(page.locator('#meetingDecisionText')).toHaveValue(/논의 및 결정사항/);
  await page.getByRole('button', { name: /검토한 기록 저장/ }).click();
  await page.getByRole('button', { name: '기록 보관함' }).click();
  await expect(page.locator('#allRecords .record-item')).toHaveCount(1);
  await page.locator('#allRecords [data-record]').first().click();
  await expect(page.locator('#workspaceView')).toHaveClass(/active/);
  await page.locator('#meetingDecisionText').fill('검토자가 확인한 회의 결정사항입니다.');
  await page.getByRole('button', { name: /검토한 기록 저장/ }).click();
  await page.getByRole('button', { name: '기록 보관함' }).click();
  await page.locator('#recordSearch').fill('검토자가');
  await page.getByRole('button', { name: '검색' }).click();
  await expect(page.locator('#allRecords .record-item')).toHaveCount(1);
});

test('first launch explains the runtime and local Ollama setup', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtimePillText')).toHaveText('브라우저 로컬 모드');
  await expect(page.getByRole('button', { name: /상담 예시로 시작/ })).toBeVisible();
  await page.getByRole('button', { name: /상담 예시로 시작/ }).click();
  await expect(page.locator('#workspaceView')).toHaveClass(/active/);
  await expect(page.locator('#rawText')).toHaveValue(/친모는 7월에 이혼/);
  await page.getByRole('button', { name: /업무 선택/ }).click();
  await page.locator('[data-action="ollamaSetup"]').first().click();
  await expect(page.locator('#ollamaDialog')).toBeVisible();
  await expect(page.locator('#ollamaDownloadLink')).toHaveAttribute('href', 'https://ollama.com/download');
  await expect(page.locator('#ollamaCommand')).toHaveText('ollama pull qwen2.5:7b');
  await page.getByRole('button', { name: '×' }).last().click();
  await page.goto('/?desktop=1');
  await expect(page.locator('#runtimePillText')).toHaveText('Dawith 데스크톱 EXE');
});

test('a record can be assigned to a locally created case', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /상담 내용 정리/ }).click();
  await expect(page.locator('#caseSelect option')).toHaveCount(1);
  page.once('dialog', (dialog) => dialog.accept('합성 사례 B'));
  await page.getByRole('button', { name: /새 사례/ }).click();
  await expect(page.locator('#caseSelect option')).toHaveCount(2);
  await page.locator('#caseSelect').selectOption({ label: '합성 사례 B' });
  await page.getByRole('button', { name: '예시 넣기' }).click();
  await page.getByRole('button', { name: /초안 만들기/ }).click();
  await page.getByRole('button', { name: /검토한 기록 저장/ }).click();
  await page.getByRole('button', { name: '기록 보관함' }).click();
  await expect(page.locator('#allRecords')).toContainText('합성 사례 B');
});

for (const [taskName, expectedText] of [['상담 내용 정리', '상담일지'], ['녹취 파일 정리', '녹취 기반 상담기록']]) {
  test(`${taskName} creates a visible local draft`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(taskName) }).click();
    await page.getByRole('button', { name: '예시 넣기' }).click();
    await page.getByRole('button', { name: /초안 만들기/ }).click();
    await expect(page.locator('#outputTitle')).toHaveText(new RegExp(expectedText));
    await expect(page.locator('#outputText')).not.toHaveValue('');
    if (taskName === '녹취 파일 정리') await expect(page.locator('#audioResultMeta')).toBeVisible();
  });
}

test('document studio creates, edits, saves, and exports a business plan', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /기관 문서 만들기/ }).click();
  await expect(page.locator('#documentsView')).toHaveClass(/active/);
  await expect(page.locator('#documentFormTitle')).toHaveText('사업기획서');
  await page.getByRole('button', { name: '예시 채우기' }).click();
  await page.getByRole('button', { name: /문서 초안 만들기/ }).click();
  await expect(page.locator('#documentPreview .paper-header h1')).toContainText('주거취약가구 주거안정 지원사업');
  await expect(page.locator('#documentReviewStatus')).toHaveClass(/ready/);
  await page.locator('[data-doc-section="necessity"]').fill('담당자가 검토한 합성 필요성입니다.');
  await page.getByRole('button', { name: '검토한 문서 저장' }).click();
  await expect.poll(() => page.locator('#savedDocuments .saved-document-item').count()).toBeGreaterThan(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Word 다운로드' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
});

test('workbenches remain readable at a narrow laptop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 717, height: 825 });
  for (const taskName of ['사례회의 기록', '녹취 파일 정리']) {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(taskName) }).click();
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      workspaceColumns: getComputedStyle(document.querySelector('.workspace-grid')).gridTemplateColumns,
      inputColumns: getComputedStyle(document.querySelector('.input-column')).gridTemplateColumns,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport + 1);
    expect(layout.workspaceColumns).toBe('677px');
    expect(layout.inputColumns).toBe('677px');
  }
});

test('document studio switches the built-in welfare document templates', async ({ page }) => {
  await page.route('**/api/document-templates', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: /기관 문서 만들기/ }).click();
  await page.locator('#documentTemplates [data-doc-template="business-report"]').click();
  await expect(page.locator('#documentFormTitle')).toHaveText('사업보고서');
  await page.getByRole('button', { name: '예시 채우기' }).click();
  await page.getByRole('button', { name: /문서 초안 만들기/ }).click();
  await expect(page.locator('#documentPreview .paper-header h1')).toContainText('사업보고서');
  await page.locator('#documentTemplates [data-doc-template="meeting-minutes"]').click();
  await expect(page.locator('#documentFormTitle')).toHaveText('회의록');
  await page.getByRole('button', { name: '예시 채우기' }).click();
  await page.getByRole('button', { name: /문서 초안 만들기/ }).click();
  await expect(page.locator('#documentPreview .paper-header h1')).toContainText('회의록');
});

test('document studio uploads a tagged institution template and exports the filled original format', async ({ page }) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-e2e-template-'));
  const templatePath = path.join(tempDir, '기관양식.docx');
  const template = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('기관: {{기관명}}'), new Paragraph('사업명: {{사업명}}')] }] }));
  fs.writeFileSync(templatePath, template);
  try {
    await page.goto('/');
    await page.getByRole('button', { name: /기관 문서 만들기/ }).click();
    await page.locator('#documentTemplateFile').setInputFiles(templatePath);
    await expect(page.locator('#documentFormTitle')).toHaveText('기관양식.docx');
    await expect(page.locator('#documentTemplateStatus')).toContainText('로컬 템플릿');
    await page.locator('[data-doc-field="기관명"]').fill('합성 사회복지관');
    await page.locator('[data-doc-field="사업명"]').fill('주거안정 지원사업');
    await page.getByRole('button', { name: /문서 초안 만들기/ }).click();
    await expect(page.locator('#documentPreview .paper-header h1')).toHaveText('기관양식 작성본');
    await expect(page.locator('#documentReviewStatus')).toHaveClass(/ready/);
    await page.getByRole('button', { name: '검토한 문서 저장' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Word 다운로드' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
