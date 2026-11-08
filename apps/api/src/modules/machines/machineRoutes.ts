import { Router } from 'express';
import { MachineController } from './machineController.js';
import { authenticate } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenant.js';
import { authorizeRoles } from '../../middleware/rbac.js';
import { verifyAdminPassword } from '../../middleware/adminPasswordAuth.js';
import { criticalOpsRateLimiter } from '../../middleware/rateLimiter.js';
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
  MachineController.list
);

router.post(
  '/',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  MachineController.register
);

router.get(
  '/discovery/devices',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  MachineController.getDiscoveredDevices
);

router.get(
  '/discovery/interfaces',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  MachineController.getNetworkInterfaces
);

router.post(
  '/discovery/probe',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  MachineController.probeDevice
);

router.get(
  '/simulator/status',
  authorizeRoles(
    UserRole.MASTER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.PLANT_IT_HEAD,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MACHINE_OPERATOR,
    UserRole.MAINTENANCE_ENGINEER
  ),
  MachineController.getSimulatorStatus
);

router.post(
  '/simulator/toggle',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD, UserRole.PRODUCTION_MANAGER),
  MachineController.toggleSimulatorMode
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
  MachineController.getById
);

router.put(
  '/:id',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  MachineController.update
);

router.put(
  '/:id/di-config',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  MachineController.updateDiConfig
);

router.post(
  '/:id/di-config/reset',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  MachineController.resetDiConfig
);

router.post(
  '/:id/wise/poll',
  authorizeRoles(
    UserRole.MASTER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.PLANT_IT_HEAD,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MACHINE_OPERATOR,
    UserRole.MAINTENANCE_ENGINEER
  ),
  MachineController.pollWiseNow
);

router.patch(
  '/:id/archive',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  MachineController.archive
);

router.patch(
  '/:id/restore',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  MachineController.restore
);

router.post(
  '/:id/device-connection',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD, UserRole.PRODUCTION_MANAGER),
  MachineController.toggleDeviceConnection
);

router.post(
  '/:id/ping',
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD, UserRole.PRODUCTION_MANAGER, UserRole.MAINTENANCE_ENGINEER),
  MachineController.pingDevice
);

router.post(
  '/:id/restart',
  criticalOpsRateLimiter,
  authorizeRoles(UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD),
  verifyAdminPassword,
  MachineController.restartMachine
);

export default router;
