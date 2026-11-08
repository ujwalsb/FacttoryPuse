import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';

export interface IProductionLineDoc {
  id: string;
  _id: string;
  tenantId: string;
  plantId: string;
  name: string;
  code: string;
  targetRatePerHour: number;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class ProductionLineModel extends MySQLModel {
  static override tableName = 'production_lines';
  static override inMemoryStore = new Map();
}

ModelRegistry.register('ProductionLine', ProductionLineModel);
export const ProductionLine = ProductionLineModel;
