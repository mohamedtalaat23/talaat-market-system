import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  purchaseRepository,
  CreatePOInput,
  UpdatePOInput,
} from '../repositories/purchase.repository';
import { createPOSchema, updatePOSchema, receivePOSchema } from '../validators/purchase.validator';
import { logger } from '../middleware/logger';

const queryFilterSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(15),
  status: z.string().optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
});

export class PurchaseController {
  /**
   * List purchase orders
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedFilters = queryFilterSchema.parse(req.query);
      const filters: { status?: string; supplier_id?: number; page?: number; limit?: number } = {
        page: parsedFilters.page,
        limit: parsedFilters.limit,
      };
      if (parsedFilters.status !== undefined) {
        filters.status = parsedFilters.status;
      }
      if (parsedFilters.supplier_id !== undefined) {
        filters.supplier_id = parsedFilters.supplier_id;
      }
      const result = await purchaseRepository.getList(filters);
      res.json({ status: 'success', ...result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ status: 'error', message: 'Invalid query filters', errors: error.errors });
        return;
      }
      logger.error('Error in purchase controller list:', error);
      next(error);
    }
  }

  /**
   * Fetch detailed purchase order
   */
  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const po = await purchaseRepository.getDetail(id);
      if (!po) {
        res.status(404).json({ status: 'error', message: 'Purchase order not found' });
        return;
      }
      res.json({ status: 'success', data: po });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ status: 'error', message: 'Invalid parameters', errors: error.errors });
        return;
      }
      logger.error('Error in purchase controller detail:', error);
      next(error);
    }
  }

  /**
   * Create new draft purchase order
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedPayload = createPOSchema.parse(req.body);
      const creatorId = req.user?.id;
      if (!creatorId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const payload: CreatePOInput = {
        supplier_id: parsedPayload.supplier_id,
        items: parsedPayload.items,
      };
      if (parsedPayload.discount_amount !== undefined) {
        payload.discount_amount = parsedPayload.discount_amount;
      }
      if (parsedPayload.tax_amount !== undefined) {
        payload.tax_amount = parsedPayload.tax_amount;
      }
      if (parsedPayload.notes !== undefined) {
        payload.notes = parsedPayload.notes;
      }
      const po = await purchaseRepository.create(payload, creatorId);
      res.status(211).json({ status: 'success', data: po });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ status: 'error', message: 'Invalid input payload', errors: error.errors });
        return;
      }
      logger.error('Error in purchase controller create:', error);
      next(error);
    }
  }

  /**
   * Update draft purchase order details
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const parsedPayload = updatePOSchema.parse(req.body);
      const payload: UpdatePOInput = {
        supplier_id: parsedPayload.supplier_id,
        items: parsedPayload.items,
      };
      if (parsedPayload.discount_amount !== undefined) {
        payload.discount_amount = parsedPayload.discount_amount;
      }
      if (parsedPayload.tax_amount !== undefined) {
        payload.tax_amount = parsedPayload.tax_amount;
      }
      if (parsedPayload.notes !== undefined) {
        payload.notes = parsedPayload.notes;
      }
      const po = await purchaseRepository.update(id, payload);
      res.json({ status: 'success', data: po });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ status: 'error', message: 'Invalid input payload', errors: error.errors });
        return;
      }
      logger.error('Error in purchase controller update:', error);
      next(error);
    }
  }

  /**
   * Transition PO from draft to ordered status
   */
  async order(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      await purchaseRepository.updateStatus(id, 'ordered');
      res.json({ status: 'success', message: 'Purchase order placed successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ status: 'error', message: 'Invalid parameters', errors: error.errors });
        return;
      }
      logger.error('Error in purchase controller order:', error);
      next(error);
    }
  }

  /**
   * Cancel draft or ordered PO
   */
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      await purchaseRepository.updateStatus(id, 'cancelled');
      res.json({ status: 'success', message: 'Purchase order cancelled successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ status: 'error', message: 'Invalid parameters', errors: error.errors });
        return;
      }
      logger.error('Error in purchase controller cancel:', error);
      next(error);
    }
  }

  /**
   * Complete purchase order goods receipt and increment inventory
   */
  async receive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const payload = receivePOSchema.parse(req.body);
      const receiverId = req.user?.id;
      if (!receiverId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      await purchaseRepository.receiveGoods(id, payload.items, receiverId);
      res.json({
        status: 'success',
        message: 'Goods receipt processed successfully, inventory updated',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({
            status: 'error',
            message: 'Invalid goods receipt payload',
            errors: error.errors,
          });
        return;
      }
      logger.error('Error in purchase controller receive:', error);
      next(error);
    }
  }
}

export const purchaseController = new PurchaseController();
