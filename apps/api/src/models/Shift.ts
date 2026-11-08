import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';

export interface IShiftDoc {
  id: string;
  _id: string;
  tenantId: string;
  name: string;
  code: string;
  startTime: string; // HH:mm format, e.g. "06:00"
  endTime: string;   // HH:mm format, e.g. "14:00"
  plannedDurationMinutes: number;
  breakDurationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class ShiftModel extends MySQLModel {
  static override tableName = 'shifts';
  static override inMemoryStore = new Map();
}

ModelRegistry.register('Shift', ShiftModel);
export const Shift = ShiftModel;
