import { connectDB, disconnectDB } from '../config/db.js';
import { Tenant } from '../models/Tenant.js';
import { Machine } from '../models/Machine.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { ProductionSummary } from '../models/ProductionSummary.js';
import { TelemetryService } from '../services/telemetryService.js';
import { MachineState, IndustrialProtocol } from '@factorypulse/shared';
import { v4 as uuidv4 } from 'uuid';

describe('Industrial Counter Processing & PLC Rollover Detection', () => {
  let tenant: any;
  let machine: any;

  beforeAll(async () => {
    await connectDB();

    tenant = await Tenant.create({
      name: 'Counter Test Org',
      code: 'CNTR',
      plan: 'STARTER',
      status: 'ACTIVE',
      contactEmail: 'cntr@test.com'
    });

    machine = await Machine.create({
      assetId: 'MC-CNTR-01',
      tenantId: tenant._id,
      plantId: uuidv4(),
      lineId: uuidv4(),
      name: 'High-Speed Stamping Press',
      category: 'Press',
      manufacturer: 'Schuler',
      modelNumber: 'MS-500',
      serialNumber: 'SN-S-500',
      protocol: IndustrialProtocol.SIMULATOR,
      expectedCycleTimeSeconds: 2,
      plannedCapacityPerHour: 1800,
      targetGoodQuantityPerShift: 10000,
      targetRejectionPercentage: 1.0,
      state: MachineState.RUNNING,
      isMonitored: true,
      isSimulated: true,
      tagMappings: []
    });
  });

  afterAll(async () => {
    if (tenant) {
      await TelemetryEvent.deleteMany({ machineId: machine._id });
      await ProductionSummary.deleteMany({ machineId: machine._id });
      await Machine.deleteOne({ _id: machine._id });
      await Tenant.deleteOne({ _id: tenant._id });
    }
  });

  it('correctly calculates incremental delta from monotonic cumulative counters', async () => {
    // 1st tick: Cumulative = 100 Good, 5 Reject
    await TelemetryService.ingest({
      tenantId: tenant._id.toString(),
      machineId: machine._id.toString(),
      sequenceNumber: 1,
      state: MachineState.RUNNING,
      cumulativeGoodCount: 100,
      cumulativeRejectCount: 5,
      cycleTimeSeconds: 2.1
    });

    // 2nd tick: Cumulative = 180 Good, 8 Reject
    await TelemetryService.ingest({
      tenantId: tenant._id.toString(),
      machineId: machine._id.toString(),
      sequenceNumber: 2,
      state: MachineState.RUNNING,
      cumulativeGoodCount: 180,
      cumulativeRejectCount: 8,
      cycleTimeSeconds: 2.0
    });

    const event2 = await TelemetryEvent.findOne({ machineId: machine._id, sequenceNumber: 2 });
    expect(event2).toBeDefined();
    expect(event2?.deltaGoodCount).toBe(80); // 180 - 100
    expect(event2?.deltaRejectCount).toBe(3); // 8 - 5
  });

  it('transparently detects PLC counter reset/rollover when cumulative count drops', async () => {
    // 3rd tick: Counter rollover / shift reset back to 25 Good, 1 Reject
    await TelemetryService.ingest({
      tenantId: tenant._id.toString(),
      machineId: machine._id.toString(),
      sequenceNumber: 3,
      state: MachineState.RUNNING,
      cumulativeGoodCount: 25,
      cumulativeRejectCount: 1,
      cycleTimeSeconds: 2.0
    });

    const event3 = await TelemetryEvent.findOne({ machineId: machine._id, sequenceNumber: 3 });
    expect(event3).toBeDefined();
    // Delta should be 25 because 25 < 180 indicates a rollover reset
    expect(event3?.deltaGoodCount).toBe(25);
    expect(event3?.deltaRejectCount).toBe(1);
  });
});
