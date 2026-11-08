import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Gateway } from '../../models/Gateway.js';
import { Machine } from '../../models/Machine.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { IndustrialProtocol } from '@factorypulse/shared';

export class GatewayController {
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filter: any = {};
    if (req.tenantId) filter.tenantId = req.tenantId;

    const gateways = await Gateway.find(filter)
      .populate('plantId', 'name code')
      .sort({ name: 1 })
      .lean();

    const enriched = await Promise.all(
      gateways.map(async (g: any) => {
        const connectedMachinesCount = await Machine.countDocuments({
          gatewayId: g._id,
          isArchived: false
        });
        return {
          ...g,
          connectedMachinesCount
        };
      })
    );

    res.json({ success: true, data: enriched });
  }

  static async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { name, plantId, ipAddress, protocolSupport } = req.body;
    const tenantId = req.tenantId || req.body.tenantId;

    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const gatewayKey = `FP-GWK-${uuidv4().substring(0, 12).toUpperCase()}`;

    const gateway = await Gateway.create({
      tenantId,
      plantId,
      name,
      gatewayKey,
      ipAddress: ipAddress || '192.168.1.10',
      protocolSupport: protocolSupport || [IndustrialProtocol.MQTT, IndustrialProtocol.SIMULATOR],
      status: 'ONLINE',
      metrics: {
        cpuUsagePercent: 12.4,
        memoryUsagePercent: 28.5,
        queuedMessages: 0
      }
    });

    res.status(201).json({ success: true, data: gateway });
  }
}
