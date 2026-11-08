import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Modal } from '../components/common/Modal.js';
import { StatCard } from '../components/common/StatCard.js';
import {
  Building2,
  Plus,
  Shield,
  CheckCircle2,
  AlertOctagon,
  Users,
  Cpu,
  Loader2,
  Trash2,
  Sliders,
  Settings2,
  Zap,
  Activity,
  Layers,
  Sparkles,
  Lock
} from 'lucide-react';

export const MasterAdminPage: React.FC = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);

  const [newTenant, setNewTenant] = useState({
    name: '',
    code: '',
    plan: 'PROFESSIONAL',
    maxMachines: 50,
    maxUsers: 20,
    contactEmail: '',
    contactPhone: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    features: {
      advancedOee: true,
      remoteControl: true,
      opcUaSupport: true,
      mqttTlsSupport: true,
      modbusTcpSupport: true,
      predictiveMaintenance: false,
      customExportReports: true
    },
    settings: {
      telemetryRetentionDays: 90,
      timezone: 'UTC',
      currency: 'USD',
      staleDataThresholdSeconds: 30
    }
  });

  const [editFormData, setEditFormData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTenants = async () => {
    try {
      const res = await api.getTenants();
      if (res.success) setTenants(res.data);
    } catch (err) {
      console.error('Failed to load tenants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createTenant(newTenant);
      setIsCreateModalOpen(false);
      setNewTenant({
        name: '',
        code: '',
        plan: 'PROFESSIONAL',
        maxMachines: 50,
        maxUsers: 20,
        contactEmail: '',
        contactPhone: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        features: {
          advancedOee: true,
          remoteControl: true,
          opcUaSupport: true,
          mqttTlsSupport: true,
          modbusTcpSupport: true,
          predictiveMaintenance: false,
          customExportReports: true
        },
        settings: {
          telemetryRetentionDays: 90,
          timezone: 'UTC',
          currency: 'USD',
          staleDataThresholdSeconds: 30
        }
      });
      fetchTenants();
    } catch (err: any) {
      alert(err.message || 'Failed to create tenant');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (tenant: any) => {
    setSelectedTenant(tenant);
    setEditFormData({
      name: tenant.name,
      plan: tenant.plan,
      maxMachines: tenant.maxMachines,
      maxUsers: tenant.maxUsers,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone || '',
      features: {
        advancedOee: tenant.features?.advancedOee ?? true,
        remoteControl: tenant.features?.remoteControl ?? true,
        opcUaSupport: tenant.features?.opcUaSupport ?? true,
        mqttTlsSupport: tenant.features?.mqttTlsSupport ?? true,
        modbusTcpSupport: tenant.features?.modbusTcpSupport ?? true,
        predictiveMaintenance: tenant.features?.predictiveMaintenance ?? false,
        customExportReports: tenant.features?.customExportReports ?? true
      },
      settings: {
        telemetryRetentionDays: tenant.settings?.telemetryRetentionDays ?? 90,
        timezone: tenant.settings?.timezone ?? 'UTC',
        currency: tenant.settings?.currency ?? 'USD',
        staleDataThresholdSeconds: tenant.settings?.staleDataThresholdSeconds ?? 30
      }
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant || !editFormData) return;
    setIsSubmitting(true);
    try {
      await api.updateTenant(selectedTenant._id, editFormData);
      setIsEditModalOpen(false);
      setSelectedTenant(null);
      fetchTenants();
    } catch (err: any) {
      alert(err.message || 'Failed to update company');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (tenant: any) => {
    setSelectedTenant(tenant);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteTenant = async () => {
    if (!selectedTenant) return;
    setIsSubmitting(true);
    try {
      await api.deleteTenant(selectedTenant._id);
      setIsDeleteModalOpen(false);
      setSelectedTenant(null);
      fetchTenants();
    } catch (err: any) {
      alert(err.message || 'Failed to delete company');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to switch company status to ${nextStatus}?`)) return;

    try {
      await api.updateTenantStatus(tenantId, nextStatus);
      fetchTenants();
    } catch (err: any) {
      alert(err.message || 'Failed to update tenant status');
    }
  };

  const totalMachines = tenants.reduce((acc, t) => acc + (t.machineCount || 0), 0);
  const totalUsers = tenants.reduce((acc, t) => acc + (t.userCount || 0), 0);
  const totalEnterprise = tenants.filter(t => t.plan === 'ENTERPRISE').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-industrial-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-brand-400 shrink-0" />
            <span>SaaS Platform Master Administration</span>
          </h1>
          <p className="text-xs text-industrial-400 mt-1 font-mono">
            Company Provisioning • Plan Tiers & Feature Governance • Complete Tenant Lifecycle
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 transition-all w-full sm:w-auto text-center"
        >
          <Plus className="h-4 w-4" />
          Add New Company
        </button>
      </div>

      {/* Platform KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Registered Companies"
          value={tenants.length}
          subValue={`${tenants.filter(t => t.status === 'ACTIVE').length} Active • ${tenants.filter(t => t.status === 'SUSPENDED').length} Suspended`}
          icon={Building2}
          variant="indigo"
        />

        <StatCard
          title="Enterprise Tier Tenants"
          value={totalEnterprise}
          subValue="Highest priority SLA & limits"
          icon={Sparkles}
          variant="indigo"
        />

        <StatCard
          title="Platform Connected Machines"
          value={totalMachines}
          subValue="Across all customer manufacturing plants"
          icon={Cpu}
          variant="emerald"
        />

        <StatCard
          title="Provisioned User Accounts"
          value={totalUsers}
          subValue="Governed under tenant RBAC policies"
          icon={Users}
          variant="amber"
        />
      </div>

      {/* Tenants Table */}
      <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-4 sm:p-6 backdrop-blur-sm shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-400" />
            Customer Manufacturing Companies Directory
          </h3>
          <span className="text-xs text-industrial-400 font-mono">
            {tenants.length} Companies Governed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-industrial-800 bg-industrial-950/60 text-industrial-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Company Name</th>
                <th className="py-3 px-4">Tenant Code</th>
                <th className="py-3 px-4">Subscription Plan</th>
                <th className="py-3 px-4">Enabled Features</th>
                <th className="py-3 px-4">Machines Quota</th>
                <th className="py-3 px-4">User Seats</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800/60 text-industrial-300">
              {tenants.map(t => (
                <tr key={t._id} className="hover:bg-industrial-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">
                    {t.name}
                    <span className="block text-[10px] text-industrial-500 font-normal">
                      {t.contactEmail} {t.contactPhone ? `• ${t.contactPhone}` : ''}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-brand-400">{t.code}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${t.plan === 'ENTERPRISE'
                        ? 'border-purple-500/40 bg-purple-950/50 text-purple-300'
                        : t.plan === 'PROFESSIONAL'
                          ? 'border-brand-500/40 bg-brand-950/50 text-brand-300'
                          : 'border-industrial-700 bg-industrial-800 text-industrial-300'
                      }`}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {t.features?.advancedOee && (
                        <span className="px-1.5 py-0.5 rounded bg-industrial-800 text-industrial-300 text-[9px] border border-industrial-700">
                          OEE
                        </span>
                      )}
                      {t.features?.remoteControl && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[9px] border border-emerald-800/40">
                          Control
                        </span>
                      )}
                      {t.features?.opcUaSupport && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-400 text-[9px] border border-indigo-800/40">
                          OPC-UA
                        </span>
                      )}
                      {t.features?.mqttTlsSupport && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-400 text-[9px] border border-blue-800/40">
                          MQTT
                        </span>
                      )}
                      {t.features?.predictiveMaintenance && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 text-[9px] border border-amber-800/40">
                          PdM
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-white font-bold">{t.machineCount || 0}</span> / {t.maxMachines}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-white font-bold">{t.userCount || 0}</span> / {t.maxUsers}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${t.status === 'ACTIVE'
                          ? 'border border-emerald-500/40 bg-emerald-950/60 text-emerald-400'
                          : 'border border-rose-500/40 bg-rose-950/60 text-rose-400'
                        }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(t)}
                        className="inline-flex items-center gap-1 rounded-lg border border-industrial-700 bg-industrial-800 px-2 py-1 text-[11px] font-semibold text-industrial-200 hover:border-brand-500 hover:text-white transition-all"
                        title="Configure Features & Quotas"
                      >
                        <Sliders className="h-3 w-3 text-brand-400" />
                        Features & Quotas
                      </button>

                      <button
                        onClick={() => handleToggleStatus(t._id, t.status)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${t.status === 'ACTIVE'
                            ? 'border-amber-500/30 text-amber-400 hover:bg-amber-950/40'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/40'
                          }`}
                      >
                        {t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>

                      <button
                        onClick={() => handleOpenDelete(t)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-950/20 px-2 py-1 text-[11px] font-semibold text-rose-400 hover:bg-rose-900/40 hover:text-rose-200 transition-all"
                        title="Delete Company"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision New Tenant Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Manufacturing Company"
        subtitle="Provision an isolated multi-tenant boundary, plan limits, and initial administrative credentials"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateTenant} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Company Legal Name
              </label>
              <input
                type="text"
                required
                value={newTenant.name}
                onChange={e => setNewTenant({ ...newTenant, name: e.target.value })}
                placeholder="e.g. Apex Precision Aerospace"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Unique Company Code (2-6 chars)
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={newTenant.code}
                onChange={e => setNewTenant({ ...newTenant, code: e.target.value.toUpperCase() })}
                placeholder="e.g. APEX"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white uppercase focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Subscription Plan
              </label>
              <select
                value={newTenant.plan}
                onChange={e => setNewTenant({ ...newTenant, plan: e.target.value as any })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="STARTER">Starter Tier</option>
                <option value="PROFESSIONAL">Professional Tier</option>
                <option value="ENTERPRISE">Enterprise Tier</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Max Machines Quota
              </label>
              <input
                type="number"
                min={1}
                value={newTenant.maxMachines}
                onChange={e => setNewTenant({ ...newTenant, maxMachines: parseInt(e.target.value, 10) })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                User Seats Quota
              </label>
              <input
                type="number"
                min={1}
                value={newTenant.maxUsers}
                onChange={e => setNewTenant({ ...newTenant, maxUsers: parseInt(e.target.value, 10) })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Primary Contact Email
              </label>
              <input
                type="email"
                required
                value={newTenant.contactEmail}
                onChange={e => setNewTenant({ ...newTenant, contactEmail: e.target.value })}
                placeholder="contact@company.com"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={newTenant.contactPhone}
                onChange={e => setNewTenant({ ...newTenant, contactPhone: e.target.value })}
                placeholder="+1 (555) 0123"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Initial Company Admin Setup */}
          <div className="rounded-xl border border-industrial-800 bg-industrial-950/70 p-3.5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 font-mono flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" />
              Initial Company Administrator Credentials (Optional)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-industrial-400 block mb-1 font-mono">Admin Name</label>
                <input
                  type="text"
                  value={newTenant.adminName}
                  onChange={e => setNewTenant({ ...newTenant, adminName: e.target.value })}
                  placeholder="e.g. John Doe (VP Operations)"
                  className="w-full rounded-lg border border-industrial-700 bg-industrial-900 px-3 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-industrial-400 block mb-1 font-mono">Admin Email</label>
                <input
                  type="email"
                  value={newTenant.adminEmail}
                  onChange={e => setNewTenant({ ...newTenant, adminEmail: e.target.value })}
                  placeholder="admin@company.com"
                  className="w-full rounded-lg border border-industrial-700 bg-industrial-900 px-3 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-industrial-400 block mb-1 font-mono">Admin Password</label>
                <input
                  type="password"
                  value={newTenant.adminPassword}
                  onChange={e => setNewTenant({ ...newTenant, adminPassword: e.target.value })}
                  placeholder="Password123!"
                  className="w-full rounded-lg border border-industrial-700 bg-industrial-900 px-3 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Company Add Features Section */}
          <div className="rounded-xl border border-industrial-800 bg-industrial-950/70 p-3.5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 font-mono flex items-center gap-2">
              <Zap className="h-3.5 w-3.5" />
              Company Feature Toggles
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTenant.features.advancedOee}
                  onChange={e => setNewTenant({
                    ...newTenant,
                    features: { ...newTenant.features, advancedOee: e.target.checked }
                  })}
                  className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                />
                Advanced OEE (ISO 22400)
              </label>
              <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTenant.features.remoteControl}
                  onChange={e => setNewTenant({
                    ...newTenant,
                    features: { ...newTenant.features, remoteControl: e.target.checked }
                  })}
                  className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                />
                Remote Machine Start / Stop Control
              </label>
              <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTenant.features.opcUaSupport}
                  onChange={e => setNewTenant({
                    ...newTenant,
                    features: { ...newTenant.features, opcUaSupport: e.target.checked }
                  })}
                  className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                />
                OPC UA Industrial Connector
              </label>
              <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTenant.features.mqttTlsSupport}
                  onChange={e => setNewTenant({
                    ...newTenant,
                    features: { ...newTenant.features, mqttTlsSupport: e.target.checked }
                  })}
                  className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                />
                MQTT over TLS Telemetry Broker
              </label>
              <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTenant.features.modbusTcpSupport}
                  onChange={e => setNewTenant({
                    ...newTenant,
                    features: { ...newTenant.features, modbusTcpSupport: e.target.checked }
                  })}
                  className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                />
                Modbus TCP Device Mapping
              </label>
              <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTenant.features.customExportReports}
                  onChange={e => setNewTenant({
                    ...newTenant,
                    features: { ...newTenant.features, customExportReports: e.target.checked }
                  })}
                  className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                />
                Custom Data Exports & PDF Reporting
              </label>
              <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTenant.features.predictiveMaintenance}
                  onChange={e => setNewTenant({
                    ...newTenant,
                    features: { ...newTenant.features, predictiveMaintenance: e.target.checked }
                  })}
                  className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                />
                Predictive Maintenance Engine
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-industrial-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="w-full sm:w-auto rounded-xl border border-industrial-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800 text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 disabled:opacity-50 text-center"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Provision Company'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Company Features & Quotas Modal */}
      {isEditModalOpen && editFormData && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Configure Features & Quotas — ${selectedTenant?.name}`}
          subtitle="Manage subscription tier, machine and user limits, and company feature toggles"
          maxWidth="2xl"
        >
          <form onSubmit={handleUpdateTenant} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                  Subscription Plan
                </label>
                <select
                  value={editFormData.plan}
                  onChange={e => setEditFormData({ ...editFormData, plan: e.target.value })}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="STARTER">Starter Tier</option>
                  <option value="PROFESSIONAL">Professional Tier</option>
                  <option value="ENTERPRISE">Enterprise Tier</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                  Machine Assets Limit
                </label>
                <input
                  type="number"
                  min={1}
                  value={editFormData.maxMachines}
                  onChange={e => setEditFormData({ ...editFormData, maxMachines: parseInt(e.target.value, 10) })}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                  User Seats Limit
                </label>
                <input
                  type="number"
                  min={1}
                  value={editFormData.maxUsers}
                  onChange={e => setEditFormData({ ...editFormData, maxUsers: parseInt(e.target.value, 10) })}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                  Primary Contact Email
                </label>
                <input
                  type="email"
                  required
                  value={editFormData.contactEmail}
                  onChange={e => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                  Telemetry Retention (Days)
                </label>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={editFormData.settings.telemetryRetentionDays}
                  onChange={e => setEditFormData({
                    ...editFormData,
                    settings: { ...editFormData.settings, telemetryRetentionDays: parseInt(e.target.value, 10) }
                  })}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="rounded-xl border border-industrial-800 bg-industrial-950/70 p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 font-mono flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Active Company Features
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.features.advancedOee}
                    onChange={e => setEditFormData({
                      ...editFormData,
                      features: { ...editFormData.features, advancedOee: e.target.checked }
                    })}
                    className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                  />
                  Advanced OEE (ISO 22400)
                </label>
                <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.features.remoteControl}
                    onChange={e => setEditFormData({
                      ...editFormData,
                      features: { ...editFormData.features, remoteControl: e.target.checked }
                    })}
                    className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                  />
                  Remote Machine Start / Stop Control
                </label>
                <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.features.opcUaSupport}
                    onChange={e => setEditFormData({
                      ...editFormData,
                      features: { ...editFormData.features, opcUaSupport: e.target.checked }
                    })}
                    className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                  />
                  OPC UA Industrial Connector
                </label>
                <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.features.mqttTlsSupport}
                    onChange={e => setEditFormData({
                      ...editFormData,
                      features: { ...editFormData.features, mqttTlsSupport: e.target.checked }
                    })}
                    className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                  />
                  MQTT over TLS Broker Ingestion
                </label>
                <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.features.modbusTcpSupport}
                    onChange={e => setEditFormData({
                      ...editFormData,
                      features: { ...editFormData.features, modbusTcpSupport: e.target.checked }
                    })}
                    className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                  />
                  Modbus TCP Device Mapping
                </label>
                <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.features.customExportReports}
                    onChange={e => setEditFormData({
                      ...editFormData,
                      features: { ...editFormData.features, customExportReports: e.target.checked }
                    })}
                    className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                  />
                  Custom Data Exports & PDF Reports
                </label>
                <label className="flex items-center gap-2 text-industrial-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.features.predictiveMaintenance}
                    onChange={e => setEditFormData({
                      ...editFormData,
                      features: { ...editFormData.features, predictiveMaintenance: e.target.checked }
                    })}
                    className="rounded border-industrial-700 bg-industrial-900 text-brand-500"
                  />
                  Predictive Maintenance Engine
                </label>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-industrial-800">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-full sm:w-auto rounded-xl border border-industrial-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800 text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 disabled:opacity-50 text-center"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Features & Quotas'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Company Confirmation Modal */}
      {isDeleteModalOpen && selectedTenant && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title={`Permanent Deletion of Company ${selectedTenant.name}`}
          subtitle="WARNING: Irreversible multi-tenant data deletion"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm font-mono">
                <AlertOctagon className="h-5 w-5 shrink-0" />
                Cascade Deletion Warning
              </div>
              <p className="text-xs text-rose-300 leading-relaxed font-mono">
                Deleting <strong>{selectedTenant.name}</strong> ({selectedTenant.code}) will permanently remove:
              </p>
              <ul className="text-xs text-rose-300/80 list-disc list-inside space-y-1 font-mono">
                <li>All plants and production lines</li>
                <li>All connected machine records & telemetry history</li>
                <li>All company user accounts and RBAC access</li>
                <li>All maintenance work orders and incident alerts</li>
                <li>All historical production counts & OEE summaries</li>
              </ul>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full sm:w-auto rounded-xl border border-industrial-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800 text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTenant}
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 disabled:opacity-50 text-center"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Permanent Deletion'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
