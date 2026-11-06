import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

async function pdfBuffer() {
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  return Buffer.from(await document.save());
}

let rhwpReady;
async function hwpxBuffer() {
  const module = await import('../../public/vendor/rhwp/rhwp.js');
  rhwpReady ||= module.default({ module_or_path: await readFile(new URL('../../public/vendor/rhwp/rhwp_bg.wasm', import.meta.url)) });
  await rhwpReady;
  const document = module.HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, '기관명: {{기관명}}\n2026년 사례회의 양식\n결정사항을 입력하세요.');
  const bytes = Buffer.from(document.exportHwpx());
  document.free();
  return bytes;
}

test('홈에서 비AI 로컬 도구를 검색하고 분류할 수 있다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Dawith Local Tools/);
  await expect(page.locator('.tool-card')).toHaveCount(14);
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

test('HWPX 양식은 rhwp WASM으로 로컬 텍스트를 추출한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="hwp-inspector"]').click();
  await page.locator('#hwpInput').setInputFiles({ name: '사례회의.hwpx', mimeType: 'application/octet-stream', buffer: await hwpxBuffer() });
  await expect(page.locator('#hwpEngineStatus')).toHaveText('엔진 준비됨');
  await expect(page.locator('#hwpPreview')).toContainText('2026년 사례회의 양식');
  await expect(page.locator('#hwpPageCount')).toContainText('1페이지');
  await expect(page.locator('#hwpUseAsSource')).toBeEnabled();
  await page.locator('#hwpQuery').fill('{{기관명}}');
  await page.locator('#hwpReplacement').fill('다위복지관');
  const download = page.waitForEvent('download');
  await page.locator('#hwpReplaceSave').click();
  expect((await download).suggestedFilename()).toMatch(/\.hwpx$/);
  await expect(page.locator('#hwpPreview')).toContainText('다위복지관');
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

test('기관 양식 작업공간은 기관 정보와 문서 초안을 로컬에서 만든다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="template-studio"]').click();
  await page.locator('#profileOrganization').fill('다위종합사회복지관');
  await page.locator('#profileManager').fill('김담당');
  await page.locator('#profileSave').click();
  await page.locator('#templateProject').fill('주거취약가구 지원사업');
  await page.locator('#templatePurpose').fill('지역 내 주거 불안 가구를 지원하기 위해 작성함');
  await page.locator('#templateContent').fill('임대주택 신청 안내와 서류 확인을 진행함');
  await page.locator('#templateDecisions').fill('다음 상담에서 신청서류를 확인하기로 함');
  await expect(page.locator('#templatePreview')).toContainText('다위종합사회복지관');
  await expect(page.locator('#templatePreview')).toContainText('주거취약가구 지원사업');
  await expect(page.locator('#templatePreview')).toContainText('다음 상담에서 신청서류를 확인하기로 함');
  await page.locator('#templateName').fill('우리 기관 회의록');
  await page.locator('#templateBody').fill('기관: {{기관명}}\n사업: {{사업명}}\n내용: {{내용}}');
  await page.locator('#templateSave').click();
  await expect(page.locator('#templateNotice')).toContainText('저장했습니다');
});

test('작은 화면에서도 도구 작업대가 가로로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.tool-card[data-tool="text-tools"]').click();
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
});
