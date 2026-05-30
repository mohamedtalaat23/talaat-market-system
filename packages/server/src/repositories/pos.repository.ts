import { db } from '../config/database';

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
    const [shift] = await db('cashier_shifts').insert({
      employee_id: employeeId,
      register_id: registerId,
      status: 'open',
      starting_cash: startingCash,
    }).returning('*');
    return shift;
  }

  /**
   * Close a shift.
   */
  async closeShift(shiftId: number, endingCash: number, expectedCash: number, notes?: string) {
    const [shift] = await db('cashier_shifts')
      .where({ id: shiftId, status: 'open' })
      .update({
        status: 'closed',
        end_time: db.fn.now(),
        ending_cash: endingCash,
        expected_cash: expectedCash,
        notes: notes || null,
        updated_at: db.fn.now()
      })
      .returning('*');
    return shift;
  }

  /**
   * Get the current active shift for a cashier.
   */
  async getCurrentShift(employeeId: number) {
    return db('cashier_shifts')
      .where({ employee_id: employeeId, status: 'open' })
      .first();
  }

  /**
   * Get shift summary for closing
   */
  async getShiftSummary(shiftId: number) {
    const shift = await db('cashier_shifts').where('id', shiftId).first();
    if (!shift) throw new Error('Shift not found');

    const salesSummary = await db('sales')
      .where('shift_id', shiftId)
      .andWhere('status', 'completed')
      .select(
        db.raw("COUNT(id) as transaction_count"),
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total WHEN payment_method = 'split' THEN COALESCE(cash_amount, 0) ELSE 0 END), 0) as cash_sales"),
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total WHEN payment_method = 'split' THEN COALESCE(card_amount, 0) ELSE 0 END), 0) as card_sales"),
        db.raw("COALESCE(SUM(COALESCE(discount_amount, 0) + COALESCE(global_discount, 0)), 0) as total_discounts"),
        db.raw("COALESCE(SUM(CASE WHEN print_status = 'pending_print' THEN 1 ELSE 0 END), 0) as pending_prints")
      )
      .first();

    const paymentSummary = await db('customer_transactions')
      .where('shift_id', shiftId)
      .andWhere('transaction_type', 'payment')
      .select(
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash_payments"),
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END), 0) as card_payments")
      )
      .first();

    const cashSales = Number(salesSummary.cash_sales) + Number(paymentSummary.cash_payments);
    const cardSales = Number(salesSummary.card_sales) + Number(paymentSummary.card_payments);
    const totalDiscounts = Number(salesSummary.total_discounts);
    const expectedCash = Number(shift.starting_cash) + cashSales;

    return {
      shift_id: shiftId,
      starting_cash: Number(shift.starting_cash),
      cash_sales: cashSales,
      card_sales: cardSales,
      total_discounts: totalDiscounts,
      expected_cash: expectedCash,
      transaction_count: Number(salesSummary.transaction_count),
      pending_prints: Number(salesSummary.pending_prints)
    };
  }

  /**
   * Atomic Checkout Transaction
   */
  async checkout(payload: CheckoutPayload, cashierId: number, bypassInventoryCheck: boolean = false) {
    if (!payload.shift_id) {
      throw new Error('Active shift is required for checkout.');
    }

    try {
      return await db.transaction(async (trx) => {
        // 1. Acquire transaction-level advisory lock on the hashed idempotency key to strictly serialize concurrent checkout requests
        const hashQuery = await trx.raw("SELECT hashtext(?) as hash", [payload.idempotency_key]);
        const lockHash = hashQuery.rows[0].hash;
        await trx.raw("SELECT pg_advisory_xact_lock(?)", [lockHash]);

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

      // 2. Generate Receipt Number using sequence
      const { rows } = await trx.raw(`SELECT nextval('receipt_number_seq') as seq`);
      const seq = String(rows[0].seq).padStart(5, '0');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const receiptNumber = `STR01-REG${String(payload.register_id || 1).padStart(2, '0')}-${dateStr}-${seq}`;

      // 3. Create Sale Record
      const changeGiven = payload.cash_received ? Math.max(0, payload.cash_received - total) : 0;
      
      const [sale] = await trx('sales').insert({
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
        cash_amount: payload.payment_method === 'split' ? (payload.cash_amount || null) : null,
        card_amount: payload.payment_method === 'split' ? (payload.card_amount || null) : null,
        change_given: changeGiven,
        status: 'completed',
        print_status: 'pending_print',
        print_count: 0,
        idempotency_key: payload.idempotency_key,
        customer_id: payload.customer_id || null
      }).returning('*');

      if (payload.payment_method === 'debt' && payload.customer_id) {
        const customer = await trx('customers').where('id', payload.customer_id).whereNull('deleted_at').first();
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
          created_at: trx.fn.now()
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

        const lineTotal = (item.unit_price * item.quantity) - item.discount;

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
            `Insufficient inventory or inventory record missing for product ID ${item.product_id}. Checkout aborted.`
          );
        }
      }

        const insertedItems = await trx('sale_items').insert(saleItemsToInsert).returning('*');

        return { ...sale, items: insertedItems };
      });
    } catch (error: any) {
      if (error.code === '23505' && error.message?.includes('idempotency_key')) {
        // Race condition: another request just inserted this idempotency key.
        const existing = await db('sales').where('idempotency_key', payload.idempotency_key).first();
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
      return { synced: 0, syncedIds: [] as string[], failed: [] as { id: string; error: string }[] };
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
      return { synced: 0, syncedIds: [] as string[], failed: [] as { id: string; error: string }[] };
    }

    // 2. Sort sales by their minimum product_id to maintain consistent lock ordering
    const sortedSales = [...salesToProcess].sort((a, b) => {
      const aMin = a.items.length > 0 ? Math.min(...a.items.map(i => i.product_id)) : 0;
      const bMin = b.items.length > 0 ? Math.min(...b.items.map(i => i.product_id)) : 0;
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
          error: error.message || 'Unknown sync error'
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
        updated_at: db.fn.now()
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
          updated_at: db.fn.now()
        })
        .returning('*');

      if (!sale) throw new Error('Sale not found');

      await trx('manager_overrides').insert({
        manager_id: managerId,
        cashier_id: sale.cashier_id,
        action_type: 'reprint_receipt',
        reference_id: saleId,
        details: `Reprint #${sale.print_count} for receipt ${sale.receipt_number}`
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
      const escapedQuery = query
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      q.where('receipt_number', 'ilike', `%${escapedQuery}%`);
    }

    const sales = await q;

    if (sales.length > 0) {
      const saleIds = sales.map(s => s.id);
      const items = await db('sale_items').whereIn('sale_id', saleIds);
      
      const itemsBySaleId = items.reduce((acc, item) => {
        if (!acc[item.sale_id]) acc[item.sale_id] = [];
        acc[item.sale_id].push(item);
        return acc;
      }, {} as Record<string, any[]>);

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
}

export const posRepository = new POSRepository();
