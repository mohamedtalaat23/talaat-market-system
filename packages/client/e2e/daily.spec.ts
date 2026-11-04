import { expect } from '@playwright/test';
import { test } from './daily-test';
import { fixture } from './fixtures';
import { login, api, db, enterPOS, addProduct, pay, capture } from './daily-helpers';
import { translations } from '../src/utils/translations';
for (const language of ['en', 'ar'] as const) {
  const t = translations[language];
  test(`${language}: quantity approved discount and suspended cart checkout`, async ({ page }) => {
    const f = fixture(language, 'cart');
    await login(page, f);
    await enterPOS(page, f);
    await addProduct(page, f);
    await page.keyboard.press('F2');
    await page.fill('#quantity-input', '3');
    await page.locator('#quantity-input').press('Enter');
    await page.keyboard.press('F6');
    await page.keyboard.press('F6');
    await page.getByRole('button', { name: t.pos.resume, exact: true }).click();
    await page.keyboard.press('F3');
    await page.locator('input[type=number]').fill('10');
    await page.locator('button[type=submit]').click();
    await capture(page, f, 'populated-cart');
    await page.getByRole('button', { name: t.pos.payAction }).click();
    await page.fill('#cash-input', '100');
    await page.selectOption('#inline-manager-select', String(f.manager.id));
    await page.fill('#inline-pin-input', '000000');
    const denied = page.waitForResponse(
      (r) => r.url().endsWith('/pos/checkout') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: t.pos.completeSale, exact: true }).click();
    expect((await denied).status()).toBe(403);
    await expect(page.locator('#cash-input')).toHaveValue('100');
    await page.fill('#inline-pin-input', f.pin);
    const posted = page.waitForResponse(
      (r) => r.url().endsWith('/pos/checkout') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: t.pos.completeSale, exact: true }).click();
    const response = await posted;
    expect(response.ok(), await response.text()).toBe(true);
    const sale = (await response.json()).data;
    expect(Number(sale.total)).toBe(20);
    expect(
      Number((await (await db())('inventory').where({ product_id: f.productId }).first()).quantity),
    ).toBe(97);
    await capture(page, f, 'approved-discount');
    await page.keyboard.press('Escape');
    await page.keyboard.press('F4');
    await page.getByPlaceholder(t.pos.searchReceiptNo).fill(sale.receipt_number);
    await page
      .getByRole('row')
      .filter({ hasText: sale.receipt_number })
      .getByRole('button', { name: t.pos.refundVoid, exact: true })
      .click();
    await expect(
      page.getByRole('dialog').getByRole('cell').filter({ hasText: /6\.67/ }),
    ).toBeVisible();
    await page.getByRole('dialog').locator('input[type=number]').fill('1');
    await page.getByPlaceholder(t.pos.placeholderRefundReason).fill('Discounted partial return');
    await page.selectOption('#inline-manager-select', String(f.manager.id));
    await page.fill('#inline-pin-input', f.pin);
    const refunded = page.waitForResponse(
      (r) => r.url().endsWith(`/sales/${sale.id}/refund`) && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: t.pos.processRefund, exact: true }).click();
    const result = await refunded;
    expect(result.ok()).toBe(true);
    expect(Number((await result.json()).data.total_refunded)).toBe(6.67);
    await expect(page.getByRole('dialog').getByText(new RegExp('-6\\.67')).first()).toBeVisible();
    await capture(page, f, 'discounted-refund');
  });
  test(`${language}: approved partial returns preserve restock and damage outcomes`, async ({
    page,
  }) => {
    const f = fixture(language, 'returns');
    await login(page, f);
    await enterPOS(page, f);
    await addProduct(page, f);
    await addProduct(page, f);
    await addProduct(page, f);
    const sale = await pay(page, f);
    await page.keyboard.press('F4');
    await page.getByPlaceholder(t.pos.searchReceiptNo).fill(sale.receipt_number);
    await page
      .getByRole('row')
      .filter({ hasText: sale.receipt_number })
      .getByRole('button', { name: t.pos.refundVoid, exact: true })
      .click();
    const quantity = page.locator('input[type=number]');
    await quantity.fill('1');
    await page
      .getByPlaceholder(t.pos.placeholderRefundReason)
      .fill('Synthetic partial customer return');
    await page.selectOption('#inline-manager-select', String(f.manager.id));
    await page.fill('#inline-pin-input', f.pin);
    const refund = page.waitForResponse(
      (r) => r.url().endsWith(`/sales/${sale.id}/refund`) && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: t.pos.processRefund, exact: true }).click();
    const response = await refund;
    expect(response.ok(), await response.text()).toBe(true);
    const database = await db();
    expect(
      Number((await database('inventory').where({ product_id: f.productId }).first()).quantity),
    ).toBe(98);
    await capture(page, f, 'refund');
    await page.keyboard.press('Escape');
    await page.keyboard.press('F4');
    await page.getByPlaceholder(t.pos.searchReceiptNo).fill(sale.receipt_number);
    await page
      .getByRole('row')
      .filter({ hasText: sale.receipt_number })
      .getByRole('button', { name: t.pos.refundVoid, exact: true })
      .click();
    await page.getByRole('dialog').locator('input[type=number]').fill('1');
    await page.getByRole('button', { name: t.pos.restock, exact: true }).click();
    await page.getByPlaceholder(t.pos.placeholderRefundReason).fill('Damaged item written off');
    await page.selectOption('#inline-manager-select', String(f.manager.id));
    await page.fill('#inline-pin-input', f.pin);
    const damaged = page.waitForResponse(
      (r) => r.url().endsWith(`/sales/${sale.id}/refund`) && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: t.pos.processRefund, exact: true }).click();
    expect((await damaged).ok()).toBe(true);
    expect(
      Number((await database('inventory').where({ product_id: f.productId }).first()).quantity),
    ).toBe(98);
    expect(Number((await database('sales').where({ id: sale.id }).first()).refunded_amount)).toBe(
      20,
    );
  });
  test(`${language}: purchase order receives partially then completes`, async ({ page }) => {
    const f = fixture(language, 'purchasing');
    await login(page, f, 'manager');
    await page.goto('/purchases');
    await page.getByRole('button', { name: t.purchases.createPO, exact: true }).click();
    const form = page.getByRole('dialog');
    await form.locator('select').selectOption(String(f.supplierId));
    await form.getByPlaceholder(t.purchases.scanBarcodeOrType).fill(f.productName);
    await form.getByText(f.productName, { exact: true }).click();
    await form.locator('tbody input[type=number]').nth(1).fill('4');
    const created = page.waitForResponse(
      (r) => r.url().endsWith('/purchases') && r.request().method() === 'POST',
    );
    await form.getByRole('button', { name: t.purchases.submitDraft, exact: true }).click();
    const creation = await created;
    expect(creation.ok(), await creation.text()).toBe(true);
    const orderId = (await creation.json()).data.id;
    await page.goto(`/purchases/${orderId}`);
    await page.getByRole('button', { name: t.purchases.placeOrder, exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: language === 'ar' ? 'تأكيد' : 'Confirm', exact: true })
      .click();
    await page.getByRole('button', { name: t.purchases.receiveInflux, exact: true }).click();
    await page.locator('input[type=number]').first().fill('2');
    const receiptFailed = page.waitForEvent('requestfailed', {
      predicate: (request) => request.url().endsWith(`/purchases/${orderId}/receive`),
    });
    await page.route(`**/purchases/${orderId}/receive`, async (route) => {
      await route.fetch();
      await route.abort('failed');
    });
    await page.getByRole('button', { name: t.purchases.confirmInflux, exact: true }).click();
    await receiptFailed;
    await expect(
      page.getByRole('button', { name: t.purchases.confirmInflux, exact: true }),
    ).toBeEnabled();
    await expect(page.getByRole('dialog').locator('input[type=number]').first()).toHaveValue('2');
    await page.unroute(`**/purchases/${orderId}/receive`);
    await page.getByRole('button', { name: t.purchases.confirmInflux, exact: true }).click();

    await expect(
      page.getByRole('button', { name: t.purchases.continueReceiving, exact: true }),
    ).toBeVisible();
    expect(Number((await api(page, `/products/${f.productId}`)).data.inventory_quantity)).toBe(102);
    await page.getByRole('button', { name: t.purchases.continueReceiving, exact: true }).click();
    await page.getByRole('button', { name: t.purchases.confirmInflux, exact: true }).click();
    await expect
      .poll(async () => (await api(page, `/purchases/${orderId}`)).data.status)
      .toBe('received');
    expect(Number((await api(page, `/products/${f.productId}`)).data.inventory_quantity)).toBe(104);
    await capture(page, f, 'receiving');
  });
  test(`${language}: credit sale and customer payment agree with the ledger`, async ({ page }) => {
    const f = fixture(language, 'accounts');
    await login(page, f);
    await enterPOS(page, f);
    await addProduct(page, f);
    await page.keyboard.press('F7');
    await page.getByPlaceholder(t.pos.searchCustomerPlaceholder).fill(f.customerName);
    await page.getByRole('button').filter({ hasText: f.customerName }).click();
    await pay(page, f, 'debt');
    const database = await db();
    expect(Number((await database('customers').where({ id: f.customerId }).first()).balance)).toBe(
      -10,
    );
    await page.goto(`/customers/${f.customerId}`);
    await page.getByRole('button', { name: t.customers.payment, exact: true }).click();
    await page.locator('input[type=number]').fill('5');
    let postedKey = '';
    const paymentFailed = page.waitForEvent('requestfailed', {
      predicate: (request) => request.url().endsWith(`/customers/${f.customerId}/payments`),
    });
    await page.route(`**/customers/${f.customerId}/payments`, async (route) => {
      postedKey = route.request().postDataJSON().idempotency_key;
      await route.fetch();
      await route.abort('failed');
    });
    await page.locator('button[type=submit]').click();
    await paymentFailed;
    await expect(page.locator('button[type=submit]')).toBeEnabled();
    await expect(page.locator('input[type=number]')).toHaveValue('5');
    await page.unroute(`**/customers/${f.customerId}/payments`);
    const retried = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/customers/${f.customerId}/payments`) && r.request().method() === 'POST',
    );
    await page.locator('button[type=submit]').click();
    const paymentResponse = await retried;
    expect(paymentResponse.ok()).toBe(true);
    expect(paymentResponse.request().postDataJSON().idempotency_key).toBe(postedKey);
    await expect(page.locator('input[type=number]')).toBeHidden();
    expect(Number((await database('customers').where({ id: f.customerId }).first()).balance)).toBe(
      -5,
    );
    await page.getByRole('button', { name: t.customers.payment, exact: true }).click();
    await page.locator('input[type=number]').fill('5');
    await page.locator('input[type=number]').press('Enter');
    await expect
      .poll(async () =>
        Number((await database('customers').where({ id: f.customerId }).first()).balance),
      )
      .toBe(0);
    await capture(page, f, 'customer-ledger');
  });
}
