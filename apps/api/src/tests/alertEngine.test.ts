import { connectDB, disconnectDB } from '../config/db.js';
import { Tenant } from '../models/Tenant.js';
import { Machine } from '../models/Machine.js';
import { AlertRule } from '../models/AlertRule.js';
import { Alert } from '../models/Alert.js';
import { AlertService } from '../services/alertService.js';
import { MachineState, IndustrialProtocol, AlertSeverity, AlertStatus } from '@factorypulse/shared';
import { v4 as uuidv4 } from 'uuid';

describe('Real-Time Alert Engine & Rule Evaluation', () => {
  let tenant: any;
  let machine: any;
  let tempRule: any;

  beforeAll(async () => {
    await connectDB();

    tenant = await Tenant.create({
      name: 'Alert Engine Test Facility',
      code: 'ALRTENG',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      contactEmail: 'alerts@test.com'
    });

    machine = await Machine.create({
      assetId: 'MC-ALRT-01',
      tenantId: tenant._id,
      plantId: uuidv4(),
      lineId: uuidv4(),
      name: 'Precision Injection Molder',
      category: 'Molding',
      manufacturer: 'Engel',
      modelNumber: 'e-motion 440',
      serialNumber: 'SN-ENG-440',
      protocol: IndustrialProtocol.SIMULATOR,
      expectedCycleTimeSeconds: 12,
      plannedCapacityPerHour: 300,
      targetGoodQuantityPerShift: 2400,
      targetRejectionPercentage: 1.0,
      state: MachineState.RUNNING,
      isMonitored: true,
      isSimulated: true,
      tagMappings: []
    });

    tempRule = await AlertRule.create({
      tenantId: tenant._id,
      name: 'Barrel Overheating Rule',
      machineId: machine._id,
      metric: 'TEMPERATURE',
      condition: 'GREATER_THAN',
      thresholdValue: 85,
      severity: AlertSeverity.CRITICAL,
      cooldownMinutes: 15,
      isEnabled: true
    });
  });

  afterAll(async () => {
    if (tenant) {
      await Alert.deleteMany({ tenantId: tenant._id });
      await AlertRule.deleteMany({ tenantId: tenant._id });
      await Machine.deleteOne({ _id: machine._id });
      await Tenant.deleteOne({ _id: tenant._id });
    }
  });

  it('triggers a CRITICAL alert when sensor temperature exceeds configured threshold', async () => {
    await AlertService.evaluateRules(machine, {
      state: MachineState.RUNNING,
      temperature: 92.4, // Exceeds 85
      vibration: 1.2
    });

    const alert = await Alert.findOne({
      tenantId: tenant._id,
      machineId: machine._id,
      ruleId: tempRule._id,
      status: AlertStatus.ACTIVE
    });

    expect(alert).toBeDefined();
    expect(alert?.severity).toBe(AlertSeverity.CRITICAL);
    expect(alert?.title).toContain('High Temperature Alert');
    expect(alert?.description).toContain('92.4°C exceeds threshold of 85°C');
  });

  it('enforces cooldown period to prevent duplicate flood alerts within cooldown window', async () => {
    const initialAlertsCount = await Alert.countDocuments({
      tenantId: tenant._id,
      machineId: machine._id
    });

    // Ingest another high temperature event immediately
    await AlertService.evaluateRules(machine, {
      state: MachineState.RUNNING,
      temperature: 94.0, // Still exceeds 85
      vibration: 1.5
    });

    const newAlertsCount = await Alert.countDocuments({
      tenantId: tenant._id,
      machineId: machine._id
    });

    // Count must NOT increase because cooldown period of 15 minutes is active
    expect(newAlertsCount).toBe(initialAlertsCount);
  });
});
