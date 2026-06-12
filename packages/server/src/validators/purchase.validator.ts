import { z } from 'zod';

export const createPOSchema = z.object({
  supplier_id: z.number().int().positive('Supplier ID must be a positive integer'),
  discount_amount: z
    .number()
    .nonnegative('Discount amount cannot be negative')
    .optional()
    .default(0),
  tax_amount: z.number().nonnegative('Tax amount cannot be negative').optional().default(0),
  notes: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive('Product ID must be a positive integer'),
        ordered_quantity: z.number().positive('Ordered quantity must be greater than 0'),
        unit_cost: z.number().nonnegative('Unit cost cannot be negative'),
      }),
    )
    .min(1, 'Purchase order must contain at least one item'),
});

export const updatePOSchema = createPOSchema;

export const receivePOSchema = z.object({
  items: z
    .array(
      z.object({
        po_item_id: z.number().int().positive('PO Item ID must be a positive integer'),
        product_id: z.number().int().positive('Product ID must be a positive integer'),
        quantity_to_receive: z.number().nonnegative('Received quantity cannot be negative'),
        shortage_quantity: z.number().nonnegative('Shortage quantity cannot be negative').optional().default(0),
        shortage_reason: z.string().nullable().optional(),
      }),
    )
    .min(1, 'Goods receipt must contain at least one verified item'),
  notes: z.string().nullable().optional(),
});
