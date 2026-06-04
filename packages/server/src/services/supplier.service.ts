import { supplierRepository, type Supplier } from '../repositories/supplier.repository';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';
import { logger } from '../middleware/logger';

export interface PaginatedSuppliers {
  items: Supplier[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class SupplierService {
  /**
   * Fetch paginated and filtered suppliers directory list.
   */
  async getSuppliers(search?: string, page = 1, limit = 10): Promise<PaginatedSuppliers> {
    logger.debug('Fetching suppliers list with search & page parameters', { search, page, limit });

    const { data: items, total } = await supplierRepository.findAll(search, page, limit);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Fetch supplier by ID.
   */
  async getSupplierById(id: number): Promise<Supplier> {
    logger.debug('Fetching supplier by ID', { id });
    const supplier = await supplierRepository.findById(id);
    if (!supplier) {
      throw new NotFoundError('Supplier', id);
    }
    return supplier;
  }

  /**
   * Get all products supplied by this supplier along with live inventory details.
   */
  async getSupplierCatalog(supplierId: number): Promise<any[]> {
    logger.debug('Fetching supplied catalog for supplier', { supplierId });
    // Check if supplier exists first
    await this.getSupplierById(supplierId);
    return supplierRepository.getSuppliedProducts(supplierId);
  }

  /**
   * Register a new supplier profile.
   */
  async createSupplier(input: any, createdByUserId: number | null = null): Promise<Supplier> {
    logger.info('Creating new supplier profile', { name: input.name });
    return supplierRepository.create(input, createdByUserId);
  }

  /**
   * Update supplier profile details.
   */
  async updateSupplier(
    id: number,
    input: any,
    updatedByUserId: number | null = null,
  ): Promise<Supplier> {
    logger.info('Updating supplier profile details', { id });
    // Verify supplier exists
    await this.getSupplierById(id);
    return supplierRepository.update(id, input, updatedByUserId);
  }

  /**
   * Soft delete a supplier profile.
   */
  async deleteSupplier(id: number): Promise<void> {
    logger.info('Soft deleting supplier profile', { id });

    // 1. Ensure supplier exists
    await this.getSupplierById(id);

    // 2. Perform soft delete
    await supplierRepository.softDelete(id);
    logger.info('Supplier soft deleted successfully', { id });
  }

  /**
   * Business Validation: Suspended suppliers cannot be assigned to products.
   */
  async validateSupplierAssignment(supplierId: number): Promise<void> {
    const supplier = await supplierRepository.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (supplier.status === 'suspended') {
      throw new ConflictError(
        `Suspended supplier "${supplier.name}" cannot be assigned to products.`,
        {
          supplier_id: supplierId,
          status: supplier.status,
        },
      );
    }

    if (supplier.status === 'inactive') {
      logger.warn(`Inactive supplier "${supplier.name}" is being assigned to a product.`, {
        supplier_id: supplierId,
      });
    }
  }
}

export const supplierService = new SupplierService();
