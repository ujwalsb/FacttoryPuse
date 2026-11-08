import { Router } from 'express';
import { CommandController } from './commandController.js';
import { authenticate } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenant.js';
import { authorizeRoles } from '../../middleware/rbac.js';
import { UserRole } from '@factorypulse/shared';
import { criticalOpsRateLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.use(
  authenticate,
  enforceTenantIsolation,
  authorizeRoles(
    UserRole.COMPANY_ADMIN,
    UserRole.PLANT_IT_HEAD,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MACHINE_OPERATOR,
    UserRole.MAINTENANCE_ENGINEER
  )
);

router.post('/machines/:machineId', criticalOpsRateLimiter, CommandController.issue);
router.get('/machines/:machineId', CommandController.listForMachine);

export default router;
