import { db } from '../config/database';

export interface ReportFilters {
  page?: number;
  limit?: number;
  cashier_id?: number;
  date_from?: string;
  date_to?: string;
}

export class ReportsRepository {
  /**
   * Endpoint 1: GET /reports/shifts
   */
  async getShifts(filters: ReportFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 15;
    const offset = (page - 1) * limit;

    const query = db('cashier_shifts as cs')
      .join('employees as e', 'e.id', 'cs.employee_id')
      .leftJoin('registers as r', 'r.id', 'cs.register_id')
      .where('cs.status', 'closed')
      .select(
        'cs.id',
        'e.full_name as cashier_name',
        'r.name as register_name',
        'cs.start_time',
        'cs.end_time',
        'cs.starting_cash',
        'cs.expected_cash',
        'cs.ending_cash',
        'cs.notes',
        db.raw('CAST(cs.ending_cash AS NUMERIC) - CAST(cs.expected_cash AS NUMERIC) as variance'),
      );

    if (filters.cashier_id) {
      query.where('cs.employee_id', filters.cashier_id);
    }

    const [countResult] = await query.clone().clearSelect().count({ total: 'cs.id' });
    const total = Number(countResult?.total || 0);

    const shifts = await query.orderBy('cs.end_time', 'desc').limit(limit).offset(offset);

    // Ensure numeric fields are returned as numbers
    const items = shifts.map((s) => ({
      ...s,
      starting_cash: Number(s.starting_cash),
      expected_cash: s.expected_cash !== null ? Number(s.expected_cash) : null,
      ending_cash: s.ending_cash !== null ? Number(s.ending_cash) : null,
      variance: s.variance !== null ? Number(s.variance) : null,
    }));

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Endpoint 2: GET /reports/shifts/:id
   * Supports transaction pagination via txPage/txLimit parameters.
   * summary.transaction_count reflects the total shift transactions from the DB
   * aggregate query, NOT the current page length, so the title "Transactions (N)"
   * always shows the correct full count regardless of which page is loaded.
   */
  async getShiftDetail(id: number, txPage: number = 1, txLimit: number = 100) {
    const safeTxLimit = Math.min(txLimit, 200);
    const txOffset = (txPage - 1) * safeTxLimit;

    const shift = await db('cashier_shifts as cs')
      .join('employees as e', 'e.id', 'cs.employee_id')
      .leftJoin('registers as r', 'r.id', 'cs.register_id')
      .where('cs.id', id)
      .where('cs.status', 'closed')
      .select(
        'cs.*',
        'e.full_name as cashier_name',
        'r.name as register_name',
        db.raw('CAST(cs.ending_cash AS NUMERIC) - CAST(cs.expected_cash AS NUMERIC) as variance'),
      )
      .first();

    if (!shift) return null;

    shift.starting_cash = Number(shift.starting_cash);
    shift.expected_cash = shift.expected_cash !== null ? Number(shift.expected_cash) : null;
    shift.ending_cash = shift.ending_cash !== null ? Number(shift.ending_cash) : null;
    shift.variance = shift.variance !== null ? Number(shift.variance) : null;

    // Fetch total transaction count for this shift (for the title/summary).
    // This count comes from the aggregate query below, NOT from transactions.length,
    // so it remains accurate across pages.
    const [transactionsRaw, txCountResult] = await Promise.all([
      db('sales')
        .join('employees', 'employees.id', 'sales.cashier_id')
        .where('sales.shift_id', id)
        .select(
          'sales.id',
          'sales.receipt_number',
          'sales.total',
          'sales.payment_method',
          'sales.discount_amount',
          'sales.global_discount',
          'sales.cash_received',
          'sales.cash_amount',
          'sales.card_amount',
          'sales.change_given',
          'sales.status',
          'sales.print_count',
          'sales.created_at',
          'employees.full_name as cashier_name',
        )
        .orderBy('sales.created_at', 'desc')
        .limit(safeTxLimit)
        .offset(txOffset),
      db('sales').where('shift_id', id).count({ count: 'id' }).first(),
    ]);

    const txTotal = Number(txCountResult?.count ?? 0);

    const transactions = transactionsRaw.map((t) => ({
      ...t,
      total: Number(t.total),
      discount_amount: Number(t.discount_amount),
      global_discount: Number(t.global_discount),
      cash_received: t.cash_received !== null ? Number(t.cash_received) : null,
      cash_amount: t.cash_amount !== null ? Number(t.cash_amount) : null,
      card_amount: t.card_amount !== null ? Number(t.card_amount) : null,
      change_given: Number(t.change_given),
    }));

    const overrides = await db('manager_overrides as mo')
      .join('employees as m', 'm.id', 'mo.manager_id')
      .where('mo.cashier_id', shift.employee_id)
      .whereBetween('mo.created_at', [shift.start_time, shift.end_time || new Date()])
      .select(
        'mo.id',
        'mo.action_type',
        'mo.reference_id',
        'mo.details',
        'm.full_name as manager_name',
        'mo.created_at',
      )
      .orderBy('mo.created_at', 'desc');

    const salesSummary = await db('sales')
      .where('shift_id', id)
      .andWhere('status', '!=', 'voided')
      .select(
        db.raw('COALESCE(SUM(total), 0) as total_revenue'),
        db.raw(
          'COALESCE(SUM(COALESCE(discount_amount, 0) + COALESCE(global_discount, 0)), 0) as total_discounts',
        ),
        db.raw(
          "COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total WHEN payment_method = 'split' THEN COALESCE(cash_amount, 0) ELSE 0 END), 0) as cash_sales_total",
        ),
        db.raw(
          "COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total WHEN payment_method = 'split' THEN COALESCE(card_amount, 0) ELSE 0 END), 0) as card_sales_total",
        ),
      )
      .first();

    const paymentSummary = await db('customer_transactions')
      .where('shift_id', id)
      .andWhere('transaction_type', 'payment')
      .select(
        db.raw('COALESCE(SUM(amount), 0) as payment_amount'),
        db.raw(
          "COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash_payments",
        ),
        db.raw(
          "COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END), 0) as card_payments",
        ),
      )
      .first();

    const totalRevenue = Number(salesSummary.total_revenue) + Number(paymentSummary.payment_amount);
    const totalDiscounts = Number(salesSummary.total_discounts);
    const cashSalesTotal =
      Number(salesSummary.cash_sales_total) + Number(paymentSummary.cash_payments);
    const cardSalesTotal =
      Number(salesSummary.card_sales_total) + Number(paymentSummary.card_payments);

    return {
      shift,
      transactions,
      transactions_meta: {
        total: txTotal,
        page: txPage,
        limit: safeTxLimit,
        totalPages: Math.ceil(txTotal / safeTxLimit),
      },
      overrides,
      summary: {
        // NOTE: transaction_count is the full shift total from the DB aggregate,
        // not transactions.length (which is only the current page).
        transaction_count: txTotal,
        total_revenue: totalRevenue,
        total_discounts: totalDiscounts,
        cash_sales_total: cashSalesTotal,
        card_sales_total: cardSalesTotal,
      },
    };
  }

  /**
   * Endpoint 3: GET /reports/weekly
   */
  async getWeeklyReport(weekStart: string, weekEnd: string) {
    const rawSales = await db('sales')
      .whereBetween('created_at', [weekStart, weekEnd])
      .where('status', '!=', 'voided')
      .select(
        db.raw('DATE(created_at) as sale_date'),
        db.raw('COUNT(id) as tx_count'),
        db.raw('COALESCE(SUM(total), 0) as total_rev'),
        db.raw('COALESCE(SUM(discount_amount + global_discount), 0) as total_disc'),
      )
      .groupByRaw('DATE(created_at)');

    const salesByDate: Record<string, any> = {};
    for (const row of rawSales) {
      // row.sale_date can be a Date object in pg
      const dateStr =
        typeof row.sale_date === 'string'
          ? row.sale_date.substring(0, 10)
          : row.sale_date.toISOString().substring(0, 10);
      salesByDate[dateStr] = {
        tx_count: Number(row.tx_count),
        total_rev: Number(row.total_rev),
        total_disc: Number(row.total_disc),
      };
    }

    const days = [];
    let weekTx = 0;
    let weekRev = 0;
    let weekDisc = 0;

    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().substring(0, 10);

      const dayData = salesByDate[dateStr] || { tx_count: 0, total_rev: 0, total_disc: 0 };
      const net = dayData.total_rev - dayData.total_disc;

      days.push({
        date: dateStr,
        transaction_count: dayData.tx_count,
        total_revenue: dayData.total_rev,
        total_discounts: dayData.total_disc,
        net_revenue: net,
      });

      weekTx += dayData.tx_count;
      weekRev += dayData.total_rev;
      weekDisc += dayData.total_disc;
    }

    const topProductsRaw = await db('sale_items as si')
      .join('sales as s', 's.id', 'si.sale_id')
      .join('products as p', 'p.id', 'si.product_id')
      .whereBetween('s.created_at', [weekStart, weekEnd])
      .where('s.status', '!=', 'voided')
      .select(
        'p.name as product_name',
        db.raw('SUM(si.quantity) as total_quantity_sold'),
        db.raw('COALESCE(SUM(si.line_total), 0) as total_revenue'),
      )
      .groupBy('p.name')
      .orderBy('total_quantity_sold', 'desc')
      .limit(10);

    const top_products = topProductsRaw.map((p) => ({
      product_name: p.product_name,
      total_quantity_sold: Number(p.total_quantity_sold),
      total_revenue: Number(p.total_revenue),
    }));

    return {
      days,
      totals: {
        transaction_count: weekTx,
        total_revenue: weekRev,
        total_discounts: weekDisc,
        net_revenue: weekRev - weekDisc,
      },
      top_products,
    };
  }

  /**
   * Endpoint 4: GET /reports/overrides
   */
  async getOverrides(filters: ReportFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const query = db('manager_overrides as mo')
      .join('employees as m', 'm.id', 'mo.manager_id')
      .join('employees as c', 'c.id', 'mo.cashier_id')
      .select(
        'mo.id',
        'mo.action_type',
        'mo.reference_id',
        'mo.details',
        'mo.created_at',
        'm.full_name as manager_name',
        'c.full_name as cashier_name',
      );

    if (filters.date_from) {
      query.where('mo.created_at', '>=', filters.date_from);
    }
    if (filters.date_to) {
      query.where('mo.created_at', '<=', filters.date_to);
    }

    const [countResult] = await query.clone().clearSelect().count({ total: 'mo.id' });
    const total = Number(countResult?.total || 0);

    const items = await query.orderBy('mo.created_at', 'desc').limit(limit).offset(offset);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}

export const reportsRepository = new ReportsRepository();
