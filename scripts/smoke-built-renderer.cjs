const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const target = process.argv[2];
const resources = target && !target.startsWith('http:') ? path.resolve(target) : null;
const index = resources
  ? path.join(resources, 'client/dist/index.html')
  : path.join(root, 'packages/client/dist/index.html');
async function main() {
  let localServer;
  let url = target?.startsWith('http:') ? target : null;
  if (!url) {
    const app = express();
    const { desktopRenderer } = require('../packages/server/dist/desktop-renderer.js');
    app.use(desktopRenderer(path.dirname(index)));
    localServer = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => localServer.once('listening', resolve));
    url = `http://127.0.0.1:${localServer.address().port}/`;
  }
  const html =
    resources || !target?.startsWith('http:')
      ? fs.readFileSync(index, 'utf8')
      : await (await fetch(url)).text();
  if (/(?:src|href)=["']\/(?!\/)/.test(html))
    throw new Error('Built renderer uses root-relative file assets.');
  const browser = await chromium.launch({
    headless: true,
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
      await page.route(`${url}api/v1/**`, async (route) => {
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
      await page.goto(url);
      await page.locator('#username').waitFor({ timeout: 30000 });
      if (!page.url().includes('#/login'))
        throw new Error('Desktop renderer did not select hash routing.');
      if (!(await page.evaluate(async () => (await document.fonts.load('16px Cairo')).length)))
        throw new Error('Bundled Cairo font is missing.');
      if (!(await page.evaluate(() => document.fonts.check('16px Cairo'))))
        throw new Error('Bundled Cairo font did not load from file.');
      await page.fill('#username', 'synthetic_smoke');
      await page.fill('#password', 'not-a-real-password');
      const requested = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' && response.url() === `${url}api/v1/auth/login`,
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
          transport: 'same-origin-loopback-http',
          languages: ['en', 'ar'],
          checks: ['relative assets', 'hash routing', 'local fonts', 'same-origin HTTP API'],
          limits:
            'Chromium with a minimal desktop bridge fixture; not native Electron/hardware acceptance',
        },
        null,
        2,
      ),
    );
    console.log('Built desktop renderer smoke passed in Arabic and English.');
  } finally {
    await browser.close();
    if (localServer) await new Promise((resolve) => localServer.close(resolve));
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
