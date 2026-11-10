import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from './fixtures.mjs';
import { startServer } from '../../server.mjs';

let runtime;
let dataDir;

test.beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-local-tools-auth-'));
  runtime = await startServer({ port: 0, host: '127.0.0.1', authRequired: true, dataDir });
});

test.afterAll(async () => {
  await new Promise((resolve) => runtime.server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('기관 인증 모드에서도 로컬 도구 화면은 열리고 보호 API는 인증을 요구한다', async ({ page, request }) => {
  await page.goto(runtime.url);
  await expect(page.locator('#homeTitle')).toContainText('서류 일은 줄이고');
  const response = await request.get(`${runtime.url}/api/capabilities`);
  expect(response.status()).toBe(401);
});
