import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { ROLE_CONFIGS } from '../../constants/rbac.js';
import { ChevronRight, Shield, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const roleConfig = user?.role ? ROLE_CONFIGS[user.role] : null;
  const navSections = roleConfig?.navSections || [];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-50 w-72 sm:w-64 border-r border-industrial-800 bg-industrial-950/95 backdrop-blur-md transition-transform duration-300 lg:static lg:translate-x-0 ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          } overflow-y-auto p-4 pb-8 lg:pb-4 flex flex-col justify-between h-[calc(100dvh-4rem)] lg:h-auto safe-area-bottom`}
      >
        <div className="space-y-4">
          {/* Mobile Drawer Header with Close Button */}
          <div className="flex items-center justify-between pb-3 border-b border-industrial-800 lg:hidden">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand-400" />
              <span className="font-mono text-xs font-bold uppercase text-white tracking-wider">
                {roleConfig?.badge || 'Navigation'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-industrial-400 hover:text-white hover:bg-industrial-800 transition-colors"
              aria-label="Close navigation sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6">
            {navSections.map(section => (
              <div key={section.title}>
                <h4 className="px-3 text-[10px] font-bold tracking-widest text-industrial-500 uppercase font-mono mb-2">
                  {section.title}
                </h4>
                <nav className="space-y-1">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center justify-between rounded-xl px-3 py-2.5 sm:py-2 min-h-[42px] text-xs font-semibold tracking-wide transition-all ${isActive
                            ? 'bg-brand-600/15 border border-brand-500/30 text-white shadow-sm'
                            : 'text-industrial-400 hover:bg-industrial-900/60 hover:text-industrial-200 border border-transparent'
                          }`
                        }
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0 text-brand-400" />
                          <span>{item.label}</span>
                        </div>
                        <ChevronRight className="h-3 w-3 text-industrial-600" />
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-industrial-900 mt-6 space-y-3">
          {/* Active Role Card */}
          {roleConfig && (
            <div className="rounded-xl border border-industrial-800/80 bg-industrial-900/50 p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-3.5 w-3.5 text-brand-400" />
                <span className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">
                  {roleConfig.badge}
                </span>
              </div>
              <p className="text-[10px] text-industrial-400 leading-tight">
                {roleConfig.scope}
              </p>
            </div>
          )}

          <div className="text-center">
            <p className="font-mono text-[10px] text-industrial-500">
              FactoryPulse Industrial v1.0.0
            </p>
            <p className="font-mono text-[9px] text-industrial-600 mt-0.5">
              IEC 62443 / ISO 22400 RBAC Enforced
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
