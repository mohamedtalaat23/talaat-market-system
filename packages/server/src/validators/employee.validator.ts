import { z } from 'zod';

/**
 * Zod validation schemas for authentication and employee management requests.
 */

export const loginSchema = z
  .object({
    username: z.string().trim().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required').optional(),
    pin: z
      .string()
      .regex(/^\d{4,6}$/, 'PIN must be between 4 and 6 digits')
      .optional(),
  })
  .refine((data) => data.password !== undefined || data.pin !== undefined, {
    message: 'Either password or PIN is required to login',
    path: ['password'],
  });

export const fastPinLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be between 4 and 6 digits'),
});

export const createEmployeeSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required').max(150),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, 'PIN must be between 4 and 6 digits')
    .nullable()
    .optional(),
  role: z.enum(['admin', 'manager', 'cashier'], {
    errorMap: () => ({ message: 'Invalid role type' }),
  }),
  is_active: z.boolean().default(true),
});

export const updateEmployeeSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required').max(150).optional(),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores')
    .optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100).optional(),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, 'PIN must be between 4 and 6 digits')
    .nullable()
    .optional(),
  role: z
    .enum(['admin', 'manager', 'cashier'], {
      errorMap: () => ({ message: 'Invalid role type' }),
    })
    .optional(),
  is_active: z.boolean().optional(),
});

export const employeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  role: z.enum(['admin', 'manager', 'cashier']).optional(),
  is_active: z.coerce
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

export const employeeIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid employee ID'),
});
