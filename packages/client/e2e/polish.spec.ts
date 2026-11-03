import { test, expect } from '@playwright/test';
import { translations } from '../src/utils/translations';

for (const language of ['en', 'ar'] as const) {
  test(`${language}: management screens, saved setup, backup and safe confirmations`, async ({
    page,
  }) => {
    const t = translations[language];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((lang) => {
      localStorage.setItem('talaat_token', 'synthetic-ui-fixture');
      localStorage.setItem('talaat_lang', lang);
    }, language);
    let settings: Record<string, unknown> = { store_name: 'Talaat Market' };
    let backups: unknown[] = [];
    let placed = 0;
    let failDashboard = false;
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1', '');
      let data: unknown = [];
      if (path === '/auth/me')
        data = { id: 1, username: 'owner', full_name: 'Talaat Market', role: 'admin' };
      if (path === '/dashboard/stats') {
        if (failDashboard)
          return route.fulfill({ status: 503, json: { message: 'Synthetic unavailable service' } });
        data = {
          productsCount: 1248,
          lowStockCount: 12,
          employeesCount: 6,
          todayNetSales: 8450,
          todayTransactionCount: 127,
          todayRefundsCount: 2,
          todayVoidsCount: 0,
          todayDrawerAdjustmentsCount: 1,
          pendingPurchaseOrdersCount: 4,
          unreconciledShiftsCount: 1,
          failedPrintJobsCount: 0,
          negativeInventoryCount: 0,
        };
      }
      if (path === '/products')
        data = Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          name: ['Fresh milk', 'Egyptian rice', 'Sunflower oil', 'White cheese'][i % 4],
          name_ar: ['حليب طازج', 'أرز مصري', 'زيت عباد الشمس', 'جبنة بيضاء'][i % 4],
          barcode: `62210000000${i}`,
          unit: 'piece',
          selling_price: 35 + i * 5,
          cost_price: 20,
          inventory_quantity: 40 + i,
          min_stock_level: 10,
          is_active: true,
        }));
      if (path === '/settings') {
        if (request.method() === 'PUT') settings = { ...settings, ...request.postDataJSON() };
        data = settings;
      }
      if (path === '/settings/backups') {
        if (request.method() === 'POST')
          backups = [
            {
              filename: 'synthetic-backup.json',
              sizeBytes: 1024,
              created_at: '2026-11-02T10:00:00Z',
            },
          ];
        data = backups;
      }
      if (path === '/health')
        data = {
          version: '1.0.0',
          status: 'healthy',
          services: { database: { status: 'connected' } },
        };
      if (path === '/purchases/1')
        data = {
          id: 1,
          po_number: 'PO-TEST-001',
          supplier_id: 1,
          supplier_name: 'Test Supplier',
          supplier_code: 'SUP-001',
          status: 'draft',
          order_date: '2026-11-02',
          subtotal: 100,
          discount_amount: 0,
          tax_amount: 0,
          total: 100,
          items: [],
        };
      if (path === '/purchases/1/order') {
        placed++;
        return route.fulfill({ status: 503, json: { message: 'Synthetic request failed' } });
      }
      return route.fulfill({
        json: {
          success: true,
          status: 'success',
          data,
          meta: { total: 8, page: 1, limit: 10, totalPages: 1 },
        },
      });
    });
    for (const width of [1366, 1920]) {
      await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
      for (const path of ['products', '', 'settings/operations']) {
        await page.goto(`/${path}`);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          language === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.locator('text=synthetic-ui-fixture')).toHaveCount(0);
        await page.screenshot({
          path: `../../docs/qa/daily/layout-${path.replace('/', '-') || 'dashboard'}-${language}-${width}.png`,
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
    }
    const firstStep = page.getByRole('checkbox').first();
    await firstStep.click();
    await expect(firstStep).toBeChecked();
    await page.reload();
    await expect(page.getByRole('checkbox').first()).toBeChecked();
    await page
      .getByRole('button', {
        name: language === 'ar' ? 'إنشاء نسخة احتياطية' : 'Create backup',
        exact: true,
      })
      .click();
    await expect(page.getByText('synthetic-backup.json')).toBeVisible();
    await page
      .getByRole('button', { name: language === 'ar' ? 'فحص الحالة' : 'Check status', exact: true })
      .click();
    await expect(page.getByText('healthy / connected')).toBeVisible();

    await page.goto('/purchases/1');
    const place = page.getByRole('button', { name: t.purchases.placeOrder, exact: true });
    await place.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(place).toBeFocused();
    expect(placed).toBe(0);
    await place.click();
    await page
      .getByRole('button', { name: language === 'ar' ? 'تأكيد' : 'Confirm', exact: true })
      .click();
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(
      'Synthetic request failed',
    );
    expect(placed).toBe(1);
    failDashboard = true;
    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText('Synthetic unavailable service');
    expect(errors).toEqual([]);
  });
}
