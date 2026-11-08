import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Modal } from '../components/common/Modal.js';
import { WorkOrderStatus } from '@factorypulse/shared';
import {
  Wrench,
  Plus,
  CheckSquare,
  Square,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  Package,
  Loader2
} from 'lucide-react';

export const MaintenancePage: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const [newOrder, setNewOrder] = useState({
    machineId: '',
    title: '',
    description: '',
    type: 'PREVENTIVE',
    priority: 'HIGH',
    scheduledDate: new Date().toISOString().split('T')[0],
    checklist: [
      { task: 'Lockout/Tagout (LOTO) isolation verified', isDone: false },
      { task: 'Inspect high-speed spindle drawbar retention force', isDone: false },
      { task: 'Clean and flush pneumatic filter regulator bowl', isDone: false },
      { task: 'Check way lube delivery rate on linear guide blocks', isDone: false }
    ]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchWorkOrders = async () => {
    try {
      const [woRes, mRes] = await Promise.all([
        api.getWorkOrders(),
        api.getMachines()
      ]);

      if (woRes.success) setWorkOrders(woRes.data);
      if (mRes.success) {
        setMachines(mRes.data);
        if (mRes.data.length > 0 && !newOrder.machineId) {
          setNewOrder(prev => ({ ...prev, machineId: mRes.data[0]._id }));
        }
      }
    } catch (err) {
      console.error('Failed to load maintenance records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createWorkOrder(newOrder);
      setIsCreateModalOpen(false);
      fetchWorkOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to create work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: string, nextStatus: WorkOrderStatus) => {
    try {
      await api.updateWorkOrderStatus(orderId, { status: nextStatus });
      fetchWorkOrders();
      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder((prev: any) => ({ ...prev, status: nextStatus }));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update work order status');
    }
  };

  const toggleChecklistItem = async (taskIndex: number) => {
    if (!selectedOrder) return;
    const updatedChecklist = [...selectedOrder.checklist];
    updatedChecklist[taskIndex].isDone = !updatedChecklist[taskIndex].isDone;

    try {
      await api.updateWorkOrderStatus(selectedOrder._id, { checklist: updatedChecklist });
      setSelectedOrder({ ...selectedOrder, checklist: updatedChecklist });
      fetchWorkOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to update checklist item');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-industrial-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Wrench className="h-6 w-6 text-brand-400" />
            Asset Maintenance & Reliability Work Orders
          </h1>
          <p className="text-xs text-industrial-400 mt-1 font-mono">
            Preventive Inspections • Corrective Breakdowns • LOTO Safety Sign-Off
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Create Work Order
        </button>
      </div>

      {/* Work Orders List & Selected Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Work Orders Cards */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
            Maintenance Schedule ({workOrders.length})
          </h3>

          <div className="space-y-3">
            {workOrders.map(wo => {
              const priorityColors: Record<string, string> = {
                CRITICAL: 'text-rose-400 border-rose-500/40 bg-rose-950/40',
                HIGH: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
                MEDIUM: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/40',
                LOW: 'text-slate-400 border-slate-700 bg-slate-900/60'
              };

              const isSelected = selectedOrder?._id === wo._id;

              return (
                <div
                  key={wo._id}
                  onClick={() => setSelectedOrder(wo)}
                  className={`cursor-pointer rounded-2xl border p-5 backdrop-blur-sm transition-all ${isSelected
                      ? 'border-brand-500 bg-brand-950/20 shadow-xl'
                      : 'border-industrial-800 bg-industrial-900/70 hover:border-industrial-700'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-mono text-xs mb-1">
                        <span className="font-bold text-brand-400">{wo.workOrderNumber}</span>
                        <span className="text-industrial-500">•</span>
                        <span className="text-industrial-300 font-semibold">{wo.machineId?.name || 'Machine Asset'}</span>
                      </div>
                      <h4 className="text-base font-bold text-white tracking-tight">
                        {wo.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityColors[wo.priority]}`}>
                        {wo.priority}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-industrial-700 bg-industrial-800 text-industrial-300">
                        {wo.status}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-industrial-400 line-clamp-2">
                    {wo.description}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-industrial-800/80 pt-3 text-xs font-mono text-industrial-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-industrial-500" />
                      Scheduled: {new Date(wo.scheduledDate).toLocaleDateString()}
                    </span>
                    <span className="text-industrial-300">
                      Checklist: {wo.checklist.filter((c: any) => c.isDone).length}/{wo.checklist.length} Complete
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Work Order Inspection Detail Drawer */}
        <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-6 backdrop-blur-sm shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-brand-400" />
            Inspection & Checklist Execution
          </h3>

          {!selectedOrder ? (
            <div className="text-center py-16 text-industrial-500 font-mono text-xs">
              Select a work order from the left list to review or sign off tasks.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-b border-industrial-800 pb-3">
                <span className="font-mono text-xs text-brand-400 font-bold block">
                  {selectedOrder.workOrderNumber}
                </span>
                <h4 className="text-base font-bold text-white mt-0.5">
                  {selectedOrder.title}
                </h4>
                <p className="text-xs text-industrial-400 mt-1">
                  Machine: {selectedOrder.machineId?.name} ({selectedOrder.machineId?.assetId})
                </p>
              </div>

              {/* Status Stepper */}
              <div>
                <label className="text-[11px] font-semibold uppercase text-industrial-400 block mb-2 font-mono">
                  Lifecycle Workflow:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {['OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'].map(st => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(selectedOrder._id, st as WorkOrderStatus)}
                      className={`p-2 rounded-lg border text-left font-bold transition-all ${selectedOrder.status === st
                          ? 'border-brand-500 bg-brand-950/40 text-brand-300'
                          : 'border-industrial-800 bg-industrial-950 text-industrial-400 hover:text-white'
                        }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checklist Sign-Off */}
              <div>
                <label className="text-[11px] font-semibold uppercase text-industrial-400 block mb-2 font-mono">
                  Preventive Sign-Off Tasks:
                </label>
                <div className="space-y-2">
                  {selectedOrder.checklist.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => toggleChecklistItem(idx)}
                      className="cursor-pointer flex items-start gap-2.5 p-2.5 rounded-xl border border-industrial-800 bg-industrial-950 hover:border-industrial-700 transition-all text-xs"
                    >
                      {item.isDone ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-industrial-500 mt-0.5" />
                      )}
                      <span className={item.isDone ? 'line-through text-industrial-500' : 'text-industrial-200'}>
                        {item.task}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Spare Parts Log */}
              {selectedOrder.sparePartsUsed && selectedOrder.sparePartsUsed.length > 0 && (
                <div className="pt-3 border-t border-industrial-800">
                  <label className="text-[11px] font-semibold uppercase text-industrial-400 block mb-2 font-mono flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-brand-400" />
                    Replaced Spare Components:
                  </label>
                  <div className="space-y-1.5">
                    {selectedOrder.sparePartsUsed.map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-industrial-950 border border-industrial-800 font-mono text-[11px]">
                        <span className="text-white">{p.partName}</span>
                        <span className="text-brand-400 font-bold">Qty: {p.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Work Order Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule Preventive / Corrective Maintenance"
        subtitle="Generates work order ticket, checklist, and technician assignment"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Select Machine Asset
            </label>
            <select
              value={newOrder.machineId}
              onChange={e => setNewOrder({ ...newOrder, machineId: e.target.value })}
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            >
              {machines.map(m => (
                <option key={m._id} value={m._id}>{m.assetId} — {m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Work Order Title
            </label>
            <input
              type="text"
              required
              value={newOrder.title}
              onChange={e => setNewOrder({ ...newOrder, title: e.target.value })}
              placeholder="e.g. 500-Hour Spindle Chiller Fluid Inspection"
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Scope of Work / Diagnostic Notes
            </label>
            <textarea
              required
              rows={2}
              value={newOrder.description}
              onChange={e => setNewOrder({ ...newOrder, description: e.target.value })}
              placeholder="Specify maintenance procedure, torque specifications, and safety precautions..."
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Type
              </label>
              <select
                value={newOrder.type}
                onChange={e => setNewOrder({ ...newOrder, type: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="PREVENTIVE">Preventive</option>
                <option value="CORRECTIVE">Corrective</option>
                <option value="EMERGENCY">Emergency</option>
                <option value="INSPECTION">Inspection</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Priority
              </label>
              <select
                value={newOrder.priority}
                onChange={e => setNewOrder({ ...newOrder, priority: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Scheduled Date
              </label>
              <input
                type="date"
                required
                value={newOrder.scheduledDate}
                onChange={e => setNewOrder({ ...newOrder, scheduledDate: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
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
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Work Order'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
