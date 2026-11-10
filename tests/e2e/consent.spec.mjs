import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { startServer } from '../../server.mjs';
import { acceptedConsent } from './fixtures.mjs';

// Each test gets its own server and data folder (and therefore its own origin
// and localStorage), so first-run state never leaks into the tool tests.
let runtime;
let dataDir;

test.beforeEach(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-consent-e2e-'));
  runtime = await startServer({ port: 0, host: '127.0.0.1', dataDir });
});

test.afterEach(async () => {
  runtime.server.closeAllConnections();
  await new Promise((resolve) => runtime.server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const serverConsent = async (request) => (await (await request.get(`${runtime.url}/api/settings`)).json()).settings.consent;
const patchConsent = (request, consent) => request.patch(`${runtime.url}/api/settings`, { data: { consent } });

test('첫 실행 설정은 필수 동의 없이는 넘어가지 않고, 선택한 내용이 새로고침 뒤에도 남는다', async ({ page, request }) => {
  await page.goto(runtime.url);
  const setup = page.locator('#setupDialog');
  await expect(setup).toBeVisible();
  await expect(setup).toContainText('계정이 없습니다');
  await page.keyboard.press('Escape');
  await expect(setup).toBeVisible();

  await page.locator('#setupNext').click();
  await expect(page.locator('#setupStepLabel')).toHaveText('2/4');
  await expect(setup.locator('a[href="./privacy.html"]').first()).toBeVisible();
  await page.locator('#setupNext').click();
  await expect(page.locator('#setupError')).toContainText('개인정보처리방침에 동의해야');
  await expect(page.locator('#setupStepLabel')).toHaveText('2/4');
  await page.locator('#consentPrivacy').check();
  await page.locator('#setupNext').click();

  await expect(page.locator('#setupStepLabel')).toHaveText('3/4');
  await page.locator('#setupNext').click();
  await expect(page.locator('#setupError')).toContainText('이용 조건에 동의해야');
  await page.locator('#consentTerms').check();
  await page.locator('#setupNext').click();

  // There is no optional cloud-AI step: the app has no external AI.
  await expect(page.locator('#setupStepLabel')).toHaveText('4/4');
  await expect(setup.locator('#consentExternalAi')).toHaveCount(0);
  await page.locator('#setupOrganization').fill('합성 종합사회복지관');
  await page.locator('#setupManager').fill('합성 담당자');
  await page.locator('#setupNext').click();
  await expect(setup).toBeHidden();

  const saved = await serverConsent(request);
  expect(saved.policyVersion).toBe('2026-11-11');
  expect(saved.privacy.agreed).toBe(true);
  expect(saved.terms.agreed).toBe(true);
  expect('externalAi' in saved).toBe(false);
  expect(Date.parse(saved.privacy.at)).not.toBeNaN();

  await page.reload();
  await page.locator('.tool-card[data-tool="template-studio"]').click();
  await expect(page.locator('#setupDialog')).toBeHidden();
  await expect(page.locator('#profileOrganization')).toHaveValue('합성 종합사회복지관');
  await expect(page.locator('#profileManager')).toHaveValue('합성 담당자');

  // Server copy survives even when the browser storage is cleared.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#homeTitle')).toBeVisible();
  await expect(page.evaluate(() => window.dawithConsent.ready())).resolves.toBeUndefined();
  await expect(page.locator('#setupDialog')).toBeHidden();
  expect(await page.evaluate(() => window.dawithConsent.status().terms.agreed)).toBe(true);
});

test('설정 화면에는 외부 AI 동의가 없고, 필수 동의를 철회할 수 있다', async ({ page, request }) => {
  await patchConsent(request, acceptedConsent());
  await page.goto(runtime.url);
  await expect(page.locator('#setupDialog')).toBeHidden();

  await page.locator('#privacyButton').click();
  await page.locator('#privacyOpenSettings').click();
  const settings = page.locator('#settingsDialog');
  await expect(settings).toBeVisible();
  await expect(page.locator('#settingsPrivacyStatus')).toContainText('동의함');
  await expect(page.locator('#settingsExternalAi')).toHaveCount(0);
  await expect(settings).not.toContainText('선택 동의');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#settingsWithdraw').click();
  await expect(settings).toBeHidden();
  await expect(page.locator('#setupDialog')).toBeVisible();
  await expect.poll(async () => (await serverConsent(request)).privacy.agreed).toBe(false);

  await page.reload();
  await expect(page.locator('#setupDialog')).toBeVisible();
});

test('정책 버전이 바뀌면 처음 설정을 다시 보여준다', async ({ page, request }) => {
  await patchConsent(request, { ...acceptedConsent(), policyVersion: '2026-01-01' });
  await page.goto(runtime.url);
  await expect(page.locator('#setupDialog')).toBeVisible();
  await expect(page.locator('#setupPolicyChanged')).toBeVisible();
});

test('외부 AI 전송 동의 창과 구독 AI 버튼이 어디에도 없다', async ({ page, request }) => {
  await patchConsent(request, acceptedConsent());
  await page.goto(runtime.url);
  await expect(page.locator('#externalConsentDialog')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.dawithConsent.ensureExternalAi)).toBe('undefined');
  for (const tool of ['text-tools', 'hwp-inspector', 'template-studio', 'ai-setup']) {
    await page.locator(`.tool-card[data-tool="${tool}"]`).click();
    await expect(page.locator('#workspaceView')).toBeVisible();
    await expect(page.locator('.external-ai-button')).toHaveCount(0);
    await expect(page.locator('#workspaceMount')).not.toContainText('구독 AI');
    await page.locator('[data-action="home"]').click();
  }
});

test('앱 하단과 정책 문서 링크가 실제 페이지로 열린다', async ({ page, request }) => {
  await patchConsent(request, acceptedConsent());
  await page.goto(runtime.url);
  const links = page.locator('.app-legal a');
  await expect(links).toHaveText(['개인정보처리방침', '이용약관', '데이터 처리 안내', '해외 서버 안내', '광고·쿠키 안내']);
  for (const href of await links.evaluateAll((items) => items.map((item) => item.getAttribute('href')))) {
    const response = await request.get(`${runtime.url}/${href.replace('./', '')}`);
    expect(response.status(), href).toBe(200);
    expect(await response.text()).toContain('시행일');
  }
});
