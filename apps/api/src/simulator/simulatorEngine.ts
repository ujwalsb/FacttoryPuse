import { isDBConnected } from '../config/db.js';
import { Machine } from '../models/Machine.js';
import { SimulatedDriver } from '../adapters/SimulatedDriver.js';
import { TelemetryService } from '../services/telemetryService.js';
import { IndustrialProtocol } from '@factorypulse/shared';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export class SimulatorEngine {
  private static intervalHandle: NodeJS.Timeout | null = null;
  private static driver = new SimulatedDriver();
  private static isRunning = false;

  static async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.driver.connect();

    logger.info(
      { intervalMs: config.simulator.tickIntervalMs },
      'Started FactoryPulse Industrial Telemetry Simulator Engine'
    );

    this.intervalHandle = setInterval(async () => {
      try {
        await this.tick();
      } catch (error) {
        logger.error({ error }, 'Error in simulator engine tick loop');
      }
    }, config.simulator.tickIntervalMs);
  }

  static stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
    this.driver.disconnect();
    logger.info('Stopped Industrial Telemetry Simulator Engine');
  }

  private static async tick(): Promise<void> {
    if (!isDBConnected()) {
      return;
    }
    const machines = await Machine.find({
      isSimulated: true,
      isArchived: false,
      isMonitored: true,
      protocol: { $ne: IndustrialProtocol.WISE_4051 },
      isRealDevice: { $ne: true },
      'wiseConnectionSettings.model': { $ne: 'WISE-4051' }
    }).exec();

    for (const machine of machines) {
      try {
        const reading = await this.driver.readTelemetry(machine._id.toString());

        await TelemetryService.ingest({
          tenantId: machine.tenantId.toString(),
          machineId: machine._id.toString(),
          gatewayId: machine.gatewayId ? machine.gatewayId.toString() : undefined,
          timestamp: reading.timestamp.toISOString(),
          sequenceNumber: reading.sequenceNumber,
          state: reading.state,
          cumulativeGoodCount: reading.cumulativeGoodCount,
          cumulativeRejectCount: reading.cumulativeRejectCount,
          cycleTimeSeconds: reading.cycleTimeSeconds,
          temperature: reading.temperature,
          vibration: reading.vibration,
          powerKw: reading.powerKw,
          energyKwh: reading.energyKwh,
          voltageV: reading.voltageV,
          currentA: reading.currentA,
          faultCode: reading.faultCode,
          faultDescription: reading.faultDescription
        });
      } catch (err) {
        logger.error({ err, machineId: machine._id }, 'Error simulating machine tick');
      }
    }
  }
}
