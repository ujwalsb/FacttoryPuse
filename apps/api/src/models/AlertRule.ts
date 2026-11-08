import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';
import { AlertSeverity } from '@factorypulse/shared';

export interface IAlertRuleDoc {
  id: string;
  _id: string;
  tenantId: string;
  name: string;
  machineId?: string;
  metric: string;
  condition: string;
  thresholdValue: any;
  severity: AlertSeverity;
  cooldownMinutes: number;
  isEnabled: boolean;
  lastTriggeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class AlertRuleModel extends MySQLModel {
  static override tableName = 'alert_rules';
  static override jsonColumns = ['thresholdValue'];
  static override inMemoryStore = new Map();
}

ModelRegistry.register('AlertRule', AlertRuleModel);
export const AlertRule = AlertRuleModel;
