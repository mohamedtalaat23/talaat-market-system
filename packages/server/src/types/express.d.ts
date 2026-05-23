import type { Role } from '../config/constants';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: Role;
      };
    }
  }
}
