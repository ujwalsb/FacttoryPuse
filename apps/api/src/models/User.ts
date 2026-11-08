import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';
import { UserRole } from '@factorypulse/shared';

export interface IUserDoc {
  id: string;
  _id: string;
  tenantId?: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  assignedMachines: string[];
  refreshToken?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class UserModel extends MySQLModel {
  static override tableName = 'users';
  static override jsonColumns = ['assignedMachines'];
  static override inMemoryStore = new Map();
}

ModelRegistry.register('User', UserModel);
export const User = UserModel;
