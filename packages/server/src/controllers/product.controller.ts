import type { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import { HTTP_STATUS } from '../config/constants';

/**
 * GET /products
 *
 * Fetches list of products with pagination, search, sorting, and category filters.
 */
export async function getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = req.query as unknown as Parameters<typeof productService.getProducts>[0];
    const result = await productService.getProducts(filters);
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
 * GET /products/:id
 *
 * Fetches a single product by numeric ID.
 */
export async function getProductById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const product = await productService.getProductById(id);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /products/barcode/:code
 *
 * Fetches a single product by barcode string.
 */
export async function getProductByBarcode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const barcode = req.params.code as string;
    const product = await productService.getProductByBarcode(barcode);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /products
 *
 * Creates a new product and inserts its matching initial inventory record.
 */
export async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const product = await productService.createProduct(req.body);
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /products/:id
 *
 * Updates product details.
 */
export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const product = await productService.updateProduct(id, req.body);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /products/:id
 *
 * Soft-deletes a product by setting deleted_at = now() and is_active = false.
 */
export async function deleteProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await productService.deleteProduct(id);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Product deleted successfully (soft-delete)',
    });
  } catch (error) {
    next(error);
  }
}
