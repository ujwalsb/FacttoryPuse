import { Response } from 'express';
import { MaintenanceWorkOrder } from '../../models/MaintenanceWorkOrder.js';
import { Machine } from '../../models/Machine.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { CreateWorkOrderSchema, WorkOrderStatus, MachineState, AuditAction } from '@factorypulse/shared';
import { recordAudit } from '../../middleware/audit.js';

export class MaintenanceController {
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filter: any = {};
    if (req.tenantId) filter.tenantId = req.tenantId;

    if (req.query.machineId) filter.machineId = req.query.machineId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;

    const workOrders = await MaintenanceWorkOrder.find(filter)
      .populate('machineId', 'name assetId')
      .populate('assignedToUserId', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: workOrders });
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const filter: any = { _id: id };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const wo = await MaintenanceWorkOrder.findOne(filter)
      .populate('machineId', 'name assetId category manufacturer')
      .populate('assignedToUserId', 'name email');

    if (!wo) {
      res.status(404).json({ success: false, error: 'Work order not found' });
      return;
    }

    res.json({ success: true, data: wo });
  }

  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = CreateWorkOrderSchema.parse(req.body);
    const tenantId = req.tenantId || data.tenantId;

    const count = await MaintenanceWorkOrder.countDocuments({ tenantId });
    const workOrderNumber = `WO-${String(count + 101).padStart(4, '0')}`;

    const workOrder = await MaintenanceWorkOrder.create({
      ...data,
      workOrderNumber,
      tenantId,
      scheduledDate: new Date(data.scheduledDate)
    });

    await recordAudit(
      req,
      AuditAction.MAINTENANCE_CREATED,
      'MaintenanceWorkOrder',
      workOrder._id.toString(),
      { workOrderNumber, title: workOrder.title }
    );

    res.status(201).json({ success: true, data: workOrder });
  }

  static async updateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { status, downtimeMinutes, serviceNotes, checklist, sparePartsUsed } = req.body;

    const filter: any = { _id: id };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const wo = await MaintenanceWorkOrder.findOne(filter);
    if (!wo) {
      res.status(404).json({ success: false, error: 'Work order not found' });
      return;
    }

    if (status) wo.status = status;
    if (downtimeMinutes !== undefined) wo.downtimeMinutes = downtimeMinutes;
    if (serviceNotes) wo.serviceNotes = serviceNotes;
    if (checklist) wo.checklist = checklist;
    if (sparePartsUsed) wo.sparePartsUsed = sparePartsUsed;

    if (status === WorkOrderStatus.IN_PROGRESS && !wo.startedAt) {
      wo.startedAt = new Date();
      // Put machine in MAINTENANCE state
      await Machine.findByIdAndUpdate(wo.machineId, { state: MachineState.MAINTENANCE });
    } else if (status === WorkOrderStatus.COMPLETED) {
      wo.completedAt = new Date();
      // Machine returns to IDLE state awaiting startup
      await Machine.findByIdAndUpdate(wo.machineId, { state: MachineState.IDLE });
    } else if (status === WorkOrderStatus.VERIFIED) {
      wo.verifiedAt = new Date();
    }

    await wo.save();

    await recordAudit(
      req,
      AuditAction.MAINTENANCE_UPDATED,
      'MaintenanceWorkOrder',
      wo._id.toString(),
      { status: wo.status }
    );

    res.json({ success: true, data: wo });
  }
}
