import { defineConfig, devices } from '@playwright/test';

const dataDir = `.data-e2e-${process.pid}`;
const command = process.platform === 'win32'
  ? `set PORT=4397&& set WELFARE_DATA_DIR=${dataDir}&& node server.mjs`
  : `PORT=4397 WELFARE_DATA_DIR=${dataDir} node server.mjs`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4397',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command,
    url: 'http://127.0.0.1:4397/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
