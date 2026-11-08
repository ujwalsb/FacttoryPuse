import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';
import { UserRole, AuditAction } from '@factorypulse/shared';

export interface IAuditLogDoc {
  id: string;
  _id: string;
  tenantId?: string;
  actorId: string;
  actorEmail: string;
  actorRole: UserRole;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class AuditLogModel extends MySQLModel {
  static override tableName = 'audit_logs';
  static override jsonColumns = ['details'];
  static override inMemoryStore = new Map();
}

ModelRegistry.register('AuditLog', AuditLogModel);
export const AuditLog = AuditLogModel;
