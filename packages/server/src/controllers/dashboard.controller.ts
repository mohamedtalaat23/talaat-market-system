import type { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { HTTP_STATUS } from '../config/constants';

export async function getDashboardStats(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Today's date range in local time (start of today 00:00:00, exclusive end tomorrow 00:00:00)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      productsRes,
      lowStockRes,
      shiftsRes,
      todaySalesRes,
      todayRefundsRes,
      todayDrawerAdjustmentsRes,
      pendingPOsRes,
      unreconciledShiftsRes,
      failedPrintJobsRes,
      negativeInventoryRes
    ] = await Promise.all([
      db('products').whereNull('deleted_at').count({ count: 'id' }).first(),
      db('inventory')
        .join('products', 'products.id', 'inventory.product_id')
        .whereNull('products.deleted_at')
        .whereRaw('inventory.quantity <= products.min_stock_level')
        .count({ count: 'inventory.id' })
        .first(),
      db('cashier_shifts').where('status', 'open').count({ count: 'id' }).first(),
      // Today's completed and voided sales aggregates — single table scan over date range
      db('sales')
        .whereBetween('created_at', [todayStart, todayEnd])
        .select(
          db.raw('COALESCE(SUM(CASE WHEN status != \'voided\' THEN total ELSE 0 END), 0) as net_sales'),
          db.raw('COUNT(CASE WHEN status != \'voided\' THEN id ELSE NULL END) as transaction_count'),
          db.raw('COUNT(CASE WHEN status = \'voided\' THEN id ELSE NULL END) as void_count')
        )
        .first(),
      db('refunds').whereBetween('created_at', [todayStart, todayEnd]).count({ count: 'id' }).first(),
      db('cash_drawer_adjustments').whereBetween('created_at', [todayStart, todayEnd]).count({ count: 'id' }).first(),
      db('purchase_orders').whereIn('status', ['draft', 'ordered']).count({ count: 'id' }).first(),
      db('cashier_shifts')
        .where('status', 'closed')
        .whereRaw('ABS(CAST(COALESCE(ending_cash, 0) AS NUMERIC) - CAST(COALESCE(expected_cash, 0) AS NUMERIC)) > 0')
        .count({ count: 'id' })
        .first(),
      db('sales').where('print_status', 'pending_print').count({ count: 'id' }).first(),
      db('inventory').where('quantity', '<', 0).count({ count: 'id' }).first(),
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        productsCount: Number(productsRes?.count || 0),
        lowStockCount: Number(lowStockRes?.count || 0),
        employeesCount: Number(shiftsRes?.count || 0),
        todayNetSales: Number(todaySalesRes?.net_sales || 0),
        todayTransactionCount: Number(todaySalesRes?.transaction_count || 0),
        todayRefundsCount: Number(todayRefundsRes?.count || 0),
        todayVoidsCount: Number(todaySalesRes?.void_count || 0),
        todayDrawerAdjustmentsCount: Number(todayDrawerAdjustmentsRes?.count || 0),
        pendingPurchaseOrdersCount: Number(pendingPOsRes?.count || 0),
        unreconciledShiftsCount: Number(unreconciledShiftsRes?.count || 0),
        failedPrintJobsCount: Number(failedPrintJobsRes?.count || 0),
        negativeInventoryCount: Number(negativeInventoryRes?.count || 0),
      },
    });
  } catch (error) {
    next(error);
  }
}
