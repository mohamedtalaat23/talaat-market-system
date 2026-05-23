import { Router } from 'express';
import * as controller from '../controllers/inventory.controller';
import { validate } from '../middleware/validate';
import {
  updateInventorySchema,
  adjustInventorySchema,
  inventoryQuerySchema,
  productIdParamSchema,
} from '../validators/inventory.validator';

const inventoryRouter = Router();

// GET /inventory - List stock levels with search and filters
inventoryRouter.get(
  '/',
  validate({ query: inventoryQuerySchema }),
  controller.getInventory
);

// GET /inventory/:productId - Get stock details for a product
inventoryRouter.get(
  '/:productId',
  validate({ params: productIdParamSchema }),
  controller.getInventoryByProductId
);

// PUT /inventory/:productId - Set direct stock levels (manual correction)
inventoryRouter.put(
  '/:productId',
  validate({ params: productIdParamSchema, body: updateInventorySchema }),
  controller.updateInventory
);

// POST /inventory/adjust - Perform relative adjustments (add, remove, damage, expired)
inventoryRouter.post(
  '/adjust',
  validate({ body: adjustInventorySchema }),
  controller.adjustInventory
);

export { inventoryRouter };
