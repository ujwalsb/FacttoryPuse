import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useTelemetry } from '../../context/TelemetryContext.js';
import { UserRole } from '@factorypulse/shared';
import { getDefaultRouteForRole } from '../../constants/rbac.js';
import {
  Bell,
  LogOut,
  Building2,
  Menu,
  Shield,
  Layers,
  Sparkles,
  Compass
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle.js';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { activeAlertsCount } = useTelemetry();

  const homeRoute = user ? getDefaultRouteForRole(user.role) : '/';

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-industrial-800 bg-industrial-950/90 px-3 sm:px-4 md:px-6 backdrop-blur-md">
      <div className="flex items-center gap-2 sm:gap-4">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
            className="rounded-lg p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-industrial-400 hover:bg-industrial-900 hover:text-white lg:hidden active:bg-industrial-800"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <Link to={homeRoute} className="flex items-center gap-2 sm:gap-2.5">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-md shadow-brand-500/20 shrink-0">
            <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <div>
            <span className="font-mono text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-1">
              Factory<span className="text-brand-400">Pulse</span>
            </span>
            <span className="text-[9px] sm:text-[10px] tracking-widest text-industrial-500 uppercase block -mt-1 font-mono">
              Industrial IIoT SaaS
            </span>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 md:gap-5">
        {/* Master Admin SaaS Owner Badge */}
        {user?.role === UserRole.MASTER_ADMIN && (
          <div className="hidden sm:flex items-center gap-2 bg-brand-950/40 border border-brand-500/30 rounded-lg px-3 py-1">
            <Building2 className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-xs font-mono text-brand-300 font-semibold tracking-wide">
              SaaS Platform Control Center
            </span>
          </div>
        )}

        {/* Machine Alerts Notification Indicator (Hidden for Master Admin as Master Admin does not manage shop floor machines) */}
        {user?.role !== UserRole.MASTER_ADMIN && (
          <Link
            to="/alerts"
            className="relative rounded-lg p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-industrial-400 hover:bg-industrial-900 hover:text-white transition-colors"
            title="Incident Alerts Center"
          >
            <Bell className="h-5 w-5" />
            {activeAlertsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm shadow-rose-500/50 animate-pulse font-mono">
                {activeAlertsCount}
              </span>
            )}
          </Link>
        )}

        {/* Link to Industrial Showcase / Home Page */}
        <Link
          to="/home"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-industrial-800 bg-industrial-900/80 px-2.5 py-1.5 text-xs font-mono font-medium text-industrial-300 hover:border-brand-500/50 hover:bg-brand-950/20 hover:text-brand-300 transition-all"
          title="View Industrial Platform Showcase / Home Page"
        >
          <Compass className="h-3.5 w-3.5 text-brand-400" />
          <span>Home / Showcase</span>
        </Link>

        {/* Dark / Bright Theme Button (Top Bar) */}
        <ThemeToggle />

        {/* User Role Badge & Profile */}
        <div className="flex items-center gap-2 sm:gap-3 border-l border-industrial-800 pl-2 sm:pl-3 md:pl-4">
          <div className="hidden text-right md:block">
            <p className="text-xs font-semibold text-white tracking-wide">{user?.name}</p>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-brand-400">
              <Shield className="h-2.5 w-2.5" />
              {user?.role.replace(/_/g, ' ')}
            </span>
          </div>

          <button
            onClick={logout}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-industrial-800 bg-industrial-900 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-industrial-300 hover:border-rose-500/40 hover:bg-rose-950/20 hover:text-rose-400 transition-all min-h-[38px]"
            title="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
