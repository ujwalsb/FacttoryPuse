import { Request } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { AuditAction, UserRole } from '@factorypulse/shared';
import { AuthenticatedRequest } from './auth.js';
import { logger } from '../logger.js';

export async function recordAudit(
  req: AuthenticatedRequest,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    if (!req.user) return;

    await AuditLog.create({
      tenantId: req.user.tenantId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action,
      resourceType,
      resourceId,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'],
      details
    });
  } catch (error) {
    logger.error({ error, action, resourceId }, 'Failed to write audit log record');
  }
}
