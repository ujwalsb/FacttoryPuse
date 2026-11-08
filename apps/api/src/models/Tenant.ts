import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';

export interface ITenantDoc {
  id: string;
  _id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  maxMachines: number;
  maxUsers: number;
  contactEmail: string;
  contactPhone?: string;
  features?: {
    advancedOee: boolean;
    remoteControl: boolean;
    opcUaSupport: boolean;
    mqttTlsSupport: boolean;
    modbusTcpSupport: boolean;
    predictiveMaintenance: boolean;
    customExportReports: boolean;
  };
  settings: {
    telemetryRetentionDays: number;
    timezone: string;
    currency: string;
    staleDataThresholdSeconds: number;
  };
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class TenantModel extends MySQLModel {
  static override tableName = 'tenants';
  static override jsonColumns = ['features', 'settings'];
  static override inMemoryStore = new Map();
}

ModelRegistry.register('Tenant', TenantModel);
export const Tenant = TenantModel;
