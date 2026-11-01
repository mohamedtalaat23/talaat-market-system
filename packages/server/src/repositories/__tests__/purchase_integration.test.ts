import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../config/database';
import { purchaseRepository } from '../purchase.repository';
import { supplierRepository } from '../supplier.repository';
import { setupTestData } from './reversal_setup';

describe('Inventory & Costing (AVCO Costing) Integration', () => {
  let supplier: any;

  beforeAll(async () => {
    // Create a shared supplier for these test POs
    const rand = () => Math.random().toString(36).substring(2, 11);
    supplier = await supplierRepository.create({
      name: `Test Costing Supplier ${rand()}`,
    });
  });

  const setupPO = async (
    productId: number,
    orderedQty: number,
    unitCost: number,
    managerId: number,
  ) => {
    // Create PO in draft
    const po = await purchaseRepository.create(
      {
        supplier_id: supplier.id,
        discount_amount: 0,
        tax_amount: 0,
        items: [{ product_id: productId, ordered_quantity: orderedQty, unit_cost: unitCost }],
      },
      managerId,
    );

    // Transition draft to ordered
    await purchaseRepository.updateStatus(po.id!, 'ordered');

    return po;
  };

  it('TC1: AVCO Cost Recalculation (Standard Case)', async () => {
    const localCtx = await setupTestData();
    const productId = localCtx.productId;

    // Reset live inventory to: stock = 10, cost = $5 (cost_price in products)
    await db('inventory').where('product_id', productId).update({ quantity: 10 });
    await db('products').where('id', productId).update({ cost_price: 5 });

    // Setup PO: ordered = 5, unitCost = $8
    const po = await setupPO(productId, 5, 8, localCtx.managerId);
    const poItem = po.items![0]!;

    // Receive goods
    await purchaseRepository.receiveGoods(
      po.id!,
      [{ po_item_id: poItem.id!, product_id: productId, quantity_to_receive: 5 }],
      localCtx.managerId,
    );

    // Verify stock incremented to 15
    const inv = await db('inventory').where('product_id', productId).first();
    expect(Number(inv.quantity)).toBe(15);

    // Verify AVCO cost price: ((10 * 5) + (5 * 8)) / 15 = (50 + 40) / 15 = 90 / 15 = $6.00
    const prod = await db('products').where('id', productId).first();
    expect(Number(prod.cost_price)).toBe(6.0);

    // Verify inventory adjustment log exists
    const adj = await db('inventory_adjustments')
      .where('product_id', productId)
      .andWhere('adjustment_type', 'purchase_receipt')
      .first();
    expect(adj).toBeDefined();
    expect(Number(adj.quantity_change)).toBe(5);
    expect(Number(adj.old_quantity)).toBe(10);
    expect(Number(adj.new_quantity)).toBe(15);
  });

  it("TC2: AVCO Cost Recalculation (Banker's Rounding Decimals)", async () => {
    const localCtx = await setupTestData();
    const productId = localCtx.productId;

    // Reset live inventory to: stock = 20, cost = $8
    await db('inventory').where('product_id', productId).update({ quantity: 20 });
    await db('products').where('id', productId).update({ cost_price: 8 });

    // Setup PO: ordered = 10, unitCost = $10
    const po = await setupPO(productId, 10, 10, localCtx.managerId);
    const poItem = po.items![0]!;

    // Receive goods
    await purchaseRepository.receiveGoods(
      po.id!,
      [{ po_item_id: poItem.id!, product_id: productId, quantity_to_receive: 10 }],
      localCtx.managerId,
    );

    // Verify AVCO cost price: ((20 * 8) + (10 * 10)) / 30 = (160 + 100) / 30 = 260 / 30 = 8.6666... -> Banker's rounded to 8.67
    const prod = await db('products').where('id', productId).first();
    expect(Number(prod.cost_price)).toBe(8.67);
  });

  it('TC3: Boundary Cases (Zero & Negative Stock)', async () => {
    // A. Test Zero Stock:
    const localCtxZero = await setupTestData();
    const productIdZero = localCtxZero.productId;

    await db('inventory').where('product_id', productIdZero).update({ quantity: 0 });
    await db('products').where('id', productIdZero).update({ cost_price: 5 });

    const poZero = await setupPO(productIdZero, 10, 12, localCtxZero.managerId);
    const poItemZero = poZero.items![0]!;

    await purchaseRepository.receiveGoods(
      poZero.id!,
      [{ po_item_id: poItemZero.id!, product_id: productIdZero, quantity_to_receive: 10 }],
      localCtxZero.managerId,
    );

    // Cost price should reset to incoming cost = $12.00
    const prodZero = await db('products').where('id', productIdZero).first();
    expect(Number(prodZero.cost_price)).toBe(12.0);

    // B. Test Negative Stock:
    const localCtxNeg = await setupTestData();
    const productIdNeg = localCtxNeg.productId;

    await db('inventory').where('product_id', productIdNeg).update({ quantity: -5 });
    await db('products').where('id', productIdNeg).update({ cost_price: 5 });

    const poNeg = await setupPO(productIdNeg, 10, 15, localCtxNeg.managerId);
    const poItemNeg = poNeg.items![0]!;

    await purchaseRepository.receiveGoods(
      poNeg.id!,
      [{ po_item_id: poItemNeg.id!, product_id: productIdNeg, quantity_to_receive: 10 }],
      localCtxNeg.managerId,
    );

    // Cost price should reset to incoming cost = $15.00
    const prodNeg = await db('products').where('id', productIdNeg).first();
    expect(Number(prodNeg.cost_price)).toBe(15.0);
  });

  it('TC4: Concurrency and Lock Ordering (Deadlock Prevention)', async () => {
    const localCtx = await setupTestData();
    const rand = () => Math.random().toString(36).substring(2, 11);
    const now = Date.now();

    // Create a second product
    const [product2] = await db('products')
      .insert({
        name: `Test Product 2 ${now} ${rand()}`,
        barcode: `BAR-${now}-${rand()}`,
        selling_price: 15,
        cost_price: 6,
        category_id: null,
      })
      .returning('*');

    await db('inventory').insert({
      product_id: product2.id,
      quantity: 50,
    });

    const p1 = localCtx.productId;
    const p2 = product2.id;

    // We will create two POs containing both products p1 and p2.
    // PO A has p1 then p2. PO B has p2 then p1.
    // When we call receiveGoods, the repository will sort them by product_id ASC before locking, preventing deadlocks.
    const poA = await purchaseRepository.create(
      {
        supplier_id: supplier.id,
        discount_amount: 0,
        tax_amount: 0,
        items: [
          { product_id: p1, ordered_quantity: 5, unit_cost: 10 },
          { product_id: p2, ordered_quantity: 5, unit_cost: 12 },
        ],
      },
      localCtx.managerId,
    );

    const poB = await purchaseRepository.create(
      {
        supplier_id: supplier.id,
        discount_amount: 0,
        tax_amount: 0,
        items: [
          { product_id: p2, ordered_quantity: 5, unit_cost: 12 },
          { product_id: p1, ordered_quantity: 5, unit_cost: 10 },
        ],
      },
      localCtx.managerId,
    );

    await purchaseRepository.updateStatus(poA.id!, 'ordered');
    await purchaseRepository.updateStatus(poB.id!, 'ordered');

    const poItemA1 = poA.items!.find((i: any) => i.product_id === p1)!;
    const poItemA2 = poA.items!.find((i: any) => i.product_id === p2)!;
    const poItemB1 = poB.items!.find((i: any) => i.product_id === p1)!;
    const poItemB2 = poB.items!.find((i: any) => i.product_id === p2)!;

    // Call concurrently. If sorting is correct, no deadlock occurs.
    const results = await Promise.allSettled([
      purchaseRepository.receiveGoods(
        poA.id!,
        [
          { po_item_id: poItemA1.id!, product_id: p1, quantity_to_receive: 5 },
          { po_item_id: poItemA2.id!, product_id: p2, quantity_to_receive: 5 },
        ],
        localCtx.managerId,
      ),
      purchaseRepository.receiveGoods(
        poB.id!,
        [
          { po_item_id: poItemB2.id!, product_id: p2, quantity_to_receive: 5 },
          { po_item_id: poItemB1.id!, product_id: p1, quantity_to_receive: 5 },
        ],
        localCtx.managerId,
      ),
    ]);

    const failed = results.filter((r) => r.status === 'rejected');
    expect(failed).toHaveLength(0); // Both transactions should succeed.
  });
});
