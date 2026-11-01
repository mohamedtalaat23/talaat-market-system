import type { Role } from '../config/constants';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: Role;
        /** True when the account must rotate its password before doing anything else. */
        must_change_password: boolean;
      };
    }
  }
}

