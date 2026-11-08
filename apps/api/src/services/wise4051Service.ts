import net from 'net';
import http from 'http';
import { isDBConnected } from '../config/db.js';
import { Machine, IMachineDoc } from '../models/Machine.js';
import { Alert } from '../models/Alert.js';
import { ProductionSummary } from '../models/ProductionSummary.js';
import { TelemetryService } from './telemetryService.js';
import { getSocketServer } from '../socket/socketServer.js';
import {
  MachineState,
  IndustrialProtocol,
  DIFunctionType,
  DIPolarity,
  WiseProtocol,
  AlertSeverity,
  AlertStatus,
  IDigitalInputConfig,
  IDigitalInputLiveState,
  IWiseDeviceStatus,
  getDefaultDigitalInputConfigs
} from '@factorypulse/shared';
import { logger } from '../logger.js';

interface IMachineWiseRuntime {
  machineId: string;
  lastRawLevels: boolean[];
  lastActiveStates: boolean[];
  lastChangeTimes: number[];
  pulseCounts: number[];
  accumulatedGoodCount: number;
  accumulatedRejectCount: number;
  consecutiveErrors: number;
  lastAlertTimePerPin: Record<string, number>;
  isInitialized: boolean;
}

export class Wise4051Service {
  private static pollTimer: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static runtimes: Map<string, IMachineWiseRuntime> = new Map();

  /**
   * Initializes runtime state for a machine if not already initialized
   */
  static getOrCreateRuntime(machineId: string, initialGood = 0, initialReject = 0): IMachineWiseRuntime {
    let rt = this.runtimes.get(machineId);
    if (!rt) {
      rt = {
        machineId,
        lastRawLevels: new Array(10).fill(false),
        lastActiveStates: new Array(10).fill(false),
        lastChangeTimes: new Array(10).fill(0),
        pulseCounts: new Array(10).fill(0),
        accumulatedGoodCount: initialGood,
        accumulatedRejectCount: initialReject,
        consecutiveErrors: 0,
        lastAlertTimePerPin: {},
        isInitialized: true
      };
      this.runtimes.set(machineId, rt);
    }
    return rt;
  }

  /**
   * Helper to execute an HTTP request with timeout
   */
  private static async executeHttpRequest(
    options: http.RequestOptions,
    timeoutMs: number
  ): Promise<{ statusCode: number; statusMessage?: string; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.get(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 200,
            statusMessage: res.statusMessage,
            body
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('WISE-4051 REST HTTP request timed out'));
      });

      req.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Universal parser for Advantech WISE-4051 JSON response formats across all firmware variants
   */
  static parseAdvantechDiResponse(data: any): boolean[] {
    const rawLevels = new Array(10).fill(false);
    if (!data) return rawLevels;

    const extractBool = (v: any): boolean => {
      if (v === true || v === 1 || v === '1' || v === 'true' || v === 'HIGH' || v === 'high') return true;
      if (v === false || v === 0 || v === '0' || v === 'false' || v === 'LOW' || v === 'low') return false;
      if (v && typeof v === 'object') {
        const inner = v.Val ?? v.val ?? v.V ?? v.v ?? v.Value ?? v.value ?? v.State ?? v.state;
        if (inner !== undefined) return extractBool(inner);
      }
      return false;
    };

    // 1. Array candidate: DIVal, DiVal, DI, di, di_value, channels, or root array
    const arrayCandidate = Array.isArray(data)
      ? data
      : Array.isArray(data.DIVal)
        ? data.DIVal
        : Array.isArray(data.DiVal)
          ? data.DiVal
          : Array.isArray(data.DI)
            ? data.DI
            : Array.isArray(data.di)
              ? data.di
              : Array.isArray(data.di_value)
                ? data.di_value
                : Array.isArray(data.channels)
                  ? data.channels
                  : null;

    if (arrayCandidate) {
      arrayCandidate.forEach((item: any, idx: number) => {
        let targetIdx = idx;
        if (item && typeof item === 'object') {
          const ch = item.Ch ?? item.ch ?? item.Channel ?? item.channel ?? item.pinIndex;
          if (typeof ch === 'number' && ch >= 0 && ch < 10) {
            targetIdx = ch;
          }
        }
        if (targetIdx >= 0 && targetIdx < 10) {
          rawLevels[targetIdx] = extractBool(item);
        }
      });
      return rawLevels;
    }

    // 2. Object key-value map candidates: DI0..DI9, di0..di9, DI_0..DI_9, pin0..pin9
    for (let i = 0; i < 10; i++) {
      const val =
        data[`DI${i}`] ??
        data[`di${i}`] ??
        data[`DI_${i}`] ??
        data[`di_${i}`] ??
        data[`pin${i}`] ??
        data[`Pin${i}`];
      if (val !== undefined) {
        rawLevels[i] = extractBool(val);
      }
    }

    return rawLevels;
  }

  /**
   * Reads 10 Digital Inputs from Advantech WISE-4051 via HTTP REST API with multi-path & auth fallback
   */
  static async readViaRest(
    ipAddress: string,
    port: number = 80,
    slot: number = 0,
    timeoutMs: number = 1000,
    username = 'root',
    password = '00000000'
  ): Promise<{ success: boolean; rawLevels: boolean[]; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    const candidatePaths = [
      `/di_value/slot_${slot}`,
      `/di_val/slot_${slot}`,
      `/di/slot_${slot}`
    ];

    let lastError = 'No response';
    const authHeader = 'Basic ' + Buffer.from(`${username || 'root'}:${password || '00000000'}`).toString('base64');

    for (const path of candidatePaths) {
      // First attempt: with Basic Auth header
      try {
        const res = await this.executeHttpRequest(
          {
            hostname: ipAddress,
            port,
            path,
            timeout: timeoutMs,
            headers: {
              Authorization: authHeader,
              Accept: 'application/json'
            }
          },
          timeoutMs
        );

        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(res.body);
            const rawLevels = this.parseAdvantechDiResponse(data);
            const latencyMs = Math.max(1, Date.now() - startTime);
            return { success: true, rawLevels, latencyMs };
          } catch (jsonErr: any) {
            lastError = `Malformed JSON response: ${jsonErr.message}`;
          }
        } else if (res.statusCode === 401 || res.statusCode === 400) {
          // Device might operate with auth disabled or reject unexpected Auth headers; retry without auth
          try {
            const noAuthRes = await this.executeHttpRequest(
              {
                hostname: ipAddress,
                port,
                path,
                timeout: timeoutMs,
                headers: {
                  Accept: 'application/json'
                }
              },
              timeoutMs
            );
            if (noAuthRes.statusCode >= 200 && noAuthRes.statusCode < 300) {
              const data = JSON.parse(noAuthRes.body);
              const rawLevels = this.parseAdvantechDiResponse(data);
              const latencyMs = Math.max(1, Date.now() - startTime);
              return { success: true, rawLevels, latencyMs };
            }
          } catch {
            // ignore
          }
          lastError = `HTTP ${res.statusCode}: ${res.statusMessage || 'Unauthorized / Bad Request'}`;
        } else {
          lastError = `HTTP ${res.statusCode}: ${res.statusMessage}`;
        }
      } catch (err: any) {
        lastError = err.message || 'Connection failed';
      }
    }

    return {
      success: false,
      rawLevels: new Array(10).fill(false),
      latencyMs: Math.max(1, Date.now() - startTime),
      error: lastError
    };
  }

  /**
   * Helper to query Modbus frame (FC 02 or FC 01)
   */
  private static async queryModbus(
    ipAddress: string,
    port: number,
    funcCode: number,
    unitId: number,
    timeoutMs: number
  ): Promise<{ success: boolean; rawLevels: boolean[]; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      const request = Buffer.from([
        0x00, 0x01, // Transaction ID
        0x00, 0x00, // Protocol ID (Modbus = 0)
        0x00, 0x06, // Length = 6 bytes following
        unitId,     // Unit Identifier
        funcCode,   // Function Code (0x02 Discrete Inputs or 0x01 Coils)
        0x00, 0x00, // Starting Address = 0
        0x00, 0x0A  // Quantity = 10 inputs (DI0 - DI9)
      ]);

      let receivedData = Buffer.alloc(0);

      socket.on('connect', () => {
        socket.write(request);
      });

      socket.on('data', (chunk) => {
        receivedData = Buffer.concat([receivedData, chunk]);
        if (receivedData.length >= 11) {
          const latencyMs = Math.max(1, Date.now() - startTime);
          cleanup();

          const respFunc = receivedData[7];
          if (respFunc === (funcCode | 0x80)) {
            const errCode = receivedData[8];
            resolve({
              success: false,
              rawLevels: new Array(10).fill(false),
              latencyMs,
              error: `Modbus Exception 0x${errCode.toString(16)}`
            });
            return;
          }

          if (respFunc === funcCode) {
            const byte0 = receivedData[9] || 0;
            const byte1 = receivedData[10] || 0;

            const rawLevels: boolean[] = [];
            for (let i = 0; i < 8; i++) {
              rawLevels.push(Boolean((byte0 >> i) & 1));
            }
            for (let i = 0; i < 2; i++) {
              rawLevels.push(Boolean((byte1 >> i) & 1));
            }

            resolve({ success: true, rawLevels, latencyMs });
          } else {
            resolve({
              success: false,
              rawLevels: new Array(10).fill(false),
              latencyMs,
              error: `Unexpected Modbus function code response: ${respFunc}`
            });
          }
        }
      });

      socket.on('timeout', () => {
        cleanup();
        resolve({
          success: false,
          rawLevels: new Array(10).fill(false),
          latencyMs: Date.now() - startTime,
          error: 'WISE-4051 Modbus TCP connection timed out'
        });
      });

      socket.on('error', (err) => {
        cleanup();
        resolve({
          success: false,
          rawLevels: new Array(10).fill(false),
          latencyMs: Date.now() - startTime,
          error: err.message
        });
      });

      try {
        socket.connect(port, ipAddress);
      } catch (err: any) {
        cleanup();
        resolve({
          success: false,
          rawLevels: new Array(10).fill(false),
          latencyMs: Date.now() - startTime,
          error: err.message
        });
      }
    });
  }

  /**
   * Reads 10 Digital Inputs from Advantech WISE-4051 via Modbus TCP (with FC 0x02 and FC 0x01 support)
   */
  static async readViaModbusTcp(
    ipAddress: string,
    port: number = 502,
    timeoutMs: number = 1000,
    unitId: number = 1
  ): Promise<{ success: boolean; rawLevels: boolean[]; latencyMs: number; error?: string }> {
    // Try Function Code 0x02 (Read Discrete Inputs) first
    const tryFc02 = await this.queryModbus(ipAddress, port, 0x02, unitId, timeoutMs);
    if (tryFc02.success) return tryFc02;

    // If FC 0x02 returned Modbus exception or failed, attempt FC 0x01 (Read Coils)
    const tryFc01 = await this.queryModbus(ipAddress, port, 0x01, unitId, timeoutMs);
    if (tryFc01.success) return tryFc01;

    // If unitId was 1, also attempt Unit ID 255 (standard gateway fallback)
    if (unitId === 1) {
      const tryUnit255 = await this.queryModbus(ipAddress, port, 0x02, 255, timeoutMs);
      if (tryUnit255.success) return tryUnit255;
    }

    return tryFc02.error ? tryFc02 : tryFc01;
  }

  /**
   * Unified hardware read dispatcher supporting REST, Modbus TCP, or AUTO
   */
  static async readDeviceInputs(
    ipAddress: string,
    port: number = 80,
    protocol: WiseProtocol | 'MODBUS_TCP' | 'REST' | 'AUTO' = WiseProtocol.REST,
    slot: number = 0,
    timeoutMs: number = 1000,
    username = 'root',
    password = '00000000'
  ): Promise<{ success: boolean; rawLevels: boolean[]; latencyMs: number; error?: string }> {
    if (!ipAddress) {
      return {
        success: false,
        rawLevels: new Array(10).fill(false),
        latencyMs: 0,
        error: 'No IP Address configured for WISE-4051 device'
      };
    }

    if (protocol === WiseProtocol.MODBUS_TCP || port === 502) {
      return this.readViaModbusTcp(ipAddress, port || 502, timeoutMs);
    }

    if (protocol === WiseProtocol.REST || port === 80 || port === 8080) {
      return this.readViaRest(ipAddress, port || 80, slot, timeoutMs, username, password);
    }

    // AUTO: Try REST first, then Modbus TCP
    const restRes = await this.readViaRest(ipAddress, port, slot, Math.min(timeoutMs, 600), username, password);
    if (restRes.success) return restRes;

    return this.readViaModbusTcp(ipAddress, 502, Math.min(timeoutMs, 600));
  }

  /**
   * Processes raw inputs through configured DI logic:
   * Polarity adjustment, debounce filtering, rising-edge detection, pulse counting, and alert generation.
   */
  static async processMachineInputs(
    machine: IMachineDoc,
    rawLevels: boolean[],
    latencyMs: number
  ): Promise<{
    diStates: IDigitalInputLiveState[];
    goodCount: number;
    rejectCount: number;
    triggeredAlerts: any[];
    machineStateChanged: boolean;
    newState?: MachineState;
  }> {
    const machineId = machine._id.toString();
    const rt = this.getOrCreateRuntime(
      machineId,
      (machine as any).summary?.goodCount || 0,
      (machine as any).summary?.rejectCount || 0
    );

    const configs: IDigitalInputConfig[] =
      machine.digitalInputConfigs && machine.digitalInputConfigs.length > 0
        ? machine.digitalInputConfigs
        : getDefaultDigitalInputConfigs();

    const now = Date.now();
    const diStates: IDigitalInputLiveState[] = [];
    const triggeredAlerts: any[] = [];
    let stateChanged = false;
    let targetState = machine.state;

    for (let idx = 0; idx < 10; idx++) {
      const cfg = configs.find((c) => c.pinIndex === idx) || {
        pin: `DI${idx}`,
        pinIndex: idx,
        name: `Input DI${idx}`,
        functionType: idx === 0 ? DIFunctionType.GOOD : idx === 1 ? DIFunctionType.REJECT : DIFunctionType.ALERT,
        isEnabled: true,
        polarity: DIPolarity.ACTIVE_HIGH,
        debounceMs: 50
      };

      const rawLevel = rawLevels[idx] ?? false;

      // Calculate active state according to configured signal polarity
      // ACTIVE_HIGH: Logic 1 (true) is active
      // ACTIVE_LOW: Logic 0 (false) is active
      const isActive = cfg.polarity === DIPolarity.ACTIVE_LOW ? !rawLevel : rawLevel;

      const prevActive = rt.lastActiveStates[idx] ?? false;
      const lastChange = rt.lastChangeTimes[idx] ?? 0;
      const debounceMs = cfg.debounceMs ?? 50;

      // Debounce & state transition
      let validTransition = false;
      if (isActive !== prevActive) {
        if (now - lastChange >= debounceMs) {
          rt.lastActiveStates[idx] = isActive;
          rt.lastChangeTimes[idx] = now;
          validTransition = true;
        }
      }

      // Detect RISING EDGE (became active)
      const isRisingEdge = validTransition && isActive && cfg.isEnabled;

      if (isRisingEdge) {
        rt.pulseCounts[idx] += 1;

        // Process function mapping
        switch (cfg.functionType) {
          case DIFunctionType.GOOD:
            rt.accumulatedGoodCount += 1;
            break;

          case DIFunctionType.REJECT:
            rt.accumulatedRejectCount += 1;
            break;

          case DIFunctionType.RUNNING:
            if (targetState !== MachineState.RUNNING && targetState !== MachineState.MAINTENANCE) {
              targetState = MachineState.RUNNING;
              stateChanged = true;
            }
            break;

          case DIFunctionType.STOPPED:
            if (targetState !== MachineState.STOPPED && targetState !== MachineState.MAINTENANCE) {
              targetState = MachineState.STOPPED;
              stateChanged = true;
            }
            break;

          case DIFunctionType.FAULT:
            targetState = MachineState.FAULTED;
            machine.currentFaultCode = cfg.pin;
            machine.currentFaultDescription = cfg.alertMessage || `Fault triggered by ${cfg.name}`;
            stateChanged = true;

            // Trigger CRITICAL alert
            const faultAlert = await Alert.create({
              tenantId: machine.tenantId,
              machineId: machine._id,
              title: `Machine Fault: ${cfg.name}`,
              description: cfg.alertMessage || `Machine entered FAULTED state from ${cfg.name}`,
              category: 'SAFETY',
              faultCode: cfg.pin,
              severity: AlertSeverity.CRITICAL,
              status: AlertStatus.ACTIVE
            });
            triggeredAlerts.push(faultAlert);
            break;

          case DIFunctionType.ALERT:
            // Check throttle to prevent flooding (minimum 10s between duplicate alerts for same pin)
            const lastAlertAt = rt.lastAlertTimePerPin[cfg.pin] || 0;
            if (now - lastAlertAt > 10000) {
              rt.lastAlertTimePerPin[cfg.pin] = now;
              const alertDoc = await Alert.create({
                tenantId: machine.tenantId,
                machineId: machine._id,
                title: `DI Alert: ${cfg.name}`,
                description: cfg.alertMessage || `Digital input ${cfg.pin} (${cfg.name}) became active`,
                category: 'OPERATION',
                faultCode: cfg.pin,
                severity: cfg.severity || AlertSeverity.WARNING,
                status: AlertStatus.ACTIVE
              });
              triggeredAlerts.push(alertDoc);
            }
            break;


          case DIFunctionType.CUSTOM:
            // Custom pulse logged, no default state override
            break;
        }
      }

      rt.lastRawLevels[idx] = rawLevel;

      diStates.push({
        pin: cfg.pin,
        pinIndex: idx,
        rawLogicLevel: rawLevel,
        isActive,
        name: cfg.name,
        functionType: cfg.functionType,
        isEnabled: cfg.isEnabled,
        polarity: cfg.polarity,
        severity: cfg.severity,
        alertMessage: cfg.alertMessage,
        pulseCount: rt.pulseCounts[idx],
        lastTriggeredAt: isRisingEdge ? new Date(now).toISOString() : undefined
      });
    }

    return {
      diStates,
      goodCount: rt.accumulatedGoodCount,
      rejectCount: rt.accumulatedRejectCount,
      triggeredAlerts,
      machineStateChanged: stateChanged,
      newState: targetState
    };
  }

  /**
   * Polls a specific machine right now (live reading) and updates database & sockets
   */
  static async pollMachine(machine: IMachineDoc): Promise<IWiseDeviceStatus> {
    const ip = machine.ipAddress;
    const connSettings = machine.wiseConnectionSettings || {
      model: 'WISE-4051',
      protocol: (machine.protocol === IndustrialProtocol.MODBUS_TCP ? WiseProtocol.MODBUS_TCP : WiseProtocol.REST) as WiseProtocol,
      port: machine.port || (machine.protocol === IndustrialProtocol.MODBUS_TCP ? 502 : 80),
      slot: 0,
      pollIntervalMs: 500,
      username: 'root',
      password: '00000000',
      timeoutMs: 1000
    };

    const port = machine.port || (connSettings.protocol === WiseProtocol.MODBUS_TCP ? 502 : 80);

    // Initialize runtime with today's persisted counters if available
    const todayStr = new Date().toISOString().split('T')[0];
    let initGood = (machine as any).summary?.goodCount || 0;
    let initReject = (machine as any).summary?.rejectCount || 0;
    if (initGood === 0 && initReject === 0 && isDBConnected()) {
      try {
        const sum = await ProductionSummary.findOne({
          machineId: machine._id,
          dateString: todayStr
        }).lean();
        if (sum) {
          initGood = sum.goodCount || 0;
          initReject = sum.rejectCount || 0;
        }
      } catch {
        // ignore
      }
    }
    this.getOrCreateRuntime(machine._id.toString(), initGood, initReject);

    const readResult = await this.readDeviceInputs(
      ip || '',
      port,
      connSettings.protocol,
      connSettings.slot || 0,
      connSettings.timeoutMs || 1000,
      connSettings.username || 'root',
      connSettings.password || '00000000'
    );

    const io = getSocketServer();
    const tenantRoom = `tenant_${machine.tenantId.toString()}`;
    const machineRoom = `machine_${machine._id.toString()}`;

    if (!readResult.success) {
      // Hardware disconnected or communication error
      const rt = this.getOrCreateRuntime(machine._id.toString());
      rt.consecutiveErrors += 1;

      const deviceStatus: IWiseDeviceStatus = {
        connectionStatus: 'DISCONNECTED',
        latencyMs: readResult.latencyMs,
        lastPollAt: new Date().toISOString(),
        errorMessage: readResult.error,
        diStates: machine.wiseDeviceStatus?.diStates || []
      };

      machine.wiseDeviceStatus = deviceStatus;
      machine.isDeviceConnected = false;
      machine.deviceConnectionStatus = 'DISCONNECTED';

      if (!machine.isSimulated && machine.state !== MachineState.MAINTENANCE) {
        machine.state = MachineState.OFFLINE;
      }

      await machine.save();

      if (io) {
        const payload = {
          machineId: machine._id.toString(),
          assetId: machine.assetId,
          connectionStatus: 'DISCONNECTED',
          errorMessage: readResult.error,
          latencyMs: readResult.latencyMs,
          timestamp: new Date().toISOString(),
          diStates: machine.wiseDeviceStatus?.diStates || []
        };
        io.to(tenantRoom).emit('wise:diUpdate', payload);
        io.to(machineRoom).emit('wise:diUpdate', payload);
        io.to('platform_admin').emit('wise:diUpdate', payload);
      }

      return deviceStatus;
    }

    // Successfully read real hardware inputs
    const processed = await this.processMachineInputs(machine, readResult.rawLevels, readResult.latencyMs);

    const deviceStatus: IWiseDeviceStatus = {
      connectionStatus: 'CONNECTED',
      latencyMs: readResult.latencyMs,
      lastPollAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      diStates: processed.diStates
    };

    machine.wiseDeviceStatus = deviceStatus;
    machine.isDeviceConnected = true;
    machine.deviceConnectionStatus = 'CONNECTED';

    if (processed.machineStateChanged && processed.newState) {
      machine.state = processed.newState;
    } else if (machine.state === MachineState.OFFLINE) {
      machine.state = MachineState.RUNNING;
    }

    await machine.save();

    // Broadcast live WISE DI update
    if (io) {
      const livePayload = {
        machineId: machine._id.toString(),
        assetId: machine.assetId,
        connectionStatus: 'CONNECTED',
        latencyMs: readResult.latencyMs,
        timestamp: new Date().toISOString(),
        diStates: processed.diStates,
        goodCount: processed.goodCount,
        rejectCount: processed.rejectCount,
        machineState: machine.state
      };
      io.to(tenantRoom).emit('wise:diUpdate', livePayload);
      io.to(machineRoom).emit('wise:diUpdate', livePayload);
      io.to('platform_admin').emit('wise:diUpdate', livePayload);

      if (processed.machineStateChanged) {
        io.to(tenantRoom).emit('machine:stateChanged', {
          machineId: machine._id.toString(),
          state: machine.state
        });
        io.to('platform_admin').emit('machine:stateChanged', {
          machineId: machine._id.toString(),
          state: machine.state
        });
      }

      // Broadcast triggered alerts
      for (const alert of processed.triggeredAlerts) {
        io.to(tenantRoom).emit('alert:new', alert);
        io.to('platform_admin').emit('alert:new', alert);
      }
    }

    // Ingest actual telemetry event with true good/reject counters from WISE-4051
    await TelemetryService.ingest({
      tenantId: machine.tenantId.toString(),
      machineId: machine._id.toString(),
      gatewayId: machine.gatewayId ? machine.gatewayId.toString() : undefined,
      timestamp: new Date().toISOString(),
      sequenceNumber: Date.now(),
      state: machine.state,
      cumulativeGoodCount: processed.goodCount,
      cumulativeRejectCount: processed.rejectCount,
      cycleTimeSeconds: machine.expectedCycleTimeSeconds || 10,
      temperature: 42.0,
      vibration: 1.1,
      powerKw: machine.state === MachineState.RUNNING ? 24.5 : 2.1
    });

    return deviceStatus;
  }

  /**
   * Main background polling loop for active WISE-4051 machines
   */
  static async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Started WISE-4051 Hardware Polling Engine');

    this.pollTimer = setInterval(async () => {
      try {
        await this.tick();
      } catch (err) {
        logger.error({ err }, 'Error in WISE-4051 tick loop');
      }
    }, 1000);
  }

  static stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isRunning = false;
    logger.info('Stopped WISE-4051 Hardware Polling Engine');
  }

  private static async tick(): Promise<void> {
    if (!isDBConnected()) return;

    // Find all unarchived machines with configured IP that use WISE-4051 or real hardware
    const candidateMachines = await Machine.find({
      isArchived: false,
      isMonitored: true,
      $or: [
        { protocol: IndustrialProtocol.WISE_4051 },
        { 'wiseConnectionSettings.model': 'WISE-4051' },
        { isRealDevice: true }
      ]
    }).exec();

    for (const machine of candidateMachines) {
      if (!machine.ipAddress || machine.ipAddress.trim() === '') continue;
      // Skip simulated machines that do not have WISE-4051 protocol or settings
      if (
        machine.isSimulated &&
        machine.protocol !== IndustrialProtocol.WISE_4051 &&
        machine.wiseConnectionSettings?.model !== 'WISE-4051'
      ) {
        continue;
      }

      try {
        await this.pollMachine(machine);
      } catch (err) {
        logger.error({ err, machineId: machine._id }, 'Error during WISE-4051 machine poll');
      }
    }
  }
}
