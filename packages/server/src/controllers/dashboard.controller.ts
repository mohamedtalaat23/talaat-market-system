import type { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { HTTP_STATUS } from '../config/constants';

export async function getDashboardStats(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const [productsRes, lowStockRes, shiftsRes] = await Promise.all([
      db('products').whereNull('deleted_at').count({ count: 'id' }).first(),
      db('inventory')
        .join('products', 'products.id', 'inventory.product_id')
        .whereNull('products.deleted_at')
        .whereRaw('inventory.quantity <= products.min_stock_level')
        .count({ count: 'inventory.id' })
        .first(),
      db('cashier_shifts').where('status', 'open').count({ count: 'id' }).first(),
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        productsCount: Number(productsRes?.count || 0),
        lowStockCount: Number(lowStockRes?.count || 0),
        employeesCount: Number(shiftsRes?.count || 0),
      },
    });
  } catch (error) {
    next(error);
  }
}
