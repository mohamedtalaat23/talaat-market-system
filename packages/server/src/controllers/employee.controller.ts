import type { Request, Response, NextFunction } from 'express';
import { employeeService } from '../services/employee.service';
import { HTTP_STATUS } from '../config/constants';

/**
 * GET /employees
 * 
 * Lists employees with filters and paging. Restricted to admin/manager.
 */
export async function getEmployees(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filters = req.query as unknown as Parameters<typeof employeeService.getEmployees>[0];
    const result = await employeeService.getEmployees(filters);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /employees/:id
 * 
 * Fetches single employee detail by ID. Restricted to admin/manager.
 */
export async function getEmployeeById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const employee = await employeeService.getEmployeeById(id);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /employees
 * 
 * Creates a new employee user account. Restricted to admin.
 */
export async function createEmployee(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const employee = await employeeService.createEmployee(req.body);
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /employees/:id
 * 
 * Updates employee account details. Restricted to admin (or manager for non-admin accounts).
 */
export async function updateEmployee(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const employee = await employeeService.updateEmployee(id, req.body);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /employees/:id
 * 
 * Soft-deletes an employee. Restricted to admin.
 */
export async function deleteEmployee(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await employeeService.deleteEmployee(id);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Employee account deleted successfully (soft-delete)',
    });
  } catch (error) {
    next(error);
  }
}
