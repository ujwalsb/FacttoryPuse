import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Modal } from '../components/common/Modal.js';
import { IndustrialProtocol } from '@factorypulse/shared';
import {
  Network,
  Plus,
  ShieldCheck,
  Cpu,
  HardDrive,
  Radio,
  CheckCircle2,
  Key,
  Server,
  Loader2
} from 'lucide-react';

export const GatewaysPage: React.FC = () => {
  const [gateways, setGateways] = useState<any[]>([]);
  const [plants, setPlants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [newGateway, setNewGateway] = useState({
    name: '',
    plantId: '',
    ipAddress: '10.20.4.15',
    protocolSupport: [IndustrialProtocol.MQTT, IndustrialProtocol.OPC_UA, IndustrialProtocol.MODBUS_TCP]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchGateways = async () => {
    try {
      const [gRes, pRes] = await Promise.all([
        api.getGateways(),
        api.getPlants()
      ]);
      if (gRes.success) setGateways(gRes.data);
      if (pRes.success) {
        setPlants(pRes.data);
        if (pRes.data.length > 0 && !newGateway.plantId) {
          setNewGateway(prev => ({ ...prev, plantId: pRes.data[0]._id }));
        }
      }
    } catch (err) {
      console.error('Failed to load gateways:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGateways();
  }, []);

  const handleRegisterGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.registerGateway(newGateway);
      setIsRegisterModalOpen(false);
      setNewGateway({
        name: '',
        plantId: plants[0]?._id || '',
        ipAddress: '10.20.4.15',
        protocolSupport: [IndustrialProtocol.MQTT, IndustrialProtocol.OPC_UA, IndustrialProtocol.MODBUS_TCP]
      });
      fetchGateways();
    } catch (err: any) {
      alert(err.message || 'Failed to register gateway');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-industrial-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <Network className="h-5 w-5 sm:h-6 sm:w-6 text-brand-400 shrink-0" />
            <span>Edge Gateways & Industrial Protocol Drivers</span>
          </h1>
          <p className="text-xs text-industrial-400 mt-1 font-mono">
            Outbound TLS Encrypted Links • Local Industrial Bus Adapters • Hardware Health
          </p>
        </div>

        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 transition-all w-full sm:w-auto text-center"
        >
          <Plus className="h-4 w-4" />
          Provision Edge Gateway
        </button>
      </div>

      {/* Security Networking Notice */}
      <div className="rounded-2xl border border-brand-500/20 bg-brand-950/20 p-4 backdrop-blur-sm text-xs flex items-start gap-3 text-industrial-300">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
        <div>
          <strong className="text-white block font-mono">Industrial Air-Gap & Zero Direct Exposure Policy:</strong>
          FactoryPulse edge gateways establish outbound authenticated mTLS sessions from within the customer OT plant network to the cloud ingestion broker. PLCs are never exposed to the public internet.
        </div>
      </div>

      {/* Gateways Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {gateways.map(g => (
          <div
            key={g._id}
            className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-4 sm:p-6 backdrop-blur-sm shadow-xl space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-brand-400">
                  {g.version}
                </span>
                <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                  {g.name}
                </h3>
                <p className="text-xs text-industrial-400">
                  Plant: {g.plantId?.name} ({g.plantId?.code})
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/40 bg-emerald-950/60 text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {g.status}
              </span>
            </div>

            <div className="rounded-xl border border-industrial-800 bg-industrial-950/60 p-3 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-industrial-400">
                <span className="flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-brand-400" />
                  Gateway Key Nonce:
                </span>
                <span className="text-white font-bold">{g.gatewayKey}</span>
              </div>
              <div className="flex items-center justify-between text-industrial-400">
                <span className="flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-industrial-500" />
                  OT Local IP Address:
                </span>
                <span className="text-brand-300">{g.ipAddress}</span>
              </div>
              <div className="flex items-center justify-between text-industrial-400">
                <span className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-industrial-500" />
                  Connected Machines:
                </span>
                <span className="text-emerald-400 font-bold">{g.connectedMachinesCount || 0} Assets</span>
              </div>
            </div>

            {/* Hardware Metrics Strip */}
            <div className="grid grid-cols-3 gap-2 font-mono text-xs border-t border-industrial-800/80 pt-3">
              <div>
                <span className="text-[10px] uppercase text-industrial-500 block">CPU Load</span>
                <span className="font-bold text-white">{g.metrics?.cpuUsagePercent || 14.8}%</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-industrial-500 block">RAM Usage</span>
                <span className="font-bold text-white">{g.metrics?.memoryUsagePercent || 32.1}%</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-industrial-500 block">Buffer Queue</span>
                <span className="font-bold text-emerald-400">{g.metrics?.queuedMessages || 0} msgs</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {g.protocolSupport?.map((p: string) => (
                <span
                  key={p}
                  className="font-mono text-[10px] px-2 py-0.5 rounded bg-industrial-800 border border-industrial-700 text-industrial-300 font-semibold"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Provision Gateway Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Provision Edge Gateway Node"
        subtitle="Issues unique cryptographic gateway token and binds to local plant network"
      >
        <form onSubmit={handleRegisterGateway} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Gateway Name
            </label>
            <input
              type="text"
              required
              value={newGateway.name}
              onChange={e => setNewGateway({ ...newGateway, name: e.target.value })}
              placeholder="e.g. Moxa UC-8200 Line 1 Industrial Gateway"
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Assigned Plant Facility
              </label>
              <select
                value={newGateway.plantId}
                onChange={e => setNewGateway({ ...newGateway, plantId: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                {plants.map(p => (
                  <option key={p._id} value={p._id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Internal Private IP
              </label>
              <input
                type="text"
                required
                value={newGateway.ipAddress}
                onChange={e => setNewGateway({ ...newGateway, ipAddress: e.target.value })}
                placeholder="10.20.4.15"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-industrial-800">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="w-full sm:w-auto rounded-xl border border-industrial-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800 text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 disabled:opacity-50 text-center"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Provision Gateway'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
