import { Response, NextFunction } from 'express';
import { UserRole } from '@factorypulse/shared';
import { AuthenticatedRequest } from './auth.js';

export function authorizeRoles(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden: Role '${req.user.role}' lacks permission for this operation`
      });
      return;
    }

    next();
  };
}
