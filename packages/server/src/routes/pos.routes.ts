import { Router } from 'express';
import { posController } from '../controllers/pos.controller';
import { requireAuth } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply rate limiting
router.use(standardRateLimiter);

// All POS routes require authentication
router.use(requireAuth);

// Transaction
router.post('/checkout', posController.checkout);

// Print Recovery & Reprints
router.post('/receipts/:id/print', posController.markReceiptPrinted);
router.post('/receipts/:id/reprint', posController.reprintReceipt);
router.get('/receipts/:id', posController.getReceipt);
router.get('/sales/search', posController.searchSales);

// Shift Management
router.post('/shifts/open', posController.openShift);
router.post('/shifts/close', posController.closeShift);
router.get('/shifts/current', posController.getCurrentShift);
router.get('/shifts/:id/summary', posController.getShiftSummary);

export default router;
