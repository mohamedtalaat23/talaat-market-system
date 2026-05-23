import { Router } from 'express';
import { API_PREFIX } from '../config/constants';
import { healthRouter } from './health.routes';
import { productsRouter } from './products.routes';
import { inventoryRouter } from './inventory.routes';

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
const apiRouter = Router();

// Mount sub-routers
apiRouter.use(`${API_PREFIX}/health`, healthRouter);
apiRouter.use(`${API_PREFIX}/products`, productsRouter);
apiRouter.use(`${API_PREFIX}/inventory`, inventoryRouter);

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
// apiRouter.use(`${API_PREFIX}/settings`,   settingsRouter);
// apiRouter.use(`${API_PREFIX}/backup`,     backupRouter);

export { apiRouter };
