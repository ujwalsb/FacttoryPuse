import { Router } from 'express';
import { TelemetryController } from './telemetryController.js';
import { authenticate } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenant.js';
import { authorizeRoles } from '../../middleware/rbac.js';
import { UserRole } from '@factorypulse/shared';

const router = Router();

// Edge gateway telemetry ingestion (authenticated via gateway key or token)
router.post('/ingest', TelemetryController.ingest);

// Authenticated user queries
router.use(authenticate, enforceTenantIsolation);

router.get(
  '/overview',
  authorizeRoles(
    UserRole.MASTER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.PLANT_IT_HEAD,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MACHINE_OPERATOR,
    UserRole.MAINTENANCE_ENGINEER
  ),
  TelemetryController.getOverview
);

router.get(
  '/machines/:machineId/history',
  authorizeRoles(
    UserRole.MASTER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.PLANT_IT_HEAD,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MACHINE_OPERATOR,
    UserRole.MAINTENANCE_ENGINEER
  ),
  TelemetryController.getMachineHistory
);

export default router;
