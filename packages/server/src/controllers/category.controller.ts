import type { Request, Response, NextFunction } from 'express';
import { categoryService } from '../services/category.service';
import { HTTP_STATUS } from '../config/constants';

/**
 * GET /categories
 *
 * Retrieves all active product categories.
 */
export async function getCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const categories = await categoryService.getCategories();
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
}
