import { Router } from 'express';
import * as controller from '../controllers/category.controller';
import { requireAuth } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimit';

const categoryRouter = Router();

// Apply rate limiting
categoryRouter.use(standardRateLimiter);

// GET /categories - Fetch read-only active categories (requires authentication)
categoryRouter.get('/', requireAuth, controller.getCategories);

export { categoryRouter };
