import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';
import { CommandType, CommandExecutionStatus } from '@factorypulse/shared';

export interface IMachineCommandDoc {
  id: string;
  _id: string;
  commandId: string;
  tenantId: string;
  machineId: string;
  command: CommandType;
  requestedByUserId: string;
  requestedByUserName: string;
  reason: string;
  status: CommandExecutionStatus;
  issuedAt: Date;
  acknowledgedAt?: Date;
  observedAt?: Date;
  responsePayload?: Record<string, unknown>;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class MachineCommandModel extends MySQLModel {
  static override tableName = 'machine_commands';
  static override jsonColumns = ['responsePayload'];
  static override inMemoryStore = new Map();
}

ModelRegistry.register('MachineCommand', MachineCommandModel);
export const MachineCommand = MachineCommandModel;
