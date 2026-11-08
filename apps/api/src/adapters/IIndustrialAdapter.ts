import { MachineState, CommandType } from '@factorypulse/shared';

export interface TelemetryReading {
  sequenceNumber: number;
  timestamp: Date;
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

export interface IIndustrialAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  readTelemetry(machineId: string): Promise<TelemetryReading>;
  sendCommand(machineId: string, command: CommandType): Promise<{
    success: boolean;
    resultCode: number;
    message: string;
  }>;
}
