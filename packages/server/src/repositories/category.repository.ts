import { db } from '../config/database';

export interface Category {
  id: number;
  name: string;
  name_ar: string | null;
  parent_id: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class CategoryRepository {
  /**
   * Find all active categories, ordered alphabetically by name.
   */
  async findAllActive(): Promise<Category[]> {
    return await db('categories').select('*').where('is_active', true).orderBy('name', 'asc');
  }
}

export const categoryRepository = new CategoryRepository();
