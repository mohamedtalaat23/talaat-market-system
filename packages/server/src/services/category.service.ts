import { categoryRepository, type Category } from '../repositories/category.repository';
import { logger } from '../middleware/logger';

export class CategoryService {
  /**
   * Fetch active categories.
   */
  async getCategories(): Promise<Category[]> {
    logger.debug('Fetching active categories');
    return await categoryRepository.findAllActive();
  }
}

export const categoryService = new CategoryService();
