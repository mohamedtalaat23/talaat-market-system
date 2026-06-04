import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { settingsRepository } from '../repositories/settings.repository';
import { logger } from '../middleware/logger';

const updateSettingsSchema = z.record(z.any());

export class SettingsController {
  async getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsRepository.getAllSettings();
      res.json({
        status: 'success',
        data: settings,
      });
    } catch (error) {
      logger.error('Error fetching settings:', error);
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = updateSettingsSchema.parse(req.body);
      // user is attached by requireAuth middleware
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const updatedSettings = await settingsRepository.updateSettings(payload, userId);

      res.json({
        status: 'success',
        data: updatedSettings,
      });
    } catch (error) {
      logger.error('Error updating settings:', error);
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
