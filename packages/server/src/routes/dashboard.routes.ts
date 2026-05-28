import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';

const dashboardRouter = Router();

// GET /dashboard/stats - Fetch aggregate statistics
dashboardRouter.get('/stats', getDashboardStats);

export { dashboardRouter };
