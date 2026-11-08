import { Response } from 'express';
import { Tenant } from '../../models/Tenant.js';
import { Machine } from '../../models/Machine.js';
import { User } from '../../models/User.js';
import { Plant } from '../../models/Plant.js';
import { ProductionLine } from '../../models/ProductionLine.js';
import { Gateway } from '../../models/Gateway.js';
import { Alert } from '../../models/Alert.js';
import { AlertRule } from '../../models/AlertRule.js';
import { MaintenanceWorkOrder } from '../../models/MaintenanceWorkOrder.js';
import { ProductionSummary } from '../../models/ProductionSummary.js';
import { TelemetryEvent } from '../../models/TelemetryEvent.js';
import { AuthService } from '../../services/authService.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { CreateTenantSchema, UserRole, AuditAction } from '@factorypulse/shared';
import { recordAudit } from '../../middleware/audit.js';

export class TenantController {
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (req.user?.role === UserRole.MASTER_ADMIN) {
      const tenants = await Tenant.find().sort({ createdAt: -1 });

      const enriched = await Promise.all(
        tenants.map(async (t: any) => {
          const machineCount = await Machine.countDocuments({ tenantId: t._id, isArchived: false });
          const userCount = await User.countDocuments({ tenantId: t._id, isActive: true });
          const plantCount = await Plant.countDocuments({ tenantId: t._id });
          return {
            ...t.toObject(),
            machineCount,
            userCount,
            plantCount
          };
        })
      );

      res.json({ success: true, data: enriched });
    } else {
      // Company-level users only see their own company
      const tenant = await Tenant.findById(req.user?.tenantId);
      if (!tenant) {
        res.status(404).json({ success: false, error: 'Tenant not found' });
        return;
      }
      res.json({ success: true, data: [tenant] });
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;

    if (req.user?.role !== UserRole.MASTER_ADMIN && req.user?.tenantId?.toString() !== id) {
      res.status(403).json({ success: false, error: 'Forbidden: Cannot access other tenant' });
      return;
    }

    const tenant = await Tenant.findById(id);
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    const machineCount = await Machine.countDocuments({ tenantId: tenant._id, isArchived: false });
    const userCount = await User.countDocuments({ tenantId: tenant._id, isActive: true });
    const plantCount = await Plant.countDocuments({ tenantId: tenant._id });

    res.json({
      success: true,
      data: {
        ...tenant.toObject(),
        machineCount,
        userCount,
        plantCount
      }
    });
  }

  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = CreateTenantSchema.parse(req.body);

    const existing = await Tenant.findOne({ code: data.code });
    if (existing) {
      res.status(409).json({ success: false, error: 'Company code already exists' });
      return;
    }

    const tenant = await Tenant.create(data);

    // Create default plant for convenience
    await Plant.create({
      tenantId: tenant._id,
      name: `${tenant.name} HQ Plant`,
      code: 'PLANT-1',
      location: 'Primary Manufacturing Facility'
    });

    // If initial company admin was specified, provision the admin user account
    if (data.adminEmail && data.adminPassword) {
      const passwordHash = await AuthService.hashPassword(data.adminPassword);
      await User.create({
        tenantId: tenant._id,
        name: data.adminName || `${tenant.name} Administrator`,
        email: data.adminEmail.toLowerCase(),
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        isActive: true,
        mfaEnabled: false
      });
    }

    await recordAudit(
      req,
      AuditAction.TENANT_CREATED,
      'Tenant',
      tenant._id.toString(),
      { name: tenant.name, code: tenant.code }
    );

    res.status(201).json({ success: true, data: tenant });
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;

    if (req.user?.role !== UserRole.MASTER_ADMIN && req.user?.tenantId?.toString() !== id) {
      res.status(403).json({ success: false, error: 'Forbidden: Access to other tenant configuration is denied' });
      return;
    }

    let updatePayload: any = { ...req.body };

    // Prevent Mass Assignment Privilege Escalation:
    // Non-Master Admins cannot alter subscription plans, machine/user quotas, status, or company feature flags
    if (req.user?.role !== UserRole.MASTER_ADMIN) {
      const allowedKeys = ['contactEmail', 'contactPhone', 'settings'];
      const sanitized: any = {};
      for (const key of allowedKeys) {
        if (updatePayload[key] !== undefined) {
          sanitized[key] = updatePayload[key];
        }
      }
      updatePayload = sanitized;
    }

    const tenant = await Tenant.findByIdAndUpdate(id, updatePayload, { new: true });
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    await recordAudit(
      req,
      AuditAction.TENANT_UPDATED,
      'Tenant',
      tenant._id.toString(),
      updatePayload
    );

    res.json({ success: true, data: tenant });
  }

  static async updateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'TRIAL'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status value' });
      return;
    }

    const tenant = await Tenant.findByIdAndUpdate(id, { status }, { new: true });
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    await recordAudit(
      req,
      AuditAction.TENANT_UPDATED,
      'Tenant',
      tenant._id.toString(),
      { status }
    );

    res.json({ success: true, data: tenant });
  }

  static async deleteTenant(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;

    if (req.user?.role !== UserRole.MASTER_ADMIN) {
      res.status(403).json({ success: false, error: 'Forbidden: Only Master Admin can delete a company' });
      return;
    }

    const tenant = await Tenant.findById(id);
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    // Cascade clean up all associated documents for this tenant
    await Promise.all([
      Machine.deleteMany({ tenantId: tenant._id }),
      Plant.deleteMany({ tenantId: tenant._id }),
      ProductionLine.deleteMany({ tenantId: tenant._id }),
      User.deleteMany({ tenantId: tenant._id }),
      Gateway.deleteMany({ tenantId: tenant._id }),
      Alert.deleteMany({ tenantId: tenant._id }),
      AlertRule.deleteMany({ tenantId: tenant._id }),
      MaintenanceWorkOrder.deleteMany({ tenantId: tenant._id }),
      ProductionSummary.deleteMany({ tenantId: tenant._id }),
      TelemetryEvent.deleteMany({ tenantId: tenant._id }),
      Tenant.findByIdAndDelete(tenant._id)
    ]);

    await recordAudit(
      req,
      AuditAction.TENANT_DELETED,
      'Tenant',
      tenant._id.toString(),
      { name: tenant.name, code: tenant.code }
    );

    res.json({
      success: true,
      message: `Company '${tenant.name}' and all associated company data were deleted successfully.`
    });
  }
}
