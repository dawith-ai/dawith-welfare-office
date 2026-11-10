import { test, expect } from './fixtures.mjs';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

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
  await expect(page.locator('#downloadLink')).toHaveAttribute('href', 'https://welfare-office.vercel.app/#download');
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
  await expect(page.locator('#hwpSubscriptionAi')).toBeEnabled();
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

test('기관 양식과 텍스트 화면에 로컬 AI 보조 진입점이 있다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="text-tools"]').click();
  await expect(page.locator('#textAiAssist')).toBeVisible();
  await page.locator('[data-action="home"]').click();
  await page.locator('.tool-card[data-tool="template-studio"]').click();
  await expect(page.locator('#templateAiAssist')).toBeVisible();
  await expect(page.locator('#templateSubscriptionAssist')).toBeVisible();
  await expect(page.locator('#templateAiRevert')).toBeHidden();
});

test('기관 양식 구독 AI 결과는 적용 전 되돌릴 수 있다', async ({ page }) => {
  await page.route('**/api/ai/subscription/status', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ providers: { codex: { provider: 'codex', label: 'Codex 구독', state: 'ready' } } }),
  }));
  await page.route('**/api/ai/subscription/assist', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ result: '구독 AI가 만든 합성 문서 초안입니다.' }),
  }));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.locator('.tool-card[data-tool="template-studio"]').click();
  await page.locator('#templateProject').fill('합성 사례회의');
  await page.locator('#templateContent').fill('주거 지원 절차를 논의함.');
  await page.locator('#templateSubscriptionAssist').click();
  await expect(page.locator('#templatePreview')).toContainText('구독 AI가 만든');
  await expect(page.locator('#templateAiRevert')).toBeVisible();
  await page.locator('#templateAiRevert').click();
  await expect(page.locator('#templatePreview')).toContainText('합성 사례회의');
  await expect(page.locator('#templateAiRevert')).toBeHidden();
});

test('AI 연결 센터는 로컬 모델과 구독 AI 경계를 분리해 보여준다', async ({ page }) => {
  await page.route('**/api/ai/subscription/status', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ providers: { 'claude-code': { provider: 'claude-code', label: 'Claude 구독', installed: true, state: 'signed-out' }, codex: { provider: 'codex', label: 'Codex 구독', installed: true, state: 'ready' }, 'gemini-cli': { provider: 'gemini-cli', label: 'Gemini 무료 · Google 로그인', installed: true, state: 'ready' }, chatgpt: { provider: 'chatgpt', label: 'ChatGPT 구독', kind: 'oauth', state: 'not-connected' }, openrouter: { provider: 'openrouter', label: 'OpenRouter 무료', kind: 'oauth', state: 'not-connected' }, gemini: { provider: 'gemini', label: 'Google Gemini', kind: 'key', state: 'not-connected' } } }),
  }));
  await page.goto('/');
  await page.locator('.tool-card[data-tool="ai-setup"]').click();
  await expect(page.locator('.subscription-panel')).toBeVisible();
  await expect(page.locator('.subscription-warning')).toContainText('외부 전송');
  await expect(page.locator('.subscription-card')).toHaveCount(6);
  await page.locator('#subscriptionText').fill('개인정보 없는 합성 문장입니다.');
  await expect(page.locator('#subscriptionAssist')).toBeEnabled();
});

test('텍스트 도구에는 구독 AI를 명시적으로 선택하는 경로가 있다', async ({ page }) => {
  await page.route('**/api/ai/subscription/status', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ providers: { codex: { provider: 'codex', label: 'Codex 구독', state: 'ready' } } }),
  }));
  await page.goto('/');
  await page.locator('.tool-card[data-tool="text-tools"]').click();
  await expect(page.locator('#textSubscriptionAssist')).toBeVisible();
  await expect(page.locator('.external-ai-button')).toContainText('구독 AI');
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

test('상담·회의 기록은 로컬 규칙으로 초안을 만들고 로컬 저장소에 보관한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tool-card[data-tool="case-record"]').click();
  await page.locator('#recordKind').selectOption('meeting');
  await page.locator('#recordRaw').fill('주거비 부담과 신청서류 준비의 어려움을 논의했다. 담당자가 주민센터에 연락하기로 했다.');
  await page.locator('#recordProcess').click();
  await expect(page.locator('#recordLog')).toHaveValue(/주요 안건/);
  await expect(page.locator('#recordPlan')).toHaveValue(/주민센터/);
  await page.locator('#recordSave').click();
  await expect(page.locator('#recordNotice')).toContainText('로컬 저장소');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dawith-record-drafts-v1')).length)).toBe(1);
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
  await expect(page.locator('.diagram-candidate')).toHaveCount(7);
  await page.locator('#diagramAddAllCandidates').click();
  await expect(page.locator('#genoMemberList .diagram-row')).toHaveCount(8);
  await expect(page.locator('.geno-member')).toHaveCount(8);
  await expect(page.locator('.geno-member[data-relation="모"] .geno-deceased-mark')).toHaveCount(1);
  await expect(page.locator('.geno-member[data-relation="자녀"]').first().locator('.geno-age')).toHaveText('12');
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
