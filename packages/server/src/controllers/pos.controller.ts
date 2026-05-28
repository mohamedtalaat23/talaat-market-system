import { Request, Response } from 'express';
import { posRepository } from '../repositories/pos.repository';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '../config/database';

const reprintSchema = z.object({
  manager_pin: z.string().min(4).max(6)
});

const checkoutSchema = z.object({
  shift_id: z.number(),
  register_id: z.number(),
  payment_method: z.enum(['cash', 'card', 'split', 'debt']),
  cash_received: z.number().optional(),
  cash_amount: z.number().optional(),
  card_amount: z.number().optional(),
  idempotency_key: z.string(),
  global_discount: z.number().min(0).optional(),
  customer_id: z.number().optional(),
  items: z.array(z.object({
    product_id: z.number(),
    quantity: z.number().positive(),
    unit_price: z.number().min(0),
    discount: z.number().min(0)
  })).min(1)
});

export class POSController {
  checkout = async (req: Request, res: Response) => {
    try {
      const payload = checkoutSchema.parse(req.body);
      const cashierId = (req as any).user.id; 

      const sale = await posRepository.checkout(payload, cashierId);
      return res.status(200).json({ success: true, data: sale });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid payload', errors: error.errors });
      }
      return res.status(400).json({ success: false, message: error.message || 'Checkout failed' });
    }
  }

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
  }

  closeShift = async (req: Request, res: Response) => {
    try {
      const { shift_id, ending_cash, expected_cash, notes } = req.body;
      const shift = await posRepository.closeShift(shift_id, ending_cash, expected_cash, notes);
      return res.status(200).json({ success: true, data: shift });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  getCurrentShift = async (req: Request, res: Response) => {
    try {
      const cashierId = (req as any).user.id;
      const shift = await posRepository.getCurrentShift(cashierId);
      return res.status(200).json({ success: true, data: shift || null });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  getShiftSummary = async (req: Request, res: Response) => {
    try {
      const shiftId = Number(req.params.id);
      const summary = await posRepository.getShiftSummary(shiftId);
      return res.status(200).json({ success: true, data: summary });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  markReceiptPrinted = async (req: Request, res: Response) => {
    try {
      const saleId = Number(req.params.id);
      const sale = await posRepository.markReceiptPrinted(saleId);
      return res.status(200).json({ success: true, data: sale });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  reprintReceipt = async (req: Request, res: Response) => {
    try {
      const saleId = Number(req.params.id);
      const managerId = (req as any).user.id;
      const managerRole = (req as any).user.role;
      
      const { manager_pin } = reprintSchema.parse(req.body);

      if (!['manager', 'admin'].includes(managerRole)) {
        return res.status(403).json({ success: false, message: 'Manager authorization required' });
      }

      // Fetch manager's pin_hash from employees table
      const manager = await db('employees').where('id', managerId).first();
      if (!manager?.pin_hash) {
        return res.status(403).json({ success: false, message: 'Manager PIN not configured' });
      }

      const pinValid = await bcrypt.compare(String(manager_pin), manager.pin_hash);
      if (!pinValid) {
        return res.status(403).json({ success: false, message: 'Invalid PIN' });
      }

      const sale = await posRepository.reprintReceipt(saleId, managerId);
      return res.status(200).json({ success: true, data: sale });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid payload', errors: error.errors });
      }
      return res.status(400).json({ success: false, message: error.message });
    }
  }
  searchSales = async (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const sales = await posRepository.searchSales(query);
      return res.status(200).json({ success: true, data: sales });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  getReceipt = async (req: Request, res: Response) => {
    try {
      const saleId = Number(req.params.id);
      const sale = await posRepository.getReceiptById(saleId);
      if (!sale) {
        return res.status(404).json({ success: false, message: 'Receipt not found' });
      }
      return res.status(200).json({ success: true, data: sale });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

export const posController = new POSController();
