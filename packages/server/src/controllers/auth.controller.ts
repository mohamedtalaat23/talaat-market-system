import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { HTTP_STATUS } from '../config/constants';

/**
 * POST /auth/login
 *
 * Authenticates user credentials (password or PIN) and returns a signed JWT.
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, password, pin } = req.body;
    const result = await authService.login(username, password, pin);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/logout
 *
 * Stateless logout endpoint. Simply instructs client to clear token.
 */
export async function logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // With stateless JWT, server doesn't maintain session storage.
    // Client simply deletes the token from its memory/localstorage.
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/me
 *
 * Returns the currently authenticated employee details.
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // req.user was populated by requireAuth middleware
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
}
