import { IIndustrialAdapter, TelemetryReading } from './IIndustrialAdapter.js';
import { MachineState, CommandType } from '@factorypulse/shared';

interface MachineSimState {
  sequenceNumber: number;
  goodCount: number;
  rejectCount: number;
  state: MachineState;
  temperature: number;
  vibration: number;
  energyKwh: number;
  lastTickTime: number;
  faultCode?: string;
  faultDescription?: string;
}

export class SimulatedDriver implements IIndustrialAdapter {
  private machineStates: Map<string, MachineSimState> = new Map();

  async connect(): Promise<void> {
    // Simulator connects instantly
  }

  async disconnect(): Promise<void> {
    this.machineStates.clear();
  }

  private getOrInitState(machineId: string, baseState: MachineState = MachineState.RUNNING): MachineSimState {
    if (!this.machineStates.has(machineId)) {
      this.machineStates.set(machineId, {
        sequenceNumber: 1,
        goodCount: Math.floor(Math.random() * 500) + 1200,
        rejectCount: Math.floor(Math.random() * 25) + 10,
        state: baseState,
        temperature: 52.4,
        vibration: 1.85,
        energyKwh: 3410.8 + Math.floor(Math.random() * 150),
        lastTickTime: Date.now()
      });
    }
    return this.machineStates.get(machineId)!;
  }

  async readTelemetry(machineId: string): Promise<TelemetryReading> {
    const sim = this.getOrInitState(machineId);
    sim.sequenceNumber += 1;
    const now = new Date();
    const dtSeconds = Math.max(0.1, (now.getTime() - sim.lastTickTime) / 1000);
    sim.lastTickTime = now.getTime();

    let powerKw = 0.65;
    let voltageV = 400.0;
    let currentA = 1.1;

    // Simulate state behavior
    if (sim.state === MachineState.RUNNING) {
      // Advance production counters
      sim.goodCount += Math.random() > 0.15 ? 1 : 0;
      if (Math.random() < 0.04) {
        sim.rejectCount += 1;
      }

      // Thermal and vibration dynamics with natural jitter
      sim.temperature = Math.min(85, Math.max(42, sim.temperature + (Math.random() * 1.6 - 0.75)));
      sim.vibration = Math.min(6.5, Math.max(1.1, sim.vibration + (Math.random() * 0.4 - 0.18)));

      // Electricity consumption dynamics: Active spindle motor power & 3-phase line current
      powerKw = Math.min(48.0, Math.max(18.5, 28.5 + (Math.random() * 8.4 - 4.2)));
      voltageV = Math.round((400 + (Math.random() * 6.0 - 3.0)) * 10) / 10;
      currentA = Math.round(((powerKw * 1000) / (Math.sqrt(3) * voltageV * 0.88)) * 10) / 10;
      sim.energyKwh += (powerKw * (dtSeconds / 3600));

      // Low-probability realistic fault injection
      if (Math.random() < 0.01) {
        sim.state = MachineState.FAULTED;
        sim.faultCode = 'E-402';
        sim.faultDescription = 'Spindle Motor Thermal Threshold Exceeded';
      }
    } else if (sim.state === MachineState.IDLE) {
      // Standby electrical draw: electronics, cooling fans, servo idle
      powerKw = Math.round((3.2 + Math.random() * 0.8) * 10) / 10;
      voltageV = Math.round((400 + (Math.random() * 2.0 - 1.0)) * 10) / 10;
      currentA = Math.round(((powerKw * 1000) / (Math.sqrt(3) * voltageV * 0.88)) * 10) / 10;
      sim.energyKwh += (powerKw * (dtSeconds / 3600));

      // In idle, temperature gradually cools down
      sim.temperature = Math.max(38, sim.temperature - 0.5);
      sim.vibration = 0.8;
    } else if (sim.state === MachineState.FAULTED) {
      powerKw = 0.8;
      voltageV = 400.0;
      currentA = 1.3;
      sim.temperature = Math.max(45, sim.temperature - 0.2);
    } else {
      powerKw = 0.45;
      voltageV = 400.0;
      currentA = 0.8;
    }

    const cycleTimeSeconds = sim.state === MachineState.RUNNING ? (8.5 + Math.random() * 3.0) : 0;

    return {
      sequenceNumber: sim.sequenceNumber,
      timestamp: now,
      state: sim.state,
      cumulativeGoodCount: sim.goodCount,
      cumulativeRejectCount: sim.rejectCount,
      cycleTimeSeconds: Math.round(cycleTimeSeconds * 10) / 10,
      temperature: Math.round(sim.temperature * 10) / 10,
      vibration: Math.round(sim.vibration * 100) / 100,
      powerKw: Math.round(powerKw * 10) / 10,
      energyKwh: Math.round(sim.energyKwh * 100) / 100,
      voltageV: Math.round(voltageV * 10) / 10,
      currentA: Math.round(currentA * 10) / 10,
      faultCode: sim.faultCode,
      faultDescription: sim.faultDescription
    };
  }

  async sendCommand(machineId: string, command: CommandType): Promise<{
    success: boolean;
    resultCode: number;
    message: string;
  }> {
    const sim = this.getOrInitState(machineId);

    switch (command) {
      case CommandType.START:
        sim.state = MachineState.RUNNING;
        sim.faultCode = undefined;
        sim.faultDescription = undefined;
        return { success: true, resultCode: 0, message: 'Simulated machine started' };

      case CommandType.STOP:
        sim.state = MachineState.STOPPED;
        return { success: true, resultCode: 0, message: 'Simulated machine stopped' };

      case CommandType.RESET_FAULT:
        sim.state = MachineState.IDLE;
        sim.faultCode = undefined;
        sim.faultDescription = undefined;
        return { success: true, resultCode: 0, message: 'Fault registers cleared and interlock reset' };

      case CommandType.PAUSE:
        sim.state = MachineState.IDLE;
        return { success: true, resultCode: 0, message: 'Simulated machine paused to idle' };

      default:
        return { success: false, resultCode: -1, message: 'Unrecognized command code' };
    }
  }
}
