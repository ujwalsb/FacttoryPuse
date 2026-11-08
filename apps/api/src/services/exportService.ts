import { ProductionSummary } from '../models/ProductionSummary.js';
import { Alert } from '../models/Alert.js';
import { MaintenanceWorkOrder } from '../models/MaintenanceWorkOrder.js';
import { AuditLog } from '../models/AuditLog.js';
import { Machine } from '../models/Machine.js';

function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Neutralize CSV formula injection triggers (CWE-1236)
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export class ExportService {
  static async exportProductionCSV(tenantId: string): Promise<string> {
    const records = await ProductionSummary.find({ tenantId })
      .populate('machineId', 'name assetId')
      .sort({ dateString: -1 })
      .limit(1000)
      .lean();

    const headers = [
      'Date',
      'Shift',
      'Asset ID',
      'Machine Name',
      'Good Count',
      'Reject Count',
      'Total Processed',
      'Operating Minutes',
      'Downtime Minutes',
      'Availability %',
      'Performance %',
      'Quality %',
      'OEE %'
    ];

    const rows = records.map((r: any) => [
      sanitizeCsvCell(r.dateString),
      sanitizeCsvCell(r.shiftCode),
      sanitizeCsvCell(r.machineId?.assetId || 'N/A'),
      sanitizeCsvCell(r.machineId?.name || 'N/A'),
      sanitizeCsvCell(r.goodCount ?? 0),
      sanitizeCsvCell(r.rejectCount ?? 0),
      sanitizeCsvCell(r.totalProcessedCount ?? 0),
      sanitizeCsvCell(r.operatingTimeMinutes ?? 0),
      sanitizeCsvCell(r.downtimeMinutes ?? 0),
      sanitizeCsvCell(r.availability ?? 0),
      sanitizeCsvCell(r.performance ?? 0),
      sanitizeCsvCell(r.quality ?? 0),
      sanitizeCsvCell(r.oee ?? 0)
    ]);

    return [headers.map(sanitizeCsvCell).join(','), ...rows.map((row: any) => row.join(','))].join('\n');
  }

  static async exportAlertsCSV(tenantId: string): Promise<string> {
    const alerts = await Alert.find({ tenantId })
      .populate('machineId', 'name assetId')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    const headers = [
      'Date',
      'Severity',
      'Status',
      'Category',
      'Machine',
      'Title',
      'Description',
      'Fault Code',
      'Acknowledged By',
      'Resolved By'
    ];

    const rows = alerts.map((a: any) => [
      sanitizeCsvCell(new Date(a.createdAt).toISOString()),
      sanitizeCsvCell(a.severity),
      sanitizeCsvCell(a.status),
      sanitizeCsvCell(a.category),
      sanitizeCsvCell(a.machineId?.name || 'N/A'),
      sanitizeCsvCell(a.title || ''),
      sanitizeCsvCell(a.description || ''),
      sanitizeCsvCell(a.faultCode || ''),
      sanitizeCsvCell(a.acknowledgedBy?.userName || ''),
      sanitizeCsvCell(a.resolvedBy?.userName || '')
    ]);

    return [headers.map(sanitizeCsvCell).join(','), ...rows.map((row: any) => row.join(','))].join('\n');
  }
}
