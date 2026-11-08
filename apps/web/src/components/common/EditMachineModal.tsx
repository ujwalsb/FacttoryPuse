import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.js';
import { api } from '../../services/api.js';
import { IndustrialProtocol } from '@factorypulse/shared';
import {
  Cpu,
  Network,
  Gauge,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Zap,
  Activity
} from 'lucide-react';

interface EditMachineModalProps {
  isOpen: boolean;
  machine: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditMachineModal: React.FC<EditMachineModalProps> = ({
  isOpen,
  machine,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'PLC Automation Controller',
    manufacturer: '',
    modelNumber: '',
    serialNumber: '',
    protocol: IndustrialProtocol.MODBUS_TCP,
    ipAddress: '',
    port: 502,
    expectedCycleTimeSeconds: 10,
    plannedCapacityPerHour: 360,
    targetGoodQuantityPerShift: 2800,
    targetRejectionPercentage: 1.5,
    isMonitored: true,
    isSimulated: false,
    adminPassword: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync form with current machine data when modal opens
  useEffect(() => {
    if (machine) {
      setFormData({
        name: machine.name || '',
        category: machine.category || 'PLC Automation Controller',
        manufacturer: machine.manufacturer || '',
        modelNumber: machine.modelNumber || '',
        serialNumber: machine.serialNumber || '',
        protocol: machine.protocol || IndustrialProtocol.MODBUS_TCP,
        ipAddress: machine.ipAddress || '',
        port: machine.port || 502,
        expectedCycleTimeSeconds: machine.expectedCycleTimeSeconds ?? 10,
        plannedCapacityPerHour: machine.plannedCapacityPerHour ?? 360,
        targetGoodQuantityPerShift: machine.targetGoodQuantityPerShift ?? 2800,
        targetRejectionPercentage: machine.targetRejectionPercentage ?? 1.5,
        isMonitored: machine.isMonitored ?? true,
        isSimulated: false,
        adminPassword: ''
      });
      setErrorMessage(null);
    }
  }, [machine, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      name: formData.name,
      category: formData.category,
      manufacturer: formData.manufacturer,
      modelNumber: formData.modelNumber,
      serialNumber: formData.serialNumber,
      protocol: formData.protocol,
      ipAddress: formData.ipAddress,
      port: Number(formData.port),
      expectedCycleTimeSeconds: Number(formData.expectedCycleTimeSeconds),
      plannedCapacityPerHour: Number(formData.plannedCapacityPerHour),
      targetGoodQuantityPerShift: Number(formData.targetGoodQuantityPerShift),
      targetRejectionPercentage: Number(formData.targetRejectionPercentage),
      isMonitored: formData.isMonitored,
      isSimulated: false
    };

    try {
      const machineId = machine._id || machine.id;
      await api.updateMachine(machineId, payload, formData.adminPassword || undefined);
      if (onSuccess) {
        await onSuccess();
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.message || err?.error || 'Failed to update machine configuration. Please verify settings.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !machine) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title={`Edit Machine Parameters — ${machine.name || machine.assetId}`}
      subtitle={`Asset Identifier: ${machine.assetId}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/50 p-3 text-rose-300 text-[11px]">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: Machine Identity */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-400 border-b border-industrial-800 pb-1.5">
            <Cpu className="h-3.5 w-3.5" />
            <span>Asset Specifications</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Machine Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. CNC Milling Center 01"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Asset Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                placeholder="PLC Automation Controller"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Manufacturer
              </label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                placeholder="Siemens / Fanuc / Haas"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Model Number
              </label>
              <input
                type="text"
                value={formData.modelNumber}
                onChange={e => setFormData({ ...formData, modelNumber: e.target.value })}
                placeholder="S7-1500 / VF-2"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Serial Number
              </label>
              <input
                type="text"
                value={formData.serialNumber}
                onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder="SN-98234-A"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Industrial OT Protocol & Networking */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-cyan-400 border-b border-industrial-800 pb-1.5">
            <Network className="h-3.5 w-3.5" />
            <span>Protocol & Industrial Network Integration</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Industrial Protocol
              </label>
              <select
                value={formData.protocol}
                onChange={e => setFormData({ ...formData, protocol: e.target.value as IndustrialProtocol })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              >
                <option value={IndustrialProtocol.MODBUS_TCP}>Modbus TCP</option>
                <option value={IndustrialProtocol.OPC_UA}>OPC UA (IEC 62541)</option>
                <option value={IndustrialProtocol.MQTT}>MQTT / Sparkplug</option>
                <option value={IndustrialProtocol.WISE_4051}>Advantech WISE-4051</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                IP Address / Host
              </label>
              <input
                type="text"
                value={formData.ipAddress}
                onChange={e => setFormData({ ...formData, ipAddress: e.target.value })}
                placeholder="192.168.1.100"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Port
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={e => setFormData({ ...formData, port: Number(e.target.value) })}
                placeholder="502"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Performance & Cycle Targets */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400 border-b border-industrial-800 pb-1.5">
            <Gauge className="h-3.5 w-3.5" />
            <span>Capacity & Standard Cycle Baselines</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Cycle Time (s)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.expectedCycleTimeSeconds}
                onChange={e => setFormData({ ...formData, expectedCycleTimeSeconds: Number(e.target.value) })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Capacity / Hr
              </label>
              <input
                type="number"
                value={formData.plannedCapacityPerHour}
                onChange={e => setFormData({ ...formData, plannedCapacityPerHour: Number(e.target.value) })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Shift Target
              </label>
              <input
                type="number"
                value={formData.targetGoodQuantityPerShift}
                onChange={e => setFormData({ ...formData, targetGoodQuantityPerShift: Number(e.target.value) })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Max Rejection %
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.targetRejectionPercentage}
                onChange={e => setFormData({ ...formData, targetRejectionPercentage: Number(e.target.value) })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Operational Flags & Admin Password Authorization */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-400 border-b border-industrial-800 pb-1.5">
            <Lock className="h-3.5 w-3.5" />
            <span>Telemetry Flags & Authorization</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2 rounded-xl border border-industrial-800 bg-industrial-950/50 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isMonitored}
                  onChange={e => setFormData({ ...formData, isMonitored: e.target.checked })}
                  className="rounded border-industrial-700 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-industrial-300 font-semibold text-[11px]">Enable Active Monitoring</span>
              </label>
              <p className="text-[10px] text-industrial-500">Collects and stores time-series telemetry streams from physical asset.</p>
            </div>

            <div className="space-y-1 rounded-xl border border-industrial-800 bg-industrial-950/50 p-3">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-industrial-400 block">
                Admin Password (Optional)
              </label>
              <input
                type="password"
                value={formData.adminPassword}
                onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                placeholder="Enter password if required by tenant policy..."
                className="w-full rounded-xl border border-industrial-700 bg-industrial-900 px-3 py-2 text-xs text-white placeholder-industrial-600 focus:border-brand-500 focus:outline-none"
              />
              <p className="text-[10px] text-industrial-500 pt-1">
                Required only if strict tenant asset modifications policy is enforced.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-industrial-800">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-industrial-700 bg-industrial-800 px-4 py-2.5 sm:py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-700 hover:text-white transition-all disabled:opacity-50 text-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 sm:py-2 text-xs font-bold text-white shadow-lg shadow-brand-950/50 hover:bg-brand-500 transition-all disabled:opacity-50 text-center"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
