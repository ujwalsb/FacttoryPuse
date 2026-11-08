import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';
import { MachineState } from '@factorypulse/shared';

export interface ITelemetryEventDoc {
  id: string;
  _id: string;
  tenantId: string;
  machineId: string;
  gatewayId?: string;
  timestamp: Date;
  sequenceNumber: number;
  state: MachineState;
  cumulativeGoodCount: number;
  cumulativeRejectCount: number;
  deltaGoodCount: number;
  deltaRejectCount: number;
  cycleTimeSeconds: number;
  temperature?: number;
  vibration?: number;
  powerKw?: number;
  energyKwh?: number;
  voltageV?: number;
  currentA?: number;
  faultCode?: string;
  faultDescription?: string;
  rawPayload?: Record<string, unknown>;
  createdAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class TelemetryEventModel extends MySQLModel {
  static override tableName = 'telemetry_events';
  static override jsonColumns = ['rawPayload'];
  static override inMemoryStore = new Map();
}

ModelRegistry.register('TelemetryEvent', TelemetryEventModel);
export const TelemetryEvent = TelemetryEventModel;
