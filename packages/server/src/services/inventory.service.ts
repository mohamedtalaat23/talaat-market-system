import { db } from '../config/database';
import {
  inventoryRepository,
  type InventoryItem,
  type InventoryFilters,
} from '../repositories/inventory.repository';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';
import { logger } from '../middleware/logger';

export interface PaginatedInventory {
  items: InventoryItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class InventoryService {
  /**
   * Fetch paginated and filtered inventory stock levels.
   */
  async getInventory(filters: InventoryFilters): Promise<PaginatedInventory> {
    logger.debug('Fetching inventory list with filters', { filters });

    const [items, total] = await Promise.all([
      inventoryRepository.findAll(filters),
      inventoryRepository.countAll(filters),
    ]);

    return {
      items,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  /**
   * Fetch inventory level for a specific product.
   */
  async getInventoryByProductId(productId: number): Promise<InventoryItem> {
    logger.debug('Fetching inventory by product ID', { productId });
    const item = await inventoryRepository.findByProductId(productId);
    if (!item) {
      throw new NotFoundError('Inventory for product', productId);
    }
    return item;
  }

  /**
   * Direct stock override (PUT /inventory/:productId)
   * e.g., for physical stocktakes. Logs as a 'manual_correction'.
   * Runs in a transaction.
   */
  async setStockDirectly(
    productId: number,
    newQuantity: number,
    notes?: string | null
  ): Promise<InventoryItem> {
    logger.info('Performing direct stock override', { productId, newQuantity });

    return db.transaction(async (trx) => {
      // Fetch current stock level inside the transaction
      const current = await trx('inventory')
        .where('product_id', productId)
        .first();

      if (!current) {
        throw new NotFoundError('Inventory for product', productId);
      }

      const oldQuantity = Number(current.quantity);
      const quantityChange = newQuantity - oldQuantity;

      // Update inventory stock level
      await inventoryRepository.updateStock(productId, newQuantity, trx);

      // Log the adjustment in history table
      await inventoryRepository.logAdjustment(
        {
          product_id: productId,
          adjustment_type: 'manual_correction',
          quantity_change: quantityChange,
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          notes: notes || 'Direct manual stock override',
        },
        trx
      );

      logger.info('Direct stock override completed', { productId, oldQuantity, newQuantity });

      // Fetch and return the updated record
      const updated = await inventoryRepository.findByProductId(productId);
      if (!updated) {
        throw new Error('Failed to retrieve updated inventory record');
      }
      return updated;
    });
  }

  /**
   * Relative stock adjustment (POST /inventory/adjust)
   * e.g. for damage, sales, returns, stock additions.
   * Runs in a transaction and prevents negative stock values.
   */
  async adjustStock(
    productId: number,
    adjustmentType: 'stock_addition' | 'stock_removal' | 'damaged' | 'expired' | 'manual_correction',
    quantityChange: number,
    notes?: string | null,
    createdBy: number | null = null
  ): Promise<InventoryItem> {
    logger.info('Performing relative stock adjustment', {
      productId,
      adjustmentType,
      quantityChange,
    });

    return db.transaction(async (trx) => {
      // Fetch current stock level inside the transaction
      const current = await trx('inventory')
        .where('product_id', productId)
        .first();

      if (!current) {
        throw new NotFoundError('Inventory for product', productId);
      }

      const oldQuantity = Number(current.quantity);
      const newQuantity = oldQuantity + quantityChange;

      // Business Rule Constraint: Prevent negative inventory stock
      if (newQuantity < 0) {
        throw new ConflictError(
          `Inventory stock level cannot drop below zero. Product ID: ${productId}, current: ${oldQuantity}, requested change: ${quantityChange}`,
          {
            product_id: productId,
            current_quantity: oldQuantity,
            quantity_change: quantityChange,
            resulting_quantity: newQuantity,
          }
        );
      }

      // Update inventory stock level
      await inventoryRepository.updateStock(productId, newQuantity, trx);

      // Log the adjustment in history table
      await inventoryRepository.logAdjustment(
        {
          product_id: productId,
          adjustment_type: adjustmentType,
          quantity_change: quantityChange,
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          notes: notes || `Stock adjustment: ${adjustmentType}`,
          created_by: createdBy,
        },
        trx
      );

      logger.info('Relative stock adjustment completed', {
        productId,
        adjustmentType,
        oldQuantity,
        newQuantity,
      });

      // Fetch and return the updated record
      const updated = await inventoryRepository.findByProductId(productId);
      if (!updated) {
        throw new Error('Failed to retrieve updated inventory record');
      }
      return updated;
    });
  }

  /**
   * Fetch paginated stock adjustments log.
   */
  async getAdjustments(filters: { page: number; limit: number; product_id?: number | undefined }) {
    logger.debug('Fetching stock adjustments history with filters', { filters });

    const [items, total] = await Promise.all([
      inventoryRepository.findAdjustments(filters),
      inventoryRepository.countAdjustments(filters),
    ]);

    return {
      items,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }
}

// Single instance export (minimalist/no DI)
export const inventoryService = new InventoryService();
