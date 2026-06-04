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
        'categories.name as category_name',
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
  async updateStock(productId: number, quantity: number, trx: Knex.Transaction): Promise<void> {
    await trx('inventory').where('product_id', productId).update({
      quantity,
      last_counted_at: new Date(),
      updated_at: new Date(),
    });
  }

  /**
   * Log inventory adjustment in history table inside transaction.
   */
  async logAdjustment(data: LogAdjustmentInput, trx: Knex.Transaction): Promise<void> {
    await trx('inventory_adjustments').insert(data);
  }

  /**
   * Retrieve active adjustments logs with sorting and pagination.
   */
  async findAdjustments(filters: {
    page: number;
    limit: number;
    product_id?: number | undefined;
  }): Promise<InventoryAdjustment[]> {
    const query = db('inventory_adjustments')
      .join('products', 'products.id', 'inventory_adjustments.product_id')
      .leftJoin('employees', 'employees.id', 'inventory_adjustments.created_by')
      .select(
        'inventory_adjustments.*',
        'products.name as product_name',
        'products.barcode as product_barcode',
        'products.unit as product_unit',
        'employees.full_name as creator_name',
      );

    if (filters.product_id) {
      query.where('inventory_adjustments.product_id', filters.product_id);
    }

    query.orderBy('inventory_adjustments.created_at', 'desc');

    const offset = (filters.page - 1) * filters.limit;
    query.limit(filters.limit).offset(offset);

    const rows = await query;
    return rows.map((row) => ({
      ...row,
      quantity_change: Number(row.quantity_change),
      old_quantity: Number(row.old_quantity),
      new_quantity: Number(row.new_quantity),
    }));
  }

  /**
   * Count total adjustments matching filters.
   */
  async countAdjustments(filters: { product_id?: number | undefined }): Promise<number> {
    const query = db('inventory_adjustments').count({ count: 'id' });

    if (filters.product_id) {
      query.where('product_id', filters.product_id);
    }

    const result = await query.first();
    return Number(result?.count ?? 0);
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

export interface InventoryAdjustment {
  id: number;
  product_id: number;
  product_name: string;
  product_barcode: string | null;
  product_unit: string;
  adjustment_type: 'stock_addition' | 'stock_removal' | 'damaged' | 'expired' | 'manual_correction';
  quantity_change: number;
  old_quantity: number;
  new_quantity: number;
  notes: string | null;
  created_by: number | null;
  creator_name: string | null;
  created_at: Date;
}

// Single instance export (minimalist/no DI)
export const inventoryRepository = new InventoryRepository();
