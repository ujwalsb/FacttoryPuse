import { Machine, IMachineDoc } from '../models/Machine.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { ProductionSummary } from '../models/ProductionSummary.js';
import { OEEService } from './oeeService.js';
import { AlertService } from './alertService.js';
import { getSocketServer } from '../socket/socketServer.js';
import { MachineState } from '@factorypulse/shared';
import { logger } from '../logger.js';

export interface IngestTelemetryPayload {
  tenantId: string;
  machineId: string;
  gatewayId?: string;
  timestamp?: string;
  sequenceNumber: number;
  state: MachineState;
  cumulativeGoodCount: number;
  cumulativeRejectCount: number;
  cycleTimeSeconds: number;
  temperature?: number;
  vibration?: number;
  powerKw?: number;
  energyKwh?: number;
  voltageV?: number;
  currentA?: number;
  faultCode?: string;
  faultDescription?: string;
}

export class TelemetryService {
  static async ingest(payload: IngestTelemetryPayload): Promise<void> {
    const machine = await Machine.findById(payload.machineId);
    if (!machine) {
      logger.warn({ machineId: payload.machineId }, 'Ingestion rejected: Machine not found');
      return;
    }

    // Tenant boundary check
    if (machine.tenantId.toString() !== payload.tenantId) {
      logger.error(
        { machineTenant: machine.tenantId, payloadTenant: payload.tenantId },
        'Ingestion rejected: Cross-tenant machine mismatch'
      );
      return;
    }

    // Retrieve previous telemetry event to compute counter deltas safely
    const lastEvent = await TelemetryEvent.findOne({ machineId: machine._id })
      .sort({ sequenceNumber: -1 })
      .exec();

    let deltaGood = 0;
    let deltaReject = 0;

    if (lastEvent) {
      // Counter rollover or PLC reset detection
      if (payload.cumulativeGoodCount >= lastEvent.cumulativeGoodCount) {
        deltaGood = payload.cumulativeGoodCount - lastEvent.cumulativeGoodCount;
      } else {
        // Counter reset occurred; treat new count as delta
        deltaGood = payload.cumulativeGoodCount;
      }

      if (payload.cumulativeRejectCount >= lastEvent.cumulativeRejectCount) {
        deltaReject = payload.cumulativeRejectCount - lastEvent.cumulativeRejectCount;
      } else {
        deltaReject = payload.cumulativeRejectCount;
      }
    } else {
      deltaGood = payload.cumulativeGoodCount;
      deltaReject = payload.cumulativeRejectCount;
    }

    const now = new Date(payload.timestamp || Date.now());

    // 1. Persist discrete telemetry event
    const telemetryDoc = await TelemetryEvent.create({
      tenantId: machine.tenantId,
      machineId: machine._id,
      gatewayId: payload.gatewayId || machine.gatewayId,
      timestamp: now,
      sequenceNumber: payload.sequenceNumber,
      state: payload.state,
      cumulativeGoodCount: payload.cumulativeGoodCount,
      cumulativeRejectCount: payload.cumulativeRejectCount,
      deltaGoodCount: deltaGood,
      deltaRejectCount: deltaReject,
      cycleTimeSeconds: payload.cycleTimeSeconds,
      temperature: payload.temperature,
      vibration: payload.vibration,
      powerKw: payload.powerKw,
      energyKwh: payload.energyKwh,
      voltageV: payload.voltageV,
      currentA: payload.currentA,
      faultCode: payload.faultCode,
      faultDescription: payload.faultDescription
    });

    // 2. Update current Machine state
    machine.state = payload.state;
    machine.lastHeartbeat = now;
    machine.lastTelemetryAt = now;
    machine.currentFaultCode = payload.faultCode;
    machine.currentFaultDescription = payload.faultDescription;
    await machine.save();

    // 3. Update rolling production summary and OEE for today's shift
    const todayStr = now.toISOString().split('T')[0];
    const shiftCode = 'SHIFT-1'; // Default primary shift

    let summary = await ProductionSummary.findOne({
      tenantId: machine.tenantId,
      machineId: machine._id,
      dateString: todayStr,
      shiftCode
    });

    if (!summary) {
      summary = new ProductionSummary({
        tenantId: machine.tenantId,
        machineId: machine._id,
        lineId: machine.lineId,
        plantId: machine.plantId,
        dateString: todayStr,
        shiftCode,
        goodCount: 0,
        rejectCount: 0,
        totalProcessedCount: 0,
        operatingTimeMinutes: 1,
        plannedTimeMinutes: 480,
        downtimeMinutes: 0,
        idealCycleTimeSeconds: machine.expectedCycleTimeSeconds || 10
      });
    }

    summary.goodCount += deltaGood;
    summary.rejectCount += deltaReject;
    summary.totalProcessedCount = summary.goodCount + summary.rejectCount;

    if (payload.state === MachineState.RUNNING) {
      summary.operatingTimeMinutes += 0.05; // tick contribution
    } else if (payload.state === MachineState.FAULTED || payload.state === MachineState.STOPPED) {
      summary.downtimeMinutes += 0.05;
    }

    // Recalculate OEE
    const oeeMetrics = OEEService.calculateOEE({
      operatingTimeMinutes: summary.operatingTimeMinutes,
      plannedTimeMinutes: summary.plannedTimeMinutes,
      downtimeMinutes: summary.downtimeMinutes,
      goodCount: summary.goodCount,
      rejectCount: summary.rejectCount,
      idealCycleTimeSeconds: summary.idealCycleTimeSeconds
    });

    summary.availability = oeeMetrics.availability;
    summary.performance = oeeMetrics.performance;
    summary.quality = oeeMetrics.quality;
    try {
      await summary.save();
    } catch (saveErr: any) {
      if (saveErr?.code === 11000) {
        const existing = await ProductionSummary.findOne({
          tenantId: machine.tenantId,
          machineId: machine._id,
          dateString: todayStr,
          shiftCode
        });
        if (existing) {
          existing.goodCount += deltaGood;
          existing.rejectCount += deltaReject;
          existing.totalProcessedCount = existing.goodCount + existing.rejectCount;
          existing.availability = oeeMetrics.availability;
          existing.performance = oeeMetrics.performance;
          existing.quality = oeeMetrics.quality;
          existing.oee = oeeMetrics.oee;
          await existing.save();
        }
      } else {
        throw saveErr;
      }
    }

    // 4. Evaluate Alert rules
    const rejectionRate = summary.totalProcessedCount > 0
      ? (summary.rejectCount / summary.totalProcessedCount) * 100
      : 0;

    await AlertService.evaluateRules(machine, {
      state: payload.state,
      temperature: payload.temperature,
      vibration: payload.vibration,
      rejectionRate,
      cycleTimeSeconds: payload.cycleTimeSeconds,
      faultCode: payload.faultCode
    });

    // 5. Broadcast to real-time WebSocket rooms
    const io = getSocketServer();
    if (io) {
      const livePayload = {
        machineId: machine._id.toString(),
        assetId: machine.assetId,
        name: machine.name,
        state: machine.state,
        lastTelemetryAt: machine.lastTelemetryAt,
        goodCount: summary.goodCount,
        rejectCount: summary.rejectCount,
        totalProcessedCount: summary.totalProcessedCount,
        rejectionRatePercent: Math.round(rejectionRate * 10) / 10,
        cycleTimeSeconds: payload.cycleTimeSeconds,
        temperature: payload.temperature,
        vibration: payload.vibration,
        powerKw: payload.powerKw,
        energyKwh: payload.energyKwh,
        voltageV: payload.voltageV,
        currentA: payload.currentA,
        faultCode: payload.faultCode,
        faultDescription: payload.faultDescription,
        oee: oeeMetrics
      };

      // Broadcast to tenant-wide overview room and platform admin
      io.to(`tenant_${machine.tenantId.toString()}`).emit('telemetry:update', livePayload);
      io.to('platform_admin').emit('telemetry:update', livePayload);

      // Broadcast to specific machine room
      io.to(`machine_${machine._id.toString()}`).emit('telemetry:detail', {
        ...livePayload,
        telemetry: telemetryDoc
      });
    }
  }
}
