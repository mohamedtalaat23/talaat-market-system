import { Router } from 'express';
import * as controller from '../controllers/inventory.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requireRoles } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimit';
import {
  updateInventorySchema,
  adjustInventorySchema,
  inventoryQuerySchema,
  inventoryAdjustmentsQuerySchema,
  createBatchSchema,
  batchQuerySchema,
  productIdParamSchema,
} from '../validators/inventory.validator';

const inventoryRouter = Router();

// Apply rate limiting
inventoryRouter.use(standardRateLimiter);

// Secure all inventory routes with JWT authentication
inventoryRouter.use(requireAuth);

// GET /inventory - List stock levels with search and filters
inventoryRouter.get('/', validate({ query: inventoryQuerySchema }), controller.getInventory);

// GET /inventory/adjustments - Get history of stock adjustments
inventoryRouter.get(
  '/adjustments',
  validate({ query: inventoryAdjustmentsQuerySchema }),
  controller.getAdjustments,
);

// GET /inventory/batches - Get product batches & expiration alerts
inventoryRouter.get('/batches', validate({ query: batchQuerySchema }), controller.getBatches);

// POST /inventory/batches - Add a new product batch
inventoryRouter.post(
  '/batches',
  requireRoles('admin', 'manager'),
  validate({ body: createBatchSchema }),
  controller.createBatch,
);

// GET /inventory/:productId - Get stock details for a product
inventoryRouter.get(
  '/:productId',
  validate({ params: productIdParamSchema }),
  controller.getInventoryByProductId,
);

// PUT /inventory/:productId - Set direct stock levels (manual correction)
inventoryRouter.put(
  '/:productId',
  requireRoles('admin', 'manager'),
  validate({ params: productIdParamSchema, body: updateInventorySchema }),
  controller.updateInventory,
);

// POST /inventory/adjust - Perform relative adjustments (add, remove, damage, expired)
inventoryRouter.post(
  '/adjust',
  requireRoles('admin', 'manager'),
  validate({ body: adjustInventorySchema }),
  controller.adjustInventory,
);

export { inventoryRouter };
