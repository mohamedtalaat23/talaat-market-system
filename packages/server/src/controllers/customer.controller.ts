import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { customerRepository } from '../repositories/customer.repository';
import { logger } from '../middleware/logger';

const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  phone: z.string().nullable().optional(),
  email: z.string().email('Invalid email format').or(z.literal('')).nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  balance: z.number().optional(),
  loyalty_points: z.number().int().min(0).optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Invalid email format').or(z.literal('')).nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  loyalty_points: z.number().int().min(0).optional(),
});

const recordPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  notes: z.string().nullable().optional(),
});

export class CustomerController {
  /**
   * List and search customers.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = (req.query.q as string) || undefined;
      const customers = await customerRepository.findAll(search);
      res.json({
        status: 'success',
        data: customers,
      });
    } catch (error) {
      logger.error('Error listing customers:', error);
      next(error);
    }
  }

  /**
   * Get specific customer detail and transaction history ledger.
   */
  async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ status: 'error', message: 'Invalid customer ID' });
        return;
      }

      const customer = await customerRepository.findById(id);
      if (!customer) {
        res.status(404).json({ status: 'error', message: 'Customer not found' });
        return;
      }

      const ledger = await customerRepository.getTransactionLedger(id);

      res.json({
        status: 'success',
        data: {
          ...customer,
          ledger,
        },
      });
    } catch (error) {
      logger.error('Error fetching customer details:', error);
      next(error);
    }
  }

  /**
   * Create a new customer.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = createCustomerSchema.parse(req.body);
      const userId = (req as any).user?.id || null;

      const customer = await customerRepository.create(payload, userId);

      res.status(201).json({
        status: 'success',
        data: customer,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ status: 'error', message: 'Validation failed', errors: error.errors });
        return;
      }
      // Handle unique phone constraint violation
      if (error instanceof Error && error.message.includes('unique constraint')) {
        res.status(400).json({ status: 'error', message: 'A customer with this phone number already exists' });
        return;
      }
      logger.error('Error creating customer:', error);
      next(error);
    }
  }

  /**
   * Update customer profile.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ status: 'error', message: 'Invalid customer ID' });
        return;
      }

      const payload = updateCustomerSchema.parse(req.body);
      const customer = await customerRepository.update(id, payload);

      res.json({
        status: 'success',
        data: customer,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ status: 'error', message: 'Validation failed', errors: error.errors });
        return;
      }
      if (error instanceof Error && error.message.includes('unique constraint')) {
        res.status(400).json({ status: 'error', message: 'A customer with this phone number already exists' });
        return;
      }
      logger.error('Error updating customer:', error);
      next(error);
    }
  }

  /**
   * Soft-delete customer.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ status: 'error', message: 'Invalid customer ID' });
        return;
      }

      await customerRepository.softDelete(id);

      res.json({
        status: 'success',
        message: 'Customer deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting customer:', error);
      next(error);
    }
  }

  /**
   * Record a debt payment installment or balance deposit.
   */
  async recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ status: 'error', message: 'Invalid customer ID' });
        return;
      }

      const { amount, notes } = recordPaymentSchema.parse(req.body);
      const userId = (req as any).user?.id || null;

      // When recording a payment, the customer is paying the store, so they add credit/reduce debt.
      // This means we increment their balance (amount is positive).
      const updatedCustomer = await customerRepository.recordTransaction(
        id,
        amount,
        'payment',
        null,
        notes || 'Manual customer account payment',
        userId
      );

      res.json({
        status: 'success',
        data: updatedCustomer,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ status: 'error', message: 'Validation failed', errors: error.errors });
        return;
      }
      logger.error('Error recording customer payment:', error);
      next(error);
    }
  }
}

export const customerController = new CustomerController();
