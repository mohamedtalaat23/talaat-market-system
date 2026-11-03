import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixtures';
import { login, api, db, enterPOS, capture } from './daily-helpers';
import { translations } from '../src/utils/translations';
test.afterAll(async () => {
  await (await db()).destroy();
});
for (const language of ['en', 'ar'] as const) {
  const t = translations[language];
  test(`${language}: drawer adjustment and independent cashier handover`, async ({
    page,
    browser,
  }) => {
    const f = fixture(language, 'handover');
    await login(page, f);
    await enterPOS(page, f);
    await page.keyboard.press('F9');
    await page.locator('input[type=number]').fill('5');
    await page.selectOption('#inline-manager-select', String(f.manager.id));
    await page.fill('#inline-pin-input', f.pin);
    const adjustment = page.waitForResponse(
      (r) => r.url().endsWith('/adjustments') && r.request().method() === 'POST',
    );
    await page.locator('button[type=submit]').click();
    expect((await adjustment).ok()).toBe(true);
    const database = await db();
    const shift = await database('cashier_shifts')
      .where({ employee_id: f.cashier.id, status: 'open' })
      .first();
    const summary = (await api(page, `/pos/shifts/${shift.id}/summary`)).data;
    await page.getByRole('button', { name: t.pos.closeShift, exact: true }).click();
    await page.locator('input[type=number]').fill(String(summary.expected_cash));
    const close = page.waitForResponse(
      (r) => r.url().endsWith('/shifts/close') && r.request().method() === 'POST',
    );
    await page
      .getByRole('dialog')
      .getByRole('button', { name: t.pos.closeShift, exact: true })
      .click();
    expect((await close).ok()).toBe(true);
    expect((await database('cashier_shifts').where({ id: shift.id }).first()).status).toBe(
      'closed',
    );
    const other = await browser.newContext();
    const next = await other.newPage();
    await login(next, f, 'nextCashier');
    await enterPOS(next, f);
    const nextShift = await database('cashier_shifts')
      .where({ employee_id: f.nextCashier.id, status: 'open' })
      .first();
    expect(nextShift.register_id).toBe(f.registerId);
    expect(nextShift.id).not.toBe(shift.id);
    await capture(next, f, 'handover');
    await other.close();
  });
  test(`${language}: owner setup backup diagnostics and permission denial without internet`, async ({
    page,
    browser,
  }) => {
    const f = fixture(language, 'owner');
    const external: string[] = [];
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
        external.push(url.href);
        return route.abort();
      }
      return route.continue();
    });
    await login(page, f, 'admin');
    await page.goto('/settings/operations');
    const checkbox = page.getByRole('checkbox').first();
    if (!(await checkbox.isChecked())) await checkbox.click();
    await expect(checkbox).toBeChecked();
    await page.reload();
    await expect(page.getByRole('checkbox').first()).toBeChecked();
    const backup = page.waitForResponse(
      (r) => r.url().endsWith('/settings/backups') && r.request().method() === 'POST',
    );
    await page
      .getByRole('button', {
        name: language === 'ar' ? 'إنشاء نسخة احتياطية' : 'Create backup',
        exact: true,
      })
      .click();
    const result = await backup;
    expect(result.ok()).toBe(true);
    const created = (await result.json()).data;
    await expect(page.getByText(created.filename, { exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: language === 'ar' ? 'فحص الحالة' : 'Check status', exact: true })
      .click();
    const download = page.waitForEvent('download');
    await page
      .getByRole('button', {
        name: language === 'ar' ? 'تنزيل التشخيص' : 'Download diagnostics',
        exact: true,
      })
      .click();
    const file = await download;
    const stream = await file.createReadStream();
    const parts: Buffer[] = [];
    for await (const part of stream!) parts.push(Buffer.from(part));
    const diagnostic = JSON.parse(Buffer.concat(parts).toString());
    expect(Object.keys(diagnostic).sort()).toEqual(
      [
        'version',
        'service',
        'database',
        'printer',
        'paperWidth',
        'printJobs',
        'pendingSales',
        'pendingShifts',
        'capturedAt',
      ].sort(),
    );
    expect(diagnostic.database).toBe('connected');
    await capture(page, f, 'owner');
    expect(external).toEqual([]);
    const other = await browser.newContext();
    const cashier = await other.newPage();
    await login(cashier, f);
    const token = await cashier.evaluate(() => localStorage.getItem('talaat_token'));
    const denied = await cashier.request.post('/api/v1/settings/backups', {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(denied.status()).toBe(403);
    await cashier.goto('/settings/operations');
    await expect(cashier).toHaveURL('/');
    await other.close();
  });
  test(`${language}: manager approval rejection and reconciliation drain only acknowledged evidence`, async ({
    page,
    browser,
  }) => {
    const f = fixture(language, 'offline');
    await login(page, f);
    const shift = (
      await api(page, '/pos/shifts/open', 'POST', { register_id: f.registerId, starting_cash: 100 })
    ).data;
    const sales = [0, 1].map(() => {
      const id = randomUUID();
      return {
        id,
        idempotency_key: id,
        payload: {
          shift_id: shift.id,
          register_id: f.registerId,
          payment_method: 'cash',
          cash_received: 10,
          idempotency_key: id,
          items: [{ product_id: f.productId, quantity: 1, unit_price: 8, discount: 0 }],
        },
        timestamp: new Date().toISOString(),
      };
    });
    const synced = await api(page, '/pos/sync', 'POST', {
      transactions: sales.map((s) => s.payload),
    });
    expect(synced.failed).toHaveLength(2);
    await page.evaluate(
      (sales) =>
        localStorage.setItem(
          'talaat-pos-lan-storage',
          JSON.stringify({
            state: { mode: 'standalone', offlineSales: sales, offlineShiftClosures: [] },
            version: 0,
          }),
        ),
      sales,
    );
    await page.reload();
    const other = await browser.newContext();
    const manager = await other.newPage();
    await login(manager, f, 'manager');
    const database = await db();
    const rows = await database('offline_sync_quarantine')
      .whereIn(
        'idempotency_key',
        sales.map((s) => s.idempotency_key),
      )
      .orderBy('id');
    async function review(id: number, decision: 'approve' | 'reject' | 'reconcile') {
      const li = manager
        .locator('li')
        .filter({ has: manager.locator('strong', { hasText: new RegExp(`^#${id}$`) }) });
      await li.getByRole('button', { name: t.offlineApproval.review, exact: true }).click();
      await li.getByRole('combobox').selectOption(decision);
      await li.locator('input[type=password]').fill(f.pin);
      await li
        .locator('input:not([type=password])')
        .fill('Cash refunded and goods returned; reviewed with cashier.');
      await li.getByRole('button', { name: t.offlineApproval.confirm, exact: true }).click();
      await expect(li.locator('form')).toBeHidden();
    }
    await review(rows[0].id, 'approve');
    await review(rows[1].id, 'reject');
    await page
      .getByRole('button', {
        name: language === 'ar' ? 'إعادة المحاولة' : 'Retry sync',
        exact: true,
      })
      .click();
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('talaat-pos-lan-storage')!).state.offlineSales.length,
        ),
      )
      .toBe(1);
    await manager
      .getByRole('button', {
        name: language === 'ar' ? 'مرفوضة / التسوية' : 'Rejected / reconciliation',
        exact: true,
      })
      .click();
    await review(rows[1].id, 'reconcile');
    await page
      .getByRole('button', {
        name: language === 'ar' ? 'إعادة المحاولة' : 'Retry sync',
        exact: true,
      })
      .click();
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('talaat-pos-lan-storage')!).state.offlineSales.length,
        ),
      )
      .toBe(0);
    expect(
      await database('sales').whereIn(
        'idempotency_key',
        sales.map((s) => s.idempotency_key),
      ),
    ).toHaveLength(1);
    expect(
      Number((await database('inventory').where({ product_id: f.productId }).first()).quantity),
    ).toBe(99);
    await capture(manager, f, 'reconciliation');
    await other.close();
  });
}
