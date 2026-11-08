import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { AuthService } from '../services/authService.js';
import { User } from '../models/User.js';
import { UserRole } from '@factorypulse/shared';

export async function verifyAdminPassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawHeader = req.headers['x-admin-password'];
    const headerPassword = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const bodyPassword = req.body?.adminPassword;

    // Disallow password extraction from URL query parameters to prevent credential logging in server access logs
    const candidatePassword = (headerPassword || bodyPassword || '').trim();

    if (!candidatePassword) {
      if (req.user?.role === UserRole.MASTER_ADMIN || req.user?.role === UserRole.COMPANY_ADMIN) {
        return next();
      }

      res.status(401).json({
        success: false,
        requireAdminPassword: true,
        error: 'Administrator password required to perform this action'
      });
      return;
    }

    // 1. Verify against currently authenticated user
    if (req.user?.passwordHash) {
      const isUserMatch = await AuthService.verifyPassword(candidatePassword, req.user.passwordHash);
      if (isUserMatch) {
        return next();
      }
    }

    // 2. Verify against tenant admins or master admins
    const adminQuery: any = {
      role: { $in: [UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN] },
      isActive: true
    };

    if (req.tenantId) {
      adminQuery.$or = [
        { tenantId: req.tenantId },
        { role: UserRole.MASTER_ADMIN }
      ];
    }

    const admins = await User.find(adminQuery).select('+passwordHash');
    for (const admin of admins) {
      if (admin.passwordHash) {
        const isMatch = await AuthService.verifyPassword(candidatePassword, admin.passwordHash);
        if (isMatch) {
          return next();
        }
      }
    }

    res.status(401).json({
      success: false,
      requireAdminPassword: true,
      error: 'Invalid administrator password. Authorization denied.'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Error validating administrator credentials'
    });
  }
}
