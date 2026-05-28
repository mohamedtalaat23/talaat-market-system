import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { requireAuth, requireRoles } from '../middleware/auth';

const settingsRouter = Router();

// Secure all settings endpoints to Admin users only
settingsRouter.use(requireAuth);
settingsRouter.use(requireRoles('admin'));

settingsRouter.get('/', settingsController.getSettings.bind(settingsController));
settingsRouter.put('/', settingsController.updateSettings.bind(settingsController));

export { settingsRouter };
