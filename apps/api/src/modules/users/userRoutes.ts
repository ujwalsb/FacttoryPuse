import { Router } from 'express';
import { UserController } from './userController.js';
import { authenticate } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenant.js';
import { authorizeRoles } from '../../middleware/rbac.js';
import { UserRole } from '@factorypulse/shared';

const router = Router();

router.use(
  authenticate,
  enforceTenantIsolation,
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN)
);

router.get('/', UserController.list);
router.post('/', UserController.create);
router.put('/:id', UserController.update);
router.patch('/:id/status', UserController.toggleStatus);
router.delete('/:id', UserController.delete);

export default router;
