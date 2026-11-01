import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { db } from '../../config/database';
import { posRepository } from '../pos.repository';
import { customerRepository } from '../customer.repository';
import { purchaseRepository } from '../purchase.repository';
import { setupTestData } from './reversal_setup';

const checkout = (c: Awaited<ReturnType<typeof setupTestData>>, key = randomUUID()) => ({
  shift_id: c.shiftId,
  register_id: c.registerId,
  payment_method: 'cash' as const,
  cash_received: 10,
  idempotency_key: key,
  items: [{ product_id: c.productId, quantity: 1, unit_price: 10, discount: 0 }],
});
afterAll(async () => {
  await db.destroy();
});

describe('commercial financial invariants on PostgreSQL', () => {
  it('rolls back an interrupted database transaction', async () => {
    const marker = `disconnect-${randomUUID()}`;
    await expect(
      db.transaction(async (trx) => {
        await trx('customers').insert({ name: marker });
        await trx.raw('SELECT pg_terminate_backend(pg_backend_pid())');
      }),
    ).rejects.toThrow();
    expect(await db('customers').where({ name: marker }).first()).toBeUndefined();
  });
  it('pays refunds from the current open drawer without rewriting the original closed drawer', async () => {
    const original = await setupTestData();
    const payout = await setupTestData();
    const sale = await posRepository.checkout(checkout(original), original.cashierId);
    const closed = await posRepository.closeShift(
      original.shiftId,
      1010,
      0,
      'Synthetic close',
      original.cashierId,
    );
    const input = {
      sale_id: sale.id,
      manager_id: payout.managerId,
      payout_shift_id: payout.shiftId,
      refund_type: 'partial' as const,
      reason: 'Synthetic return after shift close',
      items: [{ sale_item_id: sale.items[0].id, quantity: 1, restock_inventory: true }],
    };
    await posRepository.processRefund(input);
    expect(
      Number((await db('cashier_shifts').where({ id: original.shiftId }).first()).expected_cash),
    ).toBe(Number(closed.expected_cash));
    expect((await posRepository.getShiftSummary(payout.shiftId)).cash_sales).toBe(-10);
  });

  it('posts one sale and one stock movement under concurrent network retries', async () => {
    const c = await setupTestData();
    const payload = checkout(c);
    const sales = await Promise.all([
      posRepository.checkout(payload, c.cashierId),
      posRepository.checkout(payload, c.cashierId),
    ]);
    expect(sales[0].id).toBe(sales[1].id);
    expect(
      Number((await db('inventory').where({ product_id: c.productId }).first()).quantity),
    ).toBe(99);
    expect(
      Number(
        (await db('sales')
          .where({ idempotency_key: payload.idempotency_key })
          .count('* as count')
          .first())!.count,
      ),
    ).toBe(1);
  });
  it('cannot sell the final unit twice and rolls back the losing checkout', async () => {
    const c = await setupTestData();
    await db('inventory').where({ product_id: c.productId }).update({ quantity: 1 });
    const outcomes = await Promise.allSettled([
      posRepository.checkout(checkout(c), c.cashierId),
      posRepository.checkout(checkout(c), c.cashierId),
    ]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(
      Number((await db('inventory').where({ product_id: c.productId }).first()).quantity),
    ).toBe(0);
    expect(
      Number((await db('sales').where({ shift_id: c.shiftId }).count('* as count').first())!.count),
    ).toBe(1);
  });
  it('rejects checkout against another employee drawer without creating a sale', async () => {
    const c = await setupTestData();
    await expect(posRepository.checkout(checkout(c), c.managerId)).rejects.toThrow(
      /authenticated cashier/,
    );
    expect(
      Number((await db('inventory').where({ product_id: c.productId }).first()).quantity),
    ).toBe(100);
  });
  it('accepts concurrent retries of an exact-balance payment once', async () => {
    const c = await setupTestData();
    const input = {
      customerId: c.customerId,
      amount: 50,
      paymentMethod: 'cash' as const,
      userId: c.cashierId,
      shiftId: c.shiftId,
      registerId: c.registerId,
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.all([
      customerRepository.recordPayment(input),
      customerRepository.recordPayment(input),
    ]);
    expect(results.filter((r) => r.duplicate)).toHaveLength(1);
    expect(Number((await db('customers').where({ id: c.customerId }).first()).balance)).toBe(0);
    expect(
      Number(
        (await db('customer_transactions')
          .where({ customer_id: c.customerId })
          .count('* as count')
          .first())!.count,
      ),
    ).toBe(1);
  });
  it('caps competing distinct payments at the outstanding balance', async () => {
    const c = await setupTestData();
    const input = {
      customerId: c.customerId,
      amount: 40,
      paymentMethod: 'cash' as const,
      userId: c.cashierId,
      shiftId: c.shiftId,
      registerId: c.registerId,
    };
    const results = await Promise.allSettled([
      customerRepository.recordPayment({ ...input, idempotencyKey: randomUUID() }),
      customerRepository.recordPayment({ ...input, idempotencyKey: randomUUID() }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(Number((await db('customers').where({ id: c.customerId }).first()).balance)).toBe(-10);
  });
  it('refunds a cart discount in cent-exact partial steps and rejects duplicate lines', async () => {
    const c = await setupTestData();
    const payload = {
      ...checkout(c),
      cash_received: 30,
      global_discount: 3.01,
      items: [{ product_id: c.productId, quantity: 3, unit_price: 10, discount: 0 }],
    };
    const sale = await posRepository.checkout(payload, c.cashierId);
    const item = { sale_item_id: sale.items[0].id, quantity: 1, restock_inventory: true };
    const refund = {
      sale_id: sale.id,
      manager_id: c.managerId,
      refund_type: 'partial' as const,
      reason: 'Synthetic acceptance refund',
      items: [item],
    };
    await expect(posRepository.processRefund({ ...refund, items: [item, item] })).rejects.toThrow(
      /Duplicate/,
    );
    for (let i = 0; i < 3; i++) await posRepository.processRefund(refund);
    const updated = await db('sales').where({ id: sale.id }).first();
    expect(updated.status).toBe('refunded');
    expect(Number(updated.refunded_amount)).toBe(26.99);
    expect(
      Number((await db('inventory').where({ product_id: c.productId }).first()).quantity),
    ).toBe(100);
  });
  it('replays a refund request once after an interrupted response', async () => {
    const c = await setupTestData();
    const sale = await posRepository.checkout(
      {
        ...checkout(c),
        cash_received: 20,
        items: [{ product_id: c.productId, quantity: 2, unit_price: 10, discount: 0 }],
      },
      c.cashierId,
    );
    const payload = {
      sale_id: sale.id,
      manager_id: c.managerId,
      refund_type: 'partial' as const,
      reason: 'Synthetic retry refund',
      idempotency_key: randomUUID(),
      items: [{ sale_item_id: sale.items[0].id, quantity: 1, restock_inventory: true }],
    };
    const results = await Promise.all([
      posRepository.processRefund(payload),
      posRepository.processRefund(payload),
    ]);
    expect(results[0].refund_id).toBe(results[1].refund_id);
    expect(Number((await db('sales').where({ id: sale.id }).first()).refunded_amount)).toBe(10);
  });
  it('serializes competing manager decisions and synchronizes an approved offline sale once', async () => {
    const c = await setupTestData();
    const payload = checkout(c);
    payload.items[0]!.unit_price = 8;
    const sync = await posRepository.syncOffline([payload], c.cashierId);
    expect(sync.failed[0]?.quarantined).toBe(true);
    const row = await db('offline_sync_quarantine')
      .where({ idempotency_key: payload.idempotency_key })
      .first();
    const outcomes = await Promise.allSettled([
      posRepository.resolveQuarantinedSale(row.id, 'approve', c.managerId),
      posRepository.resolveQuarantinedSale(row.id, 'approve', c.managerId),
    ]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(
      Number(
        (await db('sales')
          .where({ idempotency_key: payload.idempotency_key })
          .count('* as count')
          .first())!.count,
      ),
    ).toBe(1);
    expect((await posRepository.syncOffline([payload], c.cashierId)).syncedIds).toContain(
      payload.idempotency_key,
    );
  });

  it('receives a purchase only once when full receiving requests compete', async () => {
    const c = await setupTestData();
    const [supplier] = await db('suppliers')
      .insert({
        name: `Concurrent supplier ${randomUUID()}`,
        supplier_code: randomUUID().slice(0, 20),
      })
      .returning('*');
    const po = await purchaseRepository.create(
      {
        supplier_id: supplier.id,
        discount_amount: 0,
        tax_amount: 0,
        items: [{ product_id: c.productId, ordered_quantity: 5, unit_cost: 5 }],
      },
      c.managerId,
    );
    await purchaseRepository.updateStatus(po.id!, 'ordered');
    const items = [
      { po_item_id: po.items![0]!.id!, product_id: c.productId, quantity_to_receive: 5 },
    ];
    const outcomes = await Promise.allSettled([
      purchaseRepository.receiveGoods(po.id!, items, c.managerId),
      purchaseRepository.receiveGoods(po.id!, items, c.managerId),
    ]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(
      Number((await db('inventory').where({ product_id: c.productId }).first()).quantity),
    ).toBe(105);
  });
});
