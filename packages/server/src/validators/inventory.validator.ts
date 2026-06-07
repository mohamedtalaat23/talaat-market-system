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
})
.superRefine((data, ctx) => {
  if (data.quantity_change === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Quantity change cannot be zero',
      path: ['quantity_change'],
    });
    return;
  }

  if (
    ['stock_removal', 'damaged', 'expired'].includes(data.adjustment_type) &&
    data.quantity_change > 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${data.adjustment_type} must have a negative quantity change`,
      path: ['quantity_change'],
    });
  } else if (data.adjustment_type === 'stock_addition' && data.quantity_change < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'stock_addition must have a positive quantity change',
      path: ['quantity_change'],
    });
  }
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

export const inventoryAdjustmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  product_id: z.coerce.number().int().positive().optional(),
});

export const productIdParamSchema = z.object({
  productId: z.coerce.number().int().positive('Invalid product ID'),
});
