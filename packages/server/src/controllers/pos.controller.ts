import { Request, Response } from 'express';
import { posRepository } from '../repositories/pos.repository';
import { z } from 'zod';
import { db } from '../config/database';
import { pinService } from '../services/pin.service';
import { checkoutSchema, reprintSchema, refundSaleSchema, voidSaleSchema } from '../validators/pos.validator';

export class POSController {
  checkout = async (req: Request, res: Response) => {
    try {
      const payload = checkoutSchema.parse(req.body);
      const cashierId = (req as any).user.id;

      let bypassInventoryCheck = false;

      // If a manager PIN is supplied, authenticate it securely with lockout protection
      if (payload.manager_pin) {
        if (!payload.manager_id) {
          return res
            .status(400)
            .json({
              success: false,
              message: 'Manager ID is required for PIN authorization override.',
            });
        }

        const verification = await pinService.verifyPin(
          Number(payload.manager_id),
          String(payload.manager_pin),
          cashierId,
          req.ip
        );
        if (!verification.success) {
          return res.status(403).json({ success: false, message: verification.message });
        }
        bypassInventoryCheck = true;
      }

      const sale = await posRepository.checkout(payload, cashierId, bypassInventoryCheck);
      return res.status(200).json({ success: true, data: sale });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid payload', errors: error.errors });
      }

      // Bubble up the specific inventory underflow error code to trigger the frontend Modal
      if (error.code === 'INVENTORY_UNDERFLOW' || error.name === 'InventoryUnderflowError') {
        return res.status(400).json({
          success: false,
          code: 'INVENTORY_UNDERFLOW',
          product_id: error.product_id,
          message: error.message || 'Inventory underflow.',
        });
      }

      return res.status(400).json({ success: false, message: error.message || 'Checkout failed.' });
    }
  };

  openShift = async (req: Request, res: Response) => {
    try {
      const startingCash = Number(req.body.starting_cash) || 0;
      const registerId = Number(req.body.register_id) || 1;
      const cashierId = (req as any).user.id;

      const existing = await posRepository.getCurrentShift(cashierId);
      if (existing) {
        return res.status(400).json({ success: false, message: 'You already have an open shift.' });
      }

      const shift = await posRepository.openShift(cashierId, startingCash, registerId);
      return res.status(200).json({ success: true, data: shift });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  closeShift = async (req: Request, res: Response) => {
    try {
      const { shift_id, ending_cash, notes } = req.body;
      const summary = await posRepository.getShiftSummary(shift_id);
      const shift = await posRepository.closeShift(shift_id, ending_cash, summary.expected_cash, notes);
      return res.status(200).json({ success: true, data: shift });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  getCurrentShift = async (req: Request, res: Response) => {
    try {
      const cashierId = (req as any).user.id;
      const shift = await posRepository.getCurrentShift(cashierId);
      return res.status(200).json({ success: true, data: shift || null });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  getShiftSummary = async (req: Request, res: Response) => {
    try {
      const shiftId = Number(req.params.id);
      const user = (req as any).user;

      // Scoping: fetch the shift record first to verify employee identity
      const shift = await db('cashier_shifts').where('id', shiftId).first();
      if (!shift) {
        return res.status(404).json({ success: false, message: 'Shift not found.' });
      }

      // Cashiers can only view their own shift summaries
      if (user.role === 'cashier' && shift.employee_id !== user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are only authorized to query your own shift summary.',
        });
      }

      const summary = await posRepository.getShiftSummary(shiftId);
      return res.status(200).json({ success: true, data: summary });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  createDrawerAdjustment = async (req: Request, res: Response) => {
    try {
      const shiftId = Number(req.params.id);
      const payload = req.body;
      const adjustment = await posRepository.createDrawerAdjustment({
        shift_id: shiftId,
        ...payload
      });
      return res.status(201).json({ success: true, data: adjustment });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  markReceiptPrinted = async (req: Request, res: Response) => {
    try {
      const saleId = String(req.params.id);
      const sale = await posRepository.markReceiptPrinted(saleId);
      return res.status(200).json({ success: true, data: sale });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  reprintReceipt = async (req: Request, res: Response) => {
    try {
      const saleId = String(req.params.id);
      const managerId = (req as any).user.id;
      const managerRole = (req as any).user.role;

      const { manager_pin } = reprintSchema.parse(req.body);

      if (!['manager', 'admin'].includes(managerRole)) {
        return res.status(403).json({ success: false, message: 'Manager authorization required' });
      }

      const verification = await pinService.verifyPin(managerId, manager_pin, managerId, req.ip);
      if (!verification.success) {
        return res.status(403).json({ success: false, message: verification.message });
      }

      const sale = await posRepository.reprintReceipt(saleId, managerId);
      return res.status(200).json({ success: true, data: sale });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid payload', errors: error.errors });
      }
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  searchSales = async (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const sales = await posRepository.searchSales(query);
      return res.status(200).json({ success: true, data: sales });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  getReceipt = async (req: Request, res: Response) => {
    try {
      const saleId = String(req.params.id);
      const sale = await posRepository.getReceiptById(saleId);
      if (!sale) {
        return res.status(404).json({ success: false, message: 'Receipt not found' });
      }
      return res.status(200).json({ success: true, data: sale });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  syncOffline = async (req: Request, res: Response) => {
    try {
      const syncSchema = z.object({
        transactions: z.array(checkoutSchema).min(1, 'Transactions array must not be empty'),
      });
      const { transactions } = syncSchema.parse(req.body);
      const cashierId = (req as any).user.id;

      const result = await posRepository.syncOffline(transactions, cashierId);
      return res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid sync payload', errors: error.errors });
      }
      return res
        .status(400)
        .json({ success: false, message: error.message || 'Offline sync failed' });
    }
  };

  /**
   * GET /pos/products/search?q=…&limit=…
   *
   * Lightweight POS product search that returns top-N matches without a
   * COUNT(*) query. Designed for the cashier search fallback modal where
   * every millisecond matters and the total count is not needed.
   *
   * The validator (posProductSearchQuerySchema) enforces:
   *   - q: min 2 chars, max 100
   *   - limit: int 1–50, defaults to 20
   */
  searchProducts = async (req: Request, res: Response) => {
    try {
      const search = req.query.q as string;
      const limit = Number(req.query.limit) || 20;
      const products = await posRepository.searchProducts(search, limit);
      return res.status(200).json({ success: true, data: products });
    } catch (error: any) {
      return res
        .status(400)
        .json({ success: false, message: error.message || 'Product search failed.' });
    }
  };

  refundSale = async (req: Request, res: Response) => {
    try {
      const saleId = String(req.params.id);
      const payload = refundSaleSchema.parse(req.body);

      const result = await posRepository.processRefund({
        sale_id: saleId,
        manager_id: payload.manager_id,
        reason: payload.reason,
        items: payload.items,
        refund_type: 'partial',
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid payload', errors: error.errors });
      }
      return res.status(400).json({ success: false, message: error.message || 'Refund failed.' });
    }
  };

  voidSale = async (req: Request, res: Response) => {
    try {
      const saleId = String(req.params.id);
      const payload = voidSaleSchema.parse(req.body);

      const sale = await posRepository.getReceiptById(saleId);
      if (!sale) throw new Error('Sale not found');

      const itemsToRefund = sale.items
        .map((i: any) => ({
          sale_item_id: i.id,
          quantity: Number(i.quantity) - Number(i.refunded_quantity),
          restock_inventory: true,
        }))
        .filter((i: any) => i.quantity > 0);

      if (itemsToRefund.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: 'Sale is already fully refunded or voided.' });
      }

      const result = await posRepository.processRefund({
        sale_id: saleId,
        manager_id: payload.manager_id,
        reason: payload.reason,
        items: itemsToRefund,
        refund_type: 'void',
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid payload', errors: error.errors });
      }
      return res.status(400).json({ success: false, message: error.message || 'Void failed.' });
    }
  };
}

export const posController = new POSController();
