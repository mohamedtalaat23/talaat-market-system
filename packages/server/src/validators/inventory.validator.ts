import { z } from 'zod';

/**
 * Zod validation schemas for inventory requests.
 */

export const updateInventorySchema = z.object({
  quantity: z.coerce.number().nonnegative('Quantity must be non-negative'),
});

export const adjustInventorySchema = z
  .object({
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

/**
 * Product batch / expiration tracking.
 *
 * `expiration_date` is stored as a PostgreSQL `date`, so it is validated as a
 * real calendar date in ISO form (YYYY-MM-DD) instead of relying on the driver.
 */
function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export const createBatchSchema = z.object({
  product_id: z.coerce.number().int().positive('Invalid product ID'),
  batch_number: z
    .string()
    .trim()
    .min(1, 'Batch number is required')
    .max(100, 'Batch number must be 100 characters or fewer'),
  expiration_date: z
    .string()
    .trim()
    .refine(isIsoCalendarDate, 'Expiration date must be a valid date in YYYY-MM-DD format'),
  quantity: z.coerce.number().positive('Batch quantity must be greater than zero'),
  cost_price: z.coerce.number().nonnegative('Cost price cannot be negative').optional(),
});

export const batchQuerySchema = z.object({
  product_id: z.coerce.number().int().positive('Invalid product ID').optional(),
  days_to_expiry: z.coerce
    .number()
    .int()
    .min(0, 'days_to_expiry cannot be negative')
    .max(3650, 'days_to_expiry is unrealistically large')
    .optional(),
});

export const productIdParamSchema = z.object({
  productId: z.coerce.number().int().positive('Invalid product ID'),
});
