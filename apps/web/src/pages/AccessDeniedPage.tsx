import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { ROLE_CONFIGS, getDefaultRouteForRole } from '../constants/rbac.js';
import { DEMO_CREDENTIALS } from '../constants/demoCredentials.js';
import { UserRole } from '@factorypulse/shared';
import {
  ShieldAlert,
  ArrowRight,
  Shield,
  Lock,
  ArrowLeft,
  UserCheck,
  Building2,
  AlertTriangle
} from 'lucide-react';

interface AccessDeniedPageProps {
  allowedRoles?: UserRole[];
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({ allowedRoles = [] }) => {
  const { user, switchDemoRole, logout } = useAuth();
  const location = useLocation();

  const userRoleConfig = user?.role ? ROLE_CONFIGS[user.role] : null;
  const userHomeRoute = user?.role ? getDefaultRouteForRole(user.role) : '/';

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-2.5 sm:p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-rose-500/30 bg-industrial-950/90 p-4 sm:p-8 shadow-2xl shadow-rose-950/20 backdrop-blur-xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative space-y-4 sm:space-y-6">
          {/* Header Badge */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-industrial-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-400 shadow-inner shrink-0">
                <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 animate-pulse" />
              </div>
              <div>
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-rose-400 block">
                  HTTP 403 • FORBIDDEN
                </span>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-mono">
                  Access Restricted by Role RBAC
                </h1>
              </div>
            </div>

            <span className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-1 font-mono text-xs font-semibold text-rose-300">
              Deny by Default
            </span>
          </div>

          {/* Explanation */}
          <p className="text-sm text-industrial-300 leading-relaxed">
            Your current account role does not have authorization to access the requested module at{' '}
            <code className="rounded bg-industrial-900 border border-industrial-800 px-2 py-0.5 font-mono text-xs text-amber-300">
              {location.pathname}
            </code>
            . FactoryPulse enforces strict multi-tenant isolation and role-scoped functional partitioning.
          </p>

          {/* Context Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Role Card */}
            <div className="rounded-xl border border-industrial-800 bg-industrial-900/60 p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-industrial-400 font-mono block">
                Your Current Role
              </span>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-brand-400" />
                <span className="font-bold text-white text-sm font-mono">
                  {userRoleConfig?.title || user?.role}
                </span>
              </div>
              <p className="text-xs text-industrial-400">
                Scope: <span className="text-industrial-300 font-mono">{userRoleConfig?.scope || 'Restricted'}</span>
              </p>
            </div>

            {/* Required Roles Card */}
            <div className="rounded-xl border border-industrial-800 bg-industrial-900/60 p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-industrial-400 font-mono block">
                Authorized Roles for this Module
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {allowedRoles.length > 0 ? (
                  allowedRoles.map(role => (
                    <span
                      key={role}
                      className="rounded-md border border-brand-500/30 bg-brand-950/40 px-2 py-0.5 text-[11px] font-mono font-medium text-brand-300"
                    >
                      {ROLE_CONFIGS[role]?.badge || role}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-industrial-400 font-mono">
                    Restricted Platform Role
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Role Switcher for instant demo evaluation */}
          <div className="rounded-xl border border-industrial-800/80 bg-industrial-900/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-industrial-300">
              <UserCheck className="h-4 w-4 text-brand-400" />
              <span>Switch role to test access:</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={user?.role}
                onChange={e => switchDemoRole(e.target.value as UserRole)}
                className="bg-industrial-950 border border-industrial-700 text-white text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-brand-500"
              >
                {Object.entries(DEMO_CREDENTIALS).map(([role, item]) => (
                  <option key={role} value={role}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-industrial-800">
            <Link
              to={userHomeRoute}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 transition-all font-mono"
            >
              <ArrowLeft className="h-4 w-4" />
              Go to My Workspace ({userHomeRoute})
            </Link>

            <button
              onClick={logout}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-industrial-700 bg-industrial-900 px-4 py-2.5 text-xs font-semibold text-industrial-300 hover:text-white hover:bg-industrial-800 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
