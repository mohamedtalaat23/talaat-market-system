import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email('Invalid email format').or(z.literal('')).nullable().optional(),
  address: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  loyalty_points: z.coerce
    .number()
    .int()
    .nonnegative('Loyalty points must be non-negative')
    .optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150).optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email('Invalid email format').or(z.literal('')).nullable().optional(),
  address: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  loyalty_points: z.coerce
    .number()
    .int()
    .nonnegative('Loyalty points must be non-negative')
    .optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce
    .number()
    .finite('Payment amount must be a finite number')
    .positive('Payment amount must be greater than zero')
    .max(1_000_000, 'Payment amount is implausibly large'),
  notes: z.string().trim().max(500).nullable().optional(),
  payment_method: z.enum(['cash', 'card']).optional().default('cash'),
  /**
   * Client-generated key. Supplying it makes the request idempotent: a retried
   * submission returns the original payment instead of posting a second one.
   */
  idempotency_key: z.string().trim().min(8).max(100).nullable().optional(),
});

export const customerIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid customer ID'),
});

export const customerQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
