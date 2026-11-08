import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalApiRateLimiter } from './middleware/rateLimiter.js';

import authRoutes from './modules/auth/authRoutes.js';
import tenantRoutes from './modules/tenants/tenantRoutes.js';
import plantRoutes from './modules/plants/plantRoutes.js';
import machineRoutes from './modules/machines/machineRoutes.js';
import telemetryRoutes from './modules/telemetry/telemetryRoutes.js';
import commandRoutes from './modules/commands/commandRoutes.js';
import alertRoutes from './modules/alerts/alertRoutes.js';
import maintenanceRoutes from './modules/maintenance/maintenanceRoutes.js';
import reportRoutes from './modules/reports/reportRoutes.js';
import gatewayRoutes from './modules/gateways/gatewayRoutes.js';
import userRoutes from './modules/users/userRoutes.js';
import auditRoutes from './modules/audit/auditRoutes.js';
import healthRoutes from './modules/health/healthRoutes.js';

export function createApp(): express.Application {
  const app = express();

  // Harden express server
  app.disable('x-powered-by');

  // Security Headers & Clickjacking Protection
  app.use((_req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Security Middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows development inline scripts if needed
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );

  app.use(
    cors({
      origin: [
        config.cors.origin,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        /\.ngrok-free\.app$/,
        /\.ngrok\.app$/,
        /\.ngrok\.io$/
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-admin-password', 'Accept']
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // API Documentation (OpenAPI / Swagger lightweight specs)
  const swaggerSpec = {
    openapi: '3.0.0',
    info: {
      title: 'FactoryPulse Industrial IoT API',
      version: '1.0.0',
      description: 'Production Monitoring & Industrial Edge Gateway REST API'
    },
    servers: [{ url: `http://localhost:${config.port}/api/v1` }]
  };
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Global API Rate Limiter
  app.use('/api', generalApiRateLimiter);

  // Versioned API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/tenants', tenantRoutes);
  app.use('/api/v1/plants', plantRoutes);
  app.use('/api/v1/machines', machineRoutes);
  app.use('/api/v1/telemetry', telemetryRoutes);
  app.use('/api/v1/commands', commandRoutes);
  app.use('/api/v1/alerts', alertRoutes);
  app.use('/api/v1/maintenance', maintenanceRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/gateways', gatewayRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/audit-logs', auditRoutes);
  app.use('/api/v1/health', healthRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
