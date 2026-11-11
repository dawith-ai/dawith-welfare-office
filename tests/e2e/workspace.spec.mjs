import { test, expect } from './fixtures.mjs';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, Table, TableCell, TableRow } from 'docx';

async function pdfBuffer(pageCount = 1) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) document.addPage([200, 200]);
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
  await expect(page).toHaveTitle(/Dawith 복지 업무 도구함/);
  await expect(page.locator('.tool-card')).toHaveCount(19);
  await page.locator('#toolSearch').fill('만나이');
  await expect(page.locator('.tool-card')).toHaveCount(1);
  await expect(page.locator('.tool-card')).toContainText('만나이 계산기');
  await page.locator('#privacyButton').click();
  await expect(page.locator('#privacyDialog')).toBeVisible();
  await page.locator('#closePrivacy').click();
});

test('왼쪽 분류를 누르면 머리말과 도구 목록이 함께 바뀐다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero-row')).toBeVisible();
  await page.locator('.category-button[data-category="image"]').click();
  await expect(page.locator('.hero-row')).toBeHidden();
  await expect(page.locator('.recommendation-row')).toBeHidden();
  await expect(page.locator('#categoryTitle')).toHaveText('이미지');
  await expect(page.locator('.tool-card')).toHaveCount(4);
  await expect(page.locator('.tool-card').first()).toBeInViewport();
  await page.locator('.tool-card[data-tool="image-resize"]').click();
  await expect(page.locator('.category-button.active')).toHaveAttribute('data-category', 'image');
  await page.locator('#homeButton').click();
  await expect(page.locator('.hero-row')).toBeVisible();
  await expect(page.locator('.category-button.active')).toHaveAttribute('data-category', 'all');
});

test('웹 앱 머리말은 소개 사이트의 내려받기로 연결한다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#downloadLink')).toHaveAttribute('href', 'https://dawith-ai.github.io/dawith-welfare-office/#download');
});

test('문서 형식 변환은 파일을 브라우저 안에서 변환해 다운로드한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="document-convert"]').click();
  await page.locator('#convertInput').setInputFiles({
    name: '회의기록.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# 사례회의\n\n- 서비스 연계 결정\n', 'utf8'),
  });
  await expect(page.locator('#convertFileSummary')).toContainText('회의기록.md');
  await page.locator('#convertFormat').selectOption('html');
  await expect(page.locator('#convertPreview')).toContainText('<h1>사례회의</h1>');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#convertButton').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('회의기록.html');
});

test('제품 안내 페이지에서 시작 흐름과 데이터 경계를 확인할 수 있다', async ({ page }) => {
  await page.goto('/guide.html');
  await expect(page).toHaveTitle(/사용 안내/);
  await expect(page.locator('h1')).toContainText('기록은 가까이');
  await expect(page.locator('#boundary')).toContainText('외부 전송 없음');
  await expect(page.locator('.nav-cta')).toHaveAttribute('href', './');
});

test('작업 화면에서도 왼쪽 메뉴가 즉시 목록으로 전환된다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="pdf-merge"]').click();
  await expect(page.locator('#workspaceView')).toBeVisible();
  await page.locator('.category-button[data-category="image"]').click();
  await expect(page.locator('#homeView')).toBeVisible();
  await expect(page.locator('.tool-card')).toHaveCount(4);
  await expect(page.locator('.tool-card[data-tool="image-compress"]')).toBeVisible();
  await page.locator('.category-button[data-category="ai"]').click();
  await expect(page.locator('.tool-card[data-tool="ai-setup"]')).toBeVisible();
  await page.locator('.tool-card[data-tool="ai-setup"]').click();
  await expect(page.locator('#aiInstallLink')).toBeVisible();
  await expect(page.locator('#aiRefresh')).toBeVisible();
});

test('텍스트 도구가 개인정보를 로컬에서 가린다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="text-tools"]').click();
  await page.locator('#textInput').fill('대상자 연락처 010-1234-5678, 이메일 test@example.com');
  await expect(page.locator('#textOutput')).toContainText('010-****-5678');
  await expect(page.locator('#textOutput')).toContainText('[이메일 가림]');
  await page.locator('#textInput').fill('계좌 110-123-456789 확인');
  await expect(page.locator('#textOutput')).toContainText('계좌 110-****-**** 확인');
  await page.locator('#textInput').fill('대상자 연락처 010-1234-5678, 이메일 test@example.com');
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
  await expect(page.locator('#moneyInput')).toHaveValue('1,250,000');
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

test('PDF 나누기는 지정한 페이지만 새 파일로 저장한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="pdf-split"]').click();
  await page.locator('#splitPdfInput').setInputFiles({ name: '원본.pdf', mimeType: 'application/pdf', buffer: await pdfBuffer(3) });
  await expect(page.locator('#splitFileList')).toContainText('3페이지');
  await page.locator('#splitRange').fill('2');
  const download = page.waitForEvent('download');
  await page.locator('#splitButton').click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await expect(page.locator('#splitNotice')).toContainText('1페이지');
});

test('HWPX 양식은 rhwp WASM으로 로컬 텍스트를 추출한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="hwp-inspector"]').click();
  await page.locator('#hwpInput').setInputFiles({ name: '사례회의.hwpx', mimeType: 'application/octet-stream', buffer: await hwpxBuffer() });
  await expect(page.locator('#hwpEngineStatus')).toHaveText('엔진 준비됨');
  await expect(page.locator('#hwpPreview')).toContainText('2026년 사례회의 양식');
  await expect(page.locator('#hwpPageCount')).toContainText('1페이지');
  await expect(page.locator('#hwpUseAsSource')).toBeEnabled();
  await expect(page.locator('#hwpLocalAi')).toBeEnabled();
  await expect(page.locator('#hwpSubscriptionAi')).toHaveCount(0);
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

test('이미지 압축·회전과 날짜 기간 계산이 결과를 만든다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="image-compress"]').click();
  await page.locator('#imageInput').setInputFiles('public/dawith-ci.png');
  await page.locator('#imageQuality').fill('60');
  let download = page.waitForEvent('download');
  await page.locator('#imageDownload').click();
  expect((await download).suggestedFilename()).toMatch(/compressed/);
  await page.locator('[data-action="home"]').click();
  await page.locator('.tool-card[data-tool="image-rotate"]').click();
  await page.locator('#imageInput').setInputFiles('public/dawith-ci.png');
  download = page.waitForEvent('download');
  await page.locator('#imageDownload').click();
  expect((await download).suggestedFilename()).toMatch(/edited/);
  await page.locator('[data-action="home"]').click();
  await page.locator('.tool-card[data-tool="date-calculator"]').click();
  await page.locator('#dateStart').fill('2026-11-01');
  await page.locator('#dateEnd').fill('2026-11-07');
  await expect(page.locator('#dateResult')).toContainText('7일');
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

const localCapabilities = { system: { platformLabel: '테스트', memoryGB: 16, cpuCores: 8 }, ollama: { available: true, models: [{ name: 'qwen2.5:7b' }], recommendation: { model: 'qwen2.5:7b', installedModel: 'qwen2.5:7b', label: '복지 기록 기본형' } } };

test('기관 양식과 텍스트 화면에 로컬 AI 보조 진입점이 있다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="text-tools"]').click();
  await expect(page.locator('#textAiAssist')).toBeVisible();
  await page.locator('[data-action="home"]').click();
  await page.locator('.tool-card[data-tool="template-studio"]').click();
  await expect(page.locator('#templateAiAssist')).toBeVisible();
  await expect(page.locator('#templateSubscriptionAssist')).toHaveCount(0);
  await expect(page.locator('#templateAiRevert')).toBeHidden();
});

test('기관 양식 로컬 AI 결과는 적용 전 되돌릴 수 있다', async ({ page }) => {
  await page.route('**/api/capabilities', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(localCapabilities),
  }));
  await page.route('**/api/ai/assist', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ result: '로컬 AI가 만든 합성 문서 초안입니다.', provider: 'ollama-local' }),
  }));
  await page.goto('/');
  await page.locator('.tool-card[data-tool="template-studio"]').click();
  await page.locator('#templateProject').fill('합성 사례회의');
  await page.locator('#templateContent').fill('주거 지원 절차를 논의함.');
  await page.locator('#templateAiAssist').click();
  await expect(page.locator('#templatePreview')).toContainText('로컬 AI가 만든');
  await expect(page.locator('#templateAiRevert')).toBeVisible();
  await page.locator('#templateAiRevert').click();
  await expect(page.locator('#templatePreview')).toContainText('합성 사례회의');
  await expect(page.locator('#templateAiRevert')).toBeHidden();
});

test('로컬 AI 설정은 Ollama 준비 흐름만 보여주고 외부 AI 연결이 없다', async ({ page }) => {
  await page.route('**/api/capabilities', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(localCapabilities),
  }));
  await page.goto('/');
  await expect(page.locator('.tool-card[data-tool="ai-setup"]')).toContainText('로컬 AI 설정');
  await page.locator('.tool-card[data-tool="ai-setup"]').click();
  await expect(page.locator('#workspaceMount')).toContainText('로컬 AI 설정');
  await expect(page.locator('#aiSetupStatus')).toHaveText('모델 준비됨');
  await expect(page.locator('#aiPullModel')).toBeEnabled();
  await expect(page.locator('.subscription-panel, .subscription-card, #subscriptionAssist')).toHaveCount(0);
  await expect(page.locator('#workspaceMount')).not.toContainText(/구독|OpenRouter|ChatGPT|Claude|Codex|Gemini/);
});

test('텍스트 도구에는 외부 AI로 보내는 버튼이 없다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="text-tools"]').click();
  await expect(page.locator('#textAiAssist')).toBeVisible();
  await expect(page.locator('#textSubscriptionAssist')).toHaveCount(0);
  await expect(page.locator('.external-ai-button')).toHaveCount(0);
});

test('텍스트 로컬 AI 보조는 외부가 아닌 로컬 API 결과를 화면에 반영한다', async ({ page }) => {
  await page.route('**/api/capabilities', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ system: { platformLabel: '테스트', memoryGB: 16, cpuCores: 8 }, ollama: { available: true, models: [{ name: 'qwen2.5:7b' }], recommendation: { model: 'qwen2.5:7b', installedModel: 'qwen2.5:7b', label: '복지 기록 기본형' } } }),
  }));
  await page.route('**/api/ai/assist', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ result: '대상자는 주거비 부담을 호소하였으며, 임대주택 신청 방법을 안내하기로 함.' }),
  }));
  await page.goto('/');
  await page.locator('.tool-card[data-tool="text-tools"]').click();
  await page.locator('#textInput').fill('대상자는 주거비가 부담된다고 말함. 임대주택 신청 방법을 안내하기로 함.');
  await page.locator('#textAiAssist').click();
  await expect(page.locator('#textOutput')).toContainText('주거비 부담을 호소');
  await expect(page.locator('#textAiApply')).toBeVisible();
});

const counselingMemo = '3월 12일 내담자는 월세가 두 달 밀려 퇴거가 걱정된다고 호소함. 자녀 양육은 꾸준히 하고 있으며 취업 의지가 있음. 연락처 010-1234-5678. 주거급여 신청 절차를 안내하였음. 다음 주에 주민센터와 연계하여 신청서류를 확인하기로 함.';
const meetingMemo = '일시: 11월 10일 오후 2시\n장소: 2층 회의실\n참석자: 김팀장, 이사회복지사, 박간호사\n안건: 독거 어르신 겨울철 안부 확인\n어르신 12가구의 난방 상태를 점검함. 방문 횟수를 주 2회로 늘리기로 결정함. 이사회복지사가 11월 15일까지 대상 명단을 정리함.';
async function institutionFormDocx() {
  const row = (label, value) => new TableRow({ children: [new TableCell({ children: [new Paragraph(label)] }), new TableCell({ children: [new Paragraph(value)] })] });
  const document = new Document({ sections: [{ children: [
    new Paragraph('{{기관명}} 상담일지'),
    new Table({ rows: [row('상담일', '{{상담일}}'), row('담당자', '{{담당자}}'), row('대상자', '{{대상자}}'), row('관찰사항', '{{관찰사항}}'), row('상담원 소견', '{{소견}}'), row('향후 계획', '{{향후 계획}}')] }),
  ] }] });
  return Buffer.from(await Packer.toBuffer(document));
}

async function docxText(buffer) {
  const xml = await (await JSZip.loadAsync(buffer)).file('word/document.xml').async('string');
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

test('홈 화면은 상담 기록·회의록 정리를 앞세우고 추천 01에서 바로 연다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.workspace-callout')).toContainText('상담 기록과 회의록');
  await expect(page.locator('.workspace-callout-action')).toHaveAttribute('data-tool', 'case-record');
  await expect(page.locator('.recommendation-item').first()).toHaveAttribute('data-tool', 'case-record');
  await expect(page.locator('.tool-card[data-tool="template-studio"]')).toContainText('기관 문서 양식');
  await page.locator('.recommendation-item').first().click();
  await expect(page.locator('.workspace-header h1')).toHaveText('상담 기록·회의록 정리');
  await expect(page.locator('#recordTemplate')).toHaveValue('preset-counseling');
  await expect(page.locator('input[name="recordEngine"][value="rules"]')).toBeChecked();
  await expect(page.locator('input[name="recordEngine"]')).toHaveCount(2);
  await expect(page.locator('.engine-picker')).toContainText('규칙 (AI 없음)');
  await expect(page.locator('.engine-picker')).toContainText('로컬 AI (Ollama)');
  await expect(page.locator('.engine-picker')).not.toContainText('클라우드');
});

test('기본 상담기록은 규칙 엔진으로 다섯 항목을 만들고 고친 내용을 저장·내보낸다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await expect(page.locator('#recordTemplateSections')).toContainText('주요 호소');
  await page.locator('#recordRaw').fill(counselingMemo);
  await page.locator('#recordProcess').click();
  await expect(page.locator('#recordTransfer')).toHaveText('규칙 · 이 PC');
  const section = (name) => page.locator(`.sum-section[data-section="${name}"]`);
  await expect(section('상담 개요')).toHaveValue(/3월 12일/);
  await expect(section('주요 호소')).toHaveValue(/퇴거가 걱정/);
  await expect(section('사정')).toHaveValue(/취업 의지/);
  await expect(section('개입 내용')).toHaveValue(/안내하였음/);
  await expect(section('향후 계획')).toHaveValue(/주민센터/);
  await section('사정').fill('주거급여 신청 지원이 필요함.');
  await page.locator('#recordSave').click();
  await expect(page.locator('#recordNotice')).toContainText('로컬 저장소');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dawith-record-drafts-v1')));
  expect(saved).toHaveLength(1);
  expect(saved[0].summary.sections.find((item) => item.name === '사정').content).toBe('주거급여 신청 지원이 필요함.');
  const markdown = page.waitForEvent('download');
  await page.locator('#recordExport').click();
  const markdownFile = await markdown;
  expect(markdownFile.suggestedFilename()).toMatch(/^기본_상담기록_\d{8}\.md$/);
  expect(await readFile(await markdownFile.path(), 'utf8')).toContain('## 사정\n\n주거급여 신청 지원이 필요함.');
  const docx = page.waitForEvent('download');
  await page.locator('#recordDocx').click();
  const docxFile = await docx;
  expect(docxFile.suggestedFilename()).toMatch(/\.docx$/);
  expect(await docxText(await readFile(await docxFile.path()))).toContain('주거급여 신청 지원이 필요함.');
  await page.reload();
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await page.locator('#recordSavedList').selectOption({ index: 1 });
  await expect(section('사정')).toHaveValue('주거급여 신청 지원이 필요함.');
});

test('프리셋을 고르면 그 양식의 항목대로 나눈다: 관찰·상담·소견형', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => { if (request.url().endsWith('/api/process')) requests.push(request.postDataJSON()); });
  await page.goto('/');
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await page.locator('#recordTemplate').selectOption('preset-observation');
  await expect(page.locator('#recordTemplateSections span')).toHaveText(['관찰사항', '상담내용', '상담원 소견', '향후 계획']);
  await expect(page.locator('#summaryBody')).toContainText('관찰사항 · 상담내용 · 상담원 소견 · 향후 계획');
  await page.locator('#recordSample').click();
  await page.locator('#recordProcess').click();
  await expect(page.locator('#summaryTitle')).toHaveText('관찰·상담·소견형');
  await expect(page.locator('.sum-section')).toHaveCount(4);
  await expect(page.locator('.sum-section[data-section="관찰사항"]')).toHaveValue(/표정이 어둡고/);
  await expect(page.locator('.sum-section[data-section="상담원 소견"]')).toHaveValue(/담당자가 작성/);
  expect(requests[0].template.sections.map((item) => item.name)).toEqual(['관찰사항', '상담내용', '상담원 소견', '향후 계획']);
  expect(requests[0].provider).toBe('rules');
  await page.reload();
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await expect(page.locator('#recordTemplate')).toHaveValue('preset-observation');
});

test('내 양식을 만들고 항목을 추가·이름 변경·순서 변경·삭제하면 규칙 엔진이 그 항목대로 채운다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await page.locator('#recordTemplateNew').click();
  await expect(page.locator('#recordTemplateEditor')).toBeVisible();
  await page.locator('#rtName').fill('우리 기관 상담일지');
  const rows = page.locator('#rtSections li');
  await rows.nth(0).locator('.rt-name').fill('경제 상황');
  await rows.nth(0).locator('.rt-guide').fill('월세·소득');
  await rows.nth(1).locator('.rt-name').fill('관찰');
  await rows.nth(2).locator('.rt-name').fill('지울 항목');
  await page.locator('#rtAdd').click();
  await rows.nth(3).locator('.rt-name').fill('종교 활동');
  await rows.nth(2).locator('.rt-remove').click();
  await rows.nth(1).locator('.rt-name').fill('관찰사항');
  await rows.nth(1).locator('.rt-up').click();
  await page.locator('#rtSave').click();
  await expect(page.locator('#recordTemplateEditor')).toBeHidden();
  await expect(page.locator('#recordTemplate option:checked')).toHaveText('우리 기관 상담일지');
  await expect(page.locator('#recordTemplateSections span')).toHaveText(['관찰사항', '경제 상황', '종교 활동']);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dawith-record-templates-v1')));
  expect(stored[0].sections).toEqual([{ name: '관찰사항', guide: '' }, { name: '경제 상황', guide: '월세·소득' }, { name: '종교 활동', guide: '' }]);

  await page.locator('#recordRaw').fill('3월 12일 가정방문. 내담자는 표정이 어둡고 말수가 적었음. 월세가 두 달 밀려 걱정된다고 함. 다음 주에 다시 방문하기로 함.');
  await page.locator('#recordProcess').click();
  await expect(page.locator('#summaryTitle')).toHaveText('우리 기관 상담일지');
  await expect(page.locator('#sumSectionsView .sum-head > label')).toHaveText(['관찰사항', '경제 상황 월세·소득', '종교 활동']);
  await expect(page.locator('.sum-section[data-section="관찰사항"]')).toHaveValue(/표정이 어둡고/);
  await expect(page.locator('.sum-section[data-section="경제 상황"]')).toHaveValue(/월세가 두 달/);
  await expect(page.locator('.sum-section[data-section="종교 활동"]')).toHaveValue(/찾지 못했습니다/);
  await expect(page.locator('.summary-unassigned')).toContainText('어느 항목에도 넣지 못한 문장');
  // The combined view (and copy) keeps those sentences too.
  await page.locator('[data-sum-view="combined"]').click();
  await expect(page.locator('#sumCombined')).toHaveValue(/어느 항목에도 넣지 못한 문장\n1\. /);

  await page.reload();
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await expect(page.locator('#recordTemplate option:checked')).toHaveText('우리 기관 상담일지');
  await page.locator('#recordTemplateEdit').click();
  await page.locator('#rtDelete').click();
  await expect(page.locator('#recordTemplate')).toHaveValue('preset-counseling');
  await expect(page.locator('#recordTemplate option', { hasText: '우리 기관 상담일지' })).toHaveCount(0);
});

test('기관 Word 양식을 올리면 표식을 찾아 정리 결과를 넣고 빈 표식을 알려준다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('dawith-institution-profile-v1', JSON.stringify({ organization: '다위종합사회복지관', manager: '김담당' })));
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await page.locator('#recordTemplate').selectOption('preset-observation');
  await page.locator('#recordFormGuideToggle').click();
  await expect(page.locator('.record-form-token')).toContainText(['{{관찰사항}}', '{{상담원 소견}}', '{{기관명}}', '{{담당자}}', '{{상담일}}']);
  const starter = page.waitForEvent('download');
  await page.locator('#recordFormStarter').click();
  expect(await docxText(await readFile(await (await starter).path()))).toContain('{{상담원 소견}}');

  await page.locator('#recordFormInput').setInputFiles({ name: '우리기관_상담일지.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await institutionFormDocx() });
  await expect(page.locator('#recordFormName')).toHaveText('우리기관_상담일지.docx');
  await expect(page.locator('.record-form-summary')).toContainText('찾은 표식 7개 · 자동으로 채울 표식 6개 · 직접 적을 표식 1개');
  await expect(page.locator('.ph-row[data-token="소견"]')).toContainText('← 상담원 소견');
  await expect(page.locator('#recordFormFill')).toBeDisabled();

  await page.locator('#recordRaw').fill(counselingMemo.replace('3월 12일', '3월 12일 표정이 어둡고 말수가 적었음.'));
  await page.locator('#recordProcess').click();
  await expect(page.locator('#sumOrg')).toHaveValue('다위종합사회복지관');
  await page.locator('.sum-section[data-section="상담원 소견"]').fill('주거 위기 단서가 있어 주거급여 연계가 필요함.');
  await expect(page.locator('#recordFormFill')).toBeEnabled();
  const first = page.waitForEvent('download');
  await page.locator('#recordFormFill').click();
  const firstFile = await first;
  expect(firstFile.suggestedFilename()).toBe('우리기관_상담일지_작성본.docx');
  const text = await docxText(await readFile(await firstFile.path()));
  expect(text).toContain('다위종합사회복지관 상담일지');
  expect(text).toContain('김담당');
  expect(text).toContain('주거 위기 단서가 있어 주거급여 연계가 필요함.');
  expect(text).toContain('표정이 어둡고');
  expect(text).toContain('{{대상자}}');
  await expect(page.locator('#recordFormNotice')).toContainText('빈 표식: {{대상자}}');
  await expect(page.locator('.ph-row[data-token="관찰사항"]')).toHaveClass(/done/);

  await page.locator('.ph-extra[data-token="대상자"]').fill('김○○');
  const second = page.waitForEvent('download');
  await page.locator('#recordFormFill').click();
  expect(await docxText(await readFile(await (await second).path()))).toContain('김○○');
  await expect(page.locator('#recordFormNotice')).toContainText('표식 7개를 모두 채워');

  await page.reload();
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await expect(page.locator('#recordFormName')).toHaveText('우리기관_상담일지.docx');
  await page.locator('#recordFormForget').click();
  await expect(page.locator('#recordFormName')).toHaveText('올린 양식 없음');
});

test('회의록 양식은 개요·결정 사항·할 일을 만들고 기관 문서 양식으로 보낸다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('dawith-institution-profile-v1', JSON.stringify({ organization: '다위종합사회복지관', manager: '김담당' })));
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await page.locator('#recordTemplate').selectOption('preset-meeting');
  await expect(page.locator('#recordRawLabel')).toHaveText('회의 메모 원문');
  await page.locator('#recordRaw').fill(meetingMemo);
  await page.locator('#recordProcess').click();
  await expect(page.locator('#summaryTitle')).toHaveText('일반 회의록');
  await expect(page.locator('#sumOrg')).toHaveValue('다위종합사회복지관');
  await expect(page.locator('#sumAuthor')).toHaveValue('김담당');
  await expect(page.locator('#sumDate')).toHaveValue('11월 10일 오후 2시');
  await expect(page.locator('.sum-section[data-section="회의 개요"]')).toHaveValue(/장소: 2층 회의실/);
  await expect(page.locator('.sum-section[data-section="결정 사항"]')).toHaveValue(/주 2회/);
  await expect(page.locator('.sum-section[data-section="할 일"]')).toHaveValue(/담당: 이사회복지사, 기한: 11월 15일까지/);
  const actions = page.locator('.sum-section[data-section="할 일"]');
  await actions.fill(`${await actions.inputValue()}\n2. 보호자에게 결과 안내 (담당: 김팀장)`);
  await page.locator('#recordToTemplate').click();
  await expect(page.locator('.workspace-header h1')).toHaveText('기관 문서 양식');
  await expect(page.locator('#templateProject')).toHaveValue('독거 어르신 겨울철 안부 확인');
  await expect(page.locator('#templateDecisions')).toHaveValue(/주 2회/);
  await expect(page.locator('#templateActions')).toHaveValue(/보호자에게 결과 안내 \(담당: 김팀장\)/);
  await expect(page.locator('#templatePreview')).toContainText('다위종합사회복지관');
  await expect(page.locator('#templatePreview')).toContainText('김팀장, 이사회복지사, 박간호사');
});

test('로컬 AI가 꺼져 있으면 규칙으로 대신 정리하고 이유를 한국어로 보여준다', async ({ page }) => {
  await page.route('**/api/capabilities', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ system: { memoryGB: 8, cpuCores: 4 }, ollama: { available: false, models: [], recommendation: { model: 'qwen2.5:3b' } } }) }));
  const requests = [];
  page.on('request', (request) => { if (request.url().endsWith('/api/process')) requests.push(request.postDataJSON()); });
  await page.goto('/');
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await expect(page.locator('#engineOllamaStatus')).toContainText('꺼져 있음');
  await page.locator('#recordTemplate').selectOption('preset-case-conference');
  await page.locator('#recordRaw').fill(meetingMemo);
  await page.locator('input[name="recordEngine"][value="ollama"]').check();
  await page.locator('#recordProcess').click();
  await expect(page.locator('#recordTransfer')).toHaveText('규칙으로 대체');
  await expect(page.locator('#recordNotice')).toContainText('Ollama');
  await expect(page.locator('.sum-section[data-section="역할 분담"]')).toHaveValue(/명단/);
  expect(requests[0].provider).toBe('ollama-local');
  expect(requests[0].template.sections.map((item) => item.name)).toContain('사례 현황');
});

test('작은 화면에서도 상담 기록·회의록 화면이 가로로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await page.locator('#recordTemplate').selectOption('preset-meeting');
  await page.locator('#recordRaw').fill(meetingMemo);
  await page.locator('#recordProcess').click();
  await expect(page.locator('.sum-section[data-section="회의 개요"]')).toHaveValue(/2층 회의실/);
  await page.locator('#recordTemplateNew').click();
  await page.locator('#recordFormGuideToggle').click();
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
});

async function addGenoMember(page, { name, relation, gender, age, deceased }) {
  await page.locator('#genoName').fill(name);
  await page.locator('#genoRelation').selectOption(relation);
  if (gender) await page.locator('#genoGender').selectOption(gender);
  if (age) await page.locator('#genoAge').fill(String(age));
  if (deceased) await page.locator('#genoDeceased').check();
  await page.locator('#genoMemberSubmit').click();
}

function overlaps(a, b, margin = 0) {
  return a.x < b.x + b.width + margin && b.x < a.x + a.width + margin && a.y < b.y + b.height + margin && b.y < a.y + a.height + margin;
}

async function expectNoOverlap(locator) {
  const boxes = await locator.evaluateAll((elements) => elements.map((element) => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; }));
  for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) expect(overlaps(boxes[i], boxes[j]), `도형 ${i}와 ${j}가 겹칩니다`).toBe(false);
  return boxes;
}

test('가계도는 구성원을 목록으로 추가하면 표준 기호로 그리고 JSON으로 내보낸다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="genogram"]').click();
  await expect(page.locator('#diagramPreview')).toContainText('아직 그릴 내용이 없습니다');
  await expect(page.locator('#genoRelation')).toHaveValue('본인');
  await addGenoMember(page, { name: '김민지', relation: '본인', gender: 'female', age: 42 });
  await addGenoMember(page, { name: '이순자', relation: '모', age: 68, deceased: true });
  await expect(page.locator('#genoMemberList .diagram-row')).toHaveCount(2);
  const self = page.locator('.geno-member[data-relation="본인"]');
  await expect(self.locator('circle')).toHaveCount(2);
  const mother = page.locator('.geno-member[data-relation="모"]');
  await expect(mother.locator('circle')).toHaveCount(1);
  await expect(mother.locator('.geno-age')).toHaveText('68');
  await expect(mother.locator('.geno-deceased-mark')).toHaveCount(1);
  await expect(mother).toContainText('이순자');
  await expect(page.locator('.geno-descent')).toHaveCount(1);
  await page.locator('#genoMemberList [data-row-edit]').nth(1).click();
  await expect(page.locator('#genoName')).toHaveValue('이순자');
  await page.locator('#genoName').fill('이영희');
  await page.locator('#genoMemberSubmit').click();
  await expect(mother).toContainText('이영희');
  await page.locator('#diagramUndo').click();
  await expect(mother).toContainText('이순자');
  const download = page.waitForEvent('download');
  await page.locator('#diagramExportJson').click();
  expect((await download).suggestedFilename()).toMatch(/genogram-.*\.json/);
  const svgDownload = page.waitForEvent('download');
  await page.locator('#diagramExportSvg').click();
  expect((await svgDownload).suggestedFilename()).toMatch(/genogram-.*\.svg/);
  const pngDownload = page.waitForEvent('download');
  await page.locator('#diagramExportPng').click();
  expect((await pngDownload).suggestedFilename()).toMatch(/genogram-.*\.png/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dawith-genogram-projects-v2'))[0].members.length)).toBe(2);
});

test('가계도는 배우자를 자동 연결하고 이혼을 // 기호로 표시한다', async ({ page }) => {
  await page.goto('/?tool=genogram');
  await addGenoMember(page, { name: '김민지', relation: '본인', gender: 'female', age: 42 });
  await addGenoMember(page, { name: '박준호', relation: '배우자', gender: 'male', age: 45 });
  await addGenoMember(page, { name: '박서연', relation: '자녀', gender: 'female', age: 14 });
  await expect(page.locator('#diagramNotice')).toContainText('추가했습니다');
  await expect(page.locator('.geno-couple')).toHaveCount(1);
  await expect(page.locator('.geno-couple[data-type="married"]')).toHaveCount(1);
  await page.locator('#genoCoupleList select[data-couple-type]').selectOption('divorced');
  const couple = page.locator('.geno-couple[data-type="divorced"]');
  await expect(couple).toHaveCount(1);
  await expect(couple.locator('.geno-divorce-mark')).toHaveCount(2);
  await expect(couple).toContainText('이혼');
  await expect(page.locator('.geno-member[data-relation="배우자"] rect')).toHaveCount(1);
  await expect(page.locator('.geno-descent')).toHaveCount(1);
  await expect(page.locator('.geno-household')).toHaveCount(1);
});

test('생태도는 기관을 추가하면 갈등은 지그재그 선과 화살표로 그린다', async ({ page }) => {
  await page.goto('/?tool=ecomap');
  await page.locator('#ecoMembers').fill('본인(42), 딸(12)');
  await expect(page.locator('.eco-household')).toContainText('딸(12)');
  await page.locator('#ecoName').fill('서울중학교');
  await page.locator('#ecoCategory').fill('아동·교육');
  await page.locator('#ecoStrength').selectOption('conflict');
  await page.locator('#ecoDirection').selectOption('both');
  await page.locator('#ecoResourceSubmit').click();
  await page.locator('#ecoName').fill('행정복지센터');
  await page.locator('#ecoStrength').selectOption('strong');
  await page.locator('#ecoDirection').selectOption('receive');
  await page.locator('#ecoResourceSubmit').click();
  await expect(page.locator('#ecoResourceList .diagram-row')).toHaveCount(2);
  const conflict = page.locator('.eco-link[data-strength="conflict"]');
  await expect(conflict).toHaveCount(1);
  expect((await conflict.locator('.eco-line').getAttribute('d')).split('L').length).toBeGreaterThan(8);
  await expect(conflict.locator('.eco-line')).toHaveAttribute('stroke', '#b84d3d');
  await expect(conflict.locator('.eco-arrow')).toHaveCount(2);
  await expect(page.locator('.eco-link[data-strength="strong"] .eco-arrow')).toHaveCount(1);
  await expect(page.locator('.diagram-legend')).toContainText('갈등·스트레스');
  await page.locator('#ecoResourceList [data-row-delete]').first().click();
  await expect(page.locator('.eco-resource')).toHaveCount(1);
});

test('생태도 원문 후보는 목록 행으로 추가되고 도형이 겹치지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="ecomap"]').click();
  await page.locator('.diagram-source summary').click();
  await page.locator('#diagramSourceText').fill('내담자는 주민센터와 학교의 지원을 받고 있다.');
  await page.locator('#diagramExtract').click();
  await expect(page.locator('.diagram-candidate')).toHaveCount(2);
  await page.locator('#diagramSourceText').fill('주민센터에서 매달 지원을 받는다. 학교 담임과는 갈등이 있다. 복지관 프로그램에 다니고, 보건소와 병원에 가끔 간다. 교회 친구와 이웃이 있다.');
  await page.locator('#diagramExtract').click();
  const count = await page.locator('.diagram-candidate').count();
  expect(count).toBeGreaterThanOrEqual(7);
  await page.locator('.diagram-candidate [data-candidate-add]').first().click();
  await expect(page.locator('#ecoResourceList .diagram-row')).toHaveCount(1);
  await page.locator('#diagramAddAllCandidates').click();
  await expect(page.locator('#ecoResourceList .diagram-row')).toHaveCount(count);
  await expect(page.locator('.eco-link[data-strength="conflict"]')).toHaveCount(1);
  await expectNoOverlap(page.locator('.eco-resource-circle, .eco-household circle'));
});

test('가계도 원문 후보도 목록에 추가되고 기호와 이름표가 겹치지 않는다', async ({ page }) => {
  await page.goto('/?tool=genogram');
  await addGenoMember(page, { name: '내담자', relation: '본인', gender: 'female', age: 40 });
  await page.locator('.diagram-source summary').click();
  await page.locator('#diagramSourceText').fill('내담자는 남편과 이혼 후 딸(12세), 아들(9세)과 함께 살고 있다. 어머니는 작년에 돌아가셨고 아버지와 남동생은 지방에 산다. 외할머니가 가끔 돌봐준다.');
  await page.locator('#diagramExtract').click();
  // 7 new people plus the client, who is listed as already added.
  await expect(page.locator('.diagram-candidate')).toHaveCount(8);
  await expect(page.locator('.diagram-candidate button:disabled')).toHaveCount(1);
  await page.locator('#diagramAddAllCandidates').click();
  await expect(page.locator('#genoMemberList .diagram-row')).toHaveCount(8);
  await expect(page.locator('.geno-member')).toHaveCount(8);
  await expect(page.locator('.geno-member[data-relation="모"] .geno-deceased-mark')).toHaveCount(1);
  // Children are drawn oldest first from the left, whatever order they were added in.
  const childAges = await page.locator('.geno-member[data-relation="자녀"]').evaluateAll((nodes) => nodes.map((node) => ({ x: node.getBBox().x, age: node.querySelector('.geno-age')?.textContent })).sort((p, q) => p.x - q.x).map((item) => item.age));
  expect(childAges).toEqual(['12', '9']);
  await expectNoOverlap(page.locator('.geno-member'));
});

test('작은 화면에서도 가계도·생태도 작업대가 가로로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tool of ['genogram', 'ecomap']) {
    await page.goto(`/?tool=${tool}`);
    if (tool === 'genogram') await addGenoMember(page, { name: '김민지', relation: '본인', gender: 'female', age: 42 });
    else { await page.locator('#ecoName').fill('행정복지센터'); await page.locator('#ecoResourceSubmit').click(); }
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  }
});

test('작은 화면에서도 도구 작업대가 가로로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.tool-card[data-tool="text-tools"]').click();
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
});

test('정리 결과는 항목별·한 번에 보기로 바꿀 수 있고 상자마다 바로 복사한다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?tool=case-record');
  await page.locator('#recordTemplate').selectOption({ label: '관찰·상담·소견형' });
  await page.locator('#recordRaw').fill('집 안이 정돈되어 있고 아동은 밝은 표정으로 인사함. 어머니는 월세가 밀려 걱정된다고 호소함. 다음 주에 주민센터와 연계하기로 함.');
  await page.locator('#recordProcess').click();
  await expect(page.locator('#sumSectionsView .sum-copy')).toHaveCount(4);
  await page.locator('[data-copy-section="0"]').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('밝은 표정');
  await page.locator('[data-sum-view="combined"]').click();
  await expect(page.locator('#sumSectionsView')).toBeHidden();
  const combined = await page.locator('#sumCombined').inputValue();
  expect(combined.startsWith('관찰사항')).toBe(true);
  expect(combined).toContain('상담원 소견');
  expect(combined).not.toContain('#');
  await page.locator('[data-copy-combined]').click();
  const normalize = (text) => text.split('\r\n').join('\n');
  expect(normalize(await page.evaluate(() => navigator.clipboard.readText()))).toBe(normalize(combined));
  await page.locator('[data-sum-view="sections"]').click();
  await expect(page.locator('#sumSectionsView')).toBeVisible();
});

test('회의록도 같은 보기 전환과 복사 버튼을 쓴다', async ({ page }) => {
  await page.goto('/?tool=case-record');
  await page.locator('#recordTemplate').selectOption({ label: '일반 회의록' });
  await page.locator('#recordRaw').fill('11월 운영회의. 참석자 김팀장, 이복지사. 송년 행사를 12월 20일에 열기로 결정함. 이복지사가 장소를 섭외하기로 함.');
  await page.locator('#recordProcess').click();
  await expect(page.locator('[data-sum-view="combined"]')).toBeVisible();
  expect(await page.locator('#sumSectionsView .sum-copy').count()).toBeGreaterThan(2);
});

async function mockUpdates(page, sequence) {
  const calls = [];
  let polls = 0;
  await page.route('**/api/update/**', async (route) => {
    const action = route.request().url().split('/api/update/')[1];
    calls.push(action);
    const base = { supported: true, runtime: 'lite', mode: 'installer', currentVersion: '1.0.4', latestVersion: '1.0.5', notes: ['한 번에 보기에 빠진 문장 포함', '로컬 AI 대기 시간 5분'], received: 0, total: 26_900_000, progress: 0 };
    let body = { ...base, status: 'idle' };
    if (action === 'check') body = { ...base, status: sequence.check };
    if (action === 'download') body = { ...base, status: 'downloading' };
    if (action === 'status' && calls.includes('download')) body = polls++ < 2 ? { ...base, status: 'downloading', progress: 34, received: 9_542_000 } : { ...base, status: 'downloaded', progress: 100, received: 26_900_000 };
    if (action === 'install') body = { ...base, status: 'installing', progress: 100 };
    await route.fulfill({ json: body });
  });
  return calls;
}

test('새 버전이 있으면 업데이트 버튼에 빨간 점이 뜨고, 달라진 점을 본 뒤 진행률을 보며 자동 설치한다', async ({ page }) => {
  const calls = await mockUpdates(page, { check: 'available' });
  await page.goto('/');
  await expect(page.locator('#updateButton')).toHaveClass(/has-update/);
  await page.locator('#updateButton').click();
  await expect(page.locator('#updateTitle')).toHaveText('새 버전 v1.0.5');
  await expect(page.locator('#updateNotes li')).toHaveText(['한 번에 보기에 빠진 문장 포함', '로컬 AI 대기 시간 5분']);
  await expect(page.locator('#updateLater')).toBeVisible();
  await page.locator('#updateAction').click();
  await expect(page.locator('#updateTitle')).toHaveText('v1.0.5로 업데이트하는 중');
  await expect(page.locator('#updatePercent')).toHaveText('34%');
  await expect(page.locator('#updateBytes')).toHaveText('9.1MB / 25.7MB');
  await expect(page.locator('#updateTitle')).toHaveText('v1.0.5 설치하는 중');
  expect(calls).toContain('install');
});

test('최신 버전이면 업데이트를 눌렀을 때 최신 버전이라고 알려 준다', async ({ page }) => {
  await mockUpdates(page, { check: 'latest' });
  await page.goto('/');
  await expect(page.locator('#updateButton')).toBeVisible();
  await expect(page.locator('#updateButton')).not.toHaveClass(/has-update/);
  await page.locator('#updateButton').click();
  await expect(page.locator('#updateTitle')).toHaveText('최신 버전입니다');
  await expect(page.locator('#updateMessage')).toContainText('v1.0.4이 가장 최신 버전');
});

test('AI 설정과 이미 예시가 있는 기록 정리를 뺀 모든 도구에 예시로 해보기 버튼이 있다', async ({ page }) => {
  await page.goto('/');
  const ids = await page.locator('.tool-card').evaluateAll((cards) => cards.map((card) => card.dataset.tool));
  for (const id of ids.filter((tool) => !['ai-setup', 'case-record'].includes(tool))) {
    await page.goto(`/?tool=${id}`);
    await expect(page.locator('.sample-button, #textSample'), id).toHaveCount(1);
  }
});

test('텍스트·금액·만나이·날짜 예시는 합성 데이터를 넣고 바로 결과를 보여준다', async ({ page }) => {
  await page.goto('/?tool=text-tools');
  await page.locator('#textSample').click();
  await expect(page.locator('#textInput')).toHaveValue(/김민지/);
  await expect(page.locator('#textOutput')).toContainText('010-****-5678');
  await expect(page.locator('#textOutput')).toContainText('[이메일 가림]');
  await expect(page.locator('#textOutput')).toContainText('990101-*******');
  await expect(page.locator('#textPrivacy')).toContainText('합성 예시');
  await page.locator('[data-text-mode="replace"]').click();
  await expect(page.locator('#textOutput')).toContainText('대상자 님(가명)');
  await page.goto('/?tool=money-converter');
  await page.locator('#moneySample').click();
  await expect(page.locator('#moneyInput')).toHaveValue('3,480,000');
  await expect(page.locator('#moneyResult')).toContainText('금 삼백사십팔만원정');
  await expect(page.locator('#moneyCopy')).toBeEnabled();
  await page.goto('/?tool=age-calculator');
  await page.locator('#ageSample').click();
  await expect(page.locator('#birthDate')).toHaveValue('20140315');
  await expect(page.locator('#ageResult strong')).toContainText(/만 \d+세/);
  await page.goto('/?tool=date-calculator');
  await page.locator('#dateSample').click();
  await expect(page.locator('#dateResult')).toContainText('30일');
});

test('PDF 합치기·나누기 예시는 이 기기에서 만든 PDF로 실제 처리까지 해 볼 수 있다', async ({ page }) => {
  await page.goto('/?tool=pdf-merge');
  await page.locator('#pdfSample').click();
  await expect(page.locator('#pdfSummary')).toHaveText('2개');
  await expect(page.locator('#pdfFileList')).toContainText('02_개인정보동의서_예시.pdf');
  await expect(page.locator('#pdfFileList')).toContainText('2페이지');
  await expect(page.locator('#pdfNotice')).toContainText('합성 예시');
  let downloadPromise = page.waitForEvent('download');
  await page.locator('#pdfMergeButton').click();
  let download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('예시_붙임서류.pdf');
  expect((await PDFDocument.load(await readFile(await download.path()))).getPageCount()).toBe(3);
  await page.goto('/?tool=pdf-split');
  await page.locator('#splitSample').click();
  await expect(page.locator('#splitFileList')).toContainText('5페이지');
  await expect(page.locator('#splitRange')).toHaveValue('1-2, 4');
  downloadPromise = page.waitForEvent('download');
  await page.locator('#splitButton').click();
  download = await downloadPromise;
  expect((await PDFDocument.load(await readFile(await download.path()))).getPageCount()).toBe(3);
  await expect(page.locator('#splitNotice')).toContainText('3페이지');
});

test('이미지 예시는 그려 만든 예시 사진을 업로드와 같은 경로로 처리한다', async ({ page }) => {
  await page.goto('/?tool=image-resize');
  await page.locator('#imageSample').click();
  await expect(page.locator('#imagePreview img')).toBeVisible();
  await expect(page.locator('#imageWidth')).toHaveValue('1200');
  await expect(page.locator('#imageMeta')).toContainText('1200 × 800px');
  await expect(page.locator('#imageNotice')).toContainText('합성 예시');
  await page.locator('#imageWidth').fill('600');
  await page.locator('#imageWidth').dispatchEvent('input');
  await expect(page.locator('#imageHeight')).toHaveValue('400');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#imageDownload').click();
  expect((await downloadPromise).suggestedFilename()).toBe('복지관_행사_예시_resized.jpg');
  await page.goto('/?tool=image-privacy');
  await page.locator('#imageSample').click();
  await expect(page.locator('#imageDownload')).toBeEnabled();
});

test('가계도·생태도 예시는 합성 가족과 자원으로 그림을 그리고 되돌릴 수 있다', async ({ page }) => {
  await page.goto('/?tool=genogram');
  await page.locator('#diagramSample').click();
  await expect(page.locator('#diagramSummary')).toHaveText('구성원 6명 · 부부 관계 2개');
  await expect(page.locator('#diagramPreview svg')).toContainText('김민지');
  await expect(page.locator('#genoCoupleList')).toContainText('박준호');
  await expect(page.locator('#genoCoupleList select').first()).toHaveValue('divorced');
  await page.locator('#diagramUndo').click();
  await expect(page.locator('#diagramSummary')).toHaveText('구성원 0명 · 부부 관계 0개');
  await page.goto('/?tool=ecomap');
  await page.locator('#diagramSample').click();
  await expect(page.locator('#diagramSummary')).toHaveText('기관·자원 6곳');
  await expect(page.locator('#ecoHouseholdName')).toHaveValue('김민지 가구');
  await expect(page.locator('#diagramPreview svg')).toContainText('행정복지센터');
});

test('문서 변환·한글 양식·기관 양식·인원 체크·당직 예시도 바로 결과를 만든다', async ({ page }) => {
  await page.goto('/?tool=document-convert');
  await page.locator('#convertSample').click();
  await expect(page.locator('#convertFileSummary')).toContainText('사례회의_예시.md');
  await expect(page.locator('#convertPreview')).toContainText('<h1>11월 통합사례회의 (예시)</h1>');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#convertButton').click();
  expect((await downloadPromise).suggestedFilename()).toBe('사례회의_예시.html');
  await page.goto('/?tool=hwp-inspector');
  await page.locator('#hwpSample').click();
  await expect(page.locator('#hwpEngineStatus')).toHaveText('엔진 준비됨');
  await expect(page.locator('#hwpPreview')).toContainText('통합사례회의 양식 (예시)');
  await expect(page.locator('#hwpQuery')).toHaveValue('{{기관명}}');
  await expect(page.locator('#hwpNotice')).toContainText('합성 예시');
  await page.goto('/?tool=template-studio');
  await page.locator('#templateSample').click();
  await expect(page.locator('#templatePreview')).toContainText('다위종합사회복지관');
  await expect(page.locator('#templatePreview')).toContainText('안부 확인 방문을 주 2회로 늘림.');
  await page.goto('/?tool=attendance');
  await page.locator('#attendanceSample').click();
  await expect(page.locator('#attendanceSummary')).toHaveText('5명');
  await expect(page.locator('#attendanceCounts span').nth(1).locator('b')).toHaveText('2');
  await page.goto('/?tool=duty-schedule');
  await page.locator('#dutySample').click();
  await expect(page.locator('#dutySummary')).toHaveText('7일 편성');
  await expect(page.locator('.duty-assignee').nth(1)).toHaveValue('이사회복지사');
});
