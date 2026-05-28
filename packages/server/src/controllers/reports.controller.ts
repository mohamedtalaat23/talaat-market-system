import type { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '../config/constants';
import { reportsRepository } from '../repositories/reports.repository';
import { NotFoundError } from '../middleware/errorHandler';

export async function getShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 15;
    const cashier_id = req.query.cashier_id ? Number(req.query.cashier_id) : undefined;

    const filters: any = { page, limit };
    if (cashier_id) filters.cashier_id = cashier_id;

    const result = await reportsRepository.getShifts(filters);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.items,
      meta: result.meta
    });
  } catch (error) {
    next(error);
  }
}

export async function getShiftDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const result = await reportsRepository.getShiftDetail(id);

    if (!result) {
      throw new NotFoundError('Closed shift not found', id);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getWeeklyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let { week_start, week_end } = req.query;

    if (!week_start) {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday
      const monday = new Date(now.setDate(diff));
      week_start = monday.toISOString().substring(0, 10);
    }
    
    if (!week_end) {
      const start = new Date(week_start as string);
      start.setDate(start.getDate() + 6);
      week_end = start.toISOString().substring(0, 10);
    }

    // Add time boundary to end date if it's just a YYYY-MM-DD
    let weekStartStr = String(week_start);
    let weekEndStr = String(week_end);
    if (weekEndStr.length === 10) {
      weekEndStr = `${weekEndStr}T23:59:59.999Z`;
    }

    const result = await reportsRepository.getWeeklyReport(weekStartStr, weekEndStr);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getOverrides(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const date_from = req.query.date_from ? String(req.query.date_from) : undefined;
    const date_to = req.query.date_to ? String(req.query.date_to) : undefined;

    const filters: any = { page, limit };
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;

    const result = await reportsRepository.getOverrides(filters);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.items,
      meta: result.meta
    });
  } catch (error) {
    next(error);
  }
}
