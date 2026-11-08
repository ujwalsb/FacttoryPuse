import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Modal } from '../components/common/Modal.js';
import { UserRole } from '@factorypulse/shared';
import { useAuth } from '../context/AuthContext.js';
import {
  Users,
  Plus,
  Shield,
  CheckCircle2,
  XCircle,
  Mail,
  UserCheck,
  Loader2,
  Edit3,
  Trash2,
  Search,
  Filter,
  KeyRound,
  AlertTriangle,
  Building2,
  Sparkles
} from 'lucide-react';

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.MASTER_ADMIN]: 'SaaS Platform Owner (Company provisioning, tenant feature toggles, platform-wide audits)',
  [UserRole.COMPANY_ADMIN]: 'Company Administrator (Fleet oversight, plant topology, company users, full operational access)',
  [UserRole.PLANT_IT_HEAD]: 'Plant IT / OT Lead (Edge gateways, PLC drivers, industrial protocol configuration, device pairing)',
  [UserRole.PRODUCTION_MANAGER]: 'Production Manager (Line throughput, hourly targets, shift OEE analytics, shift handovers)',
  [UserRole.MACHINE_OPERATOR]: 'Machine Operator (Real-time telemetry, good/reject parts counters, machine dispatch controls)',
  [UserRole.MAINTENANCE_ENGINEER]: 'Maintenance Engineer (Predictive diagnostics, sensor vibration/temperature alerts, work orders)'
};

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isMasterAdmin = currentUser?.role === UserRole.MASTER_ADMIN;
  const [users, setUsers] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Create form state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: 'Password123!',
    role: isMasterAdmin ? UserRole.COMPANY_ADMIN : UserRole.MACHINE_OPERATOR,
    tenantId: ''
  });

  // Edit form state
  const [editUser, setEditUser] = useState({
    name: '',
    email: '',
    role: UserRole.MACHINE_OPERATOR,
    isActive: true,
    newPassword: '',
    tenantId: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await api.getUsers();
      if (res.success) setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    if (isMasterAdmin) {
      api.getTenants().then(res => {
        if (res.success && res.data) {
          setTenants(res.data);
          if (res.data.length > 0) {
            setNewUser(prev => ({ ...prev, tenantId: prev.tenantId || res.data[0]._id }));
          }
        }
      }).catch(err => console.error('Failed to load tenants:', err));
    }
  }, [isMasterAdmin]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      const payload: any = {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role
      };
      if (isMasterAdmin && newUser.role === UserRole.COMPANY_ADMIN && newUser.tenantId) {
        payload.tenantId = newUser.tenantId;
      }
      const res = await api.createUser(payload);
      if (res.success) {
        setIsCreateModalOpen(false);
        setNewUser({
          name: '',
          email: '',
          password: 'Password123!',
          role: isMasterAdmin ? UserRole.COMPANY_ADMIN : UserRole.MACHINE_OPERATOR,
          tenantId: tenants[0]?._id || ''
        });
        setFeedbackMsg({ type: 'success', text: `User ${newUser.name} created successfully.` });
        fetchUsers();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to create user' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    setEditUser({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      newPassword: '',
      tenantId: user.tenantId?._id || user.tenantId || ''
    });
    setFeedbackMsg(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    setFeedbackMsg(null);

    const payload: any = {
      name: editUser.name,
      email: editUser.email,
      role: editUser.role,
      isActive: editUser.isActive
    };
    if (isMasterAdmin) {
      if (editUser.role === UserRole.MASTER_ADMIN) {
        payload.tenantId = null;
      } else if (editUser.tenantId) {
        payload.tenantId = editUser.tenantId;
      }
    }
    if (editUser.newPassword.trim()) {
      payload.password = editUser.newPassword.trim();
    }

    try {
      const res = await api.updateUser(selectedUser._id, payload);
      if (res.success) {
        setIsEditModalOpen(false);
        setFeedbackMsg({ type: 'success', text: `User ${editUser.name} updated successfully.` });
        fetchUsers();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to update user' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (user: any) => {
    setSelectedUser(user);
    setFeedbackMsg(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      const res = await api.deleteUser(selectedUser._id);
      if (res.success) {
        setIsDeleteModalOpen(false);
        setFeedbackMsg({ type: 'success', text: `User account '${selectedUser.email}' permanently deleted.` });
        fetchUsers();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to delete user' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentActive: boolean) => {
    try {
      await api.toggleUserStatus(userId, !currentActive);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle user status');
    }
  };

  const filteredUsers = users.filter(u => {
    // In Super Admin: strictly show ONLY administrators (MASTER_ADMIN and COMPANY_ADMIN), hide other roles
    if (isMasterAdmin && u.role !== UserRole.MASTER_ADMIN && u.role !== UserRole.COMPANY_ADMIN) {
      return false;
    }
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-industrial-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-brand-400 shrink-0" />
            <span>
              {isMasterAdmin ? 'Platform & Company Administrator Access Control' : 'User Identity, Role & Access Control (RBAC)'}
            </span>
          </h1>
          <p className="text-xs text-industrial-400 mt-1 font-mono">
            {isMasterAdmin
              ? 'Super Admin Governance • SaaS Platform Master Admins & Company Administrators Only'
              : 'Granular Manufacturing Roles • Edit & Delete Accounts • Audit Trail Verification'}
          </p>
        </div>

        <button
          onClick={() => {
            setNewUser({
              name: '',
              email: '',
              password: 'Password123!',
              role: isMasterAdmin ? UserRole.COMPANY_ADMIN : UserRole.MACHINE_OPERATOR,
              tenantId: tenants[0]?._id || ''
            });
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 transition-all w-full sm:w-auto text-center"
        >
          <Plus className="h-4 w-4" />
          {isMasterAdmin ? 'Provision Administrator' : 'Provision Team Member'}
        </button>
      </div>

      {/* Global Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`flex items-center justify-between rounded-xl p-3 text-xs font-mono border ${feedbackMsg.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
              : 'border-rose-500/40 bg-rose-950/40 text-rose-300'
            }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-industrial-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-industrial-900/50 p-3 rounded-xl border border-industrial-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-industrial-500" />
          <input
            type="text"
            placeholder={isMasterAdmin ? "Search administrators by name or email..." : "Search by employee name or email..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-industrial-700 bg-industrial-950 pl-9 pr-3 py-1.5 text-xs text-white placeholder-industrial-500 focus:border-brand-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-industrial-500 shrink-0" />
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto rounded-lg border border-industrial-700 bg-industrial-950 px-3 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none font-mono"
          >
            {isMasterAdmin ? (
              <>
                <option value="ALL">All Administrators ({filteredUsers.length})</option>
                <option value={UserRole.MASTER_ADMIN}>Platform Owner (Master Admin)</option>
                <option value={UserRole.COMPANY_ADMIN}>Company Administrator</option>
              </>
            ) : (
              <>
                <option value="ALL">All Roles ({users.length})</option>
                <option value={UserRole.COMPANY_ADMIN}>Company Administrator</option>
                <option value={UserRole.PLANT_IT_HEAD}>Plant IT / OT Lead</option>
                <option value={UserRole.PRODUCTION_MANAGER}>Production Manager</option>
                <option value={UserRole.MACHINE_OPERATOR}>Machine Operator</option>
                <option value={UserRole.MAINTENANCE_ENGINEER}>Maintenance Engineer</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-4 sm:p-6 backdrop-blur-sm shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            {isMasterAdmin ? 'Platform & Company Administrators' : 'Authorized Accounts'} ({filteredUsers.length})
          </h3>
          <span className="text-[11px] text-industrial-500 font-mono">
            {filteredUsers.filter(u => u.isActive).length} Active • {filteredUsers.filter(u => !u.isActive).length} Deactivated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-industrial-800 bg-industrial-950/60 text-industrial-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee Name</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Role Classification</th>
                <th className="py-3 px-4">Tenant / Company</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800/60 text-industrial-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-industrial-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-brand-500" />
                    Loading user roster...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-industrial-500">
                    No users match current search and role filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const isCurrent = currentUser?.id === u._id;
                  return (
                    <tr key={u._id} className="hover:bg-industrial-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                        <span>{u.name}</span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                            YOU
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-industrial-400">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-brand-500/30 bg-brand-950/40 text-brand-300">
                          <Shield className="h-2.5 w-2.5" />
                          {u.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-industrial-400">
                        {u.tenantId ? (
                          <span className="text-industrial-300 font-semibold">{u.tenantId.name || 'Company'}</span>
                        ) : (
                          <span className="text-brand-400 font-semibold">Global Platform</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${u.isActive
                              ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-400'
                              : 'border-rose-500/40 bg-rose-950/60 text-rose-400'
                            }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {u.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-industrial-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit User Button */}
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded-lg border border-industrial-700 bg-industrial-800 text-industrial-300 hover:text-white hover:border-brand-500 hover:bg-brand-950/30 transition-all"
                            title="Edit User Details & Role"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-brand-400" />
                          </button>

                          {/* Toggle Active Button */}
                          <button
                            onClick={() => handleToggleStatus(u._id, u.isActive)}
                            disabled={isCurrent}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${u.isActive
                                ? 'border-amber-500/30 text-amber-400 hover:bg-amber-950/30'
                                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/30'
                              } disabled:opacity-30 disabled:cursor-not-allowed`}
                            title={isCurrent ? "Cannot disable your own active account" : u.isActive ? 'Deactivate Account' : 'Activate Account'}
                          >
                            {u.isActive ? 'Suspend' : 'Activate'}
                          </button>

                          {/* Delete User Button */}
                          <button
                            onClick={() => handleOpenDelete(u)}
                            disabled={isCurrent}
                            className="p-1.5 rounded-lg border border-industrial-700 bg-industrial-800 text-industrial-300 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-950/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isCurrent ? "Cannot delete your own account" : "Delete User Account"}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision User Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={isMasterAdmin ? "Provision Administrator Account" : "Provision Authorized User Account"}
        subtitle={isMasterAdmin ? "Register SaaS Platform Master Admin or Company Administrator" : "Registers industrial team member with role-based permissions"}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Full Employee Name
            </label>
            <input
              type="text"
              required
              value={newUser.name}
              onChange={e => setNewUser({ ...newUser, name: e.target.value })}
              placeholder="e.g. Elena Rostova"
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Corporate Email Address
            </label>
            <input
              type="email"
              required
              value={newUser.email}
              onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="elena.rostova@factory.com"
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Initial Password
            </label>
            <input
              type="password"
              required
              value={newUser.password}
              onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Assigned Security Role
            </label>
            <select
              value={newUser.role}
              onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            >
              {isMasterAdmin ? (
                <>
                  <option value={UserRole.COMPANY_ADMIN}>Company Administrator</option>
                  <option value={UserRole.MASTER_ADMIN}>Master Admin (SaaS Platform Owner)</option>
                </>
              ) : (
                <>
                  <option value={UserRole.COMPANY_ADMIN}>Company Administrator</option>
                  <option value={UserRole.PLANT_IT_HEAD}>Plant IT / OT Lead</option>
                  <option value={UserRole.PRODUCTION_MANAGER}>Production Manager</option>
                  <option value={UserRole.MACHINE_OPERATOR}>Machine Operator</option>
                  <option value={UserRole.MAINTENANCE_ENGINEER}>Maintenance Engineer</option>
                </>
              )}
            </select>
            <p className="text-[11px] text-industrial-400 mt-1 font-mono">
              {ROLE_DESCRIPTIONS[newUser.role as UserRole]}
            </p>
          </div>

          {isMasterAdmin && newUser.role === UserRole.COMPANY_ADMIN && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Assigned Manufacturing Company / Tenant
              </label>
              <select
                value={newUser.tenantId}
                onChange={e => setNewUser({ ...newUser, tenantId: e.target.value })}
                required
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none font-mono"
              >
                <option value="">Select Target Company...</option>
                {tenants.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isMasterAdmin ? 'Provision Administrator' : 'Provision User')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit User Account & Security Role"
        subtitle={`Modify credentials and access profile for ${selectedUser?.email || ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Full Employee Name
            </label>
            <input
              type="text"
              required
              value={editUser.name}
              onChange={e => setEditUser({ ...editUser, name: e.target.value })}
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={editUser.email}
              onChange={e => setEditUser({ ...editUser, email: e.target.value })}
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Role Classification
            </label>
            <select
              value={editUser.role}
              onChange={e => setEditUser({ ...editUser, role: e.target.value as any })}
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            >
              {isMasterAdmin ? (
                <>
                  <option value={UserRole.COMPANY_ADMIN}>Company Administrator</option>
                  <option value={UserRole.MASTER_ADMIN}>Master Admin (SaaS Platform Owner)</option>
                </>
              ) : (
                <>
                  <option value={UserRole.COMPANY_ADMIN}>Company Administrator</option>
                  <option value={UserRole.PLANT_IT_HEAD}>Plant IT / OT Lead</option>
                  <option value={UserRole.PRODUCTION_MANAGER}>Production Manager</option>
                  <option value={UserRole.MACHINE_OPERATOR}>Machine Operator</option>
                  <option value={UserRole.MAINTENANCE_ENGINEER}>Maintenance Engineer</option>
                </>
              )}
            </select>
            <p className="text-[11px] text-industrial-400 mt-1 font-mono">
              {ROLE_DESCRIPTIONS[editUser.role as UserRole]}
            </p>
          </div>

          {isMasterAdmin && editUser.role === UserRole.COMPANY_ADMIN && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Assigned Manufacturing Company / Tenant
              </label>
              <select
                value={editUser.tenantId}
                onChange={e => setEditUser({ ...editUser, tenantId: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none font-mono"
              >
                <option value="">Select Target Company...</option>
                {tenants.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3 bg-industrial-950/70 p-3 rounded-xl border border-industrial-800">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={editUser.isActive}
              onChange={e => setEditUser({ ...editUser, isActive: e.target.checked })}
              className="rounded border-industrial-700 text-brand-500 focus:ring-brand-500 h-4 w-4"
            />
            <label htmlFor="isActiveCheck" className="text-xs font-semibold text-industrial-200 cursor-pointer">
              Account Active & Enabled for Authentication
            </label>
          </div>

          <div className="border-t border-industrial-800/80 pt-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Reset Password (Optional)
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-industrial-500" />
              <input
                type="password"
                placeholder="Leave blank to keep existing password"
                value={editUser.newPassword}
                onChange={e => setEditUser({ ...editUser, newPassword: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 pl-9 pr-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none font-mono"
              />
            </div>
            <p className="text-[11px] text-industrial-500 mt-1 font-mono">
              Minimum 6 characters. If populated, replaces the user's password hash.
            </p>
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
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Permanently Delete User Account"
        subtitle="Revokes all tenant access credentials and records security audit trail"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-200 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertTriangle className="h-5 w-5" />
              <span>Permanent Deletion Warning</span>
            </div>
            <p className="text-xs text-rose-300">
              Are you sure you want to permanently delete the account for{' '}
              <strong className="text-white underline">{selectedUser?.name}</strong> ({selectedUser?.email})?
            </p>
            <p className="text-[11px] text-rose-400/80">
              This action cannot be undone. All active sessions will terminate immediately. An immutable security audit log entry will be created.
            </p>
          </div>

          <div className="bg-industrial-950 p-3 rounded-xl border border-industrial-800 text-xs font-mono space-y-1 text-industrial-300">
            <div>User ID: <span className="text-white">{selectedUser?._id}</span></div>
            <div>Role: <span className="text-brand-300">{selectedUser?.role}</span></div>
            <div>Company: <span className="text-white">{selectedUser?.tenantId?.name || 'Platform'}</span></div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-industrial-800">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="w-full sm:w-auto rounded-xl border border-industrial-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800 text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteUser}
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 disabled:opacity-50 text-center"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Permanent Deletion'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
