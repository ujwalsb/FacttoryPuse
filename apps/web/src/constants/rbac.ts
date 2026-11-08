import { UserRole } from '@factorypulse/shared';
import {
  LayoutDashboard,
  Cpu,
  Factory,
  BarChart3,
  Wrench,
  AlertTriangle,
  FileSpreadsheet,
  Network,
  Users,
  ScrollText,
  Settings,
  HeartPulse,
  Building,
  LucideIcon
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface RoleConfig {
  role: UserRole;
  title: string;
  badge: string;
  scope: string;
  defaultRoute: string;
  allowedRoutes: string[];
  navSections: NavSection[];
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  [UserRole.MASTER_ADMIN]: {
    role: UserRole.MASTER_ADMIN,
    title: 'SaaS Platform Owner',
    badge: 'Platform Owner',
    scope: 'Multi-Tenant Platform Control',
    defaultRoute: '/master-admin',
    allowedRoutes: ['/master-admin', '/machines', '/machines/:id', '/users', '/audit-logs', '/health'],
    navSections: [

      {
        title: 'SAAS PLATFORM OWNER',
        items: [
          { label: 'Company & Tenant Control', path: '/master-admin', icon: Building },
          { label: 'Platform & Company Admins', path: '/users', icon: Users },
          { label: 'Security & Audit Logs', path: '/audit-logs', icon: ScrollText },
          { label: 'System Diagnostics & Health', path: '/health', icon: HeartPulse }
        ]
      }
    ]
  },

  [UserRole.COMPANY_ADMIN]: {
    role: UserRole.COMPANY_ADMIN,
    title: 'Company Administrator (VP Operations)',
    badge: 'Executive Admin',
    scope: 'Enterprise-Wide Manufacturing',
    defaultRoute: '/',
    allowedRoutes: [
      '/',
      '/machines',
      '/machines/:id',
      '/plants',
      '/oee',
      '/maintenance',
      '/alerts',
      '/reports',
      '/gateways',
      '/users',
      '/audit-logs',
      '/settings',
      '/health'
    ],
    navSections: [
      {
        title: 'OPERATIONS',
        items: [
          { label: 'Executive Dashboard', path: '/', icon: LayoutDashboard },
          { label: 'Machine Fleet Monitor', path: '/machines', icon: Cpu },
          { label: 'Plant & Line Topology', path: '/plants', icon: Factory }
        ]
      },
      {
        title: 'ANALYTICS & OEE',
        items: [
          { label: 'OEE Performance', path: '/oee', icon: BarChart3 },
          { label: 'Maintenance & Work Orders', path: '/maintenance', icon: Wrench },
          { label: 'Incident Alert Center', path: '/alerts', icon: AlertTriangle },
          { label: 'Reports & Data Exports', path: '/reports', icon: FileSpreadsheet }
        ]
      },
      {
        title: 'CONFIGURATION & SECURITY',
        items: [
          { label: 'Edge Gateways & Drivers', path: '/gateways', icon: Network },
          { label: 'Company Users & RBAC', path: '/users', icon: Users },
          { label: 'Security & Audit Logs', path: '/audit-logs', icon: ScrollText },
          { label: 'Company Settings & Shifts', path: '/settings', icon: Settings },
          { label: 'System Health', path: '/health', icon: HeartPulse }
        ]
      }
    ]
  },

  [UserRole.PLANT_IT_HEAD]: {
    role: UserRole.PLANT_IT_HEAD,
    title: 'Plant IT / OT Lead (Automation Engineer)',
    badge: 'OT & Networks',
    scope: 'Industrial Connectivity & Edge Infrastructure',
    defaultRoute: '/gateways',
    allowedRoutes: [
      '/gateways',
      '/machines',
      '/machines/:id',
      '/plants',
      '/alerts',
      '/audit-logs',
      '/health'
    ],
    navSections: [
      {
        title: 'EDGE & OT INFRASTRUCTURE',
        items: [
          { label: 'Edge Gateways & Drivers', path: '/gateways', icon: Network },
          { label: 'Machine Fleet & Discovery', path: '/machines', icon: Cpu },
          { label: 'Plant & Line Topology', path: '/plants', icon: Factory }
        ]
      },
      {
        title: 'MONITORING & SECURITY',
        items: [
          { label: 'Incident Alert Center', path: '/alerts', icon: AlertTriangle },
          { label: 'Security & Audit Logs', path: '/audit-logs', icon: ScrollText },
          { label: 'System Health & Diagnostics', path: '/health', icon: HeartPulse }
        ]
      }
    ]
  },

  [UserRole.PRODUCTION_MANAGER]: {
    role: UserRole.PRODUCTION_MANAGER,
    title: 'Production Manager (Line Supervisor)',
    badge: 'Production Lead',
    scope: 'Shop Floor Lines & Output',
    defaultRoute: '/',
    allowedRoutes: [
      '/',
      '/machines',
      '/machines/:id',
      '/plants',
      '/oee',
      '/alerts',
      '/reports'
    ],
    navSections: [
      {
        title: 'PRODUCTION OPERATIONS',
        items: [
          { label: 'Production Dashboard', path: '/', icon: LayoutDashboard },
          { label: 'Machine Fleet Monitor', path: '/machines', icon: Cpu },
          { label: 'Plant & Line Topology', path: '/plants', icon: Factory }
        ]
      },
      {
        title: 'ANALYTICS & MONITORING',
        items: [
          { label: 'OEE Performance', path: '/oee', icon: BarChart3 },
          { label: 'Incident Alert Center', path: '/alerts', icon: AlertTriangle },
          { label: 'Reports & Data Exports', path: '/reports', icon: FileSpreadsheet }
        ]
      }
    ]
  },

  [UserRole.MACHINE_OPERATOR]: {
    role: UserRole.MACHINE_OPERATOR,
    title: 'Machine Operator (Shop Floor Machinist)',
    badge: 'Machinist / Operator',
    scope: 'Assigned Work Cell Controls',
    defaultRoute: '/machines',
    allowedRoutes: [
      '/machines',
      '/machines/:id',
      '/alerts'
    ],
    navSections: [
      {
        title: 'OPERATOR WORKSTATION',
        items: [
          { label: 'Machine Fleet & Controls', path: '/machines', icon: Cpu },
          { label: 'Active Incident Alerts', path: '/alerts', icon: AlertTriangle }
        ]
      }
    ]
  },

  [UserRole.MAINTENANCE_ENGINEER]: {
    role: UserRole.MAINTENANCE_ENGINEER,
    title: 'Maintenance Reliability Engineer',
    badge: 'Reliability Lead',
    scope: 'Asset Condition & Work Orders',
    defaultRoute: '/maintenance',
    allowedRoutes: [
      '/maintenance',
      '/machines',
      '/machines/:id',
      '/alerts'
    ],
    navSections: [
      {
        title: 'ASSET RELIABILITY',
        items: [
          { label: 'Maintenance & Work Orders', path: '/maintenance', icon: Wrench },
          { label: 'Machine Health & Fleet', path: '/machines', icon: Cpu },
          { label: 'Incident Alert Center', path: '/alerts', icon: AlertTriangle }
        ]
      }
    ]
  }
};

export function getDefaultRouteForRole(role?: UserRole): string {
  if (!role || !ROLE_CONFIGS[role]) return '/login';
  return ROLE_CONFIGS[role].defaultRoute;
}

export function isRouteAllowed(role: UserRole | undefined, pathname: string): boolean {
  if (!role || !ROLE_CONFIGS[role]) return false;
  const allowed = ROLE_CONFIGS[role].allowedRoutes;

  return allowed.some(pattern => {
    if (pattern === pathname) return true;
    if (pattern.includes(':id')) {
      const basePattern = pattern.split('/:id')[0];
      return pathname.startsWith(basePattern + '/') && pathname.length > basePattern.length + 1;
    }
    return false;
  });
}
