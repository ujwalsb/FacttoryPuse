import { connectDB, disconnectDB, isDBConnected } from '../config/db.js';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Plant } from '../models/Plant.js';
import { ProductionLine } from '../models/ProductionLine.js';
import { Gateway } from '../models/Gateway.js';
import { Machine } from '../models/Machine.js';
import { AlertRule } from '../models/AlertRule.js';
import { Alert } from '../models/Alert.js';
import { MaintenanceWorkOrder } from '../models/MaintenanceWorkOrder.js';
import { ProductionSummary } from '../models/ProductionSummary.js';
import { AuthService } from '../services/authService.js';
import {
  UserRole,
  MachineState,
  IndustrialProtocol,
  AlertSeverity,
  AlertStatus,
  WorkOrderStatus
} from '@factorypulse/shared';
import { logger } from '../logger.js';

export async function runSeed(): Promise<void> {
  logger.info('Starting FactoryPulse database seed operation...');

  if (!isDBConnected()) {
    await connectDB();
  }

  // Clear existing demo data
  await Promise.all([
    Tenant.deleteMany({}),
    User.deleteMany({}),
    Plant.deleteMany({}),
    ProductionLine.deleteMany({}),
    Gateway.deleteMany({}),
    Machine.deleteMany({}),
    AlertRule.deleteMany({}),
    Alert.deleteMany({}),
    MaintenanceWorkOrder.deleteMany({}),
    ProductionSummary.deleteMany({})
  ]);

  const defaultPasswordHash = await AuthService.hashPassword('Password123!');

  // 1. Create Master Admin
  const masterAdmin = await User.create({
    name: 'SaaS Platform Owner',
    email: 'admin@factorypulse.io',
    passwordHash: defaultPasswordHash,
    role: UserRole.MASTER_ADMIN,
    isActive: true,
    mfaEnabled: true
  });

  // 2. Create Tenant 1: Apex Precision Aerospace
  const tenantApex = await Tenant.create({
    name: 'Apex Precision Aerospace',
    code: 'APEX',
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    maxMachines: 100,
    maxUsers: 50,
    contactEmail: 'contact@apex-aerospace.com',
    contactPhone: '+1 (206) 555-0199',
    settings: {
      telemetryRetentionDays: 180,
      timezone: 'America/Los_Angeles',
      currency: 'USD',
      staleDataThresholdSeconds: 30
    }
  });

  // Tenant 2: NexGen EV Automotive
  const tenantNexGen = await Tenant.create({
    name: 'NexGen EV Automotive',
    code: 'NEXGEN',
    plan: 'PROFESSIONAL',
    status: 'ACTIVE',
    maxMachines: 30,
    maxUsers: 15,
    contactEmail: 'operations@nexgenev.com',
    contactPhone: '+1 (313) 555-0142',
    settings: {
      telemetryRetentionDays: 90,
      timezone: 'America/Detroit',
      currency: 'USD',
      staleDataThresholdSeconds: 20
    }
  });

  // 3. Create Apex Users (All 6 roles represented)
  const apexCompanyAdmin = await User.create({
    tenantId: tenantApex._id,
    name: 'Eleanor Vance (VP Operations)',
    email: 'admin@apex.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.COMPANY_ADMIN,
    isActive: true
  });

  const apexItHead = await User.create({
    tenantId: tenantApex._id,
    name: 'Marcus Brody (OT Infrastructure Lead)',
    email: 'it@apex.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.PLANT_IT_HEAD,
    isActive: true
  });

  const apexSupervisor = await User.create({
    tenantId: tenantApex._id,
    name: 'Samantha Ray (Shift Supervisor)',
    email: 'supervisor@apex.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.PRODUCTION_MANAGER,
    isActive: true
  });

  const apexOperator = await User.create({
    tenantId: tenantApex._id,
    name: 'David Chen (Senior Operator)',
    email: 'operator@apex.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.MACHINE_OPERATOR,
    isActive: true
  });

  const apexMaintenance = await User.create({
    tenantId: tenantApex._id,
    name: 'Julian Sterling (Reliability Specialist)',
    email: 'maintenance@apex.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.MAINTENANCE_ENGINEER,
    isActive: true
  });

  // NexGen Company Admin
  await User.create({
    tenantId: tenantNexGen._id,
    name: 'Carlos Mendez (Plant Director)',
    email: 'admin@nexgen.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.COMPANY_ADMIN,
    isActive: true
  });

  // 4. Create Plants & Lines for Apex
  const plantSeattle = await Plant.create({
    tenantId: tenantApex._id,
    name: 'Seattle Advanced Aerostructures Facility',
    code: 'SEA-01',
    location: 'Everett, WA, USA',
    managerName: 'Sarah Jenkins'
  });

  const lineMilling = await ProductionLine.create({
    tenantId: tenantApex._id,
    plantId: plantSeattle._id,
    name: 'Titanium Milling & Contouring Cell',
    code: 'L-TITAN',
    targetRatePerHour: 240
  });

  const lineAssembly = await ProductionLine.create({
    tenantId: tenantApex._id,
    plantId: plantSeattle._id,
    name: 'Composite Wing Spar Robotic Assembly',
    code: 'L-WING',
    targetRatePerHour: 180
  });

  // 5. Create Edge Gateway
  const gateway = await Gateway.create({
    tenantId: tenantApex._id,
    plantId: plantSeattle._id,
    name: 'Edge-GW-01 (Moxa UC-8200 Industrial Box)',
    gatewayKey: 'FP-GWK-SEA01-A9F2',
    ipAddress: '10.20.4.15',
    version: 'v2.6.4-lts',
    protocolSupport: [
      IndustrialProtocol.MQTT,
      IndustrialProtocol.OPC_UA,
      IndustrialProtocol.MODBUS_TCP
    ],
    status: 'ONLINE',
    metrics: {
      cpuUsagePercent: 14.8,
      memoryUsagePercent: 34.2,
      queuedMessages: 0
    }
  });

  // 6. Create Industrial Machines
  const machinesData = [
    {
      assetId: 'CNC-101',
      name: 'HAAS VF-4SS 5-Axis Machining Center',
      category: 'CNC Milling',
      manufacturer: 'Haas Automation',
      modelNumber: 'VF-4SS',
      serialNumber: 'HAAS-2023-88192',
      protocol: IndustrialProtocol.MODBUS_TCP,
      lineId: lineMilling._id,
      expectedCycleTimeSeconds: 12.5,
      plannedCapacityPerHour: 288,
      targetGoodQuantityPerShift: 2100,
      targetRejectionPercentage: 1.5,
      state: MachineState.RUNNING,
      isMonitored: true,
      isSimulated: false
    },
    {
      assetId: 'ROBOT-202',
      name: 'Fanuc M-20iD Robotic TIG Welding Cell',
      category: 'Robotics',
      manufacturer: 'Fanuc Robotics',
      modelNumber: 'M-20iD/25',
      serialNumber: 'FANUC-98214-W',
      protocol: IndustrialProtocol.MODBUS_TCP,
      lineId: lineAssembly._id,
      expectedCycleTimeSeconds: 18.0,
      plannedCapacityPerHour: 200,
      targetGoodQuantityPerShift: 1500,
      targetRejectionPercentage: 2.0,
      state: MachineState.RUNNING,
      isMonitored: true,
      isSimulated: false
    },
    {
      assetId: 'INJECT-303',
      name: 'Engel Duo 1000 High-Precision Injection Molder',
      category: 'Injection Molding',
      manufacturer: 'Engel Austria',
      modelNumber: 'Duo 1000/350',
      serialNumber: 'ENG-AT-55410',
      protocol: IndustrialProtocol.MODBUS_TCP,
      lineId: lineAssembly._id,
      expectedCycleTimeSeconds: 22.0,
      plannedCapacityPerHour: 160,
      targetGoodQuantityPerShift: 1200,
      targetRejectionPercentage: 2.5,
      state: MachineState.IDLE,
      isMonitored: true,
      isSimulated: false
    },
    {
      assetId: 'LASER-404',
      name: 'Trumpf TruLaser 5030 Fiber Laser Cutter',
      category: 'Laser Cutting',
      manufacturer: 'TRUMPF Group',
      modelNumber: 'TruLaser 5030 L76',
      serialNumber: 'TRU-DE-994182',
      protocol: IndustrialProtocol.MODBUS_TCP,
      lineId: lineMilling._id,
      expectedCycleTimeSeconds: 9.0,
      plannedCapacityPerHour: 400,
      targetGoodQuantityPerShift: 3000,
      targetRejectionPercentage: 1.2,
      state: MachineState.RUNNING,
      isMonitored: true,
      isSimulated: false
    },
    {
      assetId: 'PRESS-505',
      name: 'Schuler 600-Ton Servo Stamping Press',
      category: 'Stamping Press',
      manufacturer: 'Schuler Group',
      modelNumber: 'MSD 600',
      serialNumber: 'SCH-77219-SP',
      protocol: IndustrialProtocol.MODBUS_TCP,
      lineId: lineMilling._id,
      expectedCycleTimeSeconds: 6.0,
      plannedCapacityPerHour: 600,
      targetGoodQuantityPerShift: 4500,
      targetRejectionPercentage: 3.5,
      state: MachineState.STOPPED,
      isMonitored: true,
      isSimulated: false
    },
    {
      assetId: 'PACK-606',
      name: 'Krones SynchroBloc Automated Packaging Cell',
      category: 'Packaging',
      manufacturer: 'Krones AG',
      modelNumber: 'SynchroBloc B',
      serialNumber: 'KRN-0994-PC',
      protocol: IndustrialProtocol.MODBUS_TCP,
      lineId: lineAssembly._id,
      expectedCycleTimeSeconds: 4.5,
      plannedCapacityPerHour: 800,
      targetGoodQuantityPerShift: 6000,
      targetRejectionPercentage: 0.8,
      state: MachineState.FAULTED,
      currentFaultCode: 'E-101',
      currentFaultDescription: 'Outfeed Conveyor Optical Sensor Obstruction',
      isMonitored: true,
      isSimulated: false
    }
  ];

  const createdMachines = [];
  for (const mData of machinesData) {
    const machine = await Machine.create({
      ...mData,
      tenantId: tenantApex._id,
      plantId: plantSeattle._id,
      gatewayId: gateway._id,
      ipAddress: '10.20.4.' + (20 + Math.floor(Math.random() * 50)),
      port: 502,
      tagMappings: [
        { tagName: 'PartCount_Good', plcAddress: 'DB1.DBD10', dataType: 'INTEGER', metricRole: 'GOOD_COUNT' },
        { tagName: 'PartCount_Reject', plcAddress: 'DB1.DBD14', dataType: 'INTEGER', metricRole: 'REJECT_COUNT' },
        { tagName: 'SpindleTemp_C', plcAddress: 'DB2.DBD0', dataType: 'FLOAT', metricRole: 'TEMPERATURE', unit: '°C' },
        { tagName: 'Vibration_RMS', plcAddress: 'DB2.DBD4', dataType: 'FLOAT', metricRole: 'VIBRATION', unit: 'mm/s' }
      ]
    });
    createdMachines.push(machine);
  }

  // Assign machines to Operator
  apexOperator.assignedMachines = [createdMachines[0]._id, createdMachines[1]._id] as any;
  await apexOperator.save();

  // 7. Seed Production Summaries & OEE
  const todayStr = new Date().toISOString().split('T')[0];
  for (const machine of createdMachines) {
    await ProductionSummary.create({
      tenantId: tenantApex._id,
      machineId: machine._id,
      lineId: machine.lineId,
      plantId: machine.plantId,
      dateString: todayStr,
      shiftCode: 'SHIFT-1',
      goodCount: Math.floor(Math.random() * 600) + 1200,
      rejectCount: Math.floor(Math.random() * 25) + 10,
      totalProcessedCount: 1450,
      operatingTimeMinutes: 385,
      plannedTimeMinutes: 480,
      downtimeMinutes: 35,
      idealCycleTimeSeconds: machine.expectedCycleTimeSeconds,
      availability: 88.5,
      performance: 92.4,
      quality: 98.7,
      oee: 80.7
    });
  }

  // 8. Seed Alert Rules
  const ruleTemp = await AlertRule.create({
    tenantId: tenantApex._id,
    name: 'Spindle Thermal Protection Rule',
    metric: 'TEMPERATURE',
    condition: 'GREATER_THAN',
    thresholdValue: 75,
    severity: AlertSeverity.CRITICAL,
    cooldownMinutes: 15,
    isEnabled: true
  });

  const ruleVib = await AlertRule.create({
    tenantId: tenantApex._id,
    name: 'Bearing Vibration Anomaly Rule',
    metric: 'VIBRATION',
    condition: 'GREATER_THAN',
    thresholdValue: 4.5,
    severity: AlertSeverity.WARNING,
    cooldownMinutes: 10,
    isEnabled: true
  });

  // Seed sample Active Alert
  await Alert.create({
    tenantId: tenantApex._id,
    machineId: createdMachines[5]._id, // PACK-606
    title: 'Outfeed Conveyor Sensor Obstruction (E-101)',
    description: 'Optical inspection cell detected persistent blockage on packaging belt.',
    category: 'STATE',
    severity: AlertSeverity.CRITICAL,
    status: AlertStatus.ACTIVE,
    faultCode: 'E-101'
  });

  // Seed sample Acknowledged Alert
  await Alert.create({
    tenantId: tenantApex._id,
    machineId: createdMachines[0]._id, // CNC-101
    ruleId: ruleVib._id,
    title: 'Elevated Axis Vibration Detected',
    description: 'Y-axis linear guideway vibration reached 4.62 mm/s during rough contouring.',
    category: 'VIBRATION',
    severity: AlertSeverity.WARNING,
    status: AlertStatus.ACKNOWLEDGED,
    acknowledgedBy: {
      userId: apexSupervisor._id,
      userName: apexSupervisor.name,
      timestamp: new Date()
    }
  });

  // 9. Seed Maintenance Work Orders
  await MaintenanceWorkOrder.create({
    workOrderNumber: 'WO-1001',
    tenantId: tenantApex._id,
    machineId: createdMachines[0]._id, // CNC-101
    title: '500-Hour High-Speed Spindle & Coolant Flush',
    description: 'Comprehensive inspection of spindle drawbar force, purge filter replacement, and chiller fluid check.',
    type: 'PREVENTIVE',
    priority: 'HIGH',
    status: WorkOrderStatus.OPEN,
    assignedToUserId: apexMaintenance._id,
    assignedToUserName: apexMaintenance.name,
    checklist: [
      { task: 'Inspect spindle taper for galling or fretting corrosion', isDone: true },
      { task: 'Check drawbar retention force gauge reading (> 18 kN)', isDone: false },
      { task: 'Replace 5-micron inline coolant sediment filter', isDone: false },
      { task: 'Verify axis ballscrew lubrication injector manifold pressure', isDone: false }
    ],
    sparePartsUsed: [
      { partName: 'Inline Micro-Mesh Filter Cartridge', partNumber: 'FLT-HAAS-05M', quantity: 2 }
    ],
    scheduledDate: new Date(Date.now() + 86400000 * 2)
  });

  await MaintenanceWorkOrder.create({
    workOrderNumber: 'WO-1002',
    tenantId: tenantApex._id,
    machineId: createdMachines[4]._id, // PRESS-505
    title: 'Hydraulic Cushion Seal Inspection & Valve Calibration',
    description: 'Corrective maintenance following reported pressure bleed during hold cycle.',
    type: 'CORRECTIVE',
    priority: 'CRITICAL',
    status: WorkOrderStatus.IN_PROGRESS,
    assignedToUserId: apexMaintenance._id,
    assignedToUserName: apexMaintenance.name,
    checklist: [
      { task: 'Depressurize hydraulic accumulator bank to 0 bar', isDone: true },
      { task: 'Perform ultrasonic leak detection on manifold seals', isDone: true },
      { task: 'Replace proportional relief valve cartridge', isDone: false }
    ],
    downtimeMinutes: 45,
    scheduledDate: new Date()
  });

  logger.info('Database seed completed successfully with multi-tenant industrial assets and users!');
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('seed/index.ts') || process.argv[1]?.endsWith('seed\\index.ts')) {
  runSeed()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async err => {
      logger.error({ err }, 'Seed execution failed');
      await disconnectDB();
      process.exit(1);
    });
}
