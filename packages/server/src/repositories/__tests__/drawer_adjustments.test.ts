import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../config/database';
import { posRepository } from '../pos.repository';
import { setupTestData } from './reversal_setup';

describe('Cash Drawer Adjustments', () => {
  let ctx: any;

  beforeAll(async () => {
    ctx = await setupTestData();
    // Ensure shift starting cash is $500 as requested
    await db('cashier_shifts').where('id', ctx.shiftId).update({ starting_cash: 500, expected_cash: 500 });
  });

  afterAll(async () => {
    // Reset back
    await db('cashier_shifts').where('id', ctx.shiftId).update({ status: 'open', expected_cash: 500 });
  });

  const createSale = async (cash_paid: number) => {
    const total = cash_paid;
    
    const [sale] = await db('sales').insert({
      id: db.raw('gen_random_uuid()'),
      receipt_number: `TST-ADJ-${Date.now()}-${Math.random()}`,
      cashier_id: ctx.cashierId,
      shift_id: ctx.shiftId,
      register_id: ctx.registerId,
      payment_method: 'cash',
      subtotal: total,
      discount_amount: 0,
      global_discount: 0,
      tax_amount: 0,
      total: total,
      cash_paid: cash_paid,
      card_paid: 0,
      debt_paid: 0,
      cash_amount: cash_paid,
      change_given: 0,
      status: 'completed',
      print_status: 'printed',
      print_count: 1,
      idempotency_key: `idmp-adj-${Date.now()}-${Math.random()}`
    }).returning('*');


    const [saleItem] = await db('sale_items').insert({
      sale_id: sale.id,
      product_id: ctx.productId,
      quantity: 1,
      unit_price: total,
      cost_at_sale: 5,
      line_total: total,
      discount: 0
    }).returning('*');

    await db('cashier_shifts').where('id', ctx.shiftId).increment('expected_cash', cash_paid);

    return { sale, saleItem };

  };

  it('End-to-End Reconciliation Test', async () => {
    // 1. Opening Cash = $500 (done in setup)

    // 2. Cash Sales +$1000
    const { sale, saleItem } = await createSale(1000);

    // 3. Cash Refunds -$100 (Partial refund of the $1000 sale)
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test Refund', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 0.1, restock_inventory: true }]
    });

    // 4. Safe Drop -$700
    await posRepository.createDrawerAdjustment({
      shift_id: ctx.shiftId,
      manager_id: ctx.managerId,
      type: 'safe_drop',
      amount: 700,
      reason_code: 'SAFE_DROP',
      reason_notes: 'Transfer to safe'
    });

    // 5. Change Refill +$200
    await posRepository.createDrawerAdjustment({
      shift_id: ctx.shiftId,
      manager_id: ctx.managerId,
      type: 'change_replenishment',
      amount: 200,
      reason_code: 'CHANGE_REPLENISHMENT',
      reason_notes: 'Need quarters'
    });

    // Expected Cash = 500 + 1000 - 100 - 700 + 200 = $900
    const summary = await posRepository.getShiftSummary(ctx.shiftId);
    
    expect(Number(summary.starting_cash)).toBe(500);
    expect(Number(summary.cash_sales)).toBe(400); // 1000 sale - 100 refund + 200 IN - 700 OUT = 400 net cash change? Wait!
    // Wait, the test specifies Expected Cash = $900.
    // Starting(500) + Sales(1000) - Refunds(100) - SafeDrop(700) + ChangeRefill(200) = 900
    // cash_sales field from getShiftSummary is: Number(salesSummary.cash_sales) + Number(paymentSummary.cash_payments) - Number(refundsSummary?.cash_refunds || 0) + payIns - payOuts
    // So cash_sales = 1000 - 100 + 200 - 700 = 400
    // Expected cash = 500 + 400 = 900.
    expect(summary.expected_cash).toBe(900);
    expect(summary.total_pay_ins).toBe(200);
    expect(summary.total_pay_outs).toBe(700);

    // Also check the live shift tracker expected_cash
    const liveShift = await db('cashier_shifts').where('id', ctx.shiftId).first();
    expect(Number(liveShift.expected_cash)).toBe(900);
  });


  it('Tests petty_cash', async () => {
    const shiftBefore = await db('cashier_shifts').where('id', ctx.shiftId).first();
    const adj = await posRepository.createDrawerAdjustment({
      shift_id: ctx.shiftId, manager_id: ctx.managerId, type: 'petty_cash', amount: 10, reason_code: 'PETTY_CASH'
    });
    expect(adj.adjustment_type).toBe('OUT');
    const shiftAfter = await db('cashier_shifts').where('id', ctx.shiftId).first();
    expect(Number(shiftAfter.expected_cash)).toBe(Number(shiftBefore.expected_cash) - 10);
  });

  it('Tests vendor_payment', async () => {
    const shiftBefore = await db('cashier_shifts').where('id', ctx.shiftId).first();
    const adj = await posRepository.createDrawerAdjustment({
      shift_id: ctx.shiftId, manager_id: ctx.managerId, type: 'vendor_payment', amount: 50, reason_code: 'VENDOR_PAYMENT'
    });
    expect(adj.adjustment_type).toBe('OUT');
    const shiftAfter = await db('cashier_shifts').where('id', ctx.shiftId).first();
    expect(Number(shiftAfter.expected_cash)).toBe(Number(shiftBefore.expected_cash) - 50);
  });

  it('Tests owner_withdrawal', async () => {
    const shiftBefore = await db('cashier_shifts').where('id', ctx.shiftId).first();
    const adj = await posRepository.createDrawerAdjustment({
      shift_id: ctx.shiftId, manager_id: ctx.managerId, type: 'owner_withdrawal', amount: 100, reason_code: 'OWNER_WITHDRAWAL'
    });
    expect(adj.adjustment_type).toBe('OUT');
    const shiftAfter = await db('cashier_shifts').where('id', ctx.shiftId).first();
    expect(Number(shiftAfter.expected_cash)).toBe(Number(shiftBefore.expected_cash) - 100);
  });

  it('Tests cash_correction_in', async () => {
    const shiftBefore = await db('cashier_shifts').where('id', ctx.shiftId).first();
    const adj = await posRepository.createDrawerAdjustment({
      shift_id: ctx.shiftId, manager_id: ctx.managerId, type: 'cash_correction_in', amount: 5, reason_code: 'CASH_CORRECTION_IN'
    });
    expect(adj.adjustment_type).toBe('IN');
    const shiftAfter = await db('cashier_shifts').where('id', ctx.shiftId).first();
    expect(Number(shiftAfter.expected_cash)).toBe(Number(shiftBefore.expected_cash) + 5);
  });

  it('Tests cash_correction_out', async () => {
    const shiftBefore = await db('cashier_shifts').where('id', ctx.shiftId).first();
    const adj = await posRepository.createDrawerAdjustment({
      shift_id: ctx.shiftId, manager_id: ctx.managerId, type: 'cash_correction_out', amount: 5, reason_code: 'CASH_CORRECTION_OUT'
    });
    expect(adj.adjustment_type).toBe('OUT');
    const shiftAfter = await db('cashier_shifts').where('id', ctx.shiftId).first();
    expect(Number(shiftAfter.expected_cash)).toBe(Number(shiftBefore.expected_cash) - 5);
  });


  it('Enforces live vs summary expected_cash invariant across full lifecycle', async () => {
    const shiftBefore = await db('cashier_shifts').where('id', ctx.shiftId).first();
    // 1. Cash Sale +100
    const salePayload = {
      shift_id: ctx.shiftId,
      register_id: ctx.registerId,
      payment_method: 'cash' as const,
      cash_received: 100,
      cash_amount: 100,
      idempotency_key: `idmp-${Date.now()}-${Math.random()}`,
      items: [{ product_id: ctx.productId, quantity: 1, unit_price: 100, line_total: 100, discount: 0 }]
    };
    const sale = await posRepository.checkout(salePayload, ctx.cashierId);
    const item = await db('sale_items').where('sale_id', sale.id).first();

    // 2. Refund -20
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'test', refund_type: 'partial',
      items: [{ sale_item_id: item.id, quantity: 0.2, restock_inventory: false }]
    });

    // 3. Safe Drop -50
    await posRepository.createDrawerAdjustment({
      shift_id: ctx.shiftId, manager_id: ctx.managerId, type: 'safe_drop', amount: 50, reason_code: 'SAFE_DROP'
    });

    // 4. Change Replenishment +10
    await posRepository.createDrawerAdjustment({
      shift_id: ctx.shiftId, manager_id: ctx.managerId, type: 'change_replenishment', amount: 10, reason_code: 'CHANGE_REPLENISHMENT'
    });

    const liveShift = await db('cashier_shifts').where('id', ctx.shiftId).first();
    const summary = await posRepository.getShiftSummary(ctx.shiftId);

    // Delta is +100 -20 -50 +10 = +40
    expect(Number(liveShift.expected_cash)).toBe(Number(shiftBefore.expected_cash) + 40);
    expect(Number(liveShift.expected_cash)).toBe(Number(summary.expected_cash));
  });

  it('Cannot adjust a closed shift', async () => {
    await db('cashier_shifts').where('id', ctx.shiftId).update({ status: 'closed' });

    await expect(
      posRepository.createDrawerAdjustment({
        shift_id: ctx.shiftId,
        manager_id: ctx.managerId,
        type: 'safe_drop',
        amount: 50,
        reason_code: 'SAFE_DROP'
      })
    ).rejects.toThrow('Shift must be open');
  });
});
