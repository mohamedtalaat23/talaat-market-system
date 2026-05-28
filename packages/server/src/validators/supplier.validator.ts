import { z } from 'zod';

export const createSupplierSchema = z.object({
  supplier_code: z.string().trim().max(30).nullable().optional(),
  name: z.string().trim().min(1, 'Supplier name is required').max(150),
  contact_name: z.string().trim().max(150).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email('Invalid email format').or(z.literal('')).nullable().optional(),
  address: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active').optional(),
});

export const updateSupplierSchema = z.object({
  supplier_code: z.string().trim().max(30).optional(),
  name: z.string().trim().min(1).max(150).optional(),
  contact_name: z.string().trim().max(150).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email('Invalid email format').or(z.literal('')).nullable().optional(),
  address: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

export const supplierQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
});

export const supplierIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid supplier ID'),
});
