import type { Request, Response, NextFunction } from 'express';
import { customerRepository } from '../repositories/customer.repository';
import { posRepository } from '../repositories/pos.repository';
import { logger } from '../middleware/logger';
import { HTTP_STATUS } from '../config/constants';

export class CustomerController {
  /**
   * List and search customers.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = (req.query.q as string) || undefined;
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const offset = (page - 1) * limit;

      const { data: customers, total } = await customerRepository.findAll(search, limit, offset);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        status: 'success',
        data: customers,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        }
      });
    } catch (error) {
      logger.error('Error listing customers:', error);
      next(error);
    }
  }

  /**
   * Get specific customer detail and transaction history ledger.
   * Supports pagination via ?ledger_page and ?ledger_limit query params.
   * Defaults: page 1, limit 50. Server cap: 100 rows per page.
   */
  async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const ledgerPage = Math.max(1, Number(req.query.ledger_page) || 1);
      const ledgerLimit = Math.min(100, Math.max(1, Number(req.query.ledger_limit) || 50));

      const customer = await customerRepository.findById(id);
      if (!customer) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: 'error', message: 'Customer not found' });
        return;
      }

      const { data: ledger, total: ledgerTotal } = await customerRepository.getTransactionLedger(
        id, ledgerPage, ledgerLimit
      );

      res.status(HTTP_STATUS.OK).json({
        status: 'success',
        data: {
          ...customer,
          ledger,
          ledger_meta: {
            total: ledgerTotal,
            page: ledgerPage,
            limit: ledgerLimit,
            totalPages: Math.ceil(ledgerTotal / ledgerLimit),
          },
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
      const payload = req.body;
      const userId = (req as any).user?.id || null;

      const customer = await customerRepository.create(payload, userId);

      res.status(HTTP_STATUS.CREATED).json({
        status: 'success',
        data: customer,
      });
    } catch (error) {
      // Handle unique phone constraint violation
      if (error instanceof Error && error.message.includes('unique constraint')) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: 'error', message: 'A customer with this phone number already exists' });
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
      const payload = req.body;
      const customer = await customerRepository.update(id, payload);

      res.status(HTTP_STATUS.OK).json({
        status: 'success',
        data: customer,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: 'error', message: 'A customer with this phone number already exists' });
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
      await customerRepository.softDelete(id);

      res.status(HTTP_STATUS.OK).json({
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
      const { amount, notes, payment_method } = req.body;
      const userId = (req as any).user?.id || null;

      // Query the active cashier shift to link repayment cash to the drawer
      const activeShift = userId ? await posRepository.getCurrentShift(userId) : null;

      // When recording a payment, the customer is paying the store, so they add credit/reduce debt.
      // This means we increment their balance (amount is positive).
      const updatedCustomer = await customerRepository.recordTransaction(
        id,
        amount,
        'payment',
        null,
        notes || 'Manual customer account payment',
        userId,
        activeShift?.id || null,
        activeShift?.register_id || null,
        payment_method
      );

      res.status(HTTP_STATUS.OK).json({
        status: 'success',
        data: updatedCustomer,
      });
    } catch (error) {
      logger.error('Error recording customer payment:', error);
      next(error);
    }
  }
}

export const customerController = new CustomerController();
