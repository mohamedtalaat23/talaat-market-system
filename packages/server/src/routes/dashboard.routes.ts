import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { standardRateLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/auth';

const dashboardRouter = Router();

// Apply rate limiting
dashboardRouter.use(standardRateLimiter);

// Dashboard stats are business-sensitive; require authentication.
dashboardRouter.use(requireAuth);

// GET /dashboard/stats - Fetch aggregate statistics
dashboardRouter.get('/stats', getDashboardStats);

export { dashboardRouter };
