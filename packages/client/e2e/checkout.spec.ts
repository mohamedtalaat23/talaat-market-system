import { test, expect } from '@playwright/test';
import { translations } from '../src/utils/translations';

for (const language of ['en', 'ar'] as const) {
  const t = translations[language].pos;

  test(`${language}: cashier logs in, obtains manager approval, opens shift and completes a cash sale`, async ({
    page,
  }) => {
    const f = JSON.parse(process.env[`E2E_FIXTURE_${language}`]!);
    await page.addInitScript(
      ({ registerId, language }) => {
        localStorage.setItem('talaat_lang', language);
        localStorage.setItem(
          'talaat-pos-cart-storage',
          JSON.stringify({ state: { registerId, autoPrintReceipts: false }, version: 0 }),
        );
      },
      { registerId: f.registerId, language },
    );
    await page.goto('/login');
    await page.fill('#username', f.username);
    await page.fill('#password', f.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.click('a[href="/pos"]');
    await expect(page.locator('#override-modal-title')).toBeVisible();
    await page.locator('#manager-select').selectOption(String(f.managerId));
    await page.fill('#pin-input', f.pin);
    await page.getByRole('button', { name: t.authorizeAction }).click();
    await expect(page.locator('#override-modal-title')).not.toBeVisible();
    await page.getByRole('button', { name: t.openShift, exact: true }).click();
    await page.locator('input[type="number"]').fill('100');
    await page.getByRole('button', { name: t.startShift }).click();
    await expect(page.getByRole('button', { name: t.closeShift, exact: true })).toBeVisible();
    for (const width of [1366, 1920]) {
      await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
      await page.screenshot({ path: `../../docs/qa/daily/checkout-${language}-${width}.png` });
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    // Use the cashier keyboard workflow; no application stores are exposed to tests.
    await page.keyboard.press('F5');
    await expect(page.locator('#search-input')).toBeVisible();
    await page.locator('#search-input').fill(f.productName);
    await expect(page.getByText(f.productName, { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#search-input')).not.toBeVisible();
    await page.getByRole('button', { name: t.payAction }).last().click();
    await page.locator('#cash-input').fill('20');
    // Interrupt the first checkout request: the cart must survive for a safe retry.
    const checkoutFailed = page.waitForEvent('requestfailed', {
      predicate: (request) => request.url().endsWith('/pos/checkout'),
    });
    await page.route('**/pos/checkout', async (route) => {
      await route.fetch();
      await route.abort('failed');
    });
    await page.getByRole('button', { name: t.completeSale }).click();
    await checkoutFailed;
    await expect(page.getByRole('button', { name: t.completeSale })).toBeEnabled();
    await expect(page.locator('#cash-input')).toHaveValue('20');
    await page.unroute('**/pos/checkout');
    const checkout = page.waitForResponse(
      (r) => r.url().endsWith('/pos/checkout') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: t.completeSale }).click();
    const response = await checkout;
    expect(response.ok()).toBe(true);
    const { data: sale } = await response.json();
    expect(Number(sale.total)).toBe(10);
    expect(Number(sale.change_given)).toBe(10);
    await expect(page.getByText(t.scanPrompt)).toBeVisible();
  });
}
