import { db } from '../config/database';
import type { Knex } from 'knex';

export interface InventoryItem {
  id: number;
  product_id: number;
  quantity: number;
  reserved_quantity: number;
  last_counted_at: Date | null;
  updated_at: Date;
  // Joined fields
  product_barcode: string | null;
  product_name: string;
  product_name_ar: string | null;
  product_unit: string;
  product_min_stock_level: number;
  product_selling_price: number;
  category_name?: string | null;
}

export interface InventoryFilters {
  page: number;
  limit: number;
  search?: string;
  category_id?: number;
  low_stock_only?: boolean;
}

export interface LogAdjustmentInput {
  product_id: number;
  adjustment_type: 'stock_addition' | 'stock_removal' | 'damaged' | 'expired' | 'manual_correction';
  quantity_change: number;
  old_quantity: number;
  new_quantity: number;
  notes?: string | null;
  created_by?: number | null;
}

export class InventoryRepository {
  private get baseQuery() {
    return db('inventory')
      .join('products', 'products.id', 'inventory.product_id')
      .leftJoin('categories', 'categories.id', 'products.category_id')
      .select(
        'inventory.*',
        'products.barcode as product_barcode',
        'products.name as product_name',
        'products.name_ar as product_name_ar',
        'products.unit as product_unit',
        'products.min_stock_level as product_min_stock_level',
        'products.selling_price as product_selling_price',
        'categories.name as category_name'
      )
      .whereNull('products.deleted_at'); // Filter out soft-deleted products
  }

  /**
   * Find inventory list with filters, search, and pagination.
   */
  async findAll(filters: InventoryFilters): Promise<InventoryItem[]> {
    const query = this.baseQuery;

    if (filters.category_id) {
      query.where('products.category_id', filters.category_id);
    }

    if (filters.low_stock_only) {
      query.whereRaw('inventory.quantity <= products.min_stock_level');
    }

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      query.where((builder) => {
        builder
          .where('products.name', 'ILIKE', searchPattern)
          .orWhere('products.name_ar', 'ILIKE', searchPattern)
          .orWhere('products.barcode', 'ILIKE', searchPattern);
      });
    }

    // Default sorting by product name
    query.orderBy('products.name', 'asc');

    const offset = (filters.page - 1) * filters.limit;
    query.limit(filters.limit).offset(offset);

    const rows = await query;
    return rows.map(this.mapInventoryRow);
  }

  /**
   * Count total inventory records matching filters.
   */
  async countAll(filters: Omit<InventoryFilters, 'page' | 'limit'>): Promise<number> {
    const query = db('inventory')
      .join('products', 'products.id', 'inventory.product_id')
      .whereNull('products.deleted_at')
      .count({ count: 'inventory.id' });

    if (filters.category_id) {
      query.where('products.category_id', filters.category_id);
    }

    if (filters.low_stock_only) {
      query.whereRaw('inventory.quantity <= products.min_stock_level');
    }

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      query.where((builder) => {
        builder
          .where('products.name', 'ILIKE', searchPattern)
          .orWhere('products.name_ar', 'ILIKE', searchPattern)
          .orWhere('products.barcode', 'ILIKE', searchPattern);
      });
    }

    const result = await query.first();
    return Number(result?.count ?? 0);
  }

  /**
   * Find inventory by product ID.
   */
  async findByProductId(productId: number): Promise<InventoryItem | null> {
    const row = await this.baseQuery.where('inventory.product_id', productId).first();
    if (!row) return null;
    return this.mapInventoryRow(row);
  }

  /**
   * Update stock quantity (direct set) inside transaction.
   */
  async updateStock(
    productId: number,
    quantity: number,
    trx: Knex.Transaction
  ): Promise<void> {
    await trx('inventory')
      .where('product_id', productId)
      .update({
        quantity,
        last_counted_at: new Date(),
        updated_at: new Date(),
      });
  }

  /**
   * Log inventory adjustment in history table inside transaction.
   */
  async logAdjustment(
    data: LogAdjustmentInput,
    trx: Knex.Transaction
  ): Promise<void> {
    await trx('inventory_adjustments').insert(data);
  }

  /**
   * Helper to map row values to correct JavaScript types.
   */
  private mapInventoryRow(row: any): InventoryItem {
    return {
      ...row,
      quantity: Number(row.quantity),
      reserved_quantity: Number(row.reserved_quantity),
      product_min_stock_level: Number(row.product_min_stock_level),
      product_selling_price: Number(row.product_selling_price),
    };
  }
}

// Single instance export (minimalist/no DI)
export const inventoryRepository = new InventoryRepository();
