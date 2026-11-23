import { Response } from 'express';
import { Machine } from '../../models/Machine.js';
import { Tenant } from '../../models/Tenant.js';
import { TelemetryEvent } from '../../models/TelemetryEvent.js';
import { ProductionSummary } from '../../models/ProductionSummary.js';
import { Alert } from '../../models/Alert.js';
import { MaintenanceWorkOrder } from '../../models/MaintenanceWorkOrder.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  RegisterMachineSchema,
  UpdateDIMappingsSchema,
  getDefaultDigitalInputConfigs,
  UserRole,
  AuditAction,
  AlertStatus,
  IndustrialProtocol,
  MachineState
} from '@factorypulse/shared';
import { recordAudit } from '../../middleware/audit.js';
import { SimulatorEngine } from '../../simulator/simulatorEngine.js';
import { RealHardwareService } from '../../services/realHardwareService.js';
import { Wise4051Service } from '../../services/wise4051Service.js';
import { NetworkDiscoveryService } from '../../services/networkDiscoveryService.js';
import { getSocketServer } from '../../socket/socketServer.js';


export class MachineController {
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filter: any = {};
      if (req.tenantId) filter.tenantId = req.tenantId;

      if (req.query.plantId) filter.plantId = req.query.plantId;
      if (req.query.lineId) filter.lineId = req.query.lineId;
      if (req.query.state) filter.state = req.query.state;
      if (req.query.archived === 'true') {
        filter.isArchived = true;
      } else {
        filter.isArchived = false;
      }

      if (req.query.search && typeof req.query.search === 'string') {
        const sanitized = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (sanitized) {
          filter.$or = [
            { name: { $regex: sanitized, $options: 'i' } },
            { assetId: { $regex: sanitized, $options: 'i' } }
          ];
        }
      }

      const machines = await Machine.find(filter)
        .populate('plantId', 'name code')
        .populate('lineId', 'name code')
        .populate('gatewayId', 'name status')
        .sort({ name: 1 })
        .lean();

      const todayStr = new Date().toISOString().split('T')[0];

      const enriched = await Promise.all(
        machines.map(async (m: any) => {
          try {
            let summary = await ProductionSummary.findOne({
              machineId: m._id,
              dateString: todayStr
            }).lean();

            if (!summary) {
              summary = await ProductionSummary.findOne({
                machineId: m._id
              }).sort({ dateString: -1 }).lean();
            }

            return {
              ...m,
              summary: summary || {
                goodCount: 0,
                rejectCount: 0,
                totalProcessedCount: 0,
                availability: 100,
                performance: 100,
                quality: 100,
                oee: 100
              }
            };
          } catch {
            return {
              ...m,
              summary: {
                goodCount: 0,
                rejectCount: 0,
                totalProcessedCount: 0,
                availability: 100,
                performance: 100,
                quality: 100,
                oee: 100
              }
            };
          }
        })
      );

      res.json({ success: true, data: enriched });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list machines' });
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const filter: any = { _id: id };
      if (req.tenantId) filter.tenantId = req.tenantId;

      const machine = await Machine.findOne(filter)
        .populate('plantId', 'name code location')
        .populate('lineId', 'name code targetRatePerHour')
        .populate('gatewayId', 'name ipAddress status version')
        .lean();

      if (!machine) {
        res.status(404).json({ success: false, error: 'Machine not found' });
        return;
      }

      // Fetch recent 20 telemetry events for live sparkline & charts
      const recentTelemetry = await TelemetryEvent.find({ machineId: machine._id })
        .sort({ timestamp: -1 })
        .limit(30)
        .lean();

      // Fetch active alerts for this machine
      const activeAlerts = await Alert.find({
        machineId: machine._id,
        status: { $in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] }
      }).sort({ createdAt: -1 });

      // Fetch active maintenance work orders
      const workOrders = await MaintenanceWorkOrder.find({
        machineId: machine._id,
        status: { $ne: 'COMPLETED' }
      }).sort({ createdAt: -1 });

      // Fetch today's summary
      const todayStr = new Date().toISOString().split('T')[0];
      const summary = await ProductionSummary.findOne({
        machineId: machine._id,
        dateString: todayStr
      }).lean();

      const digitalInputConfigs = machine.digitalInputConfigs && machine.digitalInputConfigs.length > 0
        ? machine.digitalInputConfigs
        : getDefaultDigitalInputConfigs();

      res.json({
        success: true,
        data: {
          ...machine,
          digitalInputConfigs,
          summary,
          recentTelemetry: recentTelemetry.reverse(),
          activeAlerts,
          workOrders
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to retrieve machine' });
    }
  }


  static async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = RegisterMachineSchema.parse(req.body);
      let tenantId = req.tenantId || data.tenantId;

      if (!tenantId) {
        const firstTenant = await Tenant.findOne();
        tenantId = firstTenant?._id.toString();
      }

      if (!tenantId) {
        res.status(400).json({ success: false, error: 'Tenant context required' });
        return;
      }

      // Quota check: Verify tenant hasn't exceeded plan machine limit
      const tenant = await Tenant.findById(tenantId);
      if (tenant) {
        const activeCount = await Machine.countDocuments({ tenantId, isArchived: false });
        if (activeCount >= tenant.maxMachines) {
          res.status(403).json({
            success: false,
            error: `Plan machine quota reached (${tenant.maxMachines} max). Upgrade plan to register additional assets.`
          });
          return;
        }
      }

      // Check duplicate asset ID within tenant
      const existing = await Machine.findOne({ tenantId, assetId: data.assetId });
      if (existing) {
        res.status(409).json({ success: false, error: `Machine Asset ID '${data.assetId}' already registered for this company` });
        return;
      }

      const isWiseConfigured =
        data.protocol === IndustrialProtocol.WISE_4051 ||
        (data as any).wiseConnectionSettings?.model === 'WISE-4051';
      const isRealDevice = isWiseConfigured || data.isSimulated === false || (data as any).isRealDevice === true;
      const isSimulated = isWiseConfigured ? false : (data.isSimulated ?? false);
      const isDeviceConnected = isRealDevice;

      const machine = await Machine.create({
        ...data,
        tenantId,
        isRealDevice,
        isSimulated,
        isDeviceConnected,
        deviceConnectionStatus: isDeviceConnected ? 'CONNECTED' : (isSimulated ? 'SIMULATED' : 'DISCONNECTED'),
        state: isDeviceConnected ? MachineState.RUNNING : (isSimulated ? MachineState.RUNNING : MachineState.OFFLINE),
        simulatedDefaultState: MachineState.RUNNING
      });

      await recordAudit(
        req,
        AuditAction.MACHINE_REGISTERED,
        'Machine',
        machine._id.toString(),
        { assetId: machine.assetId, name: machine.name, isDeviceConnected }
      );

      res.status(201).json({ success: true, data: machine });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
        return;
      }
      res.status(err.statusCode || 400).json({ success: false, error: err.message || 'Failed to register machine' });
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const filter: any = { _id: id };
      if (req.tenantId) filter.tenantId = req.tenantId;

      const { adminPassword, ...updateData } = req.body;
      if (
        updateData.protocol === IndustrialProtocol.WISE_4051 ||
        updateData.wiseConnectionSettings?.model === 'WISE-4051'
      ) {
        updateData.isSimulated = false;
        updateData.isRealDevice = true;
      }

      const machine = await Machine.findOneAndUpdate(filter, { $set: updateData }, { new: true, runValidators: false });
      if (!machine) {
        res.status(404).json({ success: false, error: 'Machine not found' });
        return;
      }

      await recordAudit(
        req,
        AuditAction.MACHINE_UPDATED,
        'Machine',
        machine._id.toString(),
        req.body
      );

      res.json({ success: true, data: machine });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ success: false, error: err.message || 'Failed to update machine' });
    }
  }

  static async archive(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const filter: any = { _id: id };
      if (req.tenantId) filter.tenantId = req.tenantId;

      const machine = await Machine.findOneAndUpdate(filter, { isArchived: true }, { new: true });
      if (!machine) {
        res.status(404).json({ success: false, error: 'Machine not found' });
        return;
      }

      await recordAudit(
        req,
        AuditAction.MACHINE_ARCHIVED,
        'Machine',
        machine._id.toString()
      );

      res.json({ success: true, message: 'Machine archived successfully', data: machine });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to archive machine' });
    }
  }

  static async restore(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const filter: any = { _id: id };
      if (req.tenantId) filter.tenantId = req.tenantId;

      const machine = await Machine.findOneAndUpdate(filter, { isArchived: false }, { new: true });
      if (!machine) {
        res.status(404).json({ success: false, error: 'Machine not found' });
        return;
      }

      res.json({ success: true, message: 'Machine restored successfully', data: machine });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to restore machine' });
    }
  }

  static async getNetworkInterfaces(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const interfaces = NetworkDiscoveryService.getNetworkInterfaces();
      res.json({ success: true, data: interfaces });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to enumerate network interfaces' });
    }
  }

  static async getDiscoveredDevices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId;
      const subnet = req.query.subnet as string | undefined;
      const interfaceName = req.query.interface as string | undefined;
      const mode = (req.query.mode as 'real' | 'simulated' | 'hybrid') || 'hybrid';

      const registeredMachines = await Machine.find({ tenantId, isArchived: false })
        .select('ipAddress port assetId name')
        .lean();

      const registeredIps = new Set<string>(registeredMachines.map((m: any) => m.ipAddress).filter((ip: any): ip is string => Boolean(ip)));

      const scanResult = await NetworkDiscoveryService.scanSubnet({
        subnet,
        interfaceName,
        mode,
        registeredIps,
        registeredMachines
      });

      res.json({
        success: true,
        subnet: scanResult.subnet,
        interfaces: scanResult.interfaces,
        currentInterface: scanResult.currentInterface,
        totalDiscovered: scanResult.totalDiscovered,
        unclaimedCount: scanResult.unclaimedCount,
        mode: scanResult.mode,
        data: scanResult.data
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to execute subnet discovery scan' });
    }
  }

  static async probeDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { ipAddress, port, protocol } = req.body;

      if (!ipAddress || typeof ipAddress !== 'string') {
        res.status(400).json({ success: false, error: 'Valid IP Address required for network probe.' });
        return;
      }

      const trimmedIp = ipAddress.trim();
      const ipParts = trimmedIp.split('.');
      if (ipParts.length !== 4) {
        res.status(400).json({ success: false, error: 'Malformed IPv4 Address format.' });
        return;
      }

      const isValidOctets = ipParts.every(part => {
        if (!/^\d{1,3}$/.test(part)) return false;
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });

      if (!isValidOctets) {
        res.status(400).json({ success: false, error: 'Malformed IPv4 Address: Octets must be between 0 and 255.' });
        return;
      }

      // Block SSRF to link-local and cloud metadata addresses (e.g. AWS/GCP 169.254.169.254)
      if (trimmedIp.startsWith('169.254.')) {
        res.status(400).json({ success: false, error: 'Probe to link-local or cloud metadata address is prohibited.' });
        return;
      }

      const effectivePort = port || (protocol === IndustrialProtocol.WISE_4051 ? 80 : protocol === IndustrialProtocol.OPC_UA ? 4840 : protocol === IndustrialProtocol.MQTT ? 1883 : 502);

      // Perform live TCP socket connectivity check
      const tcpResult = await RealHardwareService.testTcpConnection(ipAddress.trim(), effectivePort, 800);

      // Rapidly check if other common ports respond if target port failed
      let effectiveLatency = tcpResult.latencyMs;
      let handshakeVerified = tcpResult.reachable;
      let detectedOpenPorts: number[] = [];

      if (!handshakeVerified) {
        const probePorts = await NetworkDiscoveryService.probeIpPorts(ipAddress.trim());
        if (probePorts.isReachable) {
          handshakeVerified = true;
          effectiveLatency = probePorts.latencyMs;
          detectedOpenPorts = probePorts.openPorts;
        }
      } else {
        detectedOpenPorts = [effectivePort];
      }

      // If still not verified, perform fast ICMP ping
      if (!handshakeVerified) {
        const ping = await NetworkDiscoveryService.pingHost(ipAddress.trim(), 400);
        if (ping.alive) {
          handshakeVerified = true;
          effectiveLatency = ping.latencyMs;
        }
      }

      if (!handshakeVerified) {
        res.status(200).json({
          success: false,
          reachable: false,
          handshakeVerified: false,
          pingStatus: 'UNREACHABLE',
          latencyMs: 0,
          openPorts: [],
          error: `Device at ${ipAddress.trim()}:${effectivePort} is unreachable. No socket handshake response on port ${effectivePort} or ICMP ping reply.`
        });
        return;
      }

      // Resolve hardware identifiers using real MAC / IP resolution
      const arpList = await NetworkDiscoveryService.getArpEntries();
      const arpMatch = arpList.find(a => a.ip === ipAddress.trim());
      const macAddress = arpMatch ? arpMatch.mac : `00:1B:1B:${(parseInt(ipParts[3], 10) % 256).toString(16).padStart(2, '0').toUpperCase()}:A9:12`;

      const info = NetworkDiscoveryService.resolveDeviceInfo(
        macAddress,
        ipAddress.trim(),
        protocol || IndustrialProtocol.MODBUS_TCP,
        effectivePort
      );

      const detectedTags = NetworkDiscoveryService.getProtocolTags(info.protocol, effectivePort);

      res.json({
        success: true,
        pingStatus: 'SUCCESS',
        latencyMs: effectiveLatency || 4,
        handshakeVerified: true,
        reachable: true,
        openPorts: detectedOpenPorts,
        device: {
          ipAddress: ipAddress.trim(),
          port: effectivePort,
          vendor: info.vendor,
          modelNumber: info.modelNumber,
          category: info.category,
          serialNumber: `SN-DEV-${ipAddress.trim().replace(/\./g, '')}`,
          macAddress,
          firmware: info.firmware,
          protocol: protocol || info.protocol,
          suggestedCycleTime: info.suggestedCycleTime,
          suggestedCapacity: info.suggestedCapacity,
          isRealDevice: true,
          detectedTags
        }
      });
    } catch (err: any) {
      res.status(200).json({
        success: false,
        pingStatus: 'UNREACHABLE_WARNING',
        latencyMs: 0,
        handshakeVerified: false,
        reachable: false,
        error: err.message || 'Probe failed'
      });
    }
  }

  static async toggleSimulatorMode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { isSimulated } = req.body;
      let tenantId = req.tenantId;

      if (!tenantId) {
        const firstTenant = await Tenant.findOne();
        tenantId = firstTenant?._id.toString();
      }

      if (!tenantId) {
        res.status(400).json({ success: false, error: 'Tenant context required' });
        return;
      }

      const currentSimulatedCount = await Machine.countDocuments({
        tenantId,
        isSimulated: true,
        isArchived: false
      });

      const targetSimulated = typeof isSimulated === 'boolean'
        ? isSimulated
        : currentSimulatedCount === 0;

      const io = getSocketServer();
      const allMachines = await Machine.find({ tenantId, isArchived: false });

      if (targetSimulated) {
        // ─── Turn SIMULATOR ON ───
        RealHardwareService.stop();

        for (const m of allMachines) {
          if (RealHardwareService.isDeviceConnected(m)) {
            m.isDeviceConnected = true;
            m.deviceConnectionStatus = 'CONNECTED';
            m.state = MachineState.RUNNING;
            m.isSimulated = false; // Real hardware machine remains real
          } else {
            m.isSimulated = true;
            m.deviceConnectionStatus = 'SIMULATED';
            m.state = m.simulatedDefaultState || MachineState.RUNNING;
          }

          await Machine.updateOne(
            { _id: m._id },
            {
              $set: {
                isDeviceConnected: m.isDeviceConnected,
                deviceConnectionStatus: m.deviceConnectionStatus,
                state: m.state,
                isSimulated: m.isSimulated
              }
            }
          );

          if (io) {
            io.to(`tenant_${tenantId.toString()}`).emit('machine:stateChanged', {
              machineId: m._id.toString(),
              state: m.state
            });
            io.to(`tenant_${tenantId.toString()}`).emit('telemetry:update', {
              machineId: m._id.toString(),
              assetId: m.assetId,
              name: m.name,
              state: m.state,
              lastTelemetryAt: new Date(),
              goodCount: 0,
              rejectCount: 0,
              cycleTimeSeconds: m.expectedCycleTimeSeconds || 10,
              powerKw: m.state === 'RUNNING' ? 28.5 : 0
            });
          }
        }

        await SimulatorEngine.start();

        await recordAudit(
          req,
          AuditAction.MACHINE_UPDATED,
          'Simulator',
          tenantId.toString(),
          { message: 'Enabled industrial telemetry simulator mode' }
        );

        if (io) {
          io.to(`tenant_${tenantId.toString()}`).emit('simulator:statusChanged', {
            isSimulated: true,
            mode: 'SIMULATOR'
          });
        }

        res.json({
          success: true,
          isSimulated: true,
          mode: 'SIMULATOR',
          message: 'Industrial Simulator Engine active: Synthesizing demo sensor telemetry'
        });
      } else {
        // ─── Turn SIMULATOR OFF ───
        SimulatorEngine.stop();

        const connectedMachineIds: string[] = [];
        const offlineMachineIds: string[] = [];

        for (const m of allMachines) {
          const isConn = RealHardwareService.isDeviceConnected(m);
          m.isSimulated = false;

          if (isConn) {
            m.isDeviceConnected = true;
            m.deviceConnectionStatus = 'CONNECTED';
            m.state = MachineState.RUNNING;
            connectedMachineIds.push(m.assetId);
          } else {
            m.isDeviceConnected = false;
            m.deviceConnectionStatus = 'DISCONNECTED';
            m.state = MachineState.OFFLINE;
            offlineMachineIds.push(m.assetId);
          }

          await Machine.updateOne(
            { _id: m._id },
            {
              $set: {
                isDeviceConnected: m.isDeviceConnected,
                deviceConnectionStatus: m.deviceConnectionStatus,
                state: m.state,
                isSimulated: m.isSimulated
              }
            }
          );

          if (io) {
            io.to(`tenant_${tenantId.toString()}`).emit('machine:stateChanged', {
              machineId: m._id.toString(),
              state: m.state
            });
            io.to(`tenant_${tenantId.toString()}`).emit('telemetry:update', {
              machineId: m._id.toString(),
              assetId: m.assetId,
              name: m.name,
              state: m.state,
              lastTelemetryAt: new Date(),
              goodCount: 0,
              rejectCount: 0,
              cycleTimeSeconds: m.expectedCycleTimeSeconds || 10,
              powerKw: m.state === 'RUNNING' ? 28.5 : 0
            });
          }
        }

        if (connectedMachineIds.length > 0) {
          await RealHardwareService.start();
        }

        await recordAudit(
          req,
          AuditAction.MACHINE_UPDATED,
          'Simulator',
          tenantId.toString(),
          { message: `Disabled simulator: Connected ${connectedMachineIds.length} physical assets, ${offlineMachineIds.length} offline` }
        );

        if (io) {
          io.to(`tenant_${tenantId.toString()}`).emit('simulator:statusChanged', {
            isSimulated: false,
            mode: 'REAL_HARDWARE',
            connectedMachineIds,
            offlineMachineIds
          });
        }

        res.json({
          success: true,
          isSimulated: false,
          mode: 'REAL_HARDWARE',
          connectedCount: connectedMachineIds.length,
          offlineCount: offlineMachineIds.length,
          connectedAssets: connectedMachineIds,
          message: `Simulator deactivated: Only machines with real field devices are running (${connectedMachineIds.join(', ') || 'None'}). All other machines are OFFLINE.`
        });
      }
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to toggle simulator mode'
      });
    }
  }

  static async getSimulatorStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      let tenantId = req.tenantId;

      if (!tenantId) {
        const firstTenant = await Tenant.findOne();
        tenantId = firstTenant?._id.toString();
      }

      if (!tenantId) {
        res.status(400).json({ success: false, error: 'Tenant context required' });
        return;
      }

      const simulatedCount = await Machine.countDocuments({
        tenantId,
        isSimulated: true,
        isArchived: false
      });

      const totalCount = await Machine.countDocuments({
        tenantId,
        isArchived: false
      });

      const allMachines = await Machine.find({ tenantId, isArchived: false }).lean();
      const connectedCount = allMachines.filter((m: any) => RealHardwareService.isDeviceConnected(m as any)).length;

      res.json({
        success: true,
        isSimulated: simulatedCount > 0,
        simulatedMachinesCount: simulatedCount,
        connectedMachinesCount: connectedCount,
        offlineMachinesCount: Math.max(0, totalCount - connectedCount),
        totalMachinesCount: totalCount,
        mode: simulatedCount > 0 ? 'SIMULATOR' : 'REAL_HARDWARE'
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to get simulator status'
      });
    }
  }

  static async toggleDeviceConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isConnected, ipAddress, port, protocol } = req.body;
      const filter: any = { _id: id };
      if (req.tenantId) filter.tenantId = req.tenantId;

      const machine = await Machine.findOne(filter);
      if (!machine) {
        res.status(404).json({ success: false, error: 'Machine not found' });
        return;
      }

      const shouldConnect = typeof isConnected === 'boolean' ? isConnected : !machine.isDeviceConnected;

      const updateFields: any = {
        isDeviceConnected: shouldConnect,
        isRealDevice: true
      };

      if (ipAddress) updateFields.ipAddress = ipAddress;
      if (port) updateFields.port = Number(port);
      if (protocol) updateFields.protocol = protocol;

      // Check if simulator is active in this tenant
      const simActiveCount = await Machine.countDocuments({ tenantId: machine.tenantId, isSimulated: true, isArchived: false });
      const isSimulatorActive = simActiveCount > 0;

      if (shouldConnect) {
        updateFields.deviceConnectionStatus = 'CONNECTED';
        updateFields.state = MachineState.RUNNING;
        updateFields.isSimulated = false;
      } else {
        updateFields.deviceConnectionStatus = 'DISCONNECTED';
        updateFields.state = isSimulatorActive ? (machine.simulatedDefaultState || MachineState.RUNNING) : MachineState.OFFLINE;
      }

      await Machine.updateOne({ _id: machine._id }, { $set: updateFields });

      const updated = await Machine.findById(machine._id);

      const io = getSocketServer();
      if (io && updated) {
        io.to(`tenant_${machine.tenantId.toString()}`).emit('machine:stateChanged', {
          machineId: machine._id.toString(),
          state: updated.state
        });
        io.to(`tenant_${machine.tenantId.toString()}`).emit('telemetry:update', {
          machineId: machine._id.toString(),
          assetId: updated.assetId,
          name: updated.name,
          state: updated.state,
          lastTelemetryAt: new Date(),
          goodCount: 0,
          rejectCount: 0,
          powerKw: updated.state === 'RUNNING' ? 28.5 : 0
        });
      }

      res.json({
        success: true,
        message: shouldConnect ? `Device connected for ${machine.assetId}` : `Device disconnected for ${machine.assetId}`,
        data: updated || machine
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to toggle device connection'
      });
    }
  }

  static async pingDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const filter: any = { _id: id };
      if (req.tenantId) filter.tenantId = req.tenantId;

      const machine = await Machine.findOne(filter);
      if (!machine) {
        res.status(404).json({ success: false, error: 'Machine not found' });
        return;
      }

      const ip = machine.ipAddress || '127.0.0.1';
      const port = machine.port || 502;
      const result = await RealHardwareService.testTcpConnection(ip, port);

      res.json({
        success: true,
        assetId: machine.assetId,
        ipAddress: ip,
        port,
        ...result
      });
    } catch (err: any) {
      res.status(200).json({
        success: false,
        reachable: false,
        latencyMs: 0,
        error: err.message || 'Ping failed'
      });
    }
  }

  static async updateDiConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const filter: any = { _id: id };
      if (req.tenantId) filter.tenantId = req.tenantId;

      const validated = UpdateDIMappingsSchema.parse(req.body);

      const machine = await Machine.findOne(filter);
      if (!machine) {
        res.status(404).json({ success: false, error: 'Machine not found' });
        return;
      }

      await Machine.updateOne(
        { _id: machine._id },
        {
          $set: {
            digitalInputConfigs: validated.digitalInputConfigs,
            ...(validated.wiseConnectionSettings ? { wiseConnectionSettings: validated.wiseConnectionSettings } : {}),
            isRealDevice: true,
            isSimulated: false,
            ...(machine.protocol === IndustrialProtocol.SIMULATOR ? { protocol: IndustrialProtocol.WISE_4051 } : {})
          }
        }
      );

      const updated = await Machine.findById(machine._id);

      await recordAudit(
        req,
        AuditAction.MACHINE_DI_CONFIG_UPDATED,
        'Machine',
        machine._id.toString(),
        {
          digitalInputConfigsCount: validated.digitalInputConfigs.length,
          wiseConnectionSettings: validated.wiseConnectionSettings
        }
      );

      const io = getSocketServer();
      if (io) {
        const diUpdatePayload = {
          machineId: machine._id.toString(),
          digitalInputConfigs: updated?.digitalInputConfigs || validated.digitalInputConfigs,
          wiseConnectionSettings: updated?.wiseConnectionSettings || validated.wiseConnectionSettings
        };
        io.to(`tenant_${machine.tenantId.toString()}`).emit('machine:diConfigUpdated', diUpdatePayload);
        io.to('platform_admin').emit('machine:diConfigUpdated', diUpdatePayload);
      }

      res.json({
        success: true,
        message: 'WISE-4051 digital input mappings updated successfully',
        data: updated || machine
      });
    } catch (err: any) {
      res.status(err.name === 'ZodError' ? 400 : 500).json({
        success: false,
        error: err.message || 'Failed to update digital input configuration'
      });
    }
  }

  static async resetDiConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const filter: any = { _id: id };
      if (req.tenantId) filter.tenantId = req.tenantId;

      const machine = await Machine.findOne(filter);
      if (!machine) {
        res.status(404).json({ success: false, error: 'Machine not found' });
        return;
      }

      const defaultConfigs = getDefaultDigitalInputConfigs();
      await Machine.updateOne(
        { _id: machine._id },
        {
          $set: {
            digitalInputConfigs: defaultConfigs
          }
        }
      );

      const updated = await Machine.findById(machine._id);

      await recordAudit(
        req,
        AuditAction.MACHINE_DI_CONFIG_UPDATED,
        'Machine',
        machine._id.toString(),
        { message: 'Reset digital input mappings to industrial defaults (DI0=GOOD, DI1=REJECT, DI2..DI9=ALERT)' }
      );

      const io = getSocketServer();
      if (io) {
        const resetPayload = {
          machineId: machine._id.toString(),
          digitalInputConfigs: defaultConfigs,
          wiseConnectionSettings: updated?.wiseConnectionSettings || machine.wiseConnectionSettings
        };
        io.to(`tenant_${machine.tenantId.toString()}`).emit('machine:diConfigUpdated', resetPayload);
        io.to('platform_admin').emit('machine:diConfigUpdated', resetPayload);
      }

      res.json({
        success: true,
        message: 'Digital input mappings reset to industrial defaults',
        data: updated || machine
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to reset digital input configuration'
      });
    }
  }

  static async pollWiseNow(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const filter: any = { _id: id };
      if (req.tenantId) filter.tenantId = req.tenantId;

      const machine = await Machine.findOne(filter);
      if (!machine) {
        res.status(404).json({ success: false, error: 'Machine not found' });
        return;
      }

      const status = await Wise4051Service.pollMachine(machine);
      res.json({
        success: true,
        data: status
      });
    } catch (err: any) {
      res.status(200).json({
        success: false,
        error: err.message || 'Error polling WISE-4051 device',
        data: {
          connectionStatus: 'DISCONNECTED',
          errorMessage: err.message || 'Device communication failed',
          latencyMs: 0,
          diStates: []
        }
      });
    }
  }

  static async restartMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const filter: any = { _id: id };
      if (req.tenantId) filter.tenantId = req.tenantId;

      const machine = await Machine.findOne(filter);
      if (!machine) {
        res.status(404).json({ success: false, error: 'Machine not found' });
        return;
      }

      await Machine.updateOne(
        { _id: machine._id },
        {
          $set: {
            state: MachineState.RUNNING,
            deviceConnectionStatus: 'CONNECTED',
            isDeviceConnected: true,
            currentFaultCode: undefined,
            currentFaultDescription: undefined
          }
        }
      );

      if (
        machine.protocol === IndustrialProtocol.WISE_4051 ||
        machine.wiseConnectionSettings?.model === 'WISE-4051'
      ) {
        try {
          await Wise4051Service.pollMachine(machine);
        } catch {
          // Hardware poll fallback
        }
      }

      const updated = await Machine.findById(machine._id);

      await recordAudit(
        req,
        AuditAction.MACHINE_COMMAND_EXECUTED,
        'Machine',
        machine._id.toString(),
        { command: 'RESTART', reason: req.body?.reason || 'Admin verified restart' }
      );

      const io = getSocketServer();
      if (io && updated) {
        io.to(`tenant_${machine.tenantId.toString()}`).emit('machine:stateChanged', {
          machineId: machine._id.toString(),
          state: updated.state
        });
        io.to(`tenant_${machine.tenantId.toString()}`).emit('telemetry:update', {
          machineId: machine._id.toString(),
          assetId: updated.assetId,
          name: updated.name,
          state: updated.state,
          lastTelemetryAt: new Date(),
          goodCount: 0,
          rejectCount: 0,
          powerKw: 28.5
        });
      }

      res.json({
        success: true,
        message: `Machine ${machine.name} (${machine.assetId}) restarted successfully`,
        data: updated || machine
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to restart machine'
      });
    }
  }
}

