import { defineConfig, devices } from '@playwright/test';
if (
  process.env['TALAAT_E2E'] !== '1' ||
  !process.env['DB_NAME']?.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(process.env['DB_HOST'] ?? '')
) {
  throw new Error('Use an isolated loopback *_test database and TALAAT_E2E=1.');
}
const clientPort = Number(process.env['E2E_CLIENT_PORT'] || 5173);
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/setup.ts',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${clientPort}`, trace: 'retain-on-failure', headless: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../../node_modules/tsx/dist/cli.mjs ../server/src/index.ts',
      url: 'http://127.0.0.1:55441/api/v1/health',
      reuseExistingServer: false,
      env: { NODE_ENV: 'test', SERVER_HOST: '127.0.0.1', SERVER_PORT: '55441' },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${clientPort}`,
      url: `http://127.0.0.1:${clientPort}`,
      reuseExistingServer: false,
      env: { TALAAT_API_PROXY: 'http://127.0.0.1:55441' },
    },
  ],
});
