import { MySQLModel, ModelRegistry } from './base/MySQLModel.js';
import {
  MachineState,
  IndustrialProtocol,
  IDigitalInputConfig,
  IWiseConnectionSettings,
  IWiseDeviceStatus,
  getDefaultDigitalInputConfigs
} from '@factorypulse/shared';

export interface IMachineDoc {
  id: string;
  _id: string;
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
  tagMappings: Array<{
    tagName: string;
    plcAddress: string;
    dataType: string;
    metricRole: string;
    scalingFactor?: number;
    unit?: string;
  }>;
  digitalInputConfigs: IDigitalInputConfig[];
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
  connectedDeviceInfo?: {
    vendor?: string;
    model?: string;
    ipAddress?: string;
    port?: number;
    latencyMs?: number;
  };
  lastHeartbeat?: Date;
  lastTelemetryAt?: Date;
  currentFaultCode?: string;
  currentFaultDescription?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
  toObject(): any;
  toJSON(): any;
}

export class MachineModel extends MySQLModel {
  static override tableName = 'machines';
  static override jsonColumns = [
    'tagMappings',
    'digitalInputConfigs',
    'wiseConnectionSettings',
    'wiseDeviceStatus',
    'connectedDeviceInfo'
  ];
  static override inMemoryStore = new Map();

  constructor(data: any = {}) {
    if (data.isArchived === undefined) data.isArchived = false;
    if (data.isMonitored === undefined) data.isMonitored = true;
    if (data.isSimulated === undefined) data.isSimulated = true;
    if (data.isDeviceConnected === undefined) data.isDeviceConnected = false;
    if (data.isRealDevice === undefined) data.isRealDevice = false;
    if (!data.digitalInputConfigs) {
      data.digitalInputConfigs = getDefaultDigitalInputConfigs();
    }
    if (!data.wiseConnectionSettings) {
      data.wiseConnectionSettings = {
        model: 'WISE-4051',
        protocol: 'REST',
        slot: 0,
        pollIntervalMs: 500,
        username: 'root',
        password: 'password',
        timeoutMs: 1000
      };
    }
    super(data);
  }
}

ModelRegistry.register('Machine', MachineModel);
export const Machine = MachineModel;
