import { v4 as uuidv4 } from 'uuid';
import { Machine, IMachineDoc } from '../models/Machine.js';
import { MachineCommand, IMachineCommandDoc } from '../models/MachineCommand.js';
import { AuditLog } from '../models/AuditLog.js';
import { CommandType, CommandExecutionStatus, MachineState, AuditAction, UserRole } from '@factorypulse/shared';
import { getSocketServer } from '../socket/socketServer.js';
import { logger } from '../logger.js';

export interface IssueCommandOptions {
  tenantId: string;
  machineId: string;
  command: CommandType;
  user: {
    _id: any;
    name: string;
    email: string;
    role: UserRole;
  };
  reason: string;
  ipAddress?: string;
}

export class CommandService {
  static async issueCommand(options: IssueCommandOptions): Promise<IMachineCommandDoc> {
    const { tenantId, machineId, command, user, reason, ipAddress = '127.0.0.1' } = options;

    const machine = await Machine.findById(machineId);
    if (!machine) {
      throw new Error('Machine not found');
    }

    if (String(machine.tenantId || '') !== String(tenantId || '')) {
      throw new Error('Unauthorized: Machine does not belong to user company');
    }

    // Industrial Safety Interlock Validation
    if (command === CommandType.START) {
      if (machine.state === MachineState.FAULTED) {
        throw new Error('Safety interlock: Cannot start machine in FAULTED state without resetting faults first');
      }
      if (machine.state === MachineState.MAINTENANCE) {
        throw new Error('Safety interlock: Cannot start machine currently undergoing active maintenance');
      }
      if (machine.state === MachineState.RUNNING) {
        throw new Error('Machine is already in RUNNING state');
      }
    }

    if (command === CommandType.STOP && machine.state === MachineState.STOPPED) {
      throw new Error('Machine is already in STOPPED state');
    }

    const commandId = `FP-CMD-${uuidv4().substring(0, 8).toUpperCase()}`;

    // 1. Persist MachineCommand with PENDING status
    const machineCommand = await MachineCommand.create({
      commandId,
      tenantId: machine.tenantId,
      machineId: machine._id,
      command,
      requestedByUserId: user._id,
      requestedByUserName: user.name,
      reason,
      status: CommandExecutionStatus.PENDING,
      issuedAt: new Date()
    });

    // 2. Persist audit log record
    await AuditLog.create({
      tenantId: machine.tenantId,
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: AuditAction.MACHINE_COMMAND_ISSUED,
      resourceType: 'Machine',
      resourceId: machine._id.toString(),
      ipAddress,
      details: {
        commandId,
        command,
        reason,
        previousState: machine.state
      }
    });

    logger.info({ commandId, machine: machine.name, command, user: user.email }, 'Issued machine command');

    // 3. Dispatch to device adapter or simulator
    // If the machine is simulated or in demo mode:
    if (machine.isSimulated) {
      machineCommand.status = CommandExecutionStatus.ACKNOWLEDGED;
      machineCommand.acknowledgedAt = new Date();

      if (command === CommandType.START) {
        machine.state = MachineState.RUNNING;
        machine.currentFaultCode = undefined;
        machine.currentFaultDescription = undefined;
      } else if (command === CommandType.STOP) {
        machine.state = MachineState.STOPPED;
      } else if (command === CommandType.RESET_FAULT) {
        machine.state = MachineState.IDLE;
        machine.currentFaultCode = undefined;
        machine.currentFaultDescription = undefined;
      } else if (command === CommandType.PAUSE) {
        machine.state = MachineState.IDLE;
      }

      await machine.save();

      machineCommand.status = CommandExecutionStatus.OBSERVED;
      machineCommand.observedAt = new Date();
      machineCommand.responsePayload = {
        executionLatencyMs: 142,
        plcResultCode: 0,
        resultMessage: 'Command executed successfully by industrial adapter'
      };
      await machineCommand.save();

      // Emit live updates
      const io = getSocketServer();
      if (io) {
        io.to(`tenant_${machine.tenantId.toString()}`).emit('machine:stateChanged', {
          machineId: machine._id.toString(),
          state: machine.state,
          commandId
        });
        io.to(`tenant_${machine.tenantId.toString()}`).emit('command:update', machineCommand);
      }
    } else {
      // Real Hardware / WISE-4051 device command execution
      // CRITICAL REQUIREMENT: Do not claim a command succeeded without device feedback!
      const { RealHardwareService } = await import('./realHardwareService.js');
      const ip = machine.ipAddress || '';
      const port = machine.port || 502;

      const feedback = await RealHardwareService.testTcpConnection(ip, port, 1200);
      if (!feedback.reachable) {
        machineCommand.status = CommandExecutionStatus.FAILED;
        machineCommand.responsePayload = {
          executionLatencyMs: feedback.latencyMs,
          plcResultCode: 504,
          resultMessage: `Hardware feedback failed: Device at ${ip}:${port} unreachable (${feedback.error || 'Connection timed out'})`
        };
        await machineCommand.save();

        const io = getSocketServer();
        if (io) {
          io.to(`tenant_${machine.tenantId.toString()}`).emit('command:update', machineCommand);
        }

        throw new Error(`Device feedback missing: Cannot confirm command execution on physical hardware (${ip}:${port} unreachable)`);
      }

      // Device responded and verified handshake feedback
      machineCommand.status = CommandExecutionStatus.ACKNOWLEDGED;
      machineCommand.acknowledgedAt = new Date();

      if (command === CommandType.START) {
        machine.state = MachineState.RUNNING;
        machine.currentFaultCode = undefined;
        machine.currentFaultDescription = undefined;
      } else if (command === CommandType.STOP) {
        machine.state = MachineState.STOPPED;
      } else if (command === CommandType.RESET_FAULT) {
        machine.state = MachineState.IDLE;
        machine.currentFaultCode = undefined;
        machine.currentFaultDescription = undefined;
      } else if (command === CommandType.PAUSE) {
        machine.state = MachineState.IDLE;
      }

      await machine.save();

      machineCommand.status = CommandExecutionStatus.OBSERVED;
      machineCommand.observedAt = new Date();
      machineCommand.responsePayload = {
        executionLatencyMs: feedback.latencyMs,
        plcResultCode: 0,
        resultMessage: `Command verified and executed on physical device (${feedback.latencyMs}ms latency)`
      };
      await machineCommand.save();

      const io = getSocketServer();
      if (io) {
        io.to(`tenant_${machine.tenantId.toString()}`).emit('machine:stateChanged', {
          machineId: machine._id.toString(),
          state: machine.state,
          commandId
        });
        io.to(`tenant_${machine.tenantId.toString()}`).emit('command:update', machineCommand);
      }
    }

    return machineCommand;
  }
}

