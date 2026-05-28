import { z } from 'zod';

/**
 * Zod validation schemas for product requests.
 */

export const createProductSchema = z.object({
  barcode: z.string().trim().max(50).nullable().optional(),
  name: z.string().trim().min(1, 'Product name is required').max(255),
  name_ar: z.string().trim().max(255).nullable().optional(),
  description: z.string().trim().nullable().optional(),
  category_id: z.number().int().positive().nullable().optional(),
  supplier_id: z.number().int().positive('Supplier ID must be positive').nullable().optional(),
  unit: z.string().trim().max(50).default('pcs'),
  cost_price: z.coerce.number().nonnegative('Cost price must be non-negative'),
  selling_price: z.coerce.number().nonnegative('Selling price must be non-negative'),
  min_stock_level: z.coerce.number().nonnegative('Min stock level must be non-negative').default(0),
  max_stock_level: z.coerce.number().nonnegative('Max stock level must be non-negative').default(0),
  is_active: z.boolean().default(true),
  initial_quantity: z.coerce.number().nonnegative('Initial quantity must be non-negative').default(0),
});

export const updateProductSchema = z.object({
  barcode: z.string().trim().max(50).nullable().optional(),
  name: z.string().trim().min(1, 'Product name is required').max(255).optional(),
  name_ar: z.string().trim().max(255).nullable().optional(),
  description: z.string().trim().nullable().optional(),
  category_id: z.number().int().positive().nullable().optional(),
  supplier_id: z.number().int().positive('Supplier ID must be positive').nullable().optional(),
  unit: z.string().trim().max(50).optional(),
  cost_price: z.coerce.number().nonnegative('Cost price must be non-negative').optional(),
  selling_price: z.coerce.number().nonnegative('Selling price must be non-negative').optional(),
  min_stock_level: z.coerce.number().nonnegative('Min stock level must be non-negative').optional(),
  max_stock_level: z.coerce.number().nonnegative('Max stock level must be non-negative').optional(),
  is_active: z.boolean().optional(),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  is_active: z.coerce
    .string()
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z.string().trim().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const productIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid product ID'),
});

export const productBarcodeParamSchema = z.object({
  code: z.string().trim().min(1, 'Barcode is required').max(50),
});
