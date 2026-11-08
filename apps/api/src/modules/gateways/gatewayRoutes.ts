import { Router } from 'express';
import { GatewayController } from './gatewayController.js';
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

router.get('/', GatewayController.list);
router.post('/', GatewayController.register);

export default router;
