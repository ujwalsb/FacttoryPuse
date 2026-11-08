import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Settings, Save, Clock, ShieldCheck, Database, Building2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<any | null>(null);
  const [settings, setSettings] = useState({
    telemetryRetentionDays: 90,
    staleDataThresholdSeconds: 30,
    timezone: 'UTC',
    contactEmail: ''
  });
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    async function loadTenant() {
      if (!user?.tenantId) return;
      try {
        const res = await api.getTenant(user.tenantId);
        if (res.success && res.data) {
          setTenant(res.data);
          setSettings({
            telemetryRetentionDays: res.data.settings?.telemetryRetentionDays || 90,
            staleDataThresholdSeconds: res.data.settings?.staleDataThresholdSeconds || 30,
            timezone: res.data.settings?.timezone || 'UTC',
            contactEmail: res.data.contactEmail || ''
          });
        }
      } catch (err) {
        console.error('Failed to load tenant settings:', err);
      }
    }
    loadTenant();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;
    try {
      await api.updateTenant(user.tenantId, {
        contactEmail: settings.contactEmail,
        settings: {
          telemetryRetentionDays: settings.telemetryRetentionDays,
          staleDataThresholdSeconds: settings.staleDataThresholdSeconds,
          timezone: settings.timezone
        }
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-industrial-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-brand-400 shrink-0" />
            <span>Company Thresholds, Shifts & Operating Parameters</span>
          </h1>
          <p className="text-xs text-industrial-400 mt-1 font-mono">
            Tenant Configurations • Telemetry Retention Schedules • Shift Worktimes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-industrial-800 bg-industrial-900/70 p-4 sm:p-6 backdrop-blur-sm shadow-xl space-y-5">
          <form onSubmit={handleSave} className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-400" />
              General Organization Profile
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  disabled
                  value={tenant?.name || 'Apex Precision Aerospace'}
                  className="w-full rounded-xl border border-industrial-800 bg-industrial-950 px-3.5 py-2 text-sm text-industrial-400 opacity-70"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                  Tenant Identifier Code
                </label>
                <input
                  type="text"
                  disabled
                  value={tenant?.code || 'APEX'}
                  className="w-full rounded-xl border border-industrial-800 bg-industrial-950 px-3.5 py-2 text-sm text-brand-400 font-bold uppercase opacity-70 font-mono"
                />
              </div>
            </div>

            <div className="border-t border-industrial-800 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-brand-400" />
                Data Ingestion & Stale Telemetry Boundaries
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                    Stale Data Heartbeat Timeout (Seconds)
                  </label>
                  <input
                    type="number"
                    min={5}
                    value={settings.staleDataThresholdSeconds}
                    onChange={e => setSettings({ ...settings, staleDataThresholdSeconds: parseInt(e.target.value, 10) })}
                    className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-industrial-500 font-mono mt-1 block">
                    Marks machine as STALE if no packets within interval
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                    Raw Telemetry Retention Window (Days)
                  </label>
                  <input
                    type="number"
                    min={30}
                    value={settings.telemetryRetentionDays}
                    onChange={e => setSettings({ ...settings, telemetryRetentionDays: parseInt(e.target.value, 10) })}
                    className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-industrial-500 font-mono mt-1 block">
                    High-frequency sensor time-series retention period
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-industrial-800">
              {isSaved ? (
                <span className="text-emerald-400 font-mono text-xs font-bold text-center sm:text-left">
                  ✓ Configuration successfully updated
                </span>
              ) : <div />}

              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 transition-all text-center"
              >
                <Save className="h-4 w-4" />
                Save Operating Parameters
              </button>
            </div>
          </form>
        </div>

        {/* Operating Shifts Info */}
        <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-4 sm:p-6 backdrop-blur-sm shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-400" />
            Standard Production Shifts
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl border border-industrial-800 bg-industrial-950/80 space-y-1">
              <span className="text-brand-400 font-bold block">SHIFT 1 (Day Shift)</span>
              <span className="text-white">06:00 — 14:00 (480 mins)</span>
              <span className="text-industrial-500 block text-[11px]">45m Scheduled Lunch & Break</span>
            </div>

            <div className="p-3 rounded-xl border border-industrial-800 bg-industrial-950/80 space-y-1">
              <span className="text-brand-400 font-bold block">SHIFT 2 (Evening Shift)</span>
              <span className="text-white">14:00 — 22:00 (480 mins)</span>
              <span className="text-industrial-500 block text-[11px]">45m Scheduled Dinner & Break</span>
            </div>

            <div className="p-3 rounded-xl border border-industrial-800 bg-industrial-950/80 space-y-1">
              <span className="text-brand-400 font-bold block">SHIFT 3 (Night Shift)</span>
              <span className="text-white">22:00 — 06:00 (480 mins)</span>
              <span className="text-industrial-500 block text-[11px]">45m Scheduled Rest & Break</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
