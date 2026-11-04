const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const resources = process.argv[2] ? path.resolve(process.argv[2]) : null;
const index = resources
  ? path.join(resources, 'client/dist/index.html')
  : path.join(root, 'packages/client/dist/index.html');
async function main() {
  const html = fs.readFileSync(index, 'utf8');
  if (/(?:src|href)=["']\/(?!\/)/.test(html))
    throw new Error('Built renderer uses root-relative file assets.');
  const browser = await chromium.launch({
    headless: true,
    args: ['--allow-file-access-from-files'],
  });
  try {
    for (const language of ['en', 'ar']) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      const failures = [];
      let login = false;
      page.on('pageerror', (error) => failures.push(error.message));
      await page.addInitScript((language) => {
        localStorage.setItem('talaat_lang', language);
        window.electronAPI = { getServerPort: async () => 55449 };
      }, language);
      await page.route('http://127.0.0.1:55449/api/v1/**', async (route) => {
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({
            status: 204,
            headers: {
              'access-control-allow-origin': '*',
              'access-control-allow-methods': 'GET, POST, OPTIONS',
              'access-control-allow-headers': 'content-type',
            },
          });
          return;
        }
        if (route.request().url().endsWith('/auth/login') && route.request().method() === 'POST')
          login = true;
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ message: 'Synthetic built-renderer login rejection' }),
        });
      });
      await page.goto(pathToFileURL(index).href);
      await page.locator('#username').waitFor({ timeout: 30000 });
      if (!page.url().includes('#/login'))
        throw new Error('File renderer did not select hash routing.');
      if (!(await page.evaluate(async () => (await document.fonts.load('16px Cairo')).length)))
        throw new Error('Bundled Cairo font is missing.');
      if (!(await page.evaluate(() => document.fonts.check('16px Cairo'))))
        throw new Error('Bundled Cairo font did not load from file.');
      await page.fill('#username', 'synthetic_smoke');
      await page.fill('#password', 'not-a-real-password');
      const requested = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url() === 'http://127.0.0.1:55449/api/v1/auth/login',
      );
      await page.locator('button[type=submit]').click();
      await requested;
      if (!login || failures.length)
        throw new Error(`Built renderer failed: ${failures.join('; ')}`);
      await page.close();
    }
    const evidence = path.join(root, 'packages/desktop/release/pilot-evidence');
    fs.mkdirSync(evidence, { recursive: true });
    fs.writeFileSync(
      path.join(evidence, 'renderer-smoke.json'),
      JSON.stringify(
        {
          passed: true,
          transport: 'file',
          languages: ['en', 'ar'],
          checks: [
            'relative assets',
            'hash routing',
            'local fonts',
            'existing IPC port bridge to HTTP API',
          ],
          limits:
            'Chromium with a minimal port-bridge fixture; not native Electron/hardware acceptance',
        },
        null,
        2,
      ),
    );
    console.log('Built file renderer smoke passed in Arabic and English.');
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
