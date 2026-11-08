import http from 'http';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initSocketServer } from './socket/socketServer.js';
import { SimulatorEngine } from './simulator/simulatorEngine.js';
import { RealHardwareService } from './services/realHardwareService.js';
import { Wise4051Service } from './services/wise4051Service.js';
import { runSeed } from './seed/index.js';
import { Tenant } from './models/Tenant.js';
import { config } from './config/index.js';
import { logger } from './logger.js';

async function bootstrap() {
  try {
    logger.info(`Starting ${config.productName} Industrial IoT Server on port ${config.port}...`);

    // 1. Database Connection
    await connectDB();

    // 2. Check if DB needs automatic seeding
    const tenantCount = await Tenant.countDocuments();
    if (tenantCount === 0) {
      logger.info('Database empty. Running initial demo seed data population...');
      await runSeed();
    }

    // 3. Express App & HTTP Server
    const app = createApp();
    const server = http.createServer(app);

    // 4. WebSocket (Socket.IO) Engine
    initSocketServer(server);

    // 5. Industrial Machine Simulator is Stopped
    SimulatorEngine.stop();

    // 6. Start Real Field Hardware Polling Engine & WISE-4051 Driver
    await RealHardwareService.start();
    await Wise4051Service.start();

    // 7. Listen with automatic retry on EADDRINUSE (vital for hot reload on Windows)
    let bindAttempts = 0;
    server.on('error', (err: any) => {
      if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && bindAttempts < 5) {
        bindAttempts++;
        logger.warn(`Port ${config.port} is temporarily unavailable (${err.code}). Retrying in 1s (attempt ${bindAttempts}/5)...`);
        setTimeout(() => {
          try {
            server.close();
          } catch {
            // ignore if not listening
          }
          server.listen(config.port, '0.0.0.0');
        }, 1000);
      } else {
        logger.error({ err }, `Fatal HTTP server error binding to port ${config.port}. Verify port ${config.port} is available.`);
      }
    });

    server.listen(config.port, '0.0.0.0', () => {
      logger.info(`================================================================`);
      logger.info(`🚀 ${config.productName} API is live at http://localhost:${config.port}`);
      logger.info(`📚 Swagger OpenAPI documentation at http://localhost:${config.port}/api-docs`);
      logger.info(`⚡ WebSocket Socket.IO endpoint active on port ${config.port}`);
      logger.info(`================================================================`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Gracefully shutting down...`);
      SimulatorEngine.stop();
      RealHardwareService.stop();
      Wise4051Service.stop();
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      server.close(async () => {
        await disconnectDB();
        logger.info('Server successfully terminated.');
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 2000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Error during server bootstrap. Retrying in 2.5s...');
    setTimeout(bootstrap, 2500);
  }
}

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception caught in process');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection caught in process');
});

bootstrap();
