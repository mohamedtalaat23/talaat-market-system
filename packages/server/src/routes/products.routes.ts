import { Router } from 'express';
import * as controller from '../controllers/product.controller';
import { validate } from '../middleware/validate';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  productIdParamSchema,
  productBarcodeParamSchema,
} from '../validators/product.validator';

const productsRouter = Router();

// GET /products - List products with filters and search
productsRouter.get(
  '/',
  validate({ query: productQuerySchema }),
  controller.getProducts
);

// GET /products/:id - Get product by numeric ID
productsRouter.get(
  '/:id',
  validate({ params: productIdParamSchema }),
  controller.getProductById
);

// GET /products/barcode/:code - Get product by barcode string
productsRouter.get(
  '/barcode/:code',
  validate({ params: productBarcodeParamSchema }),
  controller.getProductByBarcode
);

// POST /products - Create product + initial inventory
productsRouter.post(
  '/',
  validate({ body: createProductSchema }),
  controller.createProduct
);

// PUT /products/:id - Update product details
productsRouter.put(
  '/:id',
  validate({ params: productIdParamSchema, body: updateProductSchema }),
  controller.updateProduct
);

// DELETE /products/:id - Soft-delete product
productsRouter.delete(
  '/:id',
  validate({ params: productIdParamSchema }),
  controller.deleteProduct
);

export { productsRouter };
