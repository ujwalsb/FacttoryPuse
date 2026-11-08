import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';
import { AlertSeverity, AlertStatus } from '@factorypulse/shared';
import { getPool, isDBConnected } from '../config/db.js';

export interface IAlertDoc {
  id: string;
  _id: string;
  tenantId: string;
  machineId: string;
  ruleId?: string;
  title: string;
  description: string;
  category: string;
  severity: AlertSeverity;
  status: AlertStatus;
  faultCode?: string;
  acknowledgedBy?: {
    userId: string;
    userName: string;
    timestamp: Date;
  };
  resolvedBy?: {
    userId: string;
    userName: string;
    timestamp: Date;
    resolutionNotes: string;
  };
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class AlertModel extends MySQLModel {
  static override tableName = 'alerts';
  static override jsonColumns = ['acknowledgedBy', 'resolvedBy'];
  static override inMemoryStore = new Map();

  static async aggregate(pipeline: any[]): Promise<any[]> {
    const pool = getPool();
    // Check if this is the faultBreakdown aggregation
    const matchStage = pipeline.find(p => p.$match)?.$match || {};
    const hasFaultCodeGroup = pipeline.some(p => p.$group && p.$group._id === '$faultCode');

    if (hasFaultCodeGroup && pool && isDBConnected()) {
      const cleanMatch = { ...matchStage };
      delete cleanMatch.faultCode;

      const { sqlWhere, params } = this.buildWhereClause(cleanMatch);
      const sql = `SELECT faultCode as _id, COUNT(*) as count, MAX(title) as latestTitle
                   FROM \`${this.tableName}\`
                   ${sqlWhere} AND faultCode IS NOT NULL AND faultCode != ''
                   GROUP BY faultCode
                   ORDER BY count DESC;`;
      const [rows]: any = await pool.query(sql, params);
      return rows || [];
    }

    // In-memory calculation
    const all = Array.from(this.inMemoryStore.values()).filter(item => {
      if (matchStage.tenantId && item.tenantId !== matchStage.tenantId) return false;
      return Boolean(item.faultCode);
    });

    const groups = new Map<string, { _id: string; count: number; latestTitle: string }>();
    for (const a of all) {
      const code = a.faultCode;
      if (!code) continue;
      if (!groups.has(code)) {
        groups.set(code, { _id: code, count: 0, latestTitle: a.title });
      }
      const g = groups.get(code)!;
      g.count += 1;
      g.latestTitle = a.title;
    }

    const res = Array.from(groups.values());
    res.sort((a, b) => b.count - a.count);
    return res;
  }
}

ModelRegistry.register('Alert', AlertModel);
export const Alert = AlertModel;
