import { Router } from 'express';
import { API_PREFIX } from '../config/constants';
import { healthRouter } from './health.routes';
import { productsRouter } from './products.routes';
import { inventoryRouter } from './inventory.routes';
import { authRouter } from './auth.routes';
import { employeeRouter } from './employee.routes';
import posRouter from './pos.routes';

/**
 * Root API router — aggregates all sub-routers.
 *
 * Adding a new feature? Simply:
 *   1. Create packages/server/src/routes/myfeature.routes.ts
 *   2. Import and mount it here
 *
 * The prefix ensures all API routes are namespaced under /api/v1/
 * which makes it easy to version the API in the future.
 */
import { categoryRouter } from './category.routes';
import { dashboardRouter } from './dashboard.routes';
import { reportsRouter } from './reports.routes';

import { settingsRouter } from './settings.routes';
import { customerRouter } from './customer.routes';

const apiRouter = Router();

// Mount sub-routers
apiRouter.use(`${API_PREFIX}/health`, healthRouter);
apiRouter.use(`${API_PREFIX}/products`, productsRouter);
apiRouter.use(`${API_PREFIX}/inventory`, inventoryRouter);
apiRouter.use(`${API_PREFIX}/auth`, authRouter);
apiRouter.use(`${API_PREFIX}/employees`, employeeRouter);
apiRouter.use(`${API_PREFIX}/categories`, categoryRouter);
apiRouter.use(`${API_PREFIX}/pos`, posRouter);
apiRouter.use(`${API_PREFIX}/dashboard`, dashboardRouter);
apiRouter.use(`${API_PREFIX}/reports`, reportsRouter);
apiRouter.use(`${API_PREFIX}/settings`, settingsRouter);
apiRouter.use(`${API_PREFIX}/customers`, customerRouter);

// Future routes will be mounted here (Phase 2+):
// apiRouter.use(`${API_PREFIX}/auth`,       authRouter);
// apiRouter.use(`${API_PREFIX}/products`,   productsRouter);
// apiRouter.use(`${API_PREFIX}/categories`, categoriesRouter);
// apiRouter.use(`${API_PREFIX}/inventory`,  inventoryRouter);
// apiRouter.use(`${API_PREFIX}/sales`,      salesRouter);
// apiRouter.use(`${API_PREFIX}/suppliers`,  suppliersRouter);
// apiRouter.use(`${API_PREFIX}/purchases`,  purchasesRouter);
// apiRouter.use(`${API_PREFIX}/customers`,  customersRouter);
// apiRouter.use(`${API_PREFIX}/employees`,  employeesRouter);
// apiRouter.use(`${API_PREFIX}/reports`,    reportsRouter);
// apiRouter.use(`${API_PREFIX}/backup`,     backupRouter);

export { apiRouter };
