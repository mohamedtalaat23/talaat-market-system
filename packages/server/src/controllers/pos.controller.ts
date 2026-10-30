import type { Request, Response } from 'express';
import { posRepository } from '../repositories/pos.repository';
import { z } from 'zod';
import { db } from '../config/database';
import { pinService } from '../services/pin.service';
import {
  checkoutSchema,
  quarantineDecisionSchema,
  reprintSchema,
  refundSaleSchema,
  syncOfflineSchema,
  voidSaleSchema,
} from '../validators/pos.validator';

export class POSController {
  checkout = async (req: Request, res: Response) => {
    try {
      const payload = checkoutSchema.parse(req.body);
      const cashierId = (req as any).user.id;

      let bypassInventoryCheck = false;
      let discountAuthorized = false;

      // If a manager PIN is supplied, authenticate it securely with lockout protection
      if (payload.manager_pin) {
        if (!payload.manager_id) {
          return res.status(400).json({
            success: false,
            message: 'Manager ID is required for PIN authorization override.',
          });
        }

        const verification = await pinService.verifyPin(
          Number(payload.manager_id),
          String(payload.manager_pin),
          cashierId,
          req.ip,
        );
        if (!verification.success) {
          return res.status(403).json({ success: false, message: verification.message });
        }
        bypassInventoryCheck = true;
        // A *verified* PIN is what authorises large discounts. A bare manager_id
        // in the payload must never be enough (it is client-controlled).
        discountAuthorized = true;
      }

      const sale = await posRepository.checkout(
        payload,
        cashierId,
        bypassInventoryCheck,
        false,
        discountAuthorized,
      );
      return res.status(200).json({ success: true, data: sale });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid payload', errors: error.issues });
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

      const existing = await posRepository.getCurrentShift(registerId);
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: 'This register already has an open shift.' });
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
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      const summary = await posRepository.getShiftSummary(shift_id);

      // Authorization Check
      if (summary.employee_id !== userId && !['manager', 'admin'].includes(userRole)) {
        return res
          .status(403)
          .json({ success: false, message: 'You are not authorized to close this shift.' });
      }

      const shift = await posRepository.closeShift(
        shift_id,
        ending_cash,
        summary.expected_cash,
        notes,
        userId,
      );
      return res.status(200).json({ success: true, data: shift });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  getCurrentShift = async (req: Request, res: Response) => {
    try {
      const registerId = Number(req.query.register_id) || 1;
      const shift = await posRepository.getCurrentShift(registerId);
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

      // Cashiers may only view their own shift summaries.
      // Managers and admins may view any shift.
      if (user.role === 'cashier' && shift.employee_id !== user.id) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to view this shift.',
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
      const { manager_id, manager_pin, ...rest } = req.body;
      const cashierId = (req as any).user.id;

      const verification = await pinService.verifyPin(
        Number(manager_id),
        String(manager_pin),
        cashierId,
        req.ip,
      );
      if (!verification.success) {
        return res.status(403).json({ success: false, message: verification.message });
      }

      const adjustment = await posRepository.createDrawerAdjustment({
        shift_id: shiftId,
        manager_id,
        ...rest,
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
      const callerId = req.user!.id;
      const managerRole = (req as any).user.role;

      const { manager_pin, manager_id } = reprintSchema.parse(req.body);
      const managerId = manager_id ?? callerId;

      if (!manager_id && !['manager', 'admin'].includes(managerRole)) {
        return res.status(403).json({ success: false, message: 'Manager authorization required' });
      }

      const verification = await pinService.verifyPin(managerId, manager_pin, callerId, req.ip);
      if (!verification.success) {
        return res.status(403).json({ success: false, message: verification.message });
      }

      const sale = await posRepository.reprintReceipt(saleId, managerId);
      return res.status(200).json({ success: true, data: sale });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid payload', errors: error.issues });
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
      const { transactions, manager_id, manager_pin } = syncOfflineSchema.parse(req.body);
      const cashierId = (req as any).user.id;

      // Offline price/discount overrides are only honoured when a manager PIN is
      // verified server-side (same lockout-protected path as online checkout).
      let managerAuthorized = false;
      if (manager_pin !== undefined) {
        const verification = await pinService.verifyPin(
          Number(manager_id),
          String(manager_pin),
          cashierId,
          req.ip,
        );
        if (!verification.success) {
          return res.status(403).json({ success: false, message: verification.message });
        }
        managerAuthorized = true;
      }

      const result = await posRepository.syncOffline(transactions, cashierId, managerAuthorized);
      return res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid sync payload', errors: error.issues });
      }
      return res
        .status(400)
        .json({ success: false, message: error.message || 'Offline sync failed' });
    }
  };

  /**
   * GET /pos/sync/quarantine
   *
   * Offline sales that could not be replayed without a manager decision.
   */
  listQuarantinedSales = async (_req: Request, res: Response) => {
    try {
      const rows = await posRepository.listQuarantinedSales('pending');
      return res.status(200).json({ success: true, data: rows });
    } catch (error: any) {
      return res
        .status(400)
        .json({ success: false, message: error.message || 'Failed to list quarantined sales.' });
    }
  };

  /**
   * POST /pos/sync/quarantine/:id/resolve
   *
   * Manager decision on a quarantined offline sale. Approving re-runs the
   * original checkout with the discount/price override authorized; rejecting
   * records the decision and never posts the sale.
   */
  resolveQuarantinedSale = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { decision, manager_id, manager_pin, notes } = quarantineDecisionSchema.parse(req.body);
      const cashierId = (req as any).user.id;

      const verification = await pinService.verifyPin(
        Number(manager_id),
        String(manager_pin),
        cashierId,
        req.ip,
      );
      if (!verification.success) {
        return res.status(403).json({ success: false, message: verification.message });
      }

      const result = await posRepository.resolveQuarantinedSale(
        id,
        decision,
        Number(manager_id),
        notes ?? undefined,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid payload', errors: error.issues });
      }
      return res
        .status(400)
        .json({ success: false, message: error.message || 'Failed to resolve quarantined sale.' });
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
      const cashierId = (req as any).user.id;

      const verification = await pinService.verifyPin(
        Number(payload.manager_id),
        String(payload.manager_pin),
        cashierId,
        req.ip,
      );
      if (!verification.success) {
        return res.status(403).json({ success: false, message: verification.message });
      }

      const payoutShift = await posRepository.getOpenShiftByEmployee(cashierId);
      if (!payoutShift) throw new Error('Open your register shift before processing a refund.');
      const result = await posRepository.processRefund({
        payout_shift_id: payoutShift.id,
        sale_id: saleId,
        manager_id: payload.manager_id,
        reason: payload.reason,
        items: payload.items,
        idempotency_key: payload.idempotency_key,
        refund_type: 'partial',
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid payload', errors: error.issues });
      }
      return res.status(400).json({ success: false, message: error.message || 'Refund failed.' });
    }
  };

  voidSale = async (req: Request, res: Response) => {
    try {
      const saleId = String(req.params.id);
      const payload = voidSaleSchema.parse(req.body);
      const cashierId = (req as any).user.id;

      const verification = await pinService.verifyPin(
        Number(payload.manager_id),
        String(payload.manager_pin),
        cashierId,
        req.ip,
      );
      if (!verification.success) {
        return res.status(403).json({ success: false, message: verification.message });
      }

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

      const payoutShift = await posRepository.getOpenShiftByEmployee(cashierId);
      if (!payoutShift) throw new Error('Open your register shift before processing a refund.');
      const result = await posRepository.processRefund({
        payout_shift_id: payoutShift.id,
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
          .json({ success: false, message: 'Invalid payload', errors: error.issues });
      }
      return res.status(400).json({ success: false, message: error.message || 'Void failed.' });
    }
  };
}

export const posController = new POSController();
