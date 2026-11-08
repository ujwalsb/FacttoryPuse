import { Request, Response } from 'express';
import os from 'os';
import { isDBConnected, connectDB } from '../../config/db.js';
import { config } from '../../config/index.js';
import { runSeed } from '../../seed/index.js';
import { Tenant } from '../../models/Tenant.js';
import { logger } from '../../logger.js';

const startTime = Date.now();

export class HealthController {
  static getHealth(req: Request, res: Response): void {
    const isDbOk = isDBConnected();

    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const memory = process.memoryUsage();

    const status = isDbOk ? 'HEALTHY' : 'DEGRADED';

    res.status(200).json({
      success: isDbOk,
      status,
      productName: config.productName,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      services: {
        database: {
          type: 'MySQL',
          status: isDbOk ? 'CONNECTED' : 'STANDBY',
          host: config.mysql.host,
          database: config.mysql.database
        },
        simulator: {
          status: config.simulator.enabled ? 'ACTIVE' : 'DISABLED',
          tickIntervalMs: config.simulator.tickIntervalMs
        },
        system: {
          platform: process.platform,
          nodeVersion: process.version,
          cpus: os.cpus().length,
          freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
          rssMemoryMb: Math.round(memory.rss / (1024 * 1024)),
          heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024))
        }
      }
    });
  }

  static async restart(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Health restart self-recovery invoked via API.');
      await connectDB();
      const count = await Tenant.countDocuments();
      if (count === 0) {
        await runSeed();
      }
      res.json({
        success: true,
        message: 'Server self-recovery completed successfully. All engines operational.'
      });
    } catch (err: any) {
      logger.error({ err }, 'Error during health restart recovery');
      res.status(500).json({
        success: false,
        error: err.message || 'Server restart recovery failed.'
      });
    }
  }
}
