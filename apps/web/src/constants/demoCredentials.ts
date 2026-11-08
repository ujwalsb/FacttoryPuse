import { UserRole } from '@factorypulse/shared';

export const DEMO_CREDENTIALS: Record<UserRole, { email: string; title: string }> = {
  [UserRole.MASTER_ADMIN]: { email: 'admin@factorypulse.io', title: 'Platform Owner (Master Admin)' },
  [UserRole.COMPANY_ADMIN]: { email: 'admin@apex.com', title: 'Company Admin (VP Operations)' },
  [UserRole.PLANT_IT_HEAD]: { email: 'it@apex.com', title: 'Plant IT / OT Engineer' },
  [UserRole.PRODUCTION_MANAGER]: { email: 'supervisor@apex.com', title: 'Production Supervisor' },
  [UserRole.MACHINE_OPERATOR]: { email: 'operator@apex.com', title: 'Machine Operator' },
  [UserRole.MAINTENANCE_ENGINEER]: { email: 'maintenance@apex.com', title: 'Maintenance Reliability Lead' }
};
