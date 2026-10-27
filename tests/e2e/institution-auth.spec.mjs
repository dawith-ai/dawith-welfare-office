import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { startServer } from '../../server.mjs';

let runtime;
let dataDir;

test.beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-browser-auth-'));
  runtime = await startServer({ port: 0, host: '127.0.0.1', authRequired: true, dataDir });
});

test.afterAll(async () => {
  await new Promise((resolve) => runtime.server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('기관 최초 관리자 설정과 로그아웃 흐름을 브라우저에서 완료한다', async ({ page }) => {
  await page.goto(runtime.url);
  await expect(page.locator('#authGate')).toBeVisible();
  await expect(page.locator('#authTitle')).toHaveText('관리자 계정을 만드세요');
  await page.locator('#authUsername').fill('admin');
  await page.locator('#authPassword').fill('institution-safe-password');
  await page.locator('#authPasswordConfirm').fill('institution-safe-password');
  await page.locator('#authSubmit').click();
  await expect(page.locator('#authGate')).toBeHidden();
  await expect(page.locator('#homeView')).toBeVisible();
  await expect(page.locator('#securityText')).toContainText('기관 내부망');
  await page.locator('#logoutButton').click();
  await expect(page.locator('#authGate')).toBeVisible();
  await expect(page.locator('#authTitle')).toHaveText('기관 계정으로 시작하세요');
});
