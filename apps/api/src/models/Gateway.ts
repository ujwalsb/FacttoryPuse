import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';
import { IndustrialProtocol } from '@factorypulse/shared';

export interface IGatewayDoc {
  id: string;
  _id: string;
  tenantId: string;
  plantId: string;
  name: string;
  gatewayKey: string;
  ipAddress: string;
  version: string;
  protocolSupport: IndustrialProtocol[];
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  lastSeenAt: Date;
  metrics: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    queuedMessages: number;
  };
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class GatewayModel extends MySQLModel {
  static override tableName = 'gateways';
  static override jsonColumns = ['protocolSupport', 'metrics'];
  static override inMemoryStore = new Map();
}

ModelRegistry.register('Gateway', GatewayModel);
export const Gateway = GatewayModel;
