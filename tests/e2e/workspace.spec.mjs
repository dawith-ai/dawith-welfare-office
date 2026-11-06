import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

async function pdfBuffer() {
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  return Buffer.from(await document.save());
}

test('홈에서 비AI 로컬 도구를 검색하고 분류할 수 있다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Dawith Local Tools/);
  await expect(page.locator('.tool-card')).toHaveCount(12);
  await page.locator('#toolSearch').fill('만나이');
  await expect(page.locator('.tool-card')).toHaveCount(1);
  await expect(page.locator('.tool-card')).toContainText('만나이 계산기');
  await page.locator('#privacyButton').click();
  await expect(page.locator('#privacyDialog')).toBeVisible();
  await page.locator('#closePrivacy').click();
});

test('텍스트 도구가 개인정보를 로컬에서 가린다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="text-tools"]').click();
  await page.locator('#textInput').fill('대상자 연락처 010-1234-5678, 이메일 test@example.com');
  await expect(page.locator('#textOutput')).toContainText('010-****-5678');
  await expect(page.locator('#textOutput')).toContainText('[이메일 가림]');
  await page.locator('[data-text-mode="replace"]').click();
  await page.locator('#replaceFind').fill('대상자');
  await page.locator('#replaceWith').fill('이용자');
  await expect(page.locator('#textOutput')).toContainText('이용자 연락처');
});

test('생년월일 타이핑과 금액 변환이 즉시 계산된다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="age-calculator"]').click();
  await page.locator('#birthDate').fill('20100510');
  await page.locator('#asOfDate').fill('20261106');
  await expect(page.locator('#ageResult')).toContainText('만 16세');
  await page.locator('[data-action="home"]').click();
  await page.locator('.tool-card[data-tool="money-converter"]').click();
  await page.locator('#moneyInput').fill('1250000');
  await expect(page.locator('#moneyResult')).toContainText('금 백이십오만원정');
});

test('PDF 합치기에서 여러 파일을 하나로 저장할 수 있다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="pdf-merge"]').click();
  await page.locator('#pdfInput').setInputFiles([
    { name: '01-안내.pdf', mimeType: 'application/pdf', buffer: await pdfBuffer() },
    { name: '02-신청서.pdf', mimeType: 'application/pdf', buffer: await pdfBuffer() },
  ]);
  await expect(page.locator('#pdfSummary')).toHaveText('2개');
  const download = page.waitForEvent('download');
  await page.locator('#pdfMergeButton').click();
  await download;
  await expect(page.locator('#pdfNotice')).toContainText('완료했습니다');
});

test('이미지 도구는 선택한 파일을 로컬 미리보기로 보여준다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="image-resize"]').click();
  await page.locator('#imageInput').setInputFiles('public/dawith-ci.png');
  await expect(page.locator('#imagePreview img')).toBeVisible();
  await expect(page.locator('#imageDownload')).toBeEnabled();
});

test('사진 정보 제거 도구는 결과 파일을 다운로드할 수 있다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="image-privacy"]').click();
  await page.locator('#imageInput').setInputFiles('public/dawith-ci.png');
  await expect(page.locator('#imageDownload')).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.locator('#imageDownload').click();
  await expect(await download).toBeTruthy();
  await expect(page.locator('#imageNotice')).toContainText('메타데이터');
});

test('인원 체크는 상태를 저장하고 현황을 갱신한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="attendance"]').click();
  await page.locator('#attendanceInput').fill('대상자 A\n대상자 B\n관리번호 24-018');
  await page.locator('#attendanceLoad').click();
  await expect(page.locator('#attendanceSummary')).toHaveText('3명');
  await page.locator('.attendance-status').first().selectOption('이용');
  await expect(page.locator('#attendanceCounts')).toContainText('이용');
  await expect(page.locator('#attendanceCounts span').nth(1).locator('b')).toHaveText('1');
  await expect(page.locator('#attendanceCsv')).toBeEnabled();
});

test('당직표는 직원 순서대로 날짜를 편성한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="duty-schedule"]').click();
  await page.locator('#dutyStaff').fill('김담당\n이사회복지사');
  await page.locator('#dutyStart').fill('2026-11-06');
  await page.locator('#dutyEnd').fill('2026-11-08');
  await page.locator('#dutyMake').click();
  await expect(page.locator('#dutySummary')).toHaveText('3일 편성');
  await expect(page.locator('#dutyRows tr')).toHaveCount(3);
  await expect(page.locator('.duty-assignee').first()).toHaveValue('김담당');
  await expect(page.locator('.duty-assignee').nth(1)).toHaveValue('이사회복지사');
  await expect(page.locator('#dutyCsv')).toBeEnabled();
});

test('작은 화면에서도 도구 작업대가 가로로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.tool-card[data-tool="text-tools"]').click();
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
});
