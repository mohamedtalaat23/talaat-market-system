import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { settingsRepository } from '../repositories/settings.repository';
import { logger } from '../middleware/logger';

const updateSettingsSchema = z.record(
  z.string().trim().max(100),
  z.union([z.string().max(5000), z.number(), z.boolean(), z.null()]),
);

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

  async createBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { backupService } = await import('../services/backup.service');
      // Credential hashes are included by default so the snapshot can actually be
      // restored. `include_credentials=false` produces a safer-to-share export that
      // requires re-provisioning every employee after a restore.
      const includeCredentials = req.body?.include_credentials !== false;
      const backup = await backupService.createBackup({ includeCredentials });
      res.json({
        status: 'success',
        data: backup,
      });
    } catch (error) {
      logger.error('Error creating database backup:', error);
      next(error);
    }
  }

  async listBackups(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { backupService } = await import('../services/backup.service');
      const backups = await backupService.listBackups();
      res.json({
        status: 'success',
        data: backups,
      });
    } catch (error) {
      logger.error('Error listing database backups:', error);
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
