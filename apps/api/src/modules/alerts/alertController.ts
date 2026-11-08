import { Response } from 'express';
import { Alert } from '../../models/Alert.js';
import { AlertRule } from '../../models/AlertRule.js';
import { AlertService } from '../../services/alertService.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { CreateAlertRuleSchema, AuditAction } from '@factorypulse/shared';
import { recordAudit } from '../../middleware/audit.js';

export class AlertController {
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filter: any = {};
    if (req.tenantId) filter.tenantId = req.tenantId;

    if (req.query.status) filter.status = req.query.status;
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.machineId) filter.machineId = req.query.machineId;

    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .populate('machineId', 'name assetId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Alert.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: alerts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  }

  static async acknowledge(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const filter: any = { _id: id };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const alert = await Alert.findOne(filter);
    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    const updated = await AlertService.acknowledgeAlert(alert._id.toString(), req.user);

    await recordAudit(
      req,
      AuditAction.ALERT_ACKNOWLEDGED,
      'Alert',
      alert._id.toString(),
      { title: alert.title }
    );

    res.json({ success: true, data: updated });
  }

  static async resolve(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { notes } = req.body;
    const filter: any = { _id: id };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const alert = await Alert.findOne(filter);
    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    const updated = await AlertService.resolveAlert(
      alert._id.toString(),
      req.user,
      notes || 'Resolved by operator/engineer'
    );

    await recordAudit(
      req,
      AuditAction.ALERT_RESOLVED,
      'Alert',
      alert._id.toString(),
      { title: alert.title, notes }
    );

    res.json({ success: true, data: updated });
  }

  static async listRules(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filter: any = {};
    if (req.tenantId) filter.tenantId = req.tenantId;

    const rules = await AlertRule.find(filter)
      .populate('machineId', 'name assetId')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: rules });
  }

  static async createRule(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = CreateAlertRuleSchema.parse(req.body);
    const tenantId = req.tenantId || data.tenantId;

    const rule = await AlertRule.create({
      ...data,
      tenantId
    });

    res.status(201).json({ success: true, data: rule });
  }

  static async deleteRule(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const filter: any = { _id: id };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const rule = await AlertRule.findOneAndDelete(filter);
    if (!rule) {
      res.status(404).json({ success: false, error: 'Alert rule not found' });
      return;
    }

    res.json({ success: true, message: 'Alert rule deleted' });
  }
}
