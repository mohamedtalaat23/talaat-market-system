import { Router } from 'express';
import * as controller from '../controllers/category.controller';
import { requireAuth } from '../middleware/auth';

const categoryRouter = Router();

// GET /categories - Fetch read-only active categories (requires authentication)
categoryRouter.get('/', requireAuth, controller.getCategories);

export { categoryRouter };
