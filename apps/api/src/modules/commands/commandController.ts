import { Response } from 'express';
import { CommandService } from '../../services/commandService.js';
import { MachineCommand } from '../../models/MachineCommand.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { MachineCommandRequestSchema } from '@factorypulse/shared';

export class CommandController {
  static async issue(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { machineId } = req.params;
    const { command, reason } = MachineCommandRequestSchema.parse(req.body);

    if (!req.tenantId || !req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const result = await CommandService.issueCommand({
        tenantId: req.tenantId,
        machineId,
        command,
        user: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role
        },
        reason,
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: `Command ${command} submitted and executed successfully`,
        data: result
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Failed to execute machine command'
      });
    }
  }

  static async listForMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { machineId } = req.params;
    const filter: any = { machineId };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const commands = await MachineCommand.find(filter)
      .sort({ issuedAt: -1 })
      .limit(50);

    res.json({ success: true, data: commands });
  }
}
