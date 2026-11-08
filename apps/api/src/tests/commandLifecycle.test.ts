import { connectDB, disconnectDB } from '../config/db.js';
import { Tenant } from '../models/Tenant.js';
import { Machine } from '../models/Machine.js';
import { MachineCommand } from '../models/MachineCommand.js';
import { AuditLog } from '../models/AuditLog.js';
import { CommandService } from '../services/commandService.js';
import { MachineState, IndustrialProtocol, CommandType, CommandExecutionStatus, UserRole } from '@factorypulse/shared';
import { v4 as uuidv4 } from 'uuid';

describe('Machine Command Lifecycle, RBAC & Safety Interlocks', () => {
  let tenant: any;
  let machine: any;
  const mockOperator = {
    _id: uuidv4(),
    name: 'Hans Gruber',
    email: 'operator@factory.com',
    role: UserRole.MACHINE_OPERATOR
  };

  beforeAll(async () => {
    await connectDB();

    tenant = await Tenant.create({
      name: 'Command Testing Corp',
      code: 'CMDTEST',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      contactEmail: 'safety@cmdtest.com'
    });

    machine = await Machine.create({
      assetId: 'MC-CMD-01',
      tenantId: tenant._id,
      plantId: uuidv4(),
      lineId: uuidv4(),
      name: 'Trumpf TruLaser 5030',
      category: 'Laser Cutting',
      manufacturer: 'Trumpf',
      modelNumber: 'TL-5030',
      serialNumber: 'SN-T-5030',
      protocol: IndustrialProtocol.SIMULATOR,
      expectedCycleTimeSeconds: 45,
      plannedCapacityPerHour: 80,
      targetGoodQuantityPerShift: 600,
      targetRejectionPercentage: 0.5,
      state: MachineState.IDLE,
      isMonitored: true,
      isSimulated: true,
      tagMappings: []
    });
  });

  afterAll(async () => {
    if (tenant) {
      await MachineCommand.deleteMany({ tenantId: tenant._id });
      await AuditLog.deleteMany({ tenantId: tenant._id });
      await Machine.deleteOne({ _id: machine._id });
      await Tenant.deleteOne({ _id: tenant._id });
    }
  });

  it('issues and acknowledges an authorized START command transitioning machine state', async () => {
    machine.state = MachineState.IDLE;
    await machine.save();

    const result = await CommandService.issueCommand({
      tenantId: tenant._id.toString(),
      machineId: machine._id.toString(),
      command: CommandType.START,
      user: mockOperator,
      reason: 'Starting standard morning shift cutting schedule'
    });

    expect(result).toBeDefined();
    expect(result.commandId).toMatch(/^FP-CMD-/);
    expect(result.status).toBe(CommandExecutionStatus.OBSERVED);

    // Verify machine state updated
    const refreshed = await Machine.findById(machine._id);
    expect(refreshed?.state).toBe(MachineState.RUNNING);

    // Verify AuditLog entry was recorded
    const audit = await AuditLog.findOne({
      tenantId: tenant._id,
      resourceId: machine._id.toString()
    });
    expect(audit).toBeDefined();
    expect(audit?.actorEmail).toBe(mockOperator.email);
  });

  it('blocks START command with safety interlock if machine is in FAULTED state', async () => {
    machine.state = MachineState.FAULTED;
    await machine.save();

    await expect(
      CommandService.issueCommand({
        tenantId: tenant._id.toString(),
        machineId: machine._id.toString(),
        command: CommandType.START,
        user: mockOperator,
        reason: 'Attempting start while faulted'
      })
    ).rejects.toThrow(/Safety interlock: Cannot start machine in FAULTED state/);
  });

  it('blocks START command with safety interlock if machine is undergoing MAINTENANCE', async () => {
    machine.state = MachineState.MAINTENANCE;
    await machine.save();

    await expect(
      CommandService.issueCommand({
        tenantId: tenant._id.toString(),
        machineId: machine._id.toString(),
        command: CommandType.START,
        user: mockOperator,
        reason: 'Attempting start while in maintenance'
      })
    ).rejects.toThrow(/Safety interlock: Cannot start machine currently undergoing active maintenance/);
  });
});
