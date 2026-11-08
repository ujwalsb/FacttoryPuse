import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useTelemetry } from '../context/TelemetryContext.js';
import { Modal } from '../components/common/Modal.js';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Bell,
  Clock,
  Filter,
  Plus,
  Trash2,
  Loader2
} from 'lucide-react';

import { UserRole } from '@factorypulse/shared';
import { useAuth } from '../context/AuthContext.js';

export const AlertsPage: React.FC = () => {
  const { user } = useAuth();
  const canManageRules = user?.role === UserRole.COMPANY_ADMIN || user?.role === UserRole.PLANT_IT_HEAD;
  const { latestAlert } = useTelemetry();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [isLoading, setIsLoading] = useState(true);

  const [resolvingAlert, setResolvingAlert] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCreateRuleModal, setIsCreateRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    metric: 'TEMPERATURE',
    condition: 'GREATER_THAN',
    thresholdValue: 75,
    severity: 'CRITICAL',
    cooldownMinutes: 15
  });

  const fetchAlertsAndRules = async () => {
    try {
      const aRes = await api.getAlerts(statusFilter !== 'ALL' ? { status: statusFilter } : {});
      if (aRes.success) setAlerts(aRes.data);

      if (canManageRules) {
        const rRes = await api.getAlertRules();
        if (rRes.success) setRules(rRes.data);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsAndRules();
  }, [statusFilter, latestAlert]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await api.acknowledgeAlert(alertId);
      fetchAlertsAndRules();
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge alert');
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingAlert || !resolutionNotes.trim()) return;

    setIsSubmitting(true);
    try {
      await api.resolveAlert(resolvingAlert._id, resolutionNotes.trim());
      setResolvingAlert(null);
      setResolutionNotes('');
      fetchAlertsAndRules();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createAlertRule(newRule);
      setIsCreateRuleModal(false);
      fetchAlertsAndRules();
    } catch (err: any) {
      alert(err.message || 'Failed to create alert rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) return;
    try {
      await api.deleteAlertRule(ruleId);
      fetchAlertsAndRules();
    } catch (err: any) {
      alert(err.message || 'Failed to delete rule');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-industrial-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            Incident Alarms & Anomaly Dispatch Center
          </h1>
          <p className="text-xs text-industrial-400 mt-1 font-mono">
            Automated Threshold Evaluator • Deduplication • Escalation & Resolution Sign-Off
          </p>
        </div>

        {canManageRules && (
          <button
            onClick={() => setIsCreateRuleModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 transition-all self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Configure Anomaly Rule
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        {['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'].map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 sm:px-3.5 py-1.5 rounded-lg border font-semibold uppercase tracking-wider transition-all ${
              statusFilter === st
                ? 'bg-brand-600 border-brand-500 text-white'
                : 'bg-industrial-900 border-industrial-800 text-industrial-400 hover:text-white'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Alerts Table */}
      <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-4 sm:p-6 backdrop-blur-sm shadow-xl space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
          Incident Event Ledger ({alerts.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-industrial-800 bg-industrial-950/60 text-industrial-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Alarm Title</th>
                <th className="py-3 px-4">Affected Asset</th>
                <th className="py-3 px-4">Fault Code</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Logged At</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800/60 text-industrial-300">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-industrial-500">
                    No incident alarms found under the selected filter.
                  </td>
                </tr>
              ) : (
                alerts.map(a => (
                  <tr key={a._id} className="hover:bg-industrial-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          a.severity === 'CRITICAL'
                            ? 'border-rose-500/40 bg-rose-950/60 text-rose-400'
                            : 'border-amber-500/40 bg-amber-950/60 text-amber-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${a.severity === 'CRITICAL' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                        {a.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {a.title}
                      <span className="block text-[11px] text-industrial-400 font-normal">
                        {a.description}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-brand-300">
                      {a.machineId?.name || 'Machine'}
                    </td>
                    <td className="py-3.5 px-4">
                      {a.faultCode ? (
                        <span className="px-2 py-0.5 rounded bg-industrial-950 border border-industrial-800 text-rose-400 font-bold">
                          {a.faultCode}
                        </span>
                      ) : (
                        <span className="text-industrial-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold">{a.status}</td>
                    <td className="py-3.5 px-4 text-industrial-500">
                      {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {a.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleAcknowledge(a._id)}
                          className="rounded-lg border border-amber-500/30 px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-950/30 transition-all mr-2"
                        >
                          Acknowledge
                        </button>
                      )}
                      {a.status !== 'RESOLVED' && (
                        <button
                          onClick={() => setResolvingAlert(a)}
                          className="rounded-lg border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-950/30 transition-all"
                        >
                          Resolve
                        </button>
                      )}
                      {a.status === 'RESOLVED' && (
                        <span className="text-emerald-400 font-semibold text-[11px]">
                          ✓ Signed Off
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configured Anomaly Rules */}
      {canManageRules && (
        <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-6 backdrop-blur-sm shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
            Configured Alert Rules & Cooldown Throttles
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rules.map(r => (
              <div
                key={r._id}
                className="rounded-xl border border-industrial-800 bg-industrial-950/60 p-4 font-mono text-xs space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{r.name}</span>
                    <button
                      onClick={() => handleDeleteRule(r._id)}
                      className="text-industrial-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-industrial-400 text-[11px] mt-1">
                    Metric: <strong className="text-brand-300">{r.metric}</strong> • Condition: {r.condition} {r.thresholdValue}
                  </div>
                </div>

                <div className="pt-2 border-t border-industrial-800/80 flex items-center justify-between text-[11px] text-industrial-500">
                  <span>Cooldown: {r.cooldownMinutes} min</span>
                  <span className="text-emerald-400 font-bold">ACTIVE</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolve Alert Modal */}
      {resolvingAlert && (
        <Modal
          isOpen={!!resolvingAlert}
          onClose={() => setResolvingAlert(null)}
          title={`Resolve Incident: ${resolvingAlert.title}`}
          subtitle="Requires signed corrective action notes before closing incident alarm"
        >
          <form onSubmit={handleResolve} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Corrective Action & Resolution Notes <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                placeholder="Detail corrective step taken, e.g., Cleared optical sensor jam, verified belt alignment, and completed dry cycle run without fault."
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-industrial-800">
              <button
                type="button"
                onClick={() => setResolvingAlert(null)}
                className="rounded-xl border border-industrial-700 px-4 py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !resolutionNotes.trim()}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-emerald-500 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Incident Resolution'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Alert Rule Modal */}
      <Modal
        isOpen={isCreateRuleModal}
        onClose={() => setIsCreateRuleModal(false)}
        title="Configure Anomaly Alert Rule"
        subtitle="Evaluates streaming telemetry packets against safety boundaries"
      >
        <form onSubmit={handleCreateRule} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Rule Name
            </label>
            <input
              type="text"
              required
              value={newRule.name}
              onChange={e => setNewRule({ ...newRule, name: e.target.value })}
              placeholder="e.g. Spindle Thermal Protection Rule"
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Metric
              </label>
              <select
                value={newRule.metric}
                onChange={e => setNewRule({ ...newRule, metric: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="TEMPERATURE">Temperature (°C)</option>
                <option value="VIBRATION">Vibration (mm/s)</option>
                <option value="REJECTION_RATE">Rejection Rate (%)</option>
                <option value="STATE">Machine State</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Condition
              </label>
              <select
                value={newRule.condition}
                onChange={e => setNewRule({ ...newRule, condition: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="GREATER_THAN">Greater Than (&gt;)</option>
                <option value="LESS_THAN">Less Than (&lt;)</option>
                <option value="EQUALS">Equals (==)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Threshold Value
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={newRule.thresholdValue}
                onChange={e => setNewRule({ ...newRule, thresholdValue: parseFloat(e.target.value) })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Severity
              </label>
              <select
                value={newRule.severity}
                onChange={e => setNewRule({ ...newRule, severity: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Informational</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-industrial-800">
            <button
              type="button"
              onClick={() => setIsCreateRuleModal(false)}
              className="w-full sm:w-auto rounded-xl border border-industrial-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800 text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 disabled:opacity-50 text-center"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Rule'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
