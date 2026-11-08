import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';
import { WorkOrderStatus } from '@factorypulse/shared';

export interface IMaintenanceWorkOrderDoc {
  id: string;
  _id: string;
  workOrderNumber: string;
  tenantId: string;
  machineId: string;
  title: string;
  description: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY' | 'INSPECTION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: WorkOrderStatus;
  assignedToUserId?: string;
  assignedToUserName?: string;
  checklist: Array<{
    task: string;
    isDone: boolean;
  }>;
  sparePartsUsed: Array<{
    partName: string;
    partNumber: string;
    quantity: number;
  }>;
  downtimeMinutes: number;
  serviceNotes?: string;
  scheduledDate: Date;
  startedAt?: Date;
  completedAt?: Date;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class MaintenanceWorkOrderModel extends MySQLModel {
  static override tableName = 'maintenance_work_orders';
  static override jsonColumns = ['checklist', 'sparePartsUsed'];
  static override inMemoryStore = new Map();
}

ModelRegistry.register('MaintenanceWorkOrder', MaintenanceWorkOrderModel);
export const MaintenanceWorkOrder = MaintenanceWorkOrderModel;
