import { expect, type Page } from '@playwright/test';
import type { Fixture } from './fixtures';
import { assertTestDatabase } from './fixtures';
import { translations } from '../src/utils/translations';
export async function login(
  page: Page,
  f: Fixture,
  role: 'cashier' | 'manager' | 'admin' | 'nextCashier' = 'cashier',
) {
  await page.addInitScript(
    ({ f }) => {
      localStorage.setItem('talaat_lang', f.language);
      if (!localStorage.getItem('talaat-pos-cart-storage'))
        localStorage.setItem(
          'talaat-pos-cart-storage',
          JSON.stringify({
            state: { registerId: f.registerId, autoPrintReceipts: false },
            version: 0,
          }),
        );
    },
    { f },
  );
  await page.goto('/login');
  await page.fill('#username', f[role].username);
  await page.fill('#password', f.password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL('/');
}
export async function api(page: Page, path: string, method = 'GET', data?: unknown) {
  const token = await page.evaluate(() => localStorage.getItem('talaat_token'));
  const response = await page.request.fetch(`/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
  });
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBe(true);
  return response.json();
}
export async function db() {
  assertTestDatabase();
  return (await import('../../server/src/config/database')).db;
}
export async function enterPOS(page: Page, f: Fixture, open = true) {
  const t = translations[f.language].pos;
  await page.goto('/pos');
  await page.locator('#manager-select').selectOption(String(f.manager.id));
  await page.fill('#pin-input', f.pin);
  await page.getByRole('button', { name: t.authorizeAction, exact: true }).click();
  await expect(page.locator('#override-modal-title')).toBeHidden();
  if (open) {
    await page.getByRole('button', { name: t.openShift, exact: true }).click();
    await page.locator('input[type=number]').fill('100');
    await page.getByRole('button', { name: t.startShift, exact: true }).click();
  }
  await expect(page.getByRole('button', { name: t.closeShift, exact: true })).toBeVisible();
}
export async function addProduct(page: Page, f: Fixture) {
  await page.keyboard.press('F5');
  await page.fill('#search-input', f.productName);
  await expect(
    page.getByRole('dialog').getByRole('button').filter({ hasText: f.productName }),
  ).toBeVisible();
  await page.locator('#search-input').press('Enter');
  await expect(page.locator('#search-input')).toBeHidden();
}
export async function pay(page: Page, f: Fixture, method: 'cash' | 'debt' = 'cash') {
  const t = translations[f.language].pos;
  await page.getByRole('button', { name: t.payAction }).click();
  if (method === 'debt') await page.getByRole('button', { name: t.debt, exact: true }).click();
  else await page.fill('#cash-input', '100');
  const result = page.waitForResponse(
    (r) => r.url().endsWith('/pos/checkout') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: t.completeSale, exact: true }).click();
  const response = await result;
  expect(response.ok(), await response.text()).toBe(true);
  await expect(page.locator('#cash-input')).toBeHidden();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return (await response.json()).data;
}
export async function capture(page: Page, f: Fixture, name: string) {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
    await page.screenshot({
      animations: 'disabled',
      path: `../../docs/qa/daily/${f.language}-${name}-${width}.png`,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}
