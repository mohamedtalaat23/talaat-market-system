import type { Request, Response, NextFunction } from 'express';
import { inventoryService } from '../services/inventory.service';
import { HTTP_STATUS } from '../config/constants';

/**
 * GET /inventory
 * 
 * Fetches inventory stock levels with pagination, search, categories, and low-stock filters.
 */
export async function getInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filters = req.query as any;
    const result = await inventoryService.getInventory(filters);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /inventory/:productId
 * 
 * Fetches inventory stock details for a single product.
 */
export async function getInventoryByProductId(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productId = Number(req.params.productId);
    const item = await inventoryService.getInventoryByProductId(productId);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /inventory/:productId
 * 
 * Directly overrides the stock level (e.g. for manual stocktakes).
 * Logs as manual_correction.
 */
export async function updateInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productId = Number(req.params.productId);
    const { quantity, notes } = req.body;
    const item = await inventoryService.setStockDirectly(productId, quantity, notes);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /inventory/adjust
 * 
 * Relative stock adjustment (additions, removals, damaged, expired).
 */
export async function adjustInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { product_id, adjustment_type, quantity_change, notes } = req.body;
    const item = await inventoryService.adjustStock(
      product_id,
      adjustment_type,
      quantity_change,
      notes
    );
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
}
