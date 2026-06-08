import { z } from 'zod';

export const reprintSchema = z.object({
  manager_pin: z.string().regex(/^\d{4,6}$/, 'PIN must be between 4 and 6 digits'),
});

export const checkoutSchema = z.object({
  id: z.string().uuid('Invalid receipt UUID').optional(),
  receipt_number: z.string().trim().optional(),
  created_at: z.string().optional(), // Allow ISO date string
  shift_id: z.number().int().positive('Shift ID is required'),
  register_id: z.number().int().positive('Register ID must be positive'),
  payment_method: z.enum(['cash', 'card', 'split', 'debt']),
  cash_received: z.coerce.number().nonnegative('Cash received must be non-negative').optional(),
  cash_amount: z.coerce.number().nonnegative('Cash amount must be non-negative').optional(),
  card_amount: z.coerce.number().nonnegative('Card amount must be non-negative').optional(),
  idempotency_key: z.string().trim().min(1, 'Idempotency key is required'),
  global_discount: z.coerce.number().nonnegative('Global discount must be non-negative').optional(),
  customer_id: z.number().int().positive('Customer ID must be positive').optional(),
  manager_pin: z
    .string()
    .regex(/^\d{4,6}$/, 'PIN must be between 4 and 6 digits')
    .optional(),
  manager_id: z.number().int().positive('Manager ID must be positive').optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive('Product ID must be positive'),
        quantity: z.coerce.number().positive('Quantity must be positive'),
        unit_price: z.coerce.number().nonnegative('Unit price must be non-negative'),
        discount: z.coerce.number().nonnegative('Discount must be non-negative'),
      }),
    )
    .min(1, 'At least one item is required in the cart'),
});

export const syncOfflineSchema = z.object({
  transactions: z.array(checkoutSchema).min(1, 'Transactions array must not be empty'),
});

export const posIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid identifier ID'),
});

export const receiptIdParamSchema = z.object({
  id: z.string().uuid('Invalid receipt UUID'),
});

export const salesQuerySchema = z.object({
  q: z.string().trim().optional(),
});

/**
 * Validator for the lightweight POS product search endpoint (GET /pos/products/search).
 * Requires at least 2 characters to avoid trivially broad scans.
 * Server-side limit is capped at 50 to prevent oversized payloads.
 */
export const posProductSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Search query must be at least 2 characters').max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const openShiftSchema = z.object({
  starting_cash: z.coerce.number().nonnegative('Starting cash must be non-negative').default(0),
  register_id: z.coerce.number().int().positive('Register ID must be positive').default(1),
});

export const closeShiftSchema = z.object({
  shift_id: z.coerce.number().int().positive('Shift ID must be positive'),
  ending_cash: z.coerce.number().nonnegative('Ending cash must be non-negative'),
  notes: z.string().trim().nullable().optional(),
});

export const voidSaleSchema = z.object({
  manager_id: z.number().int().positive('Manager ID is required'),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters'),
});

export const refundSaleSchema = z.object({
  manager_id: z.number().int().positive('Manager ID is required'),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters'),
  items: z.array(
    z.object({
      sale_item_id: z.string().uuid('Invalid sale item UUID'),
      quantity: z.coerce.number().positive('Quantity must be positive'),
      restock_inventory: z.boolean().default(true),
    })
  ).min(1, 'At least one item is required for refund'),
});
