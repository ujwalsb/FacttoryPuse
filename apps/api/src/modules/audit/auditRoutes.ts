import { Router } from 'express';
import { AuditController } from './auditController.js';
import { authenticate } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenant.js';
import { authorizeRoles } from '../../middleware/rbac.js';
import { UserRole } from '@factorypulse/shared';

const router = Router();

router.use(
  authenticate,
  enforceTenantIsolation,
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD)
);

router.get('/', AuditController.list);

export default router;
