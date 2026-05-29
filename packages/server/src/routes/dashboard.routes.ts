import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { standardRateLimiter } from '../middleware/rateLimit';

const dashboardRouter = Router();

// Apply rate limiting
dashboardRouter.use(standardRateLimiter);

// GET /dashboard/stats - Fetch aggregate statistics
dashboardRouter.get('/stats', getDashboardStats);

export { dashboardRouter };
