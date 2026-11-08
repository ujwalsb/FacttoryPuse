import { z } from 'zod';
import {
  UserRole,
  IndustrialProtocol,
  DIFunctionType,
  DIPolarity,
  WiseProtocol,
  AlertSeverity,
  WorkOrderStatus,
  CommandType
} from '../constants/index.js';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  mfaCode: z.string().optional()
});

export const RegisterUserSchema = z.object({
  tenantId: z.string().optional(),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole),
  assignedMachines: z.array(z.string()).optional()
});

export const CreateTenantSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(10).toUpperCase(),
  plan: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']).default('PROFESSIONAL'),
  maxMachines: z.number().int().min(1).default(50),
  maxUsers: z.number().int().min(1).default(20),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  features: z.object({
    advancedOee: z.boolean().default(true),
    remoteControl: z.boolean().default(true),
    opcUaSupport: z.boolean().default(true),
    mqttTlsSupport: z.boolean().default(true),
    modbusTcpSupport: z.boolean().default(true),
    predictiveMaintenance: z.boolean().default(false),
    customExportReports: z.boolean().default(true)
  }).optional(),
  settings: z.object({
    telemetryRetentionDays: z.number().int().min(1).default(90),
    timezone: z.string().default('UTC'),
    currency: z.string().default('USD'),
    staleDataThresholdSeconds: z.number().int().min(5).default(30)
  }).optional(),
  adminName: z.string().optional(),
  adminEmail: z.string().email().optional(),
  adminPassword: z.string().min(6).optional()
});

export const CreatePlantSchema = z.object({
  tenantId: z.string().optional(),
  name: z.string().min(2),
  code: z.string().min(2).max(10).toUpperCase(),
  location: z.string().min(2),
  managerName: z.string().optional()
});

export const CreateProductionLineSchema = z.object({
  tenantId: z.string().optional(),
  plantId: z.string().min(1),
  name: z.string().min(2),
  code: z.string().min(2).max(10).toUpperCase(),
  targetRatePerHour: z.number().int().positive()
});

export const TagMappingSchema = z.object({
  tagName: z.string().min(1),
  plcAddress: z.string().min(1),
  dataType: z.enum(['BOOLEAN', 'INTEGER', 'FLOAT', 'STRING']),
  metricRole: z.enum(['STATE', 'GOOD_COUNT', 'REJECT_COUNT', 'CYCLE_TIME', 'TEMPERATURE', 'VIBRATION', 'FAULT_CODE', 'CUSTOM']),
  scalingFactor: z.number().optional().default(1),
  unit: z.string().optional()
});

export const DigitalInputConfigSchema = z.object({
  pin: z.string().regex(/^DI[0-9]$/, 'Pin must be DI0 through DI9'),
  pinIndex: z.number().int().min(0).max(9),
  name: z.string().min(1, 'Input name is required'),
  functionType: z.nativeEnum(DIFunctionType),
  isEnabled: z.boolean().default(true),
  polarity: z.nativeEnum(DIPolarity).default(DIPolarity.ACTIVE_HIGH),
  severity: z.nativeEnum(AlertSeverity).optional(),
  alertMessage: z.string().optional(),
  debounceMs: z.number().int().min(0).max(5000).default(50)
});

export const WiseConnectionSettingsSchema = z.object({
  model: z.string().default('WISE-4051'),
  protocol: z.nativeEnum(WiseProtocol).default(WiseProtocol.REST),
  slot: z.number().int().min(0).max(4).default(0),
  pollIntervalMs: z.number().int().min(100).max(10000).default(500),
  username: z.string().optional().default('root'),
  password: z.string().optional().default('00000000'),
  timeoutMs: z.number().int().min(200).max(10000).default(1000)
});

export const UpdateDIMappingsSchema = z.object({
  digitalInputConfigs: z.array(DigitalInputConfigSchema).min(1).max(10),
  wiseConnectionSettings: WiseConnectionSettingsSchema.optional()
}).refine((data) => {
  // Validate conflicting mappings and prevent duplicate counting
  const enabledConfigs = data.digitalInputConfigs.filter(c => c.isEnabled);
  const goodConfigs = enabledConfigs.filter(c => c.functionType === DIFunctionType.GOOD);
  const rejectConfigs = enabledConfigs.filter(c => c.functionType === DIFunctionType.REJECT);
  if (goodConfigs.length > 1) {
    return false;
  }
  if (rejectConfigs.length > 1) {
    return false;
  }
  return true;
}, {
  message: 'Conflicting digital input mapping: Only one active input may be configured as GOOD counter and one as REJECT counter to prevent duplicate counting.'
});

export const RegisterMachineSchema = z.object({
  tenantId: z.string().optional(),
  assetId: z.string().min(2),
  plantId: z.string().min(1),
  lineId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().min(2),
  manufacturer: z.string().min(1),
  modelNumber: z.string().min(1),
  serialNumber: z.string().min(1),
  protocol: z.nativeEnum(IndustrialProtocol),
  gatewayId: z.string().optional(),
  ipAddress: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Invalid IPv4 address').optional().or(z.literal('')),
  port: z.number().int().min(1).max(65535).optional(),
  tagMappings: z.array(TagMappingSchema).optional().default([]),
  digitalInputConfigs: z.array(DigitalInputConfigSchema).optional(),
  wiseConnectionSettings: WiseConnectionSettingsSchema.optional(),
  expectedCycleTimeSeconds: z.number().positive().default(10),
  plannedCapacityPerHour: z.number().positive().default(300),
  targetGoodQuantityPerShift: z.number().int().positive().default(2000),
  targetRejectionPercentage: z.number().min(0).max(100).default(3.0),
  isMonitored: z.boolean().default(true),
  isSimulated: z.boolean().default(true),
  isDeviceConnected: z.boolean().optional(),
  deviceConnectionStatus: z.enum(['CONNECTED', 'DISCONNECTED', 'SIMULATED']).optional(),
  isRealDevice: z.boolean().optional()
});

export const MachineCommandRequestSchema = z.object({
  command: z.nativeEnum(CommandType),
  reason: z.string().min(3, 'A justification reason is required for machine safety compliance')
});

export const CreateAlertRuleSchema = z.object({
  tenantId: z.string().optional(),
  name: z.string().min(2),
  machineId: z.string().optional(),
  metric: z.enum(['STATE', 'REJECTION_RATE', 'TEMPERATURE', 'VIBRATION', 'CYCLE_TIME', 'STALE_DATA']),
  condition: z.enum(['EQUALS', 'GREATER_THAN', 'LESS_THAN']),
  thresholdValue: z.union([z.number(), z.string()]),
  severity: z.nativeEnum(AlertSeverity),
  cooldownMinutes: z.number().int().min(1).default(15),
  isEnabled: z.boolean().default(true)
});

export const CreateWorkOrderSchema = z.object({
  tenantId: z.string().optional(),
  machineId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(5),
  type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'INSPECTION']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  assignedToUserId: z.string().optional(),
  checklist: z.array(z.object({
    task: z.string().min(1),
    isDone: z.boolean().default(false)
  })).optional().default([]),
  scheduledDate: z.string()
});

export const IngestTelemetrySchema = z.object({
  tenantId: z.string().min(1),
  machineId: z.string().min(1),
  gatewayId: z.string().optional(),
  timestamp: z.string().optional(),
  sequenceNumber: z.number().int().nonnegative(),
  state: z.string(),
  cumulativeGoodCount: z.number().int().nonnegative(),
  cumulativeRejectCount: z.number().int().nonnegative(),
  cycleTimeSeconds: z.number().nonnegative(),
  temperature: z.number().optional(),
  vibration: z.number().optional(),
  powerKw: z.number().optional(),
  energyKwh: z.number().optional(),
  voltageV: z.number().optional(),
  currentA: z.number().optional(),
  faultCode: z.string().optional(),
  faultDescription: z.string().optional()
});

