import { db } from '../config/database';

export interface CheckoutItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount: number;
}

export interface CheckoutPayload {
  shift_id: number;
  register_id: number;
  payment_method: 'cash' | 'card' | 'split' | 'debt';
  cash_received?: number | undefined;
  cash_amount?: number | undefined;
  card_amount?: number | undefined;
  idempotency_key: string;
  global_discount?: number | undefined;
  customer_id?: number | undefined;
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

    const sales = await db('sales')
      .where('shift_id', shiftId)
      .andWhere('status', 'completed');

    let cashSales = 0;
    let cardSales = 0;
    let totalDiscounts = 0;
    let pendingPrints = 0;

    for (const sale of sales) {
      if (sale.payment_method === 'cash') {
        cashSales += Number(sale.total);
      } else if (sale.payment_method === 'card') {
        cardSales += Number(sale.total);
      } else if (sale.payment_method === 'split') {
        cashSales += Number(sale.cash_amount || 0);
        cardSales += Number(sale.card_amount || 0);
      }
      totalDiscounts += Number(sale.discount_amount) + Number(sale.global_discount);
      
      if (sale.print_status === 'pending_print') {
        pendingPrints++;
      }
    }

    // Query customer payments associated with this active shift to balance cash count
    const customerPayments = await db('customer_transactions')
      .where('shift_id', shiftId)
      .andWhere('transaction_type', 'payment');

    for (const payment of customerPayments) {
      if (payment.payment_method === 'cash') {
        cashSales += Number(payment.amount);
      } else if (payment.payment_method === 'card') {
        cardSales += Number(payment.amount);
      }
    }

    const expectedCash = Number(shift.starting_cash) + cashSales;

    return {
      shift_id: shiftId,
      starting_cash: Number(shift.starting_cash),
      cash_sales: cashSales,
      card_sales: cardSales,
      total_discounts: totalDiscounts,
      expected_cash: expectedCash,
      transaction_count: sales.length,
      pending_prints: pendingPrints
    };
  }

  /**
   * Atomic Checkout Transaction
   */
  async checkout(payload: CheckoutPayload, cashierId: number) {
    if (!payload.shift_id) {
      throw new Error('Active shift is required for checkout.');
    }

    // Return early if idempotency_key already exists to prevent duplicates
    const existing = await db('sales').where('idempotency_key', payload.idempotency_key).first();
    if (existing) {
      const existingItems = await db('sale_items').where('sale_id', existing.id);
      return { ...existing, items: existingItems }; // Already processed
    }

    return await db.transaction(async (trx) => {
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
      const taxAmount = 0; // Assuming 0 for now
      const total = subtotal - discountAmount - globalDiscount + taxAmount;

      // 2. Generate Receipt Number using sequence
      const { rows } = await trx.raw(`SELECT nextval('receipt_number_seq') as seq`);
      const seq = String(rows[0].seq).padStart(5, '0');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const receiptNumber = `STR01-REG${String(payload.register_id || 1).padStart(2, '0')}-${dateStr}-${seq}`;

      // 3. Create Sale Record
      const changeGiven = payload.cash_received ? Math.max(0, payload.cash_received - total) : 0;
      
      const [sale] = await trx('sales').insert({
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
        print_status: 'pending_print', // Decoupled from physical printing
        print_count: 0,
        idempotency_key: payload.idempotency_key,
        customer_id: payload.customer_id || null
      }).returning('*');

      // If customer is buying on credit (debt), adjust their balance and insert ledger record
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
      const productIds = payload.items.map((item) => item.product_id);
      const products = await trx('products')
        .whereIn('id', productIds)
        .select('id', 'cost_price', 'name', 'barcode');

      const productMap = new Map(products.map((p) => [p.id, p]));

      const saleItemsToInsert = [];

      for (const item of payload.items) {
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

        const [inv] = await trx('inventory')
          .where('product_id', item.product_id)
          .decrement('quantity', item.quantity)
          .returning('quantity');

        if (!inv || Number(inv.quantity) < 0) {
          throw new Error(`Insufficient inventory for product ID ${item.product_id}. Checkout aborted.`);
        }
      }

      const insertedItems = await trx('sale_items').insert(saleItemsToInsert).returning('*');

      return { ...sale, items: insertedItems };
    });
  }

  /**
   * Mark receipt as printed successfully
   */
  async markReceiptPrinted(saleId: number) {
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
   * Reprint an old receipt (manager override logic handled in controller)
   */
  async reprintReceipt(saleId: number, managerId: number) {
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
        reference_id: String(saleId),
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
      q.where('receipt_number', 'ilike', `%${query}%`);
    }

    const sales = await q;

    // Fetch items for the matching sales
    if (sales.length > 0) {
      const saleIds = sales.map(s => s.id);
      const items = await db('sale_items').whereIn('sale_id', saleIds);
      
      const itemsBySaleId = items.reduce((acc, item) => {
        if (!acc[item.sale_id]) acc[item.sale_id] = [];
        acc[item.sale_id].push(item);
        return acc;
      }, {} as Record<number, any[]>);

      for (const sale of sales) {
        sale.items = itemsBySaleId[sale.id] || [];
      }
    }

    return sales;
  }

  /**
   * Get a single receipt by ID with all details
   */
  async getReceiptById(saleId: number) {
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
