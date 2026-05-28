import { db } from '../config/database';
import type { Knex } from 'knex';

export interface Supplier {
  id: number;
  supplier_code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: 'active' | 'inactive' | 'suspended';
  created_by: number | null;
  updated_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  // Joined fields
  active_catalog_count?: number;
}

export interface CreateSupplierInput {
  supplier_code?: string | null | undefined;
  name: string;
  contact_name?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  address?: string | null | undefined;
  notes?: string | null | undefined;
  status?: 'active' | 'inactive' | 'suspended' | undefined;
}

export interface UpdateSupplierInput {
  supplier_code?: string | undefined;
  name?: string | undefined;
  contact_name?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  address?: string | null | undefined;
  notes?: string | null | undefined;
  status?: 'active' | 'inactive' | 'suspended' | undefined;
}

export class SupplierRepository {
  /**
   * Find suppliers with filtering, pagination, and count of active catalog items.
   */
  async findAll(
    search?: string,
    page = 1,
    limit = 10
  ): Promise<{ data: Supplier[]; total: number }> {
    const offset = (page - 1) * limit;

    // Subquery to count active products per supplier
    const catalogCountSubquery = db('products')
      .whereNull('products.deleted_at')
      .where('products.is_active', true)
      .select('products.supplier_id')
      .count('products.id as active_count')
      .groupBy('products.supplier_id')
      .as('catalog_counts');

    let baseQuery = db('suppliers')
      .leftJoin(catalogCountSubquery, 'catalog_counts.supplier_id', 'suppliers.id')
      .whereNull('suppliers.deleted_at')
      .select(
        'suppliers.*',
        db.raw('COALESCE(catalog_counts.active_count, 0)::integer as active_catalog_count')
      );

    let countQuery = db('suppliers')
      .whereNull('deleted_at');

    if (search) {
      const cleanSearch = search.trim();
      const searchFilter = (builder: Knex.QueryBuilder) => {
        builder.where('suppliers.name', 'ilike', `%${cleanSearch}%`)
          .orWhere('suppliers.supplier_code', 'ilike', `%${cleanSearch}%`)
          .orWhere('suppliers.phone', 'like', `%${cleanSearch}%`)
          .orWhere('suppliers.contact_name', 'ilike', `%${cleanSearch}%`);
      };
      baseQuery = baseQuery.andWhere(searchFilter);
      countQuery = countQuery.andWhere(searchFilter);
    }

    const [totalRow] = await countQuery.count('id as total');
    const total = totalRow ? Number(totalRow.total) : 0;

    const data = await baseQuery
      .orderBy('suppliers.name', 'asc')
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  /**
   * Find supplier by ID.
   */
  async findById(id: number): Promise<Supplier | null> {
    const supplier = await db('suppliers')
      .where('id', id)
      .whereNull('deleted_at')
      .first();

    return supplier || null;
  }

  /**
   * Retrieve catalog products associated with this supplier.
   */
  async getSuppliedProducts(supplierId: number): Promise<any[]> {
    return db('products')
      .leftJoin('inventory', 'inventory.product_id', 'products.id')
      .select(
        'products.*',
        'inventory.quantity as inventory_quantity',
        'inventory.reserved_quantity as inventory_reserved_quantity'
      )
      .where('products.supplier_id', supplierId)
      .whereNull('products.deleted_at')
      .orderBy('products.name', 'asc');
  }

  /**
   * Register a new supplier.
   */
  async create(input: CreateSupplierInput, createdByUserId: number | null = null): Promise<Supplier> {
    return db.transaction(async (trx) => {
      // Auto-generate supplier code if not provided
      let supplierCode = input.supplier_code;
      if (!supplierCode) {
        // Safe sequential ID parsing
        const maxRow = await trx('suppliers').max('id as maxId').first();
        const nextId = (maxRow?.maxId ? Number(maxRow.maxId) : 0) + 1;
        supplierCode = `SUP-${String(nextId).padStart(4, '0')}`;
      }

      // Verify supplier code is unique
      const existing = await trx('suppliers').where('supplier_code', supplierCode).first();
      if (existing) {
        throw new Error(`Supplier code "${supplierCode}" is already in use.`);
      }

      const [row] = await trx('suppliers')
        .insert({
          supplier_code: supplierCode,
          name: input.name,
          contact_name: input.contact_name || null,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
          notes: input.notes || null,
          status: input.status || 'active',
          created_by: createdByUserId,
          updated_by: createdByUserId,
        })
        .returning('*');

      return row;
    });
  }

  /**
   * Update supplier details.
   */
  async update(id: number, input: UpdateSupplierInput, updatedByUserId: number | null = null): Promise<Supplier> {
    return db.transaction(async (trx) => {
      const [row] = await trx('suppliers')
        .where('id', id)
        .whereNull('deleted_at')
        .update({
          ...input,
          updated_by: updatedByUserId,
          updated_at: trx.fn.now(),
        })
        .returning('*');

      if (!row) {
        throw new Error(`Supplier with ID ${id} not found or deleted.`);
      }

      return row;
    });
  }

  /**
   * Soft delete supplier.
   */
  async softDelete(id: number): Promise<void> {
    const rowsAffected = await db('suppliers')
      .where('id', id)
      .update({
        deleted_at: db.fn.now(),
        status: 'inactive', // Deactivate on deletion
        updated_at: db.fn.now(),
      });

    if (rowsAffected === 0) {
      throw new Error(`Supplier with ID ${id} not found or already deleted.`);
    }
  }
}

export const supplierRepository = new SupplierRepository();
