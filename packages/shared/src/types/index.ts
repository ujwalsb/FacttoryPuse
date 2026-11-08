import {
  UserRole,
  MachineState,
  IndustrialProtocol,
  DIFunctionType,
  DIPolarity,
  WiseProtocol,
  AlertSeverity,
  AlertStatus,
  WorkOrderStatus,
  CommandType,
  CommandExecutionStatus,
  AuditAction
} from '../constants/index.js';

export interface ITenant {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  maxMachines: number;
  maxUsers: number;
  contactEmail: string;
  contactPhone?: string;
  features?: {
    advancedOee?: boolean;
    remoteControl?: boolean;
    opcUaSupport?: boolean;
    mqttTlsSupport?: boolean;
    modbusTcpSupport?: boolean;
    predictiveMaintenance?: boolean;
    customExportReports?: boolean;
  };
  settings: {
    telemetryRetentionDays: number;
    timezone: string;
    currency: string;
    staleDataThresholdSeconds: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface IUser {
  id: string;
  tenantId?: string; // Optional for MASTER_ADMIN
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mfaEnabled: boolean;
  assignedMachines?: string[]; // Machine IDs for Operators
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IPlant {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  location: string;
  managerName?: string;
  activeLinesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IProductionLine {
  id: string;
  tenantId: string;
  plantId: string;
  name: string;
  code: string;
  targetRatePerHour: number;
  machinesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ITagMapping {
  tagName: string;
  plcAddress: string;
  dataType: 'BOOLEAN' | 'INTEGER' | 'FLOAT' | 'STRING';
  metricRole: 'STATE' | 'GOOD_COUNT' | 'REJECT_COUNT' | 'CYCLE_TIME' | 'TEMPERATURE' | 'VIBRATION' | 'FAULT_CODE' | 'CUSTOM';
  scalingFactor?: number;
  unit?: string;
}

export interface IDigitalInputConfig {
  pin: string; // 'DI0' to 'DI9'
  pinIndex: number; // 0 to 9
  name: string;
  functionType: DIFunctionType;
  isEnabled: boolean;
  polarity: DIPolarity;
  severity?: AlertSeverity;
  alertMessage?: string;
  debounceMs?: number;
}

export interface IWiseConnectionSettings {
  model: string; // 'WISE-4051'
  protocol: WiseProtocol;
  slot?: number; // 0
  pollIntervalMs?: number; // default 500
  username?: string;
  password?: string;
  timeoutMs?: number;
}

export interface IDigitalInputLiveState {
  pin: string;
  pinIndex: number;
  rawLogicLevel: boolean;
  isActive: boolean;
  name: string;
  functionType: DIFunctionType;
  isEnabled: boolean;
  polarity: DIPolarity;
  severity?: AlertSeverity;
  alertMessage?: string;
  pulseCount: number;
  lastTriggeredAt?: string;
}

export interface IWiseDeviceStatus {
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'UNCONFIGURED';
  latencyMs?: number;
  lastPollAt?: string;
  lastSuccessAt?: string;
  errorMessage?: string;
  diStates: IDigitalInputLiveState[];
}

export function getDefaultDigitalInputConfigs(): IDigitalInputConfig[] {
  return [
    {
      pin: 'DI0',
      pinIndex: 0,
      name: 'Good Product Counter',
      functionType: DIFunctionType.GOOD,
      isEnabled: true,
      polarity: DIPolarity.ACTIVE_HIGH,
      debounceMs: 50
    },
    {
      pin: 'DI1',
      pinIndex: 1,
      name: 'Reject Product Counter',
      functionType: DIFunctionType.REJECT,
      isEnabled: true,
      polarity: DIPolarity.ACTIVE_HIGH,
      debounceMs: 50
    },
    {
      pin: 'DI2',
      pinIndex: 2,
      name: 'Emergency Stop Circuit',
      functionType: DIFunctionType.ALERT,
      isEnabled: true,
      polarity: DIPolarity.ACTIVE_HIGH,
      severity: AlertSeverity.CRITICAL,
      alertMessage: 'Emergency Stop circuit triggered',
      debounceMs: 50
    },
    {
      pin: 'DI3',
      pinIndex: 3,
      name: 'Thermal Overload Alarm',
      functionType: DIFunctionType.ALERT,
      isEnabled: true,
      polarity: DIPolarity.ACTIVE_HIGH,
      severity: AlertSeverity.WARNING,
      alertMessage: 'Motor thermal overload sensor active',
      debounceMs: 50
    },
    {
      pin: 'DI4',
      pinIndex: 4,
      name: 'Lubrication Low Level',
      functionType: DIFunctionType.ALERT,
      isEnabled: true,
      polarity: DIPolarity.ACTIVE_HIGH,
      severity: AlertSeverity.WARNING,
      alertMessage: 'Coolant / lubrication reservoir low level',
      debounceMs: 50
    },
    {
      pin: 'DI5',
      pinIndex: 5,
      name: 'Safety Guard Interlock',
      functionType: DIFunctionType.ALERT,
      isEnabled: true,
      polarity: DIPolarity.ACTIVE_HIGH,
      severity: AlertSeverity.CRITICAL,
      alertMessage: 'Safety enclosure guard opened during operation',
      debounceMs: 50
    },
    {
      pin: 'DI6',
      pinIndex: 6,
      name: 'Pneumatic Pressure Low',
      functionType: DIFunctionType.ALERT,
      isEnabled: true,
      polarity: DIPolarity.ACTIVE_HIGH,
      severity: AlertSeverity.WARNING,
      alertMessage: 'Pneumatic line pressure below minimum operating limit',
      debounceMs: 50
    },
    {
      pin: 'DI7',
      pinIndex: 7,
      name: 'Conveyor Part Jam',
      functionType: DIFunctionType.ALERT,
      isEnabled: true,
      polarity: DIPolarity.ACTIVE_HIGH,
      severity: AlertSeverity.CRITICAL,
      alertMessage: 'Conveyor feed optical jam detected',
      debounceMs: 50
    },
    {
      pin: 'DI8',
      pinIndex: 8,
      name: 'Material Feed Empty',
      functionType: DIFunctionType.ALERT,
      isEnabled: true,
      polarity: DIPolarity.ACTIVE_HIGH,
      severity: AlertSeverity.INFO,
      alertMessage: 'Infeed material hopper empty',
      debounceMs: 50
    },
    {
      pin: 'DI9',
      pinIndex: 9,
      name: 'Auxiliary System Warning',
      functionType: DIFunctionType.ALERT,
      isEnabled: true,
      polarity: DIPolarity.ACTIVE_HIGH,
      severity: AlertSeverity.INFO,
      alertMessage: 'Auxiliary digital alert input triggered',
      debounceMs: 50
    }
  ];
}

export interface IMachine {
  id: string;
  assetId: string;
  tenantId: string;
  plantId: string;
  lineId: string;
  name: string;
  description?: string;
  category: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  protocol: IndustrialProtocol;
  gatewayId?: string;
  ipAddress?: string;
  port?: number;
  tagMappings: ITagMapping[];
  digitalInputConfigs?: IDigitalInputConfig[];
  wiseConnectionSettings?: IWiseConnectionSettings;
  wiseDeviceStatus?: IWiseDeviceStatus;
  expectedCycleTimeSeconds: number;
  plannedCapacityPerHour: number;
  targetGoodQuantityPerShift: number;
  targetRejectionPercentage: number;
  state: MachineState;
  isMonitored: boolean;
  isSimulated: boolean;
  isDeviceConnected?: boolean;
  deviceConnectionStatus?: 'CONNECTED' | 'DISCONNECTED' | 'SIMULATED';
  isRealDevice?: boolean;
  simulatedDefaultState?: MachineState;
  lastHeartbeat?: string;
  lastTelemetryAt?: string;
  currentFaultCode?: string;
  currentFaultDescription?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}


export interface IGateway {
  id: string;
  tenantId: string;
  plantId: string;
  name: string;
  gatewayKey: string;
  ipAddress: string;
  version: string;
  protocolSupport: IndustrialProtocol[];
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  lastSeenAt: string;
  connectedMachinesCount?: number;
  metrics: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    queuedMessages: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ITelemetryEvent {
  id?: string;
  tenantId: string;
  machineId: string;
  gatewayId?: string;
  timestamp: string;
  sequenceNumber: number;
  state: MachineState;
  cumulativeGoodCount: number;
  cumulativeRejectCount: number;
  deltaGoodCount: number;
  deltaRejectCount: number;
  cycleTimeSeconds: number;
  temperature?: number;
  vibration?: number;
  powerKw?: number;
  energyKwh?: number;
  voltageV?: number;
  currentA?: number;
  faultCode?: string;
  faultDescription?: string;
  rawPayload?: Record<string, unknown>;
}

export interface IOEEMetrics {
  availability: number; // 0 - 100%
  performance: number;  // 0 - 100%
  quality: number;      // 0 - 100%
  oee: number;          // 0 - 100%
  operatingTimeMinutes: number;
  plannedTimeMinutes: number;
  downtimeMinutes: number;
  totalProcessedCount: number;
  goodCount: number;
  rejectCount: number;
  idealCycleTimeSeconds: number;
  periodStart: string;
  periodEnd: string;
}

export interface IProductionSummary {
  machineId: string;
  machineName: string;
  lineName: string;
  plantName: string;
  state: MachineState;
  goodCount: number;
  rejectCount: number;
  totalProcessedCount: number;
  rejectionRatePercent: number;
  targetCompletionPercent: number;
  currentProductionRatePerHour: number;
  oee: IOEEMetrics;
  lastTelemetryTimestamp?: string;
}

export interface IAlertRule {
  id: string;
  tenantId: string;
  name: string;
  machineId?: string; // Optional: applies to all machines if empty
  metric: 'STATE' | 'REJECTION_RATE' | 'TEMPERATURE' | 'VIBRATION' | 'CYCLE_TIME' | 'STALE_DATA';
  condition: 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN';
  thresholdValue: number | string;
  severity: AlertSeverity;
  cooldownMinutes: number;
  isEnabled: boolean;
}

export interface IAlert {
  id: string;
  tenantId: string;
  machineId: string;
  machineName?: string;
  ruleId?: string;
  title: string;
  description: string;
  category: string;
  severity: AlertSeverity;
  status: AlertStatus;
  faultCode?: string;
  acknowledgedBy?: {
    userId: string;
    userName: string;
    timestamp: string;
  };
  resolvedBy?: {
    userId: string;
    userName: string;
    timestamp: string;
    resolutionNotes: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface IMaintenanceWorkOrder {
  id: string;
  workOrderNumber: string;
  tenantId: string;
  machineId: string;
  machineName?: string;
  title: string;
  description: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY' | 'INSPECTION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: WorkOrderStatus;
  assignedToUserId?: string;
  assignedToUserName?: string;
  checklist: Array<{
    task: string;
    isDone: boolean;
  }>;
  sparePartsUsed?: Array<{
    partName: string;
    partNumber: string;
    quantity: number;
  }>;
  downtimeMinutes?: number;
  serviceNotes?: string;
  scheduledDate: string;
  startedAt?: string;
  completedAt?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IMachineCommand {
  id: string;
  commandId: string;
  tenantId: string;
  machineId: string;
  machineName?: string;
  command: CommandType;
  requestedByUserId: string;
  requestedByUserName: string;
  reason: string;
  status: CommandExecutionStatus;
  issuedAt: string;
  acknowledgedAt?: string;
  observedAt?: string;
  responsePayload?: Record<string, unknown>;
  failureReason?: string;
}

export interface IAuditLog {
  id: string;
  tenantId?: string;
  actorId: string;
  actorEmail: string;
  actorRole: UserRole;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface IApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: unknown;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

