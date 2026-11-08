import { Router } from 'express';
import { ReportController } from './reportController.js';
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

router.get('/oee', ReportController.getOeeReport);
router.get('/production', ReportController.getProductionReport);
router.get('/downtime', ReportController.getDowntimeReport);
router.get('/export/production.csv', ReportController.exportProductionCsv);
router.get('/export/alerts.csv', ReportController.exportAlertsCsv);

export default router;
