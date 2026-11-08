import { Router } from 'express';
import { AlertController } from './alertController.js';
import { authenticate } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenant.js';
import { authorizeRoles } from '../../middleware/rbac.js';
import { UserRole } from '@factorypulse/shared';

const router = Router();

router.use(authenticate, enforceTenantIsolation);

router.get(
  '/',
  authorizeRoles(
    UserRole.MASTER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.PLANT_IT_HEAD,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MACHINE_OPERATOR,
    UserRole.MAINTENANCE_ENGINEER
  ),
  AlertController.list
);

router.patch(
  '/:id/acknowledge',
  authorizeRoles(
    UserRole.COMPANY_ADMIN,
    UserRole.PLANT_IT_HEAD,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MACHINE_OPERATOR,
    UserRole.MAINTENANCE_ENGINEER
  ),
  AlertController.acknowledge
);

router.patch(
  '/:id/resolve',
  authorizeRoles(
    UserRole.COMPANY_ADMIN,
    UserRole.PLANT_IT_HEAD,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MAINTENANCE_ENGINEER
  ),
  AlertController.resolve
);

router.get(
  '/rules',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  AlertController.listRules
);

router.post(
  '/rules',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  AlertController.createRule
);

router.delete(
  '/rules/:id',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  AlertController.deleteRule
);

export default router;
