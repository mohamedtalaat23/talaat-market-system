const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = '/home/talaat/.gemini/antigravity/brain/66e9aaa2-d136-4707-9e94-93daf803c69a/screenshots';
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  
  // Fill login form - try various selectors
  const usernameInput = page.locator('input[type="text"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  
  await usernameInput.fill('admin');
  await passwordInput.fill('admin123');
  await page.keyboard.press('Enter');
  await page.waitForURL('http://localhost:5173/', { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);

  console.log('Current URL after login:', page.url());

  // Screenshot 1: Dashboard
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dashboard_after.png') });
  console.log('✓ Dashboard');

  // Screenshot 2: Products
  await page.goto('http://localhost:5173/products');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'products_after.png') });
  console.log('✓ Products');

  // Screenshot 3: POS (capture before manager override fires)
  await page.goto('http://localhost:5173/pos');
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'pos_after.png') });
  console.log('✓ POS');

  await browser.close();
  console.log('Done. Screenshots saved to:', SCREENSHOTS_DIR);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
