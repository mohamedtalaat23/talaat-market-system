import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../config/database';
import { posRepository } from '../pos.repository';
import { setupTestData } from './reversal_setup';

describe('Reversal Engine - Hostile Production Suite', () => {
  let ctx: any;

  beforeAll(async () => {
    ctx = await setupTestData();
  });

  afterAll(async () => {
    // cleanup
  });

  const createSale = async (opts: {
    cash_paid: number, card_paid: number, debt_paid: number,
    payment_method: 'cash' | 'card' | 'debt' | 'split',
    qty: number
  }) => {
    const total = opts.cash_paid + opts.card_paid + opts.debt_paid;
    
    // reset customer balance
    await db('customers').where('id', ctx.customerId).update({ balance: -opts.debt_paid });

    const [sale] = await db('sales').insert({
      id: db.raw('gen_random_uuid()'),
      receipt_number: `TST-${Date.now()}`,
      cashier_id: ctx.cashierId,
      shift_id: ctx.shiftId,
      register_id: ctx.registerId,
      payment_method: opts.payment_method,
      subtotal: total,
      discount_amount: 0,
      global_discount: 0,
      tax_amount: 0,
      total: total,
      cash_paid: opts.cash_paid,
      card_paid: opts.card_paid,
      debt_paid: opts.debt_paid,
      customer_id: opts.debt_paid > 0 ? ctx.customerId : null,
      status: 'completed',
      print_status: 'printed',
      print_count: 1,
      idempotency_key: `idmp-${Date.now()}`
    }).returning('*');

    const [saleItem] = await db('sale_items').insert({
      sale_id: sale.id,
      product_id: ctx.productId,
      quantity: opts.qty,
      unit_price: total / opts.qty,
      cost_at_sale: 5,
      line_total: total,
      discount: 0
    }).returning('*');

    return { sale, saleItem };
  };

  it('1. Full refund - cash only', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 100, card_paid: 0, debt_paid: 0, payment_method: 'cash', qty: 1 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'full',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.cash_refunded).toBe('100.00');
    expect(refund.card_refunded).toBe('0.00');
    expect(refund.debt_reversed).toBe('0.00');
  });

  it('2. Partial refund - cash only', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 100, card_paid: 0, debt_paid: 0, payment_method: 'cash', qty: 2 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.cash_refunded).toBe('50.00');
  });

  it('3. Full refund - debt only', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 0, card_paid: 0, debt_paid: 100, payment_method: 'debt', qty: 1 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'full',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.debt_reversed).toBe('100.00');
  });

  it('4. Partial refund - debt only', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 0, card_paid: 0, debt_paid: 100, payment_method: 'debt', qty: 2 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.debt_reversed).toBe('50.00');
  });

  it('5. Full refund - card only', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 0, card_paid: 100, debt_paid: 0, payment_method: 'card', qty: 1 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'full',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.card_refunded).toBe('100.00');
  });

  it('6. Partial refund - card only', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 0, card_paid: 100, debt_paid: 0, payment_method: 'card', qty: 2 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.card_refunded).toBe('50.00');
  });

  it('7. Cash + debt split - full refund', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 60, card_paid: 0, debt_paid: 40, payment_method: 'split', qty: 1 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'full',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.cash_refunded).toBe('60.00');
    expect(refund.debt_reversed).toBe('40.00');
  });

  it('7. Cash + debt split - partial refund', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 60, card_paid: 0, debt_paid: 40, payment_method: 'split', qty: 2 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.cash_refunded).toBe('30.00');
    expect(refund.debt_reversed).toBe('20.00');
  });

  it('8. Cash + card split - full refund', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 60, card_paid: 40, debt_paid: 0, payment_method: 'split', qty: 1 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'full',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.cash_refunded).toBe('60.00');
    expect(refund.card_refunded).toBe('40.00');
  });

  it('8. Cash + card split - partial refund', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 60, card_paid: 40, debt_paid: 0, payment_method: 'split', qty: 2 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.cash_refunded).toBe('30.00');
    expect(refund.card_refunded).toBe('20.00');
  });

  it('9. Cash + card + debt split - full refund', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 40, card_paid: 40, debt_paid: 20, payment_method: 'split', qty: 1 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'full',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.cash_refunded).toBe('40.00');
    expect(refund.card_refunded).toBe('40.00');
    expect(refund.debt_reversed).toBe('20.00');
  });

  it('9. Cash + card + debt split - partial refund', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 40, card_paid: 40, debt_paid: 20, payment_method: 'split', qty: 2 });
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    const refund = await db('refunds').where('id', result.refund_id).first();
    expect(refund.cash_refunded).toBe('20.00');
    expect(refund.card_refunded).toBe('20.00');
    expect(refund.debt_reversed).toBe('10.00');
  });

  it('10. Multiple sequential refunds', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 100, card_paid: 0, debt_paid: 0, payment_method: 'cash', qty: 10 }); // total 100, 10 each
    
    // Refund 4
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test 1', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 4, restock_inventory: true }]
    });
    
    // Refund 3
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test 2', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 3, restock_inventory: true }]
    });

    // Refund 3
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test 3', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 3, restock_inventory: true }]
    });

    // Refund 1 (must fail)
    await expect(posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test 4', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    })).rejects.toThrow('Cannot refund 1 of item');
  });

  it('11. Quantity over-refund', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 50, card_paid: 0, debt_paid: 0, payment_method: 'cash', qty: 5 });
    
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 3, restock_inventory: true }]
    });

    await expect(posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Test', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 3, restock_inventory: true }]
    })).rejects.toThrow('Cannot refund 3 of item. Only 2 available.');
  });

  it('12. Concurrent refund attempt simulation', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 50, card_paid: 0, debt_paid: 0, payment_method: 'cash', qty: 5 });
    
    // Use Promise.all to simulate concurrent attempts. The DB row lock (FOR UPDATE) 
    // will serialize them and the second one will throw a quantity error.
    const attempt1 = posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Simultaneous 1', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 5, restock_inventory: true }]
    });
    
    const attempt2 = posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Simultaneous 2', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 5, restock_inventory: true }]
    });

    const results = await Promise.allSettled([attempt1, attempt2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('13. Audit log verification', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 10, card_paid: 0, debt_paid: 0, payment_method: 'cash', qty: 1 });
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Audit Test', refund_type: 'full',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    
    const log = await db('audit_logs').where('entity_id', sale.id).where('action', 'sale_refunded').first();
    expect(log).toBeDefined();
    expect(log.entity_id).toBe(sale.id); // Validates UUID maps to VARCHAR(36)
  });

  it('14. Inventory restoration verification', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 10, card_paid: 0, debt_paid: 0, payment_method: 'cash', qty: 2 });
    
    const invBefore = await db('inventory').where('product_id', ctx.productId).first();
    
    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Restock Test', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: true }]
    });
    
    const invAfter1 = await db('inventory').where('product_id', ctx.productId).first();
    expect(Number(invAfter1.quantity)).toBe(Number(invBefore.quantity) + 1);

    await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Damage Test', refund_type: 'partial',
      items: [{ sale_item_id: saleItem.id, quantity: 1, restock_inventory: false }]
    });

    const invAfter2 = await db('inventory').where('product_id', ctx.productId).first();
    expect(Number(invAfter2.quantity)).toBe(Number(invAfter1.quantity)); // Unchanged
    
    const adj = await db('inventory_adjustments').where('product_id', ctx.productId).orderBy('id', 'desc').limit(2);
    expect(adj[0].adjustment_type).toBe('damage');
    expect(adj[1].adjustment_type).toBe('return');
  });

  it('15. Void transaction verification', async () => {
    const { sale, saleItem } = await createSale({ cash_paid: 100, card_paid: 0, debt_paid: 0, payment_method: 'cash', qty: 2 });
    
    const result = await posRepository.processRefund({
      sale_id: sale.id, manager_id: ctx.managerId, reason: 'Void Test', refund_type: 'void',
      items: [{ sale_item_id: saleItem.id, quantity: 2, restock_inventory: true }]
    });
    
    expect(result.status).toBe('voided');
    
    const updatedSale = await db('sales').where('id', sale.id).first();
    expect(updatedSale.status).toBe('voided');
    expect(Number(updatedSale.refunded_amount)).toBe(100);
  });
});
