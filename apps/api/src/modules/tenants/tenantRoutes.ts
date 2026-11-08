import { Router } from 'express';
import { TenantController } from './tenantController.js';
import { authenticate } from '../../middleware/auth.js';
import { authorizeRoles } from '../../middleware/rbac.js';
import { UserRole } from '@factorypulse/shared';

const router = Router();

router.use(authenticate);

router.get('/', authorizeRoles(UserRole.MASTER_ADMIN), TenantController.list);
router.get('/:id', authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN), TenantController.getById);
router.post('/', authorizeRoles(UserRole.MASTER_ADMIN), TenantController.create);
router.put('/:id', authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN), TenantController.update);
router.patch('/:id/status', authorizeRoles(UserRole.MASTER_ADMIN), TenantController.updateStatus);
router.delete('/:id', authorizeRoles(UserRole.MASTER_ADMIN), TenantController.deleteTenant);

export default router;
