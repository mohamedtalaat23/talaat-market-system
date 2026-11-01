import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthenticationError } from '../middleware/errorHandler';
import { invalidateAuthCache } from '../middleware/auth';
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
 * POST /auth/fast-pin
 *
 * Fast PIN Switching: Authenticates a cashier purely via a 4-digit PIN.
 */
export async function fastPinLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, pin } = req.body;
    const result = await authService.login(username, undefined, pin);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/change-password
 *
 * Rotates the password of the currently authenticated employee and clears the
 * `must_change_password` flag. Requires the current password.
 */
export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const { current_password, new_password } = req.body;
    const { token } = await authService.changePassword(
      req.user.id,
      req.user.username,
      current_password,
      new_password,
    );

    // The password rotation bumped the account's auth epoch, so every previously
    // issued token (including the caller's) is now invalid. Return a fresh one for
    // the session that performed the rotation.
    invalidateAuthCache(req.user.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password changed successfully',
      data: { token },
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
