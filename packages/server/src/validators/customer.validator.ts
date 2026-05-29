import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email('Invalid email format').or(z.literal('')).nullable().optional(),
  address: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  balance: z.coerce.number().optional(),
  loyalty_points: z.coerce.number().int().nonnegative('Loyalty points must be non-negative').optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150).optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email('Invalid email format').or(z.literal('')).nullable().optional(),
  address: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  loyalty_points: z.coerce.number().int().nonnegative('Loyalty points must be non-negative').optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  notes: z.string().trim().nullable().optional(),
  payment_method: z.enum(['cash', 'card']).optional().default('cash'),
});

export const customerIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid customer ID'),
});

export const customerQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
