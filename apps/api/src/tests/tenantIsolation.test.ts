import { connectDB, disconnectDB } from '../config/db.js';
import { Tenant } from '../models/Tenant.js';
import { Machine } from '../models/Machine.js';
import { TelemetryService } from '../services/telemetryService.js';
import { MachineState, IndustrialProtocol } from '@factorypulse/shared';
import { v4 as uuidv4 } from 'uuid';

describe('Multi-Tenant Data Isolation and Cross-Tenant Prevention', () => {
  let tenantA: any;
  let tenantB: any;
  let machineA: any;
  let machineB: any;

  beforeAll(async () => {
    await connectDB();

    tenantA = await Tenant.create({
      name: 'Tenant Alpha Aerospace',
      code: 'ALPHA',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      contactEmail: 'security@alpha.com'
    });

    tenantB = await Tenant.create({
      name: 'Tenant Beta EV',
      code: 'BETA',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      contactEmail: 'security@beta.com'
    });

    machineA = await Machine.create({
      assetId: 'MC-ALPHA-01',
      tenantId: tenantA._id,
      plantId: uuidv4(),
      lineId: uuidv4(),
      name: 'Alpha CNC 5-Axis',
      category: 'CNC Milling',
      manufacturer: 'Haas',
      modelNumber: 'VF-4',
      serialNumber: 'SN-A-100',
      protocol: IndustrialProtocol.SIMULATOR,
      expectedCycleTimeSeconds: 15,
      plannedCapacityPerHour: 240,
      targetGoodQuantityPerShift: 1800,
      targetRejectionPercentage: 1.5,
      state: MachineState.RUNNING,
      isMonitored: true,
      isSimulated: true,
      tagMappings: []
    });

    machineB = await Machine.create({
      assetId: 'MC-BETA-01',
      tenantId: tenantB._id,
      plantId: uuidv4(),
      lineId: uuidv4(),
      name: 'Beta Robotic Welder',
      category: 'Robotics',
      manufacturer: 'Fanuc',
      modelNumber: 'M-20iD',
      serialNumber: 'SN-B-200',
      protocol: IndustrialProtocol.SIMULATOR,
      expectedCycleTimeSeconds: 20,
      plannedCapacityPerHour: 180,
      targetGoodQuantityPerShift: 1400,
      targetRejectionPercentage: 2.0,
      state: MachineState.IDLE,
      isMonitored: true,
      isSimulated: true,
      tagMappings: []
    });
  });

  afterAll(async () => {
    if (tenantA) {
      await Machine.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
      await Tenant.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } });
    }
  });

  it('ensures queries strictly scoped to Tenant A never return Tenant B machines', async () => {
    const alphaMachines = await Machine.find({ tenantId: tenantA._id, isArchived: false });
    const machineIds = alphaMachines.map(m => m._id.toString());

    expect(machineIds).toContain(machineA._id.toString());
    expect(machineIds).not.toContain(machineB._id.toString());
  });

  it('rejects telemetry ingestion if tenantId in payload does not match machine owner', async () => {
    // Attempting to ingest telemetry for Machine A using Tenant B's credentials/ID
    await TelemetryService.ingest({
      tenantId: tenantB._id.toString(), // FORGED / WRONG TENANT
      machineId: machineA._id.toString(),
      sequenceNumber: 1,
      state: MachineState.RUNNING,
      cumulativeGoodCount: 10,
      cumulativeRejectCount: 0,
      cycleTimeSeconds: 15
    });

    // Verify Machine A's state was NOT updated by forged cross-tenant payload
    const refreshed = await Machine.findById(machineA._id);
    expect(refreshed?.lastTelemetryAt).toBeUndefined();
  });
});
