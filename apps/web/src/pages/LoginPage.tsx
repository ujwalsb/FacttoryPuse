import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { DEMO_CREDENTIALS } from '../constants/demoCredentials.js';
import { UserRole } from '@factorypulse/shared';
import { getDefaultRouteForRole } from '../constants/rbac.js';
import { ThemeToggle } from '../components/common/ThemeToggle.js';
import {
  Layers,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Lock,
  Mail,
  Loader2,
  Shield,
  Building2,
  Network,
  BarChart3,
  Wrench,
  Gauge,
  Eye,
  EyeOff,
  Activity,
  Check,
  KeyRound
} from 'lucide-react';

interface RoleOption {
  role: UserRole;
  title: string;
  badge: string;
  description: string;
  email: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

const INDUSTRIAL_ROLES: RoleOption[] = [
  {
    role: UserRole.COMPANY_ADMIN,
    title: 'Company Administrator',
    badge: 'VP Operations',
    description: 'Enterprise fleet oversight, plant topology, shift targets & user governance',
    email: DEMO_CREDENTIALS[UserRole.COMPANY_ADMIN].email,
    icon: Shield,
    accentColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  },
  {
    role: UserRole.PLANT_IT_HEAD,
    title: 'Plant IT / OT Lead',
    badge: 'Automation & SCADA',
    description: 'WISE-4051, Modbus TCP, OPC UA gateway routing & PLC IP discovery',
    email: DEMO_CREDENTIALS[UserRole.PLANT_IT_HEAD].email,
    icon: Network,
    accentColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
  },
  {
    role: UserRole.PRODUCTION_MANAGER,
    title: 'Production Manager',
    badge: 'Line Supervisor',
    description: 'Hourly throughput, shift OEE tracking, work orders & micro-stoppages',
    email: DEMO_CREDENTIALS[UserRole.PRODUCTION_MANAGER].email,
    icon: BarChart3,
    accentColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
  },
  {
    role: UserRole.MACHINE_OPERATOR,
    title: 'Machine Operator',
    badge: 'Machinist / Operator',
    description: 'Assigned cell controls (Start/Stop/Reset), defect logging & parts counter',
    email: DEMO_CREDENTIALS[UserRole.MACHINE_OPERATOR].email,
    icon: Gauge,
    accentColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  },
  {
    role: UserRole.MAINTENANCE_ENGINEER,
    title: 'Maintenance Reliability Lead',
    badge: 'Reliability Engineer',
    description: 'Thermal & vibration diagnostics, MTBF/MTTR analytics & work orders',
    email: DEMO_CREDENTIALS[UserRole.MAINTENANCE_ENGINEER].email,
    icon: Wrench,
    accentColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30'
  },
  {
    role: UserRole.MASTER_ADMIN,
    title: 'SaaS Platform Owner',
    badge: 'Master Admin',
    description: 'Multi-tenant provisioning, enterprise licensing & global broker health',
    email: DEMO_CREDENTIALS[UserRole.MASTER_ADMIN].email,
    icon: Building2,
    accentColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
  }
];

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.COMPANY_ADMIN);
  const [email, setEmail] = useState<string>(DEMO_CREDENTIALS[UserRole.COMPANY_ADMIN].email);
  const [password, setPassword] = useState<string>('Password123!');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect immediately to the user's role-assigned route
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSelectRole = (r: UserRole) => {
    setSelectedRole(r);
    const cred = DEMO_CREDENTIALS[r];
    if (cred) {
      setEmail(cred.email);
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      // Auth context will trigger navigation via useEffect or route transition
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLoginAsRole = async (r: RoleOption) => {
    handleSelectRole(r.role);
    setIsLoading(true);
    setError(null);

    try {
      await login(r.email, 'Password123!');
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeRoleOption = INDUSTRIAL_ROLES.find(r => r.role === selectedRole) || INDUSTRIAL_ROLES[0];
  const ActiveIcon = activeRoleOption.icon;

  return (
    <div className="min-h-screen bg-industrial-950 text-industrial-100 flex flex-col justify-between py-4 sm:py-6 px-3 sm:px-6 lg:px-8 selection:bg-brand-500 selection:text-white transition-colors duration-300">
      
      {/* ─── TOP NAVBAR: BACK TO HOME & THEME TOGGLE ─── */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between pb-3 sm:pb-4 border-b border-industrial-800/80 gap-2">
        <Link
          to="/home"
          className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-industrial-800 bg-industrial-900/80 px-2.5 sm:px-3.5 py-1.5 text-xs font-mono font-medium text-industrial-300 hover:border-brand-500/50 hover:bg-brand-950/20 hover:text-brand-300 transition-all group shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
          <span className="hidden sm:inline">Back to Home Overview</span>
          <span className="sm:hidden">Home</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-md shadow-brand-500/20 shrink-0">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <span className="font-mono text-sm font-extrabold text-white tracking-tight hidden sm:inline">
            Factory<span className="text-brand-400">Pulse</span>
          </span>
        </div>

        <ThemeToggle variant="pill" showLabel={false} />
      </header>

      {/* ─── MAIN AUTHENTICATION CARD ─── */}
      <main className="my-auto py-4 sm:py-8 sm:mx-auto sm:w-full sm:max-w-4xl">
        
        {/* Header Title */}
        <div className="text-center mb-4 sm:mb-6 space-y-1.5 sm:space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-950/60 px-3 py-0.5 sm:px-3.5 sm:py-1 text-[11px] sm:text-xs font-mono text-brand-300">
            <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 shrink-0" />
            <span>IEC 62443 Enterprise IIoT Security</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white font-mono">
            Industrial Operations Portal Sign In
          </h1>
          <p className="text-xs text-industrial-400 font-mono max-w-md mx-auto">
            Select an operational role persona or authenticate with authorized corporate credentials.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          
          {/* Left Column: Role Selector Palette */}
          <div className="lg:col-span-5 rounded-2xl border border-industrial-800 bg-industrial-900/80 p-4 sm:p-5 backdrop-blur-xl shadow-xl flex flex-col justify-between space-y-3 sm:space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5 mb-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-industrial-300 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-brand-400" />
                  Select Manufacturing Role:
                </span>
                <span className="text-[10px] font-mono text-industrial-500">6 Roles Available</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {INDUSTRIAL_ROLES.map(r => {
                  const Icon = r.icon;
                  const isSelected = selectedRole === r.role;
                  return (
                    <button
                      key={r.role}
                      type="button"
                      onClick={() => handleSelectRole(r.role)}
                      className={`w-full text-left p-2.5 rounded-xl border font-mono transition-all flex items-center justify-between group ${
                        isSelected
                          ? 'border-brand-500 bg-brand-950/40 shadow-sm shadow-brand-500/20'
                          : 'border-industrial-800/90 bg-industrial-950/60 hover:border-industrial-700 hover:bg-industrial-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`p-1.5 rounded-lg border shrink-0 transition-colors ${
                            isSelected
                              ? 'border-brand-500/50 bg-brand-900/60 text-brand-300'
                              : 'border-industrial-800 bg-industrial-900 text-industrial-400 group-hover:text-white'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 truncate">
                          <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-industrial-200'}`}>
                            {r.title}
                          </div>
                          <div className="text-[10px] text-industrial-500 truncate">
                            {r.badge}
                          </div>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 text-industrial-600 group-hover:text-industrial-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Helper Note */}
            <div className="pt-3 border-t border-industrial-800/70 text-[11px] font-mono text-industrial-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-brand-400" />
                Default Pass: <strong className="text-white">Password123!</strong>
              </span>
              <span className="text-emerald-400 font-semibold">Ready</span>
            </div>
          </div>

          {/* Right Column: Active Role Sign In Form */}
          <div className="lg:col-span-7 rounded-2xl border border-industrial-800 bg-industrial-900/90 p-4 sm:p-7 backdrop-blur-xl shadow-2xl flex flex-col justify-between space-y-4 sm:space-y-5">
            
            {/* Active Selected Role Card Header */}
            <div className="p-3 sm:p-3.5 rounded-xl border border-industrial-800 bg-industrial-950/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-xl border ${activeRoleOption.accentColor} shrink-0`}>
                  <ActiveIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                      {activeRoleOption.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-brand-500/30 bg-brand-950/60 text-brand-300 uppercase">
                      {activeRoleOption.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-industrial-400 truncate mt-0.5">
                    {activeRoleOption.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleQuickLoginAsRole(activeRoleOption)}
                disabled={isLoading}
                title="Direct 1-click sign in as this role"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-600/20 px-3 py-1.5 sm:py-1 text-[11px] font-bold uppercase tracking-wider text-brand-300 hover:bg-brand-600/30 transition-all shrink-0 active:scale-95 text-center"
              >
                1-Click Sign In
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4 font-mono">
              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 font-mono flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                  <span>{error}</span>
                </div>
              )}

              {/* Corporate Email */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-300 block mb-1">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-industrial-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="operator@apex.com"
                    className="w-full rounded-xl border border-industrial-700 bg-industrial-950 pl-10 pr-4 py-2.5 text-xs text-white placeholder-industrial-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
                  />
                </div>
              </div>

              {/* Security Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-300">
                    Security Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1"
                  >
                    {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-industrial-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-industrial-700 bg-industrial-950 pl-10 pr-10 py-2.5 text-xs text-white placeholder-industrial-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
                  />
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-industrial-300 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="rounded border-industrial-700 text-brand-600 focus:ring-brand-500 h-4 w-4 bg-industrial-950"
                  />
                  <span className="text-[11px]">Remember workstation session on reload</span>
                </label>
                <span className="text-[10px] text-emerald-400 font-semibold">Active Session 7d</span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 disabled:opacity-50 transition-all font-mono"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Authenticating Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Industrial Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Security Protocol Strip */}
            <div className="pt-3 border-t border-industrial-800/80 flex items-center justify-between text-[11px] font-mono text-industrial-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Multi-Tenant Encryption: Active</span>
              </span>
              <span className="text-industrial-500">Argon2id + JWT</span>
            </div>
          </div>
        </div>
      </main>

      {/* ─── SECURITY FOOTER BADGES ─── */}
      <footer className="max-w-4xl mx-auto w-full pt-4 border-t border-industrial-800/80 text-center text-xs font-mono text-industrial-500 flex flex-wrap items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Strict Multi-Tenant Database Isolation</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-brand-400" />
          <span>Argon2id Hashes & TLS 1.3 Transport</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-indigo-400" />
          <span>Workstation Session Persistence Verified</span>
        </div>
      </footer>
    </div>
  );
};
