import { Router } from 'express';
import { posController } from '../controllers/pos.controller';
import { requireAuth } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import {
  checkoutSchema,
  reprintSchema,
  posIdParamSchema,
  salesQuerySchema,
  openShiftSchema,
  closeShiftSchema,
} from '../validators/pos.validator';

const router = Router();

// Apply rate limiting
router.use(standardRateLimiter);

// All POS routes require authentication
router.use(requireAuth);

// Transaction
router.post(
  '/checkout',
  validate({ body: checkoutSchema }),
  posController.checkout
);

// Print Recovery & Reprints
router.post(
  '/receipts/:id/print',
  validate({ params: posIdParamSchema }),
  posController.markReceiptPrinted
);

router.post(
  '/receipts/:id/reprint',
  validate({ params: posIdParamSchema, body: reprintSchema }),
  posController.reprintReceipt
);

router.get(
  '/receipts/:id',
  validate({ params: posIdParamSchema }),
  posController.getReceipt
);

router.get(
  '/sales/search',
  validate({ query: salesQuerySchema }),
  posController.searchSales
);

// Shift Management
router.post(
  '/shifts/open',
  validate({ body: openShiftSchema }),
  posController.openShift
);

router.post(
  '/shifts/close',
  validate({ body: closeShiftSchema }),
  posController.closeShift
);

router.get(
  '/shifts/current',
  posController.getCurrentShift
);

router.get(
  '/shifts/:id/summary',
  validate({ params: posIdParamSchema }),
  posController.getShiftSummary
);

export default router;

