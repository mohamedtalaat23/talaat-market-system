import { db } from '../config/database';
import {
  productRepository,
  type Product,
  type ProductFilters,
} from '../repositories/product.repository';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';
import { logger } from '../middleware/logger';
import { supplierService } from './supplier.service';
import { auditService } from './audit.service';

export interface PaginatedProducts {
  items: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class ProductService {
  /**
   * Fetch paginated and filtered product list.
   */
  async getProducts(filters: ProductFilters): Promise<PaginatedProducts> {
    logger.debug('Fetching product list with filters', { filters });

    const [items, total] = await Promise.all([
      productRepository.findAll(filters),
      productRepository.countAll(filters),
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
   * Fetch product by ID.
   */
  async getProductById(id: number): Promise<Product> {
    logger.debug('Fetching product by ID', { id });
    const product = await productRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product', id);
    }
    return product;
  }

  /**
   * Fetch product by barcode.
   */
  async getProductByBarcode(barcode: string): Promise<Product> {
    logger.debug('Fetching product by barcode', { barcode });
    const product = await productRepository.findByBarcode(barcode);
    if (!product) {
      throw new NotFoundError('Product barcode', barcode);
    }
    return product;
  }

  /**
   * Create a product and set its initial inventory stock.
   * Uses Knex transaction to ensure atomicity.
   */
  async createProduct(data: any & { initial_quantity?: number }): Promise<Product> {
    const { initial_quantity = 0, ...productData } = data;

    logger.info('Creating new product', { name: productData.name, barcode: productData.barcode });

    // Validate supplier status if provided
    if (productData.supplier_id) {
      await supplierService.validateSupplierAssignment(productData.supplier_id);
    }

    // Validate barcode uniqueness if provided
    if (productData.barcode) {
      const existingProduct = await productRepository.findByBarcode(productData.barcode);
      if (existingProduct) {
        throw new ConflictError('A product with this barcode already exists', {
          barcode: productData.barcode,
        });
      }
    }

    // Execute product and inventory creation inside a transaction with conflict interception
    try {
      return await db.transaction(async (trx) => {
        const product = await productRepository.create(productData, trx);
        await productRepository.createInventory(product.id, initial_quantity, trx);

        logger.info('Product created successfully with inventory', { id: product.id });

        // Fetch fully populated product with inventory joined
        const populatedProduct = await productRepository.findById(product.id, trx);
        if (!populatedProduct) {
          throw new Error('Failed to retrieve newly created product');
        }
        return populatedProduct;
      });
    } catch (error: any) {
      if (error.code === '23505' && error.message?.includes('barcode')) {
        throw new ConflictError('A product with this barcode already exists', {
          barcode: productData.barcode,
        });
      }
      throw error;
    }
  }

  /**
   * Update product details.
   */
  async updateProduct(id: number, data: any, userId?: number, ipAddress?: string, reason?: string): Promise<Product> {
    logger.info('Updating product details', { id });

    // Ensure product exists
    const existingProduct = await productRepository.findById(id);
    if (!existingProduct) {
      throw new NotFoundError('Product', id);
    }

    // Validate supplier status if provided
    if (data.supplier_id) {
      await supplierService.validateSupplierAssignment(data.supplier_id);
    }

    // Check barcode uniqueness if changed
    if (data.barcode && data.barcode !== existingProduct.barcode) {
      const duplicateProduct = await productRepository.findByBarcode(data.barcode);
      if (duplicateProduct) {
        throw new ConflictError('A product with this barcode already exists', {
          barcode: data.barcode,
        });
      }
    }

    const updatedProduct = await db.transaction(async (trx) => {
      const updated = await productRepository.update(id, data, trx);

      // Audit pricing, status, and identifying changes
      const oldValues: any = {};
      const newValues: any = {};
      const auditedFields = ['selling_price', 'cost_price', 'barcode', 'min_stock_level', 'max_stock_level', 'is_active'];

      for (const field of auditedFields) {
        if (data[field] !== undefined && data[field] !== (existingProduct as any)[field]) {
          oldValues[field] = (existingProduct as any)[field];
          newValues[field] = data[field];
        }
      }

      if (Object.keys(newValues).length > 0) {
        await auditService.logEvent({
          entityType: 'product',
          entityId: id,
          action: 'product_update',
          oldValue: oldValues,
          newValue: newValues,
          userId: userId,
          ipAddress: ipAddress,
          reason: reason || 'Product details updated',
          trx,
        });
      }
      
      return updated;
    });

    logger.info('Product updated successfully', { id });
    return updatedProduct;
  }

  /**
   * Soft-delete a product.
   */
  async deleteProduct(id: number): Promise<void> {
    logger.info('Soft deleting product', { id });

    // Ensure product exists
    const existingProduct = await productRepository.findById(id);
    if (!existingProduct) {
      throw new NotFoundError('Product', id);
    }

    await productRepository.softDelete(id);
    logger.info('Product soft deleted successfully', { id });
  }
}

// Single instance export (minimalist/no DI framework)
export const productService = new ProductService();
