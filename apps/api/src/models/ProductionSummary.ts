import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';

export interface IProductionSummaryDoc {
  id: string;
  _id: string;
  tenantId: string;
  machineId: string;
  lineId: string;
  plantId: string;
  dateString: string; // YYYY-MM-DD
  shiftCode: string;  // SHIFT-1, SHIFT-2, SHIFT-3
  goodCount: number;
  rejectCount: number;
  totalProcessedCount: number;
  operatingTimeMinutes: number;
  plannedTimeMinutes: number;
  downtimeMinutes: number;
  idealCycleTimeSeconds: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class ProductionSummaryModel extends MySQLModel {
  static override tableName = 'production_summaries';
  static override inMemoryStore = new Map();
}

ModelRegistry.register('ProductionSummary', ProductionSummaryModel);
export const ProductionSummary = ProductionSummaryModel;
