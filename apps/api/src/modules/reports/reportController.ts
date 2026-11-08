import { Response } from 'express';
import { ProductionSummary } from '../../models/ProductionSummary.js';
import { TelemetryEvent } from '../../models/TelemetryEvent.js';
import { Alert } from '../../models/Alert.js';
import { ExportService } from '../../services/exportService.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { AuditAction } from '@factorypulse/shared';
import { recordAudit } from '../../middleware/audit.js';

export class ReportController {
  static async getOeeReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filter: any = {};
    if (req.tenantId) filter.tenantId = req.tenantId;

    const availableDates = await ProductionSummary.distinct(
      'dateString',
      req.tenantId ? { tenantId: req.tenantId } : {}
    );
    availableDates.sort().reverse();

    if (req.query.date) {
      filter.dateString = req.query.date;
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayCount = await ProductionSummary.countDocuments({ ...filter, dateString: todayStr });
      if (todayCount > 0) {
        filter.dateString = todayStr;
      } else {
        filter.dateString = availableDates[0] || todayStr;
      }
    }

    const summaries = await ProductionSummary.find(filter)
      .populate('machineId', 'name assetId category state isDeviceConnected expectedCycleTimeSeconds')
      .populate('lineId', 'name code')
      .populate('plantId', 'name code')
      .lean();

    res.json({
      success: true,
      data: summaries,
      date: filter.dateString,
      availableDates
    });
  }

  static async getProductionReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filter: any = {};
    if (req.tenantId) filter.tenantId = req.tenantId;

    const summaries = await ProductionSummary.find(filter)
      .populate('machineId', 'name assetId targetGoodQuantityPerShift')
      .sort({ dateString: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, data: summaries });
  }

  static async getDowntimeReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filter: any = {};
    if (req.tenantId) filter.tenantId = req.tenantId;

    const summaries = await ProductionSummary.find(filter)
      .populate('machineId', 'name assetId')
      .sort({ downtimeMinutes: -1 })
      .limit(50)
      .lean();

    const faultBreakdown = await Alert.aggregate([
      { $match: { ...filter, faultCode: { $exists: true, $ne: null } } },
      { $group: { _id: '$faultCode', count: { $sum: 1 }, latestTitle: { $first: '$title' } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        machineDowntime: summaries,
        faultBreakdown
      }
    });
  }

  static async exportProductionCsv(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const csvContent = await ExportService.exportProductionCSV(req.tenantId);

    await recordAudit(
      req,
      AuditAction.REPORT_EXPORTED,
      'Report',
      'production-csv',
      { type: 'production' }
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="factorypulse-production-report.csv"');
    res.send(csvContent);
  }

  static async exportAlertsCsv(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const csvContent = await ExportService.exportAlertsCSV(req.tenantId);

    await recordAudit(
      req,
      AuditAction.REPORT_EXPORTED,
      'Report',
      'alerts-csv',
      { type: 'alerts' }
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="factorypulse-alerts-report.csv"');
    res.send(csvContent);
  }
}
