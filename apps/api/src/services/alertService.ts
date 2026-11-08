import { Alert, IAlertDoc } from '../models/Alert.js';
import { AlertRule, IAlertRuleDoc } from '../models/AlertRule.js';
import { Machine, IMachineDoc } from '../models/Machine.js';
import { AlertSeverity, AlertStatus, UserRole } from '@factorypulse/shared';
import { logger } from '../logger.js';
import { getSocketServer } from '../socket/socketServer.js';

export class AlertService {
  static async evaluateRules(machine: IMachineDoc, telemetry: {
    state: string;
    temperature?: number;
    vibration?: number;
    rejectionRate?: number;
    cycleTimeSeconds?: number;
    faultCode?: string;
  }): Promise<void> {
    try {
      const rules = await AlertRule.find({
        tenantId: machine.tenantId,
        isEnabled: true,
        $or: [{ machineId: machine._id }, { machineId: { $exists: false } }, { machineId: null }]
      });

      const now = new Date();

      for (const rule of rules) {
        // Cooldown check
        if (rule.lastTriggeredAt) {
          const cooldownMs = rule.cooldownMinutes * 60 * 1000;
          if (now.getTime() - rule.lastTriggeredAt.getTime() < cooldownMs) {
            continue;
          }
        }

        let isTriggered = false;
        let alertTitle = '';
        let alertDesc = '';

        if (rule.metric === 'STATE' && rule.condition === 'EQUALS') {
          if (telemetry.state === (rule.thresholdValue as any)) {
            isTriggered = true;
            alertTitle = `Machine ${machine.name} state changed to ${telemetry.state}`;
            alertDesc = `Observed state '${telemetry.state}' triggered configured alert rule.`;
          }
        } else if (rule.metric === 'TEMPERATURE' && telemetry.temperature !== undefined) {
          const threshold = Number(rule.thresholdValue);
          if (rule.condition === 'GREATER_THAN' && telemetry.temperature > threshold) {
            isTriggered = true;
            alertTitle = `High Temperature Alert: ${machine.name}`;
            alertDesc = `Temperature reading of ${telemetry.temperature.toFixed(1)}°C exceeds threshold of ${threshold}°C.`;
          }
        } else if (rule.metric === 'VIBRATION' && telemetry.vibration !== undefined) {
          const threshold = Number(rule.thresholdValue);
          if (rule.condition === 'GREATER_THAN' && telemetry.vibration > threshold) {
            isTriggered = true;
            alertTitle = `Excessive Vibration Alert: ${machine.name}`;
            alertDesc = `Vibration level of ${telemetry.vibration.toFixed(2)} mm/s exceeds safety threshold of ${threshold} mm/s.`;
          }
        } else if (rule.metric === 'REJECTION_RATE' && telemetry.rejectionRate !== undefined) {
          const threshold = Number(rule.thresholdValue);
          if (rule.condition === 'GREATER_THAN' && telemetry.rejectionRate > threshold) {
            isTriggered = true;
            alertTitle = `High Rejection Rate: ${machine.name}`;
            alertDesc = `Rejection rate of ${telemetry.rejectionRate.toFixed(1)}% exceeds allowable threshold of ${threshold}%.`;
          }
        }

        if (isTriggered) {
          rule.lastTriggeredAt = now;
          await rule.save();

          // Check if identical active alert already exists to prevent duplicate flood
          const existingActive = await Alert.findOne({
            tenantId: machine.tenantId,
            machineId: machine._id,
            ruleId: rule._id,
            status: AlertStatus.ACTIVE
          });

          if (!existingActive) {
            const newAlert = await Alert.create({
              tenantId: machine.tenantId,
              machineId: machine._id,
              ruleId: rule._id,
              title: alertTitle,
              description: alertDesc,
              category: rule.metric,
              severity: rule.severity,
              status: AlertStatus.ACTIVE,
              faultCode: telemetry.faultCode
            });

            logger.warn({ alertId: newAlert._id, machine: machine.name }, 'Triggered machine alert');

            // Broadcast real-time alert event
            const io = getSocketServer();
            if (io) {
              io.to(`tenant_${machine.tenantId.toString()}`).emit('alert:new', {
                ...newAlert.toObject(),
                machineName: machine.name
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error, machineId: machine._id }, 'Error evaluating alert rules');
    }
  }

  static async acknowledgeAlert(alertId: string, user: any): Promise<IAlertDoc | null> {
    const alert = await Alert.findById(alertId);
    if (!alert) return null;

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = {
      userId: user._id,
      userName: user.name,
      timestamp: new Date()
    };
    await alert.save();

    const io = getSocketServer();
    if (io) {
      io.to(`tenant_${alert.tenantId.toString()}`).emit('alert:updated', alert);
    }
    return alert;
  }

  static async resolveAlert(alertId: string, user: any, notes: string): Promise<IAlertDoc | null> {
    const alert = await Alert.findById(alertId);
    if (!alert) return null;

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedBy = {
      userId: user._id,
      userName: user.name,
      timestamp: new Date(),
      resolutionNotes: notes
    };
    await alert.save();

    const io = getSocketServer();
    if (io) {
      io.to(`tenant_${alert.tenantId.toString()}`).emit('alert:updated', alert);
    }
    return alert;
  }
}
