import { Response, NextFunction } from 'express';
import { UserRole } from '@factorypulse/shared';
import { AuthenticatedRequest } from './auth.js';

export function enforceTenantIsolation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  // Master Admin can inspect any tenant specified in query, header or body, or platform-wide if omitted
  if (req.user.role === UserRole.MASTER_ADMIN) {
    const requestedTenantId =
      (req.query.tenantId as string) ||
      (req.headers['x-tenant-id'] as string) ||
      req.body?.tenantId;
    req.tenantId = requestedTenantId || undefined;
    return next();
  }

  // All other users MUST belong to a valid tenant
  if (!req.user.tenantId) {
    res.status(403).json({
      success: false,
      error: 'User account has no associated manufacturing company'
    });
    return;
  }

  const userTenantId = req.user.tenantId.toString();

  // If the request attempts to specify a different tenantId, immediately reject as an IDOR violation
  const requestedTenantId =
    (req.query.tenantId as string) ||
    (req.headers['x-tenant-id'] as string) ||
    req.body?.tenantId;

  if (requestedTenantId && requestedTenantId !== userTenantId) {
    res.status(403).json({
      success: false,
      error: 'Security violation: Access to other tenant resources is forbidden'
    });
    return;
  }

  req.tenantId = userTenantId;
  next();
}
