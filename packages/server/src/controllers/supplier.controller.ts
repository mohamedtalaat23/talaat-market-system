import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supplierService } from '../services/supplier.service';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
  supplierIdParamSchema,
} from '../validators/supplier.validator';
import { logger } from '../middleware/logger';

export class SupplierController {
  /**
   * List paginated and searched suppliers.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = supplierQuerySchema.parse(req.query);
      const search = filters.search || undefined;

      const result = await supplierService.getSuppliers(search, filters.page, filters.limit);

      res.json({
        status: 'success',
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ status: 'error', message: 'Invalid query filters', errors: error.errors });
        return;
      }
      logger.error('Error in supplier controller list:', error);
      next(error);
    }
  }

  /**
   * Get supplier detail and catalogue inventory.
   */
  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = supplierIdParamSchema.parse(req.params);

      const supplier = await supplierService.getSupplierById(id);
      const catalog = await supplierService.getSupplierCatalog(id);

      res.json({
        status: 'success',
        data: {
          ...supplier,
          catalog,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ status: 'error', message: 'Invalid parameters', errors: error.errors });
        return;
      }
      logger.error('Error in supplier controller detail:', error);
      next(error);
    }
  }

  /**
   * Create a new supplier profile.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = createSupplierSchema.parse(req.body);
      const userId = (req as any).user?.id || null;

      const supplier = await supplierService.createSupplier(payload, userId);

      res.status(201).json({
        status: 'success',
        data: supplier,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ status: 'error', message: 'Validation failed', errors: error.errors });
        return;
      }
      if (error instanceof Error && error.message.includes('already in use')) {
        res.status(400).json({ status: 'error', message: error.message });
        return;
      }
      logger.error('Error in supplier controller create:', error);
      next(error);
    }
  }

  /**
   * Update supplier profile details.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = supplierIdParamSchema.parse(req.params);
      const payload = updateSupplierSchema.parse(req.body);
      const userId = (req as any).user?.id || null;

      const supplier = await supplierService.updateSupplier(id, payload, userId);

      res.json({
        status: 'success',
        data: supplier,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ status: 'error', message: 'Validation failed', errors: error.errors });
        return;
      }
      logger.error('Error in supplier controller update:', error);
      next(error);
    }
  }

  /**
   * Soft delete a supplier profile.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = supplierIdParamSchema.parse(req.params);

      await supplierService.deleteSupplier(id);

      res.json({
        status: 'success',
        message: 'Supplier profile deleted successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ status: 'error', message: 'Invalid parameters', errors: error.errors });
        return;
      }
      logger.error('Error in supplier controller delete:', error);
      next(error);
    }
  }
}

export const supplierController = new SupplierController();
