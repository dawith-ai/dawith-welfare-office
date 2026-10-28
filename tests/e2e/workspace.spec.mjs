import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Document, Paragraph, Packer } from 'docx';
import { test, expect } from '@playwright/test';

test('social-work meeting workflow can be completed locally', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Dawith Welfare Office/);
  await page.getByRole('button', { name: /사례회의 기록/ }).click();
  await expect(page.locator('#workspaceFlow')).toBeVisible();
  await expect(page.locator('.task-brief-meeting')).toBeVisible();
  await expect(page.locator('.task-brief-counseling')).toBeHidden();
  await expect(page.locator('#stepNumber')).toHaveText('1');
  await page.getByRole('button', { name: '예시 넣기' }).click();
  await expect(page.locator('#stepNumber')).toHaveText('2');
  await page.getByRole('button', { name: /초안 만들기/ }).click();
  await expect(page.locator('#outputContent')).toBeVisible();
  await expect(page.locator('#stepNumber')).toHaveText('3');
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
  await expect(page.locator('.home-ci-lockup img')).toHaveAttribute('src', './dawith-ci.svg');
  await expect(page.locator('.brand-logo').first()).toHaveAttribute('alt', '다빛 CI');
  await expect(page.getByRole('button', { name: /상담 예시로 시작/ })).toBeVisible();
  await page.getByRole('button', { name: /상담 예시로 시작/ }).click();
  await expect(page.locator('#workspaceView')).toHaveClass(/active/);
  await expect(page.locator('#rawText')).toHaveValue(/친모는 7월에 이혼/);
  await page.getByRole('button', { name: /업무 선택/ }).click();
  await page.locator('[data-action="ollamaSetup"]').first().click();
  await expect(page.locator('#ollamaDialog')).toBeVisible();
  await expect(page.locator('#ollamaDialog .ollama-steps li')).toHaveCount(3);
  await expect(page.locator('#ollamaStepModel')).toHaveClass(/is-(current|done|blocked)/);
  await expect(page.locator('#ollamaRecommendationTitle')).toContainText(/qwen2\.5:/);
  await expect(page.locator('#ollamaSystemMemory')).toContainText('메모리');
  await expect(page.locator('#ollamaSystemCpu')).toContainText('CPU');
  await expect(page.locator('#ollamaDownloadLink')).toHaveAttribute('href', /https:\/\/ollama\.com\/download/);
  await expect(page.locator('#ollamaCommand')).toHaveText(/ollama pull qwen2\.5:\d+b/);
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

test('행사 결과 영상 스튜디오는 장면·자막·검토 흐름을 로컬에서 제공한다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /행사 결과 영상 만들기/ }).click();
  await expect(page.locator('#videoView')).toHaveClass(/active/);
  await page.getByRole('button', { name: '예시 장면 넣기' }).click();
  await expect(page.locator('#videoSceneList .video-scene-item')).toHaveCount(3);
  await page.locator('#videoSceneName').fill('오프닝 행사');
  await page.locator('#videoSceneCaption').fill('우리 기관의 즐거운 하루');
  await page.locator('#videoSceneReviewed').check();
  await expect(page.locator('#videoSelectedSceneTitle')).toContainText('장면 1');
  await expect(page.locator('#videoDurationSummary')).toHaveText('총 9.0초');
  await page.locator('#videoTrimStart').fill('0.1');
  await page.locator('#videoTrimEnd').fill('0.9');
  await page.locator('#videoTransition').selectOption('fade');
  await page.locator('#videoSplitScene').click();
  await expect(page.locator('#videoSceneList .video-scene-item')).toHaveCount(4);
  await expect(page.locator('#videoTimelineVideo .timeline-clip')).toHaveCount(4);
  await page.locator('#videoAspect').selectOption('9:16');
  await expect.poll(() => page.locator('#videoCanvas').evaluate((canvas) => `${canvas.width}:${canvas.height}`)).toBe('540:960');
  const projectDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '프로젝트 설계도 저장' }).click();
  const download = await projectDownload;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
});

test('검토한 예시 장면은 실제 로컬 WebM으로 저장된다', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto('/');
  await page.getByRole('button', { name: /행사 결과 영상 만들기/ }).click();
  await page.getByRole('button', { name: '예시 장면 넣기' }).click();
  for (let index = 0; index < 3; index += 1) {
    await page.locator('#videoSceneList .video-scene-item').nth(index).click();
    await page.locator('#videoSceneDuration').fill('1');
    await page.locator('#videoSceneReviewed').check();
  }
  await page.locator('#videoConsentCheck').check();
  await page.locator('#videoPrivacyCheck').check();
  const videoDownload = page.waitForEvent('download', { timeout: 20_000 });
  await page.getByRole('button', { name: /영상으로 저장하기/ }).click();
  const download = await videoDownload;
  expect(download.suggestedFilename()).toMatch(/\.webm$/);
});

test('전문 타임라인의 플레이헤드·Undo/Redo·단축키를 사용할 수 있다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /행사 결과 영상 만들기/ }).click();
  await page.getByRole('button', { name: '예시 장면 넣기' }).click();
  await page.locator('#videoSceneName').fill('새 오프닝 제목');
  await expect(page.locator('#videoSaveState')).toContainText('자동 저장됨', { timeout: 1_500 });
  await page.locator('#videoUndoButton').click();
  await expect(page.locator('#videoSceneList .video-scene-item').first()).toContainText('함께 준비한 시간');
  await page.locator('#videoRedoButton').click();
  await expect(page.locator('#videoSceneList .video-scene-item').first()).toContainText('새 오프닝 제목');
  await page.locator('#videoTimelineVideo .timeline-clip').nth(1).click();
  await page.locator('#videoStepButton').click();
  await expect(page.locator('#videoCurrentTime')).not.toHaveText('00:00.0');
  await page.locator('#videoEffect').selectOption('cinematic');
  await page.locator('#videoMotion').selectOption('zoom-in');
  await page.locator('#videoEffectAmount').fill('80');
  await expect(page.locator('#videoEffectAmountValue')).toHaveText('80%');
  await page.locator('#videoSceneScaleStart').fill('110');
  await page.locator('#videoSceneScaleEnd').fill('135');
  await page.locator('#videoFraming').selectOption('contain');
  await expect(page.locator('#videoTimeline')).toContainText('A2 VOICE');
  await page.locator('#videoSceneList .video-scene-item').first().click();
  await page.locator('body').press('s');
  await expect(page.locator('#videoSceneList .video-scene-item')).toHaveCount(4);
  await page.keyboard.press('Control+Z');
  await expect(page.locator('#videoSceneList .video-scene-item')).toHaveCount(3);
});

test('독립 타이틀 트랙이 캔버스·타임라인·자동저장에 연결된다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /행사 결과 영상 만들기/ }).click();
  await page.getByRole('button', { name: '예시 장면 넣기' }).click();
  await page.getByRole('button', { name: '＋ 타이틀' }).click();
  await expect(page.locator('#videoTimelineOverlay .timeline-overlay-clip')).toHaveCount(1);
  await page.locator('#videoOverlayText').fill('2026 우리동네 나눔 행사');
  await page.locator('#videoOverlayStart').fill('1.5');
  await page.locator('#videoOverlayDuration').fill('4');
  await page.locator('#videoOverlayStyle').selectOption('lower-third');
  await page.locator('#videoOverlayX').fill('35');
  await page.locator('#videoOverlayY').fill('78');
  await expect(page.locator('#videoTimelineOverlay .timeline-overlay-clip')).toContainText('2026 우리동네 나눔 행사');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dawith.video-studio.project.v2')).project.overlays[0].start)).toBe(1.5);
});

test('프로젝트 설계도를 불러오고 빠진 원본 미디어를 다시 연결할 수 있다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /행사 결과 영상 만들기/ }).click();
  const sceneId = 'imported-scene';
  const project = { version: 3, title: '가져온 행사', organization: '다빛 복지관', aspect: '16:9', theme: 'warm', ending: '감사합니다.', scenes: [{ id: sceneId, name: '연결 대기 장면', caption: '원본을 연결해 주세요.', duration: 2, trimStart: 0, trimEnd: 1, transition: 'cut', captionStyle: 'bottom', effect: 'none', effectAmount: 50, motion: 'none', scaleStart: 100, scaleEnd: 100, positionX: 0, positionY: 0, framing: 'cover', reviewed: true, type: 'image', src: '', fileName: 'missing.png' }], overlays: [] };
  await page.locator('#videoProjectImportFile').setInputFiles({ name: 'imported-project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('#videoSceneList .video-scene-item')).toHaveCount(1);
  await expect(page.locator('.video-scene-status')).toHaveClass(/is-missing/);
  await page.locator('#videoRelinkFile').setInputFiles({ name: 'relinked.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#c43e68"/></svg>') });
  await expect(page.locator('#videoRelinkStatus')).toContainText('relinked.svg');
  await expect(page.locator('.video-scene-status')).not.toHaveClass(/is-missing/);
});

test('로컬 Whisper 타임코드가 편집 가능한 TITLE 자막으로 들어온다', async ({ page }) => {
  await page.route('**/api/transcribe', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ segments: [{ text: '함께 준비한 하루입니다.', from: '00:00:01,000', to: '00:00:03,000' }, { text: '모두가 즐겁게 참여했어요.', from: '00:00:04,000', to: '00:00:06,500' }] }) }));
  await page.goto('/');
  await page.getByRole('button', { name: /행사 결과 영상 만들기/ }).click();
  await page.getByRole('button', { name: '예시 장면 넣기' }).click();
  await page.locator('#videoVoiceFile').setInputFiles({ name: 'narration.wav', mimeType: 'audio/wav', buffer: Buffer.from('local-audio') });
  await page.getByRole('button', { name: '로컬 음성에서 자막 만들기' }).click();
  await expect(page.locator('#videoTimelineOverlay .timeline-overlay-clip')).toHaveCount(2);
  await expect(page.locator('#videoTimelineOverlay')).toContainText('함께 준비한 하루입니다.');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dawith.video-studio.project.v2')).project.overlays[0].source)).toBe('auto-caption');
});

test('장면별 개인정보 모자이크 영역이 프로젝트와 캔버스 렌더 경로에 반영된다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /행사 결과 영상 만들기/ }).click();
  await page.getByRole('button', { name: '예시 장면 넣기' }).click();
  await page.getByRole('button', { name: '＋ 영역' }).click();
  await page.locator('#videoMosaicX').fill('10');
  await page.locator('#videoMosaicY').fill('20');
  await page.locator('#videoMosaicWidth').fill('25');
  await page.locator('#videoMosaicHeight').fill('30');
  await page.locator('#videoMosaicAmount').fill('22');
  await expect(page.locator('#videoMosaicAmountValue')).toHaveText('22');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dawith.video-studio.project.v2')).project.scenes[0].mosaics[0].width)).toBe(25);
  await expect(page.locator('#videoRemoveMosaic')).toBeEnabled();
});
