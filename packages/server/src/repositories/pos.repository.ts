import { db } from '../config/database';
import type { Product } from './product.repository';
import { customerRepository } from './customer.repository';
import { auditService } from '../services/audit.service';

export interface RefundItemInput {
  sale_item_id: string;
  quantity: number;
  restock_inventory: boolean;
}

export interface RefundInput {
  sale_id: string;
  manager_id: number;
  reason: string;
  items: RefundItemInput[];
  refund_type: 'full' | 'partial' | 'void';
}

export class InventoryUnderflowError extends Error {
  public code = 'INVENTORY_UNDERFLOW';
  public product_id: number;

  constructor(productId: number, message: string) {
    super(message);
    this.name = 'InventoryUnderflowError';
    this.product_id = productId;
  }
}

export interface CheckoutItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount: number;
}

export interface CheckoutPayload {
  id?: string | undefined;
  receipt_number?: string | undefined;
  created_at?: string | undefined;
  shift_id: number;
  register_id: number;
  payment_method: 'cash' | 'card' | 'split' | 'debt';
  cash_received?: number | undefined;
  cash_amount?: number | undefined;
  card_amount?: number | undefined;
  idempotency_key: string;
  global_discount?: number | undefined;
  customer_id?: number | undefined;
  manager_pin?: string | undefined;
  manager_id?: number | undefined;
  items: CheckoutItem[];
}

export class POSRepository {
  /**
   * Open a new shift for the cashier.
   */
  async openShift(employeeId: number, startingCash: number, registerId: number = 1) {
    const [shift] = await db('cashier_shifts')
      .insert({
        employee_id: employeeId,
        register_id: registerId,
        status: 'open',
        starting_cash: startingCash,
      })
      .returning('*');
    return shift;
  }

  /**
   * Close a shift.
   */

  /**
   * Create a Cash Drawer Adjustment
   */
  async createDrawerAdjustment(payload: { shift_id: number, manager_id: number, type: string, amount: number, reason_code: string, reason_notes?: string }) {
    return await db.transaction(async (trx) => {
      // Verify shift is open
      const shift = await trx('cashier_shifts').where({ id: payload.shift_id, status: 'open' }).first();
      if (!shift) {
        throw new Error('Shift must be open to perform drawer adjustments.');
      }

      // Verify manager
      const manager = await trx('employees').where({ id: payload.manager_id, role: 'manager' }).first();
      if (!manager) {
        throw new Error('Valid manager authorization is required for drawer adjustments.');
      }

      let direction = 'OUT';
      if (['change_replenishment'].includes(payload.type)) {
        direction = 'IN';
      } else if (payload.type === 'cash_correction') {
        // If cash_correction, we look at the reason_code. For simplicity, just use reason_code to denote direction or accept the type mapping.
        // Wait, if amount is always positive, how do we denote cash_correction direction?
        // Let's rely on reason_code or type. We can use 'cash_correction_in' and 'cash_correction_out' for the API type.
      }

      // Wait! The user's requested types are: safe_drop, change_replenishment, petty_cash, vendor_payment, owner_withdrawal, cash_correction.
      // If it's a cash_correction, let's look at the payload.type if we updated it, or we just rely on the controller logic.
      
      const inTypes = ['change_replenishment', 'cash_correction_in'];
      direction = inTypes.includes(payload.type) ? 'IN' : 'OUT';

      const [adj] = await trx('cash_drawer_adjustments').insert({
        shift_id: payload.shift_id,
        cashier_id: shift.employee_id,
        manager_id: payload.manager_id,
        adjustment_type: direction,
        amount: payload.amount,
        reason_code: payload.reason_code,
        reason_notes: payload.reason_notes || null
      }).returning('*');

      // Update shift expected cash
      if (direction === 'IN') {
        await trx('cashier_shifts').where('id', shift.id).increment('expected_cash', payload.amount).update({ updated_at: trx.fn.now() });
      } else {
        await trx('cashier_shifts').where('id', shift.id).decrement('expected_cash', payload.amount).update({ updated_at: trx.fn.now() });
      }

      // Audit Log
      await trx('audit_logs').insert({
        entity_type: 'cash_drawer_adjustments',
        entity_id: String(adj.id),
        action: 'drawer_adjustment_created',
        old_value: null,
        new_value: JSON.stringify(adj),
        user_id: payload.manager_id,
        reason: payload.reason_notes || payload.reason_code
      });

      return adj;
    });
  }

  async closeShift(shiftId: number, endingCash: number, expectedCash: number, notes: string | undefined, userId: number) {
    const [shift] = await db('cashier_shifts')
      .where({ id: shiftId, status: 'open' })
      .update({
        status: 'closed',
        end_time: db.fn.now(),
        ending_cash: endingCash,
        expected_cash: expectedCash,
        notes: notes || null,
        updated_at: db.fn.now(),
      })
      .returning('*');

    // Log the close shift event
    await db('audit_logs').insert({
      entity_type: 'cashier_shifts',
      entity_id: String(shift.id),
      action: 'shift_closed',
      old_value: null,
      new_value: JSON.stringify({ ending_cash: endingCash, expected_cash: expectedCash, notes }),
      user_id: userId,
      reason: notes || 'Shift closed'
    });

    return shift;
  }

  /**
   * Get the current active shift for a specific register (Drawer sharing).
   */
  async getCurrentShift(registerId: number) {
    return db('cashier_shifts').where({ register_id: registerId, status: 'open' }).first();
  }

  /**
   * Get shift summary for closing
   */
  async getShiftSummary(shiftId: number) {
    const shift = await db('cashier_shifts').where('id', shiftId).first();
    if (!shift) throw new Error('Shift not found');

    const salesSummary = await db('sales')
      .where('shift_id', shiftId)
      .whereIn('status', ['completed', 'partially_refunded', 'refunded', 'voided'])
      .select(
        db.raw('COUNT(id) as transaction_count'),
        db.raw("COALESCE(SUM(cash_paid), 0) as cash_sales"),
        db.raw("COALESCE(SUM(card_paid), 0) as card_sales"),
        db.raw(
          'COALESCE(SUM(COALESCE(discount_amount, 0) + COALESCE(global_discount, 0)), 0) as total_discounts',
        ),
        db.raw(
          "COALESCE(SUM(CASE WHEN print_status = 'pending_print' THEN 1 ELSE 0 END), 0) as pending_prints",
        ),
      )
      .first();

    const refundsSummary = await db('refunds')
      .join('sales', 'sales.id', 'refunds.sale_id')
      .where('sales.shift_id', shiftId)
      .select(
        db.raw("COALESCE(SUM(refunds.cash_refunded), 0) as cash_refunds"),
        db.raw("COALESCE(SUM(refunds.card_refunded), 0) as card_refunds")
      )
      .first();

    
    const adjustmentSummary = await db('cash_drawer_adjustments')
      .where('shift_id', shiftId)
      .select(
        db.raw("COALESCE(SUM(CASE WHEN adjustment_type = 'IN' THEN amount ELSE 0 END), 0) as total_pay_ins"),
        db.raw("COALESCE(SUM(CASE WHEN adjustment_type = 'OUT' THEN amount ELSE 0 END), 0) as total_pay_outs")
      )
      .first();

    const payIns = Number(adjustmentSummary?.total_pay_ins || 0);
    const payOuts = Number(adjustmentSummary?.total_pay_outs || 0);

    const paymentSummary = await db('customer_transactions')
      .where('shift_id', shiftId)
      .andWhere('transaction_type', 'payment')
      .select(
        db.raw(
          "COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash_payments",
        ),
        db.raw(
          "COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END), 0) as card_payments",
        ),
      )
      .first();

    const cashSales = Number(salesSummary.cash_sales) + Number(paymentSummary.cash_payments) - Number(refundsSummary?.cash_refunds || 0) + payIns - payOuts;
    const cardSales = Number(salesSummary.card_sales) + Number(paymentSummary.card_payments) - Number(refundsSummary?.card_refunds || 0);
    const totalDiscounts = Number(salesSummary.total_discounts);
    const expectedCash = Number(shift.starting_cash) + cashSales;

    return {
      shift_id: shiftId,
      starting_cash: Number(shift.starting_cash),
      employee_id: shift.employee_id,
      cash_sales: cashSales,
      card_sales: cardSales,
      total_discounts: totalDiscounts,
      expected_cash: expectedCash,
      transaction_count: Number(salesSummary.transaction_count),
      pending_prints: Number(salesSummary.pending_prints),
      total_pay_ins: payIns,
      total_pay_outs: payOuts
    };
  }

  /**
   * Atomic Checkout Transaction
   */
  async checkout(
    payload: CheckoutPayload,
    cashierId: number,
    bypassInventoryCheck: boolean = false,
  ) {
    if (!payload.shift_id) {
      throw new Error('Active shift is required for checkout.');
    }

    try {
      return await db.transaction(async (trx) => {
        // 1. Acquire transaction-level advisory lock on the hashed idempotency key to strictly serialize concurrent checkout requests
        const hashQuery = await trx.raw('SELECT hashtext(?) as hash', [payload.idempotency_key]);
        const lockHash = hashQuery.rows[0].hash;
        await trx.raw('SELECT pg_advisory_xact_lock(?)', [lockHash]);

        // 2. Perform a strict row-level lock check inside the serialized transaction block
        const existing = await trx('sales')
          .where('idempotency_key', payload.idempotency_key)
          .forUpdate()
          .first();

        if (existing) {
          const existingItems = await trx('sale_items').where('sale_id', existing.id);
          return { ...existing, items: existingItems };
        }

        if (payload.payment_method === 'debt' && !payload.customer_id) {
          throw new Error('A customer must be selected to checkout using the debt payment method.');
        }

        // 1. Calculate totals
        let subtotal = 0;
        let discountAmount = 0;
        const globalDiscount = payload.global_discount || 0;

        for (const item of payload.items) {
          subtotal += item.unit_price * item.quantity;
          discountAmount += item.discount;
        }
        const taxAmount = 0;
        const total = subtotal - discountAmount - globalDiscount + taxAmount;

        if (total < 0) {
          throw new Error('Sale total cannot be negative.');
        }

        if (payload.payment_method === 'cash') {
          const cashReceived = payload.cash_received || 0;
          if (cashReceived < total) {
            throw new Error(`Insufficient cash received. Minimum required: ${total.toFixed(2)}`);
          }
        } else if (payload.payment_method === 'split') {
          const cashAmount = payload.cash_amount || 0;
          const cardAmount = payload.card_amount || 0;
          if (cashAmount + cardAmount < total) {
            throw new Error(
              `Insufficient split payment amounts. Total provided: ${(cashAmount + cardAmount).toFixed(2)}, required: ${total.toFixed(2)}`,
            );
          }
        }

        // 2. Generate Receipt Number using sequence
        const { rows } = await trx.raw(`SELECT nextval('receipt_number_seq') as seq`);
        const seq = String(rows[0].seq).padStart(5, '0');
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const receiptNumber = `STR01-REG${String(payload.register_id || 1).padStart(2, '0')}-${dateStr}-${seq}`;

        // 3. Create Sale Record
        let changeGiven = 0;
        if (payload.payment_method === 'cash') {
          changeGiven = Math.max(0, (payload.cash_received || 0) - total);
        } else if (payload.payment_method === 'split') {
          changeGiven = Math.max(
            0,
            (payload.cash_amount || 0) + (payload.card_amount || 0) - total,
          );
          changeGiven = Math.min(changeGiven, payload.cash_amount || 0); // Can't give back more change than cash provided
        }

        // Compute Effective Tenders
        let cashPaid = 0;
        let cardPaid = 0;
        let debtPaid = 0;
        
        if (payload.payment_method === 'cash') {
          cashPaid = total;
        } else if (payload.payment_method === 'card') {
          cardPaid = total;
        } else if (payload.payment_method === 'debt') {
          debtPaid = total;
        } else if (payload.payment_method === 'split') {
          cashPaid = (payload.cash_amount || 0) - changeGiven;
          cardPaid = payload.card_amount || 0;
        }

        const [sale] = await trx('sales')
          .insert({
            id: payload.id || trx.raw('gen_random_uuid()'),
            receipt_number: receiptNumber,
            cashier_id: cashierId,
            shift_id: payload.shift_id,
            register_id: payload.register_id,
            payment_method: payload.payment_method,
            subtotal,
            discount_amount: discountAmount,
            global_discount: globalDiscount,
            tax_amount: taxAmount,
            total,
            cash_received: payload.cash_received || null,
            cash_amount: payload.payment_method === 'split' ? payload.cash_amount || null : null,
            card_amount: payload.payment_method === 'split' ? payload.card_amount || null : null,
            change_given: changeGiven,
            cash_paid: cashPaid,
            card_paid: cardPaid,
            debt_paid: debtPaid,
            status: 'completed',
            print_status: 'pending_print',
            print_count: 0,
            idempotency_key: payload.idempotency_key,
            customer_id: payload.customer_id || null,
          })
          .returning('*');

        if (bypassInventoryCheck && payload.manager_id) {
          await trx('manager_overrides').insert({
            manager_id: payload.manager_id,
            cashier_id: cashierId,
            action_type: 'inventory_bypass',
            reference_id: sale.id,
            details: `Inventory bypass for checkout ${receiptNumber}`,
          });
        }

        if (payload.payment_method === 'debt' && payload.customer_id) {
          const customer = await trx('customers')
            .where('id', payload.customer_id)
            .whereNull('deleted_at')
            .first();
          if (!customer) {
            throw new Error('Selected customer not found or has been deleted.');
          }

          await trx('customer_transactions').insert({
            customer_id: payload.customer_id,
            transaction_type: 'sale',
            amount: -total,
            reference_id: receiptNumber,
            notes: `POS credit sale checkout: ${receiptNumber}`,
            created_by: cashierId,
            created_at: trx.fn.now(),
          });

          await trx('customers')
            .where('id', payload.customer_id)
            .decrement('balance', total)
            .update({ updated_at: trx.fn.now() });
        }

        // 4. Process items and inventory
        //
        // CRITICAL: Sort items by product_id ASC before acquiring any row-level locks.
        //
        // Without this sort, two concurrent transactions can deadlock:
        //   Txn A: locks product_id=5, waits for product_id=8
        //   Txn B: locks product_id=8, waits for product_id=5  ← cycle → deadlock
        //
        // With ascending sort, every transaction locks rows in the same order,
        // so no cycle can form. This is standard lock-ordering deadlock prevention.
        const sortedItems = [...payload.items].sort((a, b) => a.product_id - b.product_id);
        const productIds = sortedItems.map((item) => item.product_id);
        const products = await trx('products')
          .whereIn('id', productIds)
          .select('id', 'cost_price', 'name', 'barcode');

        const productMap = new Map(products.map((p) => [p.id, p]));
        const saleItemsToInsert = [];

        for (const item of sortedItems) {
          const product = productMap.get(item.product_id);
          if (!product) throw new Error(`Product ${item.product_id} not found`);

          const lineTotal = item.unit_price * item.quantity - item.discount;

          saleItemsToInsert.push({
            sale_id: sale.id,
            product_id: item.product_id,
            product_name: product.name,
            barcode: product.barcode,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount,
            line_total: lineTotal,
            cost_at_sale: product.cost_price || 0,
          });

          let affectedRows = 0;

          if (bypassInventoryCheck) {
            // Bypasses the inventory check constraint logic, allowing stock count to temporarily go negative
            affectedRows = await trx('inventory')
              .where('product_id', item.product_id)
              .decrement('quantity', item.quantity);
              
            if (affectedRows === 0) {
              await trx('inventory').insert({
                product_id: item.product_id,
                quantity: -item.quantity,
                reserved_quantity: 0
              });
              affectedRows = 1;
            }
          } else {
            // Enforces strict inventory underflow guard using atomic condition checks
            affectedRows = await trx('inventory')
              .where('product_id', item.product_id)
              .andWhere('quantity', '>=', item.quantity)
              .decrement('quantity', item.quantity);
          }

          if (affectedRows === 0) {
            throw new InventoryUnderflowError(
              item.product_id,
              `Insufficient inventory or inventory record missing for product ID ${item.product_id}. Checkout aborted.`,
            );
          }
        }

        const insertedItems = await trx('sale_items').insert(saleItemsToInsert).returning('*');

        // Update live shift tracker with incoming cash
        if (cashPaid > 0 && payload.shift_id) {
          await trx('cashier_shifts')
            .where('id', payload.shift_id)
            .increment('expected_cash', cashPaid)
            .update({ updated_at: trx.fn.now() });
        }

        return { ...sale, items: insertedItems };
      });
    } catch (error: any) {
      if (error.code === '23505' && error.message?.includes('idempotency_key')) {
        // Race condition: another request just inserted this idempotency key.
        const existing = await db('sales')
          .where('idempotency_key', payload.idempotency_key)
          .first();
        if (existing) {
          const existingItems = await db('sale_items').where('sale_id', existing.id);
          return { ...existing, items: existingItems };
        }
      }
      throw error;
    }
  }

  /**
   * Idempotent, Fault-Isolated Batch Sync for Offline Transactions.
   *
   * Each sale is processed in its own transaction via checkout() so that
   * a single poison sale (deleted customer, missing product) does not
   * roll back the entire batch. The caller receives a breakdown of
   * which IDs succeeded and which failed.
   */
  async syncOffline(payloads: CheckoutPayload[], cashierId: number) {
    if (payloads.length === 0) {
      return {
        synced: 0,
        syncedIds: [] as string[],
        failed: [] as { id: string; error: string }[],
      };
    }

    // 1. Preemptive Idempotency Check: skip sales that already exist in DB
    const incomingIds = payloads.map((p) => p.id).filter(Boolean) as string[];
    const incomingKeys = payloads.map((p) => p.idempotency_key).filter(Boolean);

    const existingSales = await db('sales')
      .where(function () {
        if (incomingIds.length > 0) this.whereIn('id', incomingIds);
        if (incomingKeys.length > 0) this.orWhereIn('idempotency_key', incomingKeys);
      })
      .select('id', 'idempotency_key');

    const existingIdsSet = new Set(existingSales.map((s) => s.id));
    const existingKeysSet = new Set(existingSales.map((s) => s.idempotency_key));

    // Filter out already-synchronized sales completely before doing any operations
    const salesToProcess = payloads.filter((p) => {
      const hasId = p.id && existingIdsSet.has(p.id);
      const hasKey = p.idempotency_key && existingKeysSet.has(p.idempotency_key);
      return !hasId && !hasKey;
    });

    if (salesToProcess.length === 0) {
      return {
        synced: 0,
        syncedIds: [] as string[],
        failed: [] as { id: string; error: string }[],
      };
    }

    // 2. Sort sales by their minimum product_id to maintain consistent lock ordering
    const sortedSales = [...salesToProcess].sort((a, b) => {
      const aMin = a.items.length > 0 ? Math.min(...a.items.map((i) => i.product_id)) : 0;
      const bMin = b.items.length > 0 ? Math.min(...b.items.map((i) => i.product_id)) : 0;
      return aMin - bMin;
    });

    // 3. Process each sale in its own isolated transaction
    const syncedIds: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const payload of sortedSales) {
      const saleIdentifier = payload.id || payload.idempotency_key;
      try {
        // Offline sales bypass inventory underflow checks since the physical sale already happened
        await this.checkout(payload, cashierId, true);
        syncedIds.push(saleIdentifier);
      } catch (error: any) {
        console.error(`[SyncOffline] Failed to sync sale ${saleIdentifier}:`, error.message);
        failed.push({
          id: saleIdentifier,
          error: error.message || 'Unknown sync error',
        });
      }
    }

    return { synced: syncedIds.length, syncedIds, failed };
  }

  /**
   * Mark receipt as printed successfully
   */
  async markReceiptPrinted(saleId: string) {
    const [sale] = await db('sales')
      .where('id', saleId)
      .update({
        print_status: 'printed',
        print_count: db.raw('print_count + 1'),
        updated_at: db.fn.now(),
      })
      .returning('*');
    return sale;
  }

  /**
   * Reprint an old receipt
   */
  async reprintReceipt(saleId: string, managerId: number) {
    return db.transaction(async (trx) => {
      const [sale] = await trx('sales')
        .where('id', saleId)
        .update({
          print_status: 'printed',
          print_count: db.raw('print_count + 1'),
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!sale) throw new Error('Sale not found');

      await trx('manager_overrides').insert({
        manager_id: managerId,
        cashier_id: sale.cashier_id,
        action_type: 'reprint_receipt',
        reference_id: saleId,
        details: `Reprint #${sale.print_count} for receipt ${sale.receipt_number}`,
      });

      const items = await trx('sale_items').where('sale_id', saleId);
      return { ...sale, items };
    });
  }

  /**
   * Search for sales by receipt number or date
   */
  async searchSales(query: string, limit: number = 20) {
    const q = db('sales')
      .select('sales.*', 'employees.username as cashier_name')
      .leftJoin('employees', 'sales.cashier_id', 'employees.id')
      .orderBy('sales.created_at', 'desc')
      .limit(limit);

    if (query) {
      // Escape ILIKE wildcard characters (\, %, _) to avoid index-bypassing scans
      const escapedQuery = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      q.where('receipt_number', 'ilike', `%${escapedQuery}%`);
    }

    const sales = await q;

    if (sales.length > 0) {
      const saleIds = sales.map((s) => s.id);
      const items = await db('sale_items').whereIn('sale_id', saleIds);

      const itemsBySaleId = items.reduce(
        (acc, item) => {
          if (!acc[item.sale_id]) acc[item.sale_id] = [];
          acc[item.sale_id].push(item);
          return acc;
        },
        {} as Record<string, any[]>,
      );

      for (const sale of sales) {
        sale.items = itemsBySaleId[sale.id] || [];
      }
    }

    return sales;
  }

  /**
   * Get a single receipt by ID with all details
   */
  async getReceiptById(saleId: string) {
    const sale = await db('sales')
      .select('sales.*', 'employees.username as cashier_name')
      .leftJoin('employees', 'sales.cashier_id', 'employees.id')
      .where('sales.id', saleId)
      .first();

    if (!sale) return null;

    const items = await db('sale_items').where('sale_id', saleId);
    sale.items = items;

    return sale;
  }
  /**
   * Lightweight POS product search — returns top-N matches WITHOUT a COUNT(*) query.
   *
   * This is intentionally leaner than ProductRepository.findAll():
   *   - No category/supplier join (not needed at POS point of scan)
   *   - No total count query (cashier only needs the top results)
   *   - Minimum 2-character query enforced upstream by the validator
   *
   * Use this endpoint for the POS search fallback modal while the cashier types.
   * Use GET /products for the admin catalog with full pagination metadata.
   */
  async searchProducts(search: string, limit: number): Promise<Product[]> {
    const escapedSearch = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const searchPattern = `%${escapedSearch}%`;
    const rows = await db('products')
      .leftJoin('inventory', 'inventory.product_id', 'products.id')
      .leftJoin('categories', 'categories.id', 'products.category_id')
      .select(
        'products.*',
        'categories.name as category_name',
        'categories.name_ar as category_name_ar',
        'inventory.quantity as inventory_quantity',
        'inventory.reserved_quantity as inventory_reserved_quantity',
      )
      .whereNull('products.deleted_at')
      .where('products.is_active', true)
      .where((builder) => {
        builder
          .where('products.name', 'ILIKE', searchPattern)
          .orWhere('products.name_ar', 'ILIKE', searchPattern)
          .orWhere('products.barcode', 'ILIKE', searchPattern);
      })
      .orderBy('products.name', 'asc')
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      cost_price: Number(row.cost_price),
      selling_price: Number(row.selling_price),
      min_stock_level: Number(row.min_stock_level),
      max_stock_level: Number(row.max_stock_level),
      inventory_quantity:
        row.inventory_quantity !== null ? Number(row.inventory_quantity) : undefined,
      inventory_reserved_quantity:
        row.inventory_reserved_quantity !== null
          ? Number(row.inventory_reserved_quantity)
          : undefined,
    })) as Product[];
  }

  async processRefund(input: RefundInput) {
    return db.transaction(async (trx) => {
      // 1. Lock sales row
      const sale = await trx('sales').where('id', input.sale_id).forUpdate().first();
      if (!sale) throw new Error('Sale not found');
      if (sale.status === 'voided') throw new Error('Sale is already voided');

      const originalSaleTotal = Number(sale.total);
      const alreadyRefundedAmount = Number(sale.refunded_amount);

      // 2. Lock sale_items rows
      const itemIds = input.items.map(i => i.sale_item_id);
      const saleItems = await trx('sale_items')
        .whereIn('id', itemIds)
        .andWhere('sale_id', input.sale_id)
        .forUpdate();

      const saleItemsMap = new Map(saleItems.map(item => [item.id, item]));

      let totalRefundAmount = 0;
      const refundItemsToInsert = [];

      // Process each item
      for (const reqItem of input.items) {
        const dbItem = saleItemsMap.get(reqItem.sale_item_id);
        if (!dbItem) throw new Error(`Sale item ${reqItem.sale_item_id} not found on this receipt`);

        const availableQty = Number(dbItem.quantity) - Number(dbItem.refunded_quantity);
        if (reqItem.quantity > availableQty) {
          throw new Error(`Cannot refund ${reqItem.quantity} of item. Only ${availableQty} available.`);
        }

        // Proportional refund for the item
        const itemRefundAmount = (Number(dbItem.line_total) / Number(dbItem.quantity)) * reqItem.quantity;
        totalRefundAmount += itemRefundAmount;

        refundItemsToInsert.push({
          sale_item_id: dbItem.id,
          product_id: dbItem.product_id,
          quantity_refunded: reqItem.quantity,
          refund_amount: itemRefundAmount,
          restock_inventory: reqItem.restock_inventory
        });

        // Update sale_items aggregate
        await trx('sale_items')
          .where('id', dbItem.id)
          .increment('refunded_quantity', reqItem.quantity)
          .update({ updated_at: trx.fn.now() });
        
        // Handle Inventory Restock
        if (reqItem.restock_inventory) {
          await trx('inventory').where('product_id', dbItem.product_id).increment('quantity', reqItem.quantity).update({ updated_at: trx.fn.now() });
          await trx('inventory_adjustments').insert({
            product_id: dbItem.product_id,
            adjustment_type: 'return',
            quantity_change: reqItem.quantity,
            new_quantity: 0, 
            old_quantity: 0, 
            notes: `Refund restock for sale ${sale.receipt_number}`,
            created_by: input.manager_id,
          });
        } else {
          await trx('inventory_adjustments').insert({
            product_id: dbItem.product_id,
            adjustment_type: 'damage',
            quantity_change: 0,
            new_quantity: 0,
            old_quantity: 0,
            notes: `Damaged return for sale ${sale.receipt_number}`,
            created_by: input.manager_id,
          });
        }
      }

      // Protect against monetary over-refund
      if (totalRefundAmount + alreadyRefundedAmount > originalSaleTotal + 0.01) { // 0.01 for rounding
        throw new Error(`Total refund amount exceeds original sale total.`);
      }

      // 3. Proportional Split-Payment amounts
      const cashPaid = Number(sale.cash_paid);
      const cardPaid = Number(sale.card_paid);
      const debtPaid = Number(sale.debt_paid);
      
      // Proportions
      let cashRefunded = 0;
      let cardRefunded = 0;
      let debtReversed = 0;

      if (originalSaleTotal > 0) {
        const cashRatio = cashPaid / originalSaleTotal;
        const cardRatio = cardPaid / originalSaleTotal;
        const debtRatio = debtPaid / originalSaleTotal;
        cashRefunded = totalRefundAmount * cashRatio;
        cardRefunded = totalRefundAmount * cardRatio;
        debtReversed = totalRefundAmount * debtRatio;
      }

      // Insert refund record
      const rawResult = await trx.raw(`SELECT nextval('refund_receipt_number_seq') as seq`);
      const refundReceiptNum = rawResult.rows[0];
      const formattedRefundReceipt = `RF-${new Date().getFullYear()}-${String(refundReceiptNum.seq).padStart(6, '0')}`;

      const [refund] = await trx('refunds').insert({
        sale_id: sale.id,
        refund_receipt_number: formattedRefundReceipt,
        manager_id: input.manager_id,
        shift_id: sale.shift_id,
        refund_type: input.refund_type,
        original_sale_total: originalSaleTotal,
        total_refunded: totalRefundAmount,
        cash_refunded: cashRefunded,
        card_refunded: cardRefunded,
        debt_reversed: debtReversed,
        reason: input.reason,
        status: 'completed'
      }).returning('*');

      const mappedRefundItems = refundItemsToInsert.map(ri => ({
        ...ri,
        refund_id: refund.id
      }));

      await trx('refund_items').insert(mappedRefundItems);

      // Increment aggregated refund on sale
      await trx('sales').where('id', sale.id).increment('refunded_amount', totalRefundAmount).update({ updated_at: trx.fn.now() });

      // Deduct cash from shift if applicable
      if (cashRefunded > 0 && sale.shift_id) {
        await trx('cashier_shifts')
          .where('id', sale.shift_id)
          .decrement('expected_cash', cashRefunded)
          .update({ updated_at: trx.fn.now() });
      }

      // Reverse customer debt if applicable
      if (debtReversed > 0 && sale.customer_id) {
        await customerRepository.recordTransaction(
          sale.customer_id,
          debtReversed, // Positive amount to credit their balance back (reduce debt)
          'adjustment',
          formattedRefundReceipt,
          `Refund for sale ${sale.receipt_number}`,
          input.manager_id,
          sale.shift_id,
          sale.register_id,
          'cash', 
          trx
        );
      }

      // Update Sales status state machine
      let newStatus = sale.status;
      if (input.refund_type === 'void') {
        newStatus = 'voided';
      } else {
        const finalRefundedAmount = alreadyRefundedAmount + totalRefundAmount;
        if (Math.abs(finalRefundedAmount - originalSaleTotal) < 0.01) {
          newStatus = 'refunded';
        } else {
          newStatus = 'partially_refunded';
        }
      }

      if (newStatus !== sale.status) {
        await trx('sales').where('id', sale.id).update({ status: newStatus, updated_at: trx.fn.now() });
      }

      // Audit Logging
      await auditService.logEvent({
        entityType: 'sales',
        entityId: sale.id,
        action: input.refund_type === 'void' ? 'sale_voided' : 'sale_refunded',
        oldValue: { status: sale.status, refunded_amount: alreadyRefundedAmount, sale_id: sale.id },
        newValue: { status: newStatus, refunded_amount: alreadyRefundedAmount + totalRefundAmount, refund_receipt: formattedRefundReceipt, sale_id: sale.id },
        userId: input.manager_id,
        reason: input.reason,
        trx: trx
      });

      return {
        refund_id: refund.id,
        refund_receipt_number: formattedRefundReceipt,
        total_refunded: totalRefundAmount,
        status: newStatus
      };
    });
  }
}

export const posRepository = new POSRepository();
