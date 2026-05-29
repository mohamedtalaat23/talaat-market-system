import { db } from '../config/database';
import type { Knex } from 'knex';

export interface Product {
  id: number;
  barcode: string | null;
  name: string;
  name_ar: string | null;
  description: string | null;
  category_id: number | null;
  unit: string;
  cost_price: number;
  selling_price: number;
  min_stock_level: number;
  max_stock_level: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  category_name?: string | null;
  category_name_ar?: string | null;
  inventory_quantity?: number;
  inventory_reserved_quantity?: number;
  supplier_id?: number | null;
  supplier_name?: string | null;
  supplier_code?: string | null;
}

export interface CreateProductInput {
  barcode?: string | null | undefined;
  name: string;
  name_ar?: string | null | undefined;
  description?: string | null | undefined;
  category_id?: number | null | undefined;
  unit?: string | undefined;
  cost_price: number;
  selling_price: number;
  min_stock_level?: number | undefined;
  max_stock_level?: number | undefined;
  is_active?: boolean | undefined;
  supplier_id?: number | null | undefined;
}

export interface UpdateProductInput {
  barcode?: string | null | undefined;
  name?: string | undefined;
  name_ar?: string | null | undefined;
  description?: string | null | undefined;
  category_id?: number | null | undefined;
  unit?: string | undefined;
  cost_price?: number | undefined;
  selling_price?: number | undefined;
  min_stock_level?: number | undefined;
  max_stock_level?: number | undefined;
  is_active?: boolean | undefined;
  supplier_id?: number | null | undefined;
}

export interface ProductFilters {
  page: number;
  limit: number;
  search?: string;
  category_id?: number;
  is_active?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export class ProductRepository {
  private get baseQuery() {
    return db('products')
      .leftJoin('categories', 'categories.id', 'products.category_id')
      .leftJoin('inventory', 'inventory.product_id', 'products.id')
      .leftJoin('suppliers', 'suppliers.id', 'products.supplier_id')
      .select(
        'products.*',
        'categories.name as category_name',
        'categories.name_ar as category_name_ar',
        'inventory.quantity as inventory_quantity',
        'inventory.reserved_quantity as inventory_reserved_quantity',
        'suppliers.name as supplier_name',
        'suppliers.supplier_code as supplier_code'
      )
      .whereNull('products.deleted_at'); // Filter out soft-deleted products
  }

  /**
   * Find products with filtering, search, and pagination.
   */
  async findAll(filters: ProductFilters): Promise<Product[]> {
    const query = this.baseQuery;

    // Filter by Category
    if (filters.category_id) {
      query.where('products.category_id', filters.category_id);
    }

    // Filter by Active status
    if (filters.is_active !== undefined) {
      query.where('products.is_active', filters.is_active);
    }

    // Search query (name, name_ar, barcode)
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      query.where((builder) => {
        builder
          .where('products.name', 'ILIKE', searchPattern)
          .orWhere('products.name_ar', 'ILIKE', searchPattern)
          .orWhere('products.barcode', 'ILIKE', searchPattern);
      });
    }

    // Sorting (with column whitelist to prevent SQL injection)
    const allowedSortFields = ['id', 'name', 'cost_price', 'selling_price', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(filters.sortBy)
      ? `products.${filters.sortBy}`
      : 'products.created_at';

    query.orderBy(sortField, filters.sortOrder);

    // Pagination
    const offset = (filters.page - 1) * filters.limit;
    query.limit(filters.limit).offset(offset);

    const rows = await query;

    // Convert decimal string fields to numbers (Knex pg driver returns numeric/decimal as string to prevent precision loss)
    return rows.map(this.mapProductRow);
  }

  /**
   * Count total products matching filters (ignoring limit/offset).
   */
  async countAll(filters: Omit<ProductFilters, 'page' | 'limit' | 'sortBy' | 'sortOrder'>): Promise<number> {
    const query = db('products')
      .whereNull('products.deleted_at')
      .count({ count: 'products.id' });

    if (filters.category_id) {
      query.where('products.category_id', filters.category_id);
    }

    if (filters.is_active !== undefined) {
      query.where('products.is_active', filters.is_active);
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
   * Find product by ID.
   */
  async findById(id: number, trx?: Knex.Transaction): Promise<Product | null> {
    let query = this.baseQuery.where('products.id', id);
    if (trx) {
      query = query.transacting(trx);
    }
    const row = await query.first();
    if (!row) return null;
    return this.mapProductRow(row);
  }

  /**
   * Find product by barcode.
   */
  async findByBarcode(barcode: string): Promise<Product | null> {
    const row = await this.baseQuery.where('products.barcode', barcode).first();
    if (!row) return null;
    return this.mapProductRow(row);
  }

  /**
   * Create a product record (can pass active transaction).
   */
  async create(data: CreateProductInput, trx?: Knex.Transaction): Promise<Product> {
    const queryBuilder = trx ? trx('products') : db('products');
    const [row] = await queryBuilder.insert(data).returning('*');
    return this.mapProductRow(row);
  }

  /**
   * Create inventory record (can pass active transaction).
   */
  async createInventory(
    product_id: number,
    quantity: number,
    trx?: Knex.Transaction
  ): Promise<void> {
    const queryBuilder = trx ? trx('inventory') : db('inventory');
    await queryBuilder.insert({
      product_id,
      quantity,
      reserved_quantity: 0.000,
      last_counted_at: new Date(),
    });
  }

  /**
   * Update a product record.
   */
  async update(id: number, data: UpdateProductInput, trx?: Knex.Transaction): Promise<Product> {
    const queryBuilder = trx ? trx('products') : db('products');
    const [row] = await queryBuilder.where('id', id).update(data).returning('*');
    return this.mapProductRow(row);
  }

  /**
   * Soft delete a product by setting deleted_at.
   */
  async softDelete(id: number, trx?: Knex.Transaction): Promise<void> {
    const queryBuilder = trx ? trx('products') : db('products');
    await queryBuilder
      .where('id', id)
      .update({
        deleted_at: new Date(),
        is_active: false, // Deactivate on deletion
      });
  }

  /**
   * Helper to map raw database row values to clean types (e.g. converting numeric strings to numbers).
   */
  private mapProductRow(row: any): Product {
    return {
      ...row,
      cost_price: Number(row.cost_price),
      selling_price: Number(row.selling_price),
      min_stock_level: Number(row.min_stock_level),
      max_stock_level: Number(row.max_stock_level),
      inventory_quantity: row.inventory_quantity !== null ? Number(row.inventory_quantity) : undefined,
      inventory_reserved_quantity: row.inventory_reserved_quantity !== null ? Number(row.inventory_reserved_quantity) : undefined,
    };
  }
}

// Single instance export for direct use (minimalist/no DI framework)
export const productRepository = new ProductRepository();
