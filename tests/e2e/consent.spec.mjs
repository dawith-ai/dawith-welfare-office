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
  await expect(page.locator('#setupStepLabel')).toHaveText('2/5');
  await expect(setup.locator('a[href="./privacy.html"]').first()).toBeVisible();
  await page.locator('#setupNext').click();
  await expect(page.locator('#setupError')).toContainText('개인정보처리방침에 동의해야');
  await expect(page.locator('#setupStepLabel')).toHaveText('2/5');
  await page.locator('#consentPrivacy').check();
  await page.locator('#setupNext').click();

  await expect(page.locator('#setupStepLabel')).toHaveText('3/5');
  await page.locator('#setupNext').click();
  await expect(page.locator('#setupError')).toContainText('이용 조건에 동의해야');
  await page.locator('#consentTerms').check();
  await page.locator('#setupNext').click();

  await expect(page.locator('#setupStepLabel')).toHaveText('4/5');
  await expect(page.locator('#consentExternalAi')).not.toBeChecked();
  await page.locator('#setupNext').click();

  await expect(page.locator('#setupStepLabel')).toHaveText('5/5');
  await page.locator('#setupOrganization').fill('합성 종합사회복지관');
  await page.locator('#setupManager').fill('합성 담당자');
  await page.locator('#setupNext').click();
  await expect(setup).toBeHidden();

  const saved = await serverConsent(request);
  expect(saved.policyVersion).toBe('2026-11-10');
  expect(saved.privacy.agreed).toBe(true);
  expect(saved.terms.agreed).toBe(true);
  expect(saved.externalAi.agreed).toBe(false);
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

test('설정 화면에서 외부 AI 동의를 켜고 끄고, 필수 동의를 철회할 수 있다', async ({ page, request }) => {
  await patchConsent(request, acceptedConsent({ externalAi: false }));
  await page.goto(runtime.url);
  await expect(page.locator('#setupDialog')).toBeHidden();

  await page.locator('#privacyButton').click();
  await page.locator('#privacyOpenSettings').click();
  const settings = page.locator('#settingsDialog');
  await expect(settings).toBeVisible();
  await expect(page.locator('#settingsPrivacyStatus')).toContainText('동의함');
  await expect(page.locator('#settingsExternalAi')).not.toBeChecked();

  await page.locator('#settingsExternalAi').check();
  await expect(page.locator('#settingsNotice')).toContainText('동의를 켰습니다');
  await expect.poll(async () => (await serverConsent(request)).externalAi.agreed).toBe(true);
  await page.locator('#settingsExternalAi').uncheck();
  await expect(page.locator('#settingsNotice')).toContainText('철회했습니다');
  await expect.poll(async () => (await serverConsent(request)).externalAi.agreed).toBe(false);

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

test('외부 AI 동의가 꺼져 있으면 보내기 전에 묻고, 취소하면 아무것도 보내지 않는다', async ({ page, request }) => {
  await patchConsent(request, acceptedConsent({ externalAi: false }));
  let assistCalls = 0;
  await page.route('**/api/ai/subscription/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ providers: { codex: { provider: 'codex', label: 'Codex 구독', state: 'ready' } } }) }));
  await page.route('**/api/ai/subscription/assist', (route) => { assistCalls += 1; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: '외부 AI 합성 결과' }) }); });
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto(runtime.url);
  await page.locator('.tool-card[data-tool="text-tools"]').click();
  await page.locator('#textInput').fill('개인정보 없는 합성 문장입니다.');

  await page.locator('#textSubscriptionAssist').click();
  const prompt = page.locator('#externalConsentDialog');
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('외부 AI로 보내기 전에 동의가 필요합니다');
  await page.locator('#externalConsentCancel').click();
  await expect(prompt).toBeHidden();
  expect(assistCalls).toBe(0);
  expect((await serverConsent(request)).externalAi.agreed).toBe(false);

  await page.locator('#textSubscriptionAssist').click();
  await expect(prompt).toBeVisible();
  await page.locator('#externalConsentAccept').click();
  await expect(page.locator('#textOutput')).toContainText('외부 AI 합성 결과');
  expect(assistCalls).toBe(1);
  expect((await serverConsent(request)).externalAi.agreed).toBe(true);

  // Once agreed, the next send only shows the per-send confirmation.
  await page.locator('#textSubscriptionAssist').click();
  await expect.poll(() => assistCalls).toBe(2);
  await expect(prompt).toBeHidden();
  expect(await page.evaluate(() => typeof window.dawithConsent.ensureExternalAi)).toBe('function');
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
