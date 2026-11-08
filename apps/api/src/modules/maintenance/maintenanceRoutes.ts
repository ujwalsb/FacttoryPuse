import { Router } from 'express';
import { MaintenanceController } from './maintenanceController.js';
import { authenticate } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenant.js';
import { authorizeRoles } from '../../middleware/rbac.js';
import { UserRole } from '@factorypulse/shared';

const router = Router();

router.use(
  authenticate,
  enforceTenantIsolation,
  authorizeRoles(
    UserRole.MASTER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.PLANT_IT_HEAD,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MAINTENANCE_ENGINEER,
    UserRole.MACHINE_OPERATOR
  )
);

router.get('/', MaintenanceController.list);
router.get('/:id', MaintenanceController.getById);
router.post('/', MaintenanceController.create);
router.patch('/:id/status', MaintenanceController.updateStatus);

export default router;
