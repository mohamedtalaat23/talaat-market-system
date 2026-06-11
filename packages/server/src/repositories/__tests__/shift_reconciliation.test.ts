import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../config/database';
import { posRepository } from '../pos.repository';
import { setupTestData } from './reversal_setup';

describe('Shift Reconciliation Repair', () => {
  let ctx: any;

  beforeAll(async () => {
    ctx = await setupTestData();
  });

  afterAll(async () => {
    await db('cashier_shifts').where('id', ctx.shiftId).update({ status: 'open' });
  });

  const createSale = async (cash_paid: number) => {
    const total = cash_paid;
    
    const [sale] = await db('sales').insert({
      id: db.raw('gen_random_uuid()'),
      receipt_number: `TST-${Date.now()}-${Math.random()}`,
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
      idempotency_key: `idmp-${Date.now()}-${Math.random()}`
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

    return { sale, saleItem };
  };

  it('1. $100 cash sale', async () => {
    const shiftBefore = await posRepository.getShiftSummary(ctx.shiftId);
    
    await createSale(100);
    
    const shiftAfter = await posRepository.getShiftSummary(ctx.shiftId);
    expect(shiftAfter.expected_cash).toBe(shiftBefore.expected_cash + 100);
  });

  it('2. $100 cash sale + $20 refund', async () => {
    const shiftBefore = await posRepository.getShiftSummary(ctx.shiftId);
    
    const { sale, saleItem } = await createSale(100);
    
    // Partial refund of $20
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test Partial', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 0.2, restock_inventory: true }]
    });

    const shiftAfter = await posRepository.getShiftSummary(ctx.shiftId);
    expect(shiftAfter.expected_cash).toBe(shiftBefore.expected_cash + 80);
  });

  it('3. $100 cash sale + $100 refund', async () => {
    const shiftBefore = await posRepository.getShiftSummary(ctx.shiftId);
    
    const { sale, saleItem } = await createSale(100);
    
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test Full', refund_type: 'full',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });

    const shiftAfter = await posRepository.getShiftSummary(ctx.shiftId);
    expect(shiftAfter.expected_cash).toBe(shiftBefore.expected_cash + 0);
  });

  it('4. Void transaction', async () => {
    const shiftBefore = await posRepository.getShiftSummary(ctx.shiftId);
    
    const { sale, saleItem } = await createSale(100);
    
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test Void', refund_type: 'void',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });

    const shiftAfter = await posRepository.getShiftSummary(ctx.shiftId);
    expect(shiftAfter.expected_cash).toBe(shiftBefore.expected_cash + 0);
  });

  it('5. Multiple partial refunds', async () => {
    const shiftBefore = await posRepository.getShiftSummary(ctx.shiftId);
    
    const { sale, saleItem } = await createSale(100);
    
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test Partial 1', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 0.3, restock_inventory: true }]
    });
    
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test Partial 2', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 0.3, restock_inventory: true }]
    });

    const shiftAfter = await posRepository.getShiftSummary(ctx.shiftId);
    expect(shiftAfter.expected_cash).toBe(shiftBefore.expected_cash + 40); // 100 - 30 - 30 = 40
  });

  it('closeShift API behavior (ending_cash and expected_cash persistence)', async () => {
    const shiftBefore = await posRepository.getShiftSummary(ctx.shiftId);
    
    const closed = await posRepository.closeShift(ctx.shiftId, 999.99, shiftBefore.expected_cash, 'Test Close');
    
    expect(Number(closed.ending_cash)).toBe(999.99);
    expect(Number(closed.expected_cash)).toBe(shiftBefore.expected_cash);
    expect(closed.status).toBe('closed');
  });
});
