import { Response } from 'express';
import { AuditLog } from '../../models/AuditLog.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class AuditController {
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filter: any = {};
    if (req.tenantId) filter.tenantId = req.tenantId;

    if (req.query.action) filter.action = req.query.action;
    if (req.query.resourceType) filter.resourceType = req.query.resourceType;

    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  }
}
