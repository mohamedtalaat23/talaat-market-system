import { z } from 'zod';

/**
 * Zod validation schemas for inventory requests.
 */

export const updateInventorySchema = z.object({
  quantity: z.coerce.number().nonnegative('Quantity must be non-negative'),
});

export const adjustInventorySchema = z.object({
  product_id: z.number().int().positive('Invalid product ID'),
  adjustment_type: z.enum(
    ['stock_addition', 'stock_removal', 'damaged', 'expired', 'manual_correction'],
    {
      errorMap: () => ({ message: 'Invalid adjustment type' }),
    },
  ),
  quantity_change: z.coerce.number({
    invalid_type_error: 'Quantity change must be a number',
  }),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const inventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  low_stock_only: z.coerce
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

export const productIdParamSchema = z.object({
  productId: z.coerce.number().int().positive('Invalid product ID'),
});
