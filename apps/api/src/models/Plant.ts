import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';

export interface IPlantDoc {
  id: string;
  _id: string;
  tenantId: string;
  name: string;
  code: string;
  location: string;
  managerName?: string;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class PlantModel extends MySQLModel {
  static override tableName = 'plants';
  static override inMemoryStore = new Map();
}

ModelRegistry.register('Plant', PlantModel);
export const Plant = PlantModel;
