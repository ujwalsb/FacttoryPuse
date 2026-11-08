import { Router } from 'express';
import { PlantController } from './plantController.js';
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
  PlantController.listPlants
);
router.post(
  '/',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  PlantController.createPlant
);
router.get(
  '/:id',
  authorizeRoles(
    UserRole.MASTER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.PLANT_IT_HEAD,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MACHINE_OPERATOR,
    UserRole.MAINTENANCE_ENGINEER
  ),
  PlantController.getPlantById
);
router.get(
  '/:plantId/lines',
  authorizeRoles(
    UserRole.MASTER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.PLANT_IT_HEAD,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MACHINE_OPERATOR,
    UserRole.MAINTENANCE_ENGINEER
  ),
  PlantController.listLines
);
router.post(
  '/:plantId/lines',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  PlantController.createLine
);
router.put(
  '/:id',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  PlantController.updatePlant
);
router.delete(
  '/:id',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  PlantController.deletePlant
);
router.put(
  '/:plantId/lines/:lineId',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  PlantController.updateLine
);
router.delete(
  '/:plantId/lines/:lineId',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  PlantController.deleteLine
);

export default router;
