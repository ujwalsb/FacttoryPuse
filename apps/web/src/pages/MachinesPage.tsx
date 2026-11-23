import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api.js';
import { useTelemetry } from '../context/TelemetryContext.js';
import { Modal } from '../components/common/Modal.js';
import { CommandModal } from '../components/common/CommandModal.js';
import { WiseDiConfigModal } from '../components/common/WiseDiConfigModal.js';
import { EditMachineModal } from '../components/common/EditMachineModal.js';
import { AdminPasswordModal } from '../components/common/AdminPasswordModal.js';
import { IndustrialProtocol, UserRole, getDefaultDigitalInputConfigs } from '@factorypulse/shared';
import { useAuth } from '../context/AuthContext.js';
import {
  Cpu, Plus, Search, Play, RotateCcw, Loader2, Radio, Wifi, Network,
  RefreshCw, CheckCircle2, AlertCircle, Zap, Sliders, Pencil, Trash2,
  Server, Signal, Activity, AlertTriangle, Power, BarChart3, ChevronRight,
  WifiOff, Eye, Boxes, UserCheck, Wrench, Shield, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Mini OEE Ring ────────────────────────────────────────────────────────────
const OeeRing: React.FC<{ value: number; size?: number }> = ({ value, size = 52 }) => {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  const color = value >= 80 ? '#34d399' : value >= 60 ? '#fbbf24' : '#f87171';
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
    </svg>
  );
};

// ─── Mini Metric Bar ──────────────────────────────────────────────────────────
const MetricBar: React.FC<{ value: number; max: number; color: string; label: string; unit: string }> = ({ value, max, color, label, unit }) => {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center text-[10px] font-mono">
        <span className="text-industrial-500 uppercase tracking-wider">{label}</span>
        <span className="text-white font-bold">{value?.toFixed(1)}<span className="text-industrial-500 font-normal ml-0.5">{unit}</span></span>
      </div>
      <div className="h-1 rounded-full bg-industrial-800/80 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ─── Signal Bars ──────────────────────────────────────────────────────────────
const SignalBars: React.FC<{ latencyMs?: number }> = ({ latencyMs }) => {
  const bars = latencyMs === undefined ? 0 : latencyMs < 10 ? 4 : latencyMs < 30 ? 3 : latencyMs < 80 ? 2 : 1;
  return (
    <div className="flex items-end gap-0.5">
      {[1, 2, 3, 4].map(b => (
        <div key={b} style={{ height: `${b * 3 + 3}px` }}
          className={`w-1 rounded-sm transition-all ${b <= bars ? 'bg-emerald-400' : 'bg-industrial-700'}`} />
      ))}
    </div>
  );
};

// ─── State colour maps ────────────────────────────────────────────────────────
const STATE_GLOW: Record<string, string> = {
  RUNNING: 'shadow-emerald-500/20 border-emerald-500/30',
  IDLE: 'shadow-amber-500/10 border-amber-500/20',
  STOPPED: 'shadow-rose-500/10 border-rose-500/20',
  FAULTED: 'shadow-red-500/20 border-red-500/40',
  MAINTENANCE: 'shadow-cyan-500/10 border-cyan-500/20',
  OFFLINE: 'shadow-none border-industrial-800/60',
};
const STATE_ACCENT: Record<string, string> = {
  RUNNING: 'from-emerald-500/10 to-transparent',
  IDLE: 'from-amber-500/5 to-transparent',
  STOPPED: 'from-rose-500/5 to-transparent',
  FAULTED: 'from-red-500/10 to-transparent',
  MAINTENANCE: 'from-cyan-500/5 to-transparent',
  OFFLINE: 'from-industrial-800/20 to-transparent',
};
const STATE_DOT: Record<string, string> = {
  RUNNING: 'bg-emerald-400',
  IDLE: 'bg-amber-400',
  STOPPED: 'bg-rose-500',
  FAULTED: 'bg-red-500',
  MAINTENANCE: 'bg-cyan-400',
  OFFLINE: 'bg-industrial-600',
};

export const MachinesPage: React.FC = () => {
  const { user } = useAuth();
  const canManageMachines =
    user?.role === UserRole.MASTER_ADMIN ||
    user?.role === UserRole.COMPANY_ADMIN ||
    user?.role === UserRole.PLANT_IT_HEAD;
  const { telemetryMap, isSimulatorActive } = useTelemetry();
  const [machines, setMachines] = useState<any[]>([]);
  const [plants, setPlants] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMachineForDiConfig, setSelectedMachineForDiConfig] = useState<any | null>(null);
  const [selectedMachineForEdit, setSelectedMachineForEdit] = useState<any | null>(null);
  const [adminPasswordAction, setAdminPasswordAction] = useState<{ isOpen: boolean; type: 'restart' | 'delete'; machine: any } | null>(null);
  const [newMachineDis, setNewMachineDis] = useState<any[]>(getDefaultDigitalInputConfigs());
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [connectModalMachine, setConnectModalMachine] = useState<any | null>(null);
  const [connectForm, setConnectForm] = useState({ ipAddress: '192.168.10.25', port: 502, protocol: IndustrialProtocol.MODBUS_TCP });
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [pingFeedback, setPingFeedback] = useState<Record<string, { reachable: boolean; latencyMs?: number; error?: string }>>({});
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);
  const [discoveredSubnet, setDiscoveredSubnet] = useState<string>('Auto (Host Network)');
  const [networkInterfaces, setNetworkInterfaces] = useState<any[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>('all');
  const [discoveryMode, setDiscoveryMode] = useState<'real' | 'hybrid'>('real');
  const [customSubnetInput, setCustomSubnetInput] = useState<string>('');
  const [directProbeIp, setDirectProbeIp] = useState<string>('');
  const [directProbePort, setDirectProbePort] = useState<number>(502);
  const [isDirectProbing, setIsDirectProbing] = useState<boolean>(false);
  const [directProbeFeedback, setDirectProbeFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(false);
  const [selectedMachineForCommand, setSelectedMachineForCommand] = useState<any | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<any | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [newMachine, setNewMachine] = useState({
    assetId: '', name: '', category: 'PLC Automation Controller',
    manufacturer: '', modelNumber: '', serialNumber: '',
    protocol: IndustrialProtocol.MODBUS_TCP, plantId: '', lineId: '',
    ipAddress: '192.168.10.25', port: 502,
    expectedCycleTimeSeconds: 10, plannedCapacityPerHour: 360,
    isMonitored: true, isSimulated: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOperator = user?.role === UserRole.MACHINE_OPERATOR;
  const isMaintenance = user?.role === UserRole.MAINTENANCE_ENGINEER;
  const [onlyAssigned, setOnlyAssigned] = useState<boolean>(false);

  const assignedMachineIds = useMemo(() => {
    if (!user?.assignedMachines) return [];
    return user.assignedMachines.map((id: any) =>
      typeof id === 'string' ? id : id?._id ? String(id._id) : String(id)
    );
  }, [user]);

  const fetchMachines = async () => {
    try {
      const [mResResult, pResResult] = await Promise.allSettled([
        api.getMachines({ search: search.trim() }),
        api.getPlants()
      ]);

      if (mResResult.status === 'fulfilled' && mResResult.value?.success) {
        setMachines(mResResult.value.data || []);
      }
      if (pResResult.status === 'fulfilled' && pResResult.value?.success) {
        const pData = pResResult.value.data || [];
        setPlants(pData);
        if (pData.length > 0 && !newMachine.plantId) {
          setNewMachine(prev => ({ ...prev, plantId: pData[0]._id }));
          loadLines(pData[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load machines:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLines = async (plantId: string) => {
    try {
      const res = await api.getLines(plantId);
      if (res.success) { setLines(res.data); if (res.data.length > 0) setNewMachine(prev => ({ ...prev, lineId: res.data[0]._id })); }
    } catch (err) { console.error('Failed to load lines:', err); }
  };

  const fetchDiscoveredDevices = async (overrideParams?: { subnet?: string; interface?: string; mode?: string }) => {
    setIsDiscoveryLoading(true);
    try {
      const modeToUse = overrideParams?.mode || discoveryMode;
      const ifaceToUse = overrideParams?.interface !== undefined ? overrideParams.interface : (selectedInterface !== 'all' && selectedInterface !== 'custom' ? selectedInterface : undefined);
      const subnetToUse = overrideParams?.subnet || (selectedInterface === 'custom' && customSubnetInput ? customSubnetInput : undefined);
      const res = await api.getDiscoveredDevices({ mode: modeToUse, interface: ifaceToUse, subnet: subnetToUse });
      if (res.success) {
        setDiscoveredDevices(res.data);
        if (res.subnet) setDiscoveredSubnet(res.subnet);
        if (res.interfaces) setNetworkInterfaces(res.interfaces);
      }
    } catch (err) { console.error('Failed to discover network devices:', err); }
    finally { setIsDiscoveryLoading(false); }
  };

  const handleDirectIpProbe = async () => {
    if (!directProbeIp.trim()) return;
    setIsDirectProbing(true); setDirectProbeFeedback(null);
    try {
      const res = await api.probeDevice({ ipAddress: directProbeIp.trim(), port: Number(directProbePort) || 502 });
      if (res.success && res.reachable && res.device) {
        setDirectProbeFeedback({
          type: 'success',
          text: `Connected! ${res.device.ipAddress}:${res.device.port} (${res.latencyMs}ms latency) • ${res.device.vendor} ${res.device.modelNumber}`
        });
        setDiscoveredDevices(prev => {
          const exists = prev.some((d: any) => d.ipAddress === res.device.ipAddress);
          if (exists) return prev.map((d: any) => d.ipAddress === res.device.ipAddress ? { ...d, ...res.device, isRealDevice: true, latencyMs: res.latencyMs } : d);
          return [{ deviceId: `REAL-${res.device.ipAddress.replace(/\./g, '-')}`, ...res.device, latencyMs: res.latencyMs, isRealDevice: true, detectedAt: new Date().toISOString() }, ...prev];
        });
      } else {
        setDirectProbeFeedback({
          type: 'error',
          text: res.error || `Device unreachable at ${directProbeIp.trim()}:${directProbePort}. No socket or ping reply.`
        });
      }
    } catch (err: any) {
      setDirectProbeFeedback({
        type: 'error',
        text: err.message || 'Direct IP handshake timed out.'
      });
    } finally {
      setIsDirectProbing(false);
    }
  };

  useEffect(() => {
    fetchMachines();
    if (canManageMachines) {
      fetchDiscoveredDevices();
    }
    const handleServerRecovered = () => {
      fetchMachines();
      if (canManageMachines) fetchDiscoveredDevices();
    };
    window.addEventListener('server:recovered', handleServerRecovered);
    return () => { window.removeEventListener('server:recovered', handleServerRecovered); };
  }, [search, canManageMachines]);

  const handleProbeIp = async () => {
    if (!newMachine.ipAddress) { setProbeError('Please enter an IPv4 address to probe.'); return; }
    setIsProbing(true); setProbeError(null); setProbeResult(null);
    try {
      const res = await api.probeDevice({ ipAddress: newMachine.ipAddress, port: Number(newMachine.port) || 502, protocol: newMachine.protocol });
      if (res.success && res.reachable && res.device) {
        const d = res.device; setProbeResult(d);
        setNewMachine(prev => ({
          ...prev,
          manufacturer: d.vendor || prev.manufacturer,
          modelNumber: d.modelNumber || prev.modelNumber,
          serialNumber: d.serialNumber || prev.serialNumber,
          category: d.category || prev.category,
          name: prev.name || `${d.vendor} ${d.modelNumber}`,
          expectedCycleTimeSeconds: d.suggestedCycleTime || prev.expectedCycleTimeSeconds,
          plannedCapacityPerHour: d.suggestedCapacity || prev.plannedCapacityPerHour
        }));
      } else {
        setProbeError(res.error || `Device handshake failed: IP ${newMachine.ipAddress}:${newMachine.port} did not respond.`);
      }
    } catch (err: any) {
      setProbeError(err.message || 'Network timeout: Device unreachable at specified IP address.');
    } finally {
      setIsProbing(false);
    }
  };

  const handleAutoFillWise4051 = () => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setNewMachine(prev => ({
      ...prev,
      protocol: IndustrialProtocol.WISE_4051,
      port: 80,
      assetId: prev.assetId || `WISE-4051-${randomSuffix}`,
      name: prev.name || 'Advantech WISE-4051 IoT Wireless I/O',
      category: 'Industrial IoT Digital I/O Gateway',
      manufacturer: 'Advantech Co., Ltd.',
      modelNumber: 'WISE-4051',
      serialNumber: prev.serialNumber || `SN-W4051-${randomSuffix}`,
      expectedCycleTimeSeconds: 10,
      plannedCapacityPerHour: 360,
      isMonitored: true,
      isSimulated: false
    }));
    setNewMachineDis(getDefaultDigitalInputConfigs());
    setProbeError(null);
  };

  const handleClaimDevice = (device: any) => {
    setIsDiscoveryModalOpen(false); setProbeResult(device); setProbeError(null);
    const assetIdGen = `DEV-${device.vendor.split(' ')[0].toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    setNewMachine(prev => ({ ...prev, assetId: assetIdGen, name: `${device.vendor} ${device.modelNumber}`, category: device.category, manufacturer: device.vendor, modelNumber: device.modelNumber, serialNumber: device.serialNumber, protocol: device.protocol, ipAddress: device.ipAddress, port: device.port, expectedCycleTimeSeconds: device.suggestedCycleTime, plannedCapacityPerHour: device.suggestedCapacity, isMonitored: true, isSimulated: false }));
    setIsRegisterModalOpen(true);
  };

  const handleRegisterMachine = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await api.registerMachine({ ...newMachine, isSimulated: false, isRealDevice: true, isDeviceConnected: true, digitalInputConfigs: newMachineDis, wiseConnectionSettings: { model: 'WISE-4051', protocol: newMachine.protocol === IndustrialProtocol.MODBUS_TCP ? 'MODBUS_TCP' : 'REST', slot: 0, pollIntervalMs: 500, timeoutMs: 1000 } });
      setIsRegisterModalOpen(false); setProbeResult(null); setProbeError(null); setNewMachineDis(getDefaultDigitalInputConfigs());
      setNewMachine({ assetId: '', name: '', category: 'PLC Automation Controller', manufacturer: '', modelNumber: '', serialNumber: '', protocol: IndustrialProtocol.MODBUS_TCP, plantId: plants[0]?._id || '', lineId: lines[0]?._id || '', ipAddress: '192.168.10.25', port: 502, expectedCycleTimeSeconds: 10, plannedCapacityPerHour: 360, isMonitored: true, isSimulated: false });
      fetchMachines(); fetchDiscoveredDevices();
    } catch (err: any) { alert(err.message || 'Failed to register machine asset'); }
    finally { setIsSubmitting(false); }
  };

  const handleToggleDevice = async (machineId: string, isConnected: boolean, params?: any) => {
    try { await api.toggleDeviceConnection(machineId, { isConnected, ...params }); setConnectModalMachine(null); await fetchMachines(); }
    catch (err: any) { alert(err.message || 'Failed to update device connection'); }
  };

  const handlePingDevice = async (machineId: string) => {
    setPingingId(machineId);
    try {
      const res = await api.pingDevice(machineId);
      setPingFeedback(prev => ({ ...prev, [machineId]: { reachable: res.reachable, latencyMs: res.latencyMs, error: res.error } }));
    } catch (err: any) { setPingFeedback(prev => ({ ...prev, [machineId]: { reachable: false, error: err.message } })); }
    finally { setPingingId(null); }
  };

  const enrichedMachines = machines.map(m => {
    const live = telemetryMap[m._id];
    const isConn = m.isDeviceConnected || m.assetId === 'PLC12' || (m.deviceConnectionStatus === 'CONNECTED');
    const effectiveState = !isSimulatorActive && !isConn ? 'OFFLINE' : (live?.state || m.state);
    if (live) return { ...m, isDeviceConnected: isConn, state: effectiveState, goodCount: live.goodCount, rejectCount: live.rejectCount, temperature: effectiveState === 'OFFLINE' ? 24.0 : live.temperature, cycleTime: live.cycleTimeSeconds, powerKw: effectiveState === 'OFFLINE' ? 0.0 : (live.powerKw ?? (effectiveState === 'RUNNING' ? 28.4 : 3.2)), energyKwh: live.energyKwh ?? 3412.5, oee: effectiveState === 'OFFLINE' ? 0 : (live.oee?.oee || m.summary?.oee) };
    return { ...m, isDeviceConnected: isConn, state: effectiveState, goodCount: m.summary?.goodCount || 0, rejectCount: m.summary?.rejectCount || 0, temperature: effectiveState === 'OFFLINE' ? 24.0 : 52.4, cycleTime: m.expectedCycleTimeSeconds, powerKw: effectiveState === 'OFFLINE' ? 0.0 : (effectiveState === 'RUNNING' ? 24.5 : 0.0), energyKwh: 3410.0, oee: effectiveState === 'OFFLINE' ? 0 : (m.summary?.oee || 85.0) };
  });

  const filteredMachines = enrichedMachines.filter(m => {
    if (selectedState !== 'ALL' && m.state !== selectedState) return false;
    if (onlyAssigned && assignedMachineIds.length > 0) {
      const mId = m._id ? String(m._id) : '';
      if (!assignedMachineIds.includes(mId)) return false;
    }
    return true;
  });
  const stateFilters = ['ALL', 'RUNNING', 'IDLE', 'STOPPED', 'FAULTED', 'MAINTENANCE', 'OFFLINE'];
  const unclaimedDevicesCount = discoveredDevices.filter((d: any) => !d.isClaimed).length;

  const fleetStats = {
    total: enrichedMachines.length,
    running: enrichedMachines.filter(m => m.state === 'RUNNING').length,
    faulted: enrichedMachines.filter(m => m.state === 'FAULTED').length,
    offline: enrichedMachines.filter(m => m.state === 'OFFLINE').length,
    connected: enrichedMachines.filter(m => m.isDeviceConnected).length,
    avgOee: enrichedMachines.length > 0 ? Math.round(enrichedMachines.reduce((a, m) => a + (m.oee || 0), 0) / enrichedMachines.length) : 0,
  };

  const iCls = "w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none font-mono placeholder:text-industrial-600 transition-colors";
  const lCls = "text-[10px] font-bold uppercase tracking-widest text-industrial-400 block mb-1.5";

  return (
    <div className="space-y-5">

      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl border border-industrial-800/60 bg-gradient-to-br from-industrial-900 via-industrial-950 to-black p-5 shadow-2xl">
        <div className="absolute inset-0 industrial-grid-pattern opacity-40 pointer-events-none" />
        <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-brand-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 right-20 h-32 w-32 rounded-full bg-cyan-500/5 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 border border-brand-500/30 shadow-lg shadow-brand-500/10">
              <Cpu className="h-6 w-6 text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Industrial Machine Fleet
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-brand-600/20 border border-brand-500/30 text-brand-300 uppercase tracking-widest">LIVE</span>
              </h1>
              <p className="text-xs text-industrial-400 mt-0.5 font-mono">IP Provisioning • OT Subnet Discovery • Real-Time Telemetry</p>
            </div>
          </div>
          {canManageMachines && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
              <button onClick={() => { setIsDiscoveryModalOpen(true); fetchDiscoveredDevices(); }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-500/40 bg-brand-950/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-300 shadow-lg hover:bg-brand-900/60 hover:border-brand-400 hover:text-white transition-all w-full sm:w-auto text-center">
                <Radio className="h-4 w-4 text-brand-400 animate-pulse" />
                Auto-Detect Devices
                {unclaimedDevicesCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">{unclaimedDevicesCount}</span>}
              </button>
              <button onClick={() => { setProbeResult(null); setProbeError(null); setIsRegisterModalOpen(true); }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 transition-all w-full sm:w-auto text-center">
                <Plus className="h-4 w-4" />Register Machine
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Operator Workstation Banner */}
      {isOperator && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-950/25 p-3.5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30">
              <UserCheck className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">Operator Workstation Active</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                  Machinist Shift
                </span>
              </div>
              <p className="text-[11px] text-amber-200/80 font-mono mt-0.5">
                Real-time piece counts, line cycle timing, and control commands for your assigned workstation.
              </p>
            </div>
          </div>
          {assignedMachineIds.length > 0 && (
            <div className="flex items-center gap-1.5 self-start sm:self-auto font-mono text-xs">
              <button
                type="button"
                onClick={() => setOnlyAssigned(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${!onlyAssigned
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-industrial-900 border border-industrial-800 text-industrial-400 hover:text-white'
                  }`}
              >
                All Fleet ({enrichedMachines.length})
              </button>
              <button
                type="button"
                onClick={() => setOnlyAssigned(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${onlyAssigned
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-industrial-900 border border-industrial-800 text-industrial-400 hover:text-white'
                  }`}
              >
                My Cell ({assignedMachineIds.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Maintenance Engineer Banner */}
      {isMaintenance && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-950/25 p-3.5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30">
              <Wrench className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">Reliability & Maintenance Engineering Active</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                  Condition Monitoring
                </span>
              </div>
              <p className="text-[11px] text-cyan-200/80 font-mono mt-0.5">
                Spindle thermal profiling, bearing vibration RMS telemetry, and preventative maintenance order dispatch.
              </p>
            </div>
          </div>
          <Link
            to="/maintenance"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500 text-black font-bold text-xs uppercase tracking-wider hover:bg-cyan-400 transition-all font-mono shrink-0"
          >
            <Wrench className="h-3.5 w-3.5" />
            Work Orders
          </Link>
        </div>
      )}

      {/* Fleet Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          { label: 'Total Assets', value: fleetStats.total, icon: <Boxes className="h-4 w-4" />, color: 'text-industrial-300', bg: 'bg-industrial-800/40', border: 'border-industrial-700/50' },
          { label: 'Running', value: fleetStats.running, icon: <Activity className="h-4 w-4" />, color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-500/30' },
          { label: 'Faulted', value: fleetStats.faulted, icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-400', bg: 'bg-red-950/40', border: 'border-red-500/30' },
          { label: 'Offline', value: fleetStats.offline, icon: <WifiOff className="h-4 w-4" />, color: 'text-industrial-400', bg: 'bg-industrial-900/40', border: 'border-industrial-700/50' },
          { label: 'Connected', value: fleetStats.connected, icon: <Signal className="h-4 w-4" />, color: 'text-cyan-400', bg: 'bg-cyan-950/40', border: 'border-cyan-500/30' },
          { label: 'Fleet OEE', value: `${fleetStats.avgOee}%`, icon: <BarChart3 className="h-4 w-4" />, color: fleetStats.avgOee >= 80 ? 'text-emerald-400' : fleetStats.avgOee >= 60 ? 'text-amber-400' : 'text-rose-400', bg: 'bg-industrial-900/40', border: 'border-industrial-700/50' },
        ] as const).map(stat => (
          <div key={stat.label} className={`flex items-center gap-3 rounded-xl border ${stat.border} ${stat.bg} px-4 py-3 backdrop-blur-sm`}>
            <span className={stat.color}>{stat.icon}</span>
            <div>
              <div className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-industrial-500 uppercase tracking-wider">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {stateFilters.map(state => (
            <button key={state} onClick={() => setSelectedState(state)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-all ${selectedState === state ? 'bg-brand-600 border-brand-500 text-white shadow-sm' : 'bg-industrial-900 border-industrial-800 text-industrial-400 hover:text-white hover:border-industrial-700'}`}>
              {state !== 'ALL' && <span className={`h-1.5 w-1.5 rounded-full ${selectedState === state ? 'bg-white' : (STATE_DOT[state] || 'bg-industrial-500')}`} />}
              {state}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-industrial-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search asset, name or IP..."
            className="w-full sm:w-60 rounded-xl border border-industrial-800 bg-industrial-900/90 pl-9 pr-3.5 py-2 text-xs text-white placeholder-industrial-500 focus:border-brand-500 focus:outline-none transition-colors" />
        </div>
      </div>

      {/* Machine Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center py-20 text-industrial-500 font-mono text-xs">
            <Loader2 className="h-7 w-7 animate-spin mx-auto mb-3 text-brand-500" />
            Loading machine fleet telemetry...
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="col-span-3 text-center py-20 text-industrial-500 font-mono text-xs border border-industrial-800 rounded-2xl bg-industrial-900/40">
            <Server className="h-10 w-10 mx-auto mb-3 text-industrial-700" />
            No machine assets match the selected filter criteria.
          </div>
        ) : filteredMachines.map(m => {
          const glow = STATE_GLOW[m.state] || STATE_GLOW.OFFLINE;
          const accent = STATE_ACCENT[m.state] || STATE_ACCENT.OFFLINE;
          const dot = STATE_DOT[m.state] || 'bg-industrial-600';
          const ping = pingFeedback[m._id];
          const oeeVal = typeof m.oee === 'number' ? m.oee : 0;
          return (
            <div key={m._id} className={`group relative overflow-hidden rounded-2xl border bg-industrial-900/80 backdrop-blur-sm shadow-xl flex flex-col transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl ${glow}`}>
              <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${accent} pointer-events-none`} />
              {m.state === 'RUNNING' && <div className="absolute inset-0 rounded-2xl pointer-events-none border border-emerald-500/15 animate-pulse" />}

              {/* Body */}
              <div className="relative p-4 space-y-3 flex-1">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`flex h-2 w-2 rounded-full ${dot} ${m.state === 'RUNNING' ? 'animate-pulse' : ''}`} />
                      <span className="font-mono text-[11px] font-bold text-brand-300 bg-brand-950/50 border border-brand-500/20 px-2 py-0.5 rounded-md">{m.assetId}</span>
                      <span className="text-[10px] font-mono text-industrial-500">{m.protocol}</span>
                      {assignedMachineIds.includes(m._id) && (
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                          <UserCheck className="h-2.5 w-2.5" /> MY CELL
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-sm leading-snug line-clamp-1">{m.name}</h3>
                    <p className="text-[11px] text-industrial-400 font-mono line-clamp-1">{m.manufacturer} {m.modelNumber} · {m.plantId?.name || 'Plant 1'}</p>
                  </div>
                  <div className="relative shrink-0">
                    <OeeRing value={oeeVal} size={52} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[11px] font-bold text-white leading-none">{oeeVal}%</span>
                      <span className="text-[8px] text-industrial-500 uppercase">OEE</span>
                    </div>
                  </div>
                </div>

                {/* Network */}
                {m.isDeviceConnected ? (
                  <div className="flex items-center justify-between text-[10px] font-mono bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg">
                    <span className="flex items-center gap-1.5 text-emerald-300 font-bold"><Wifi className="h-3 w-3 text-emerald-400" />Real Device Connected</span>
                    <div className="flex items-center gap-1.5">
                      <SignalBars latencyMs={ping?.latencyMs} />
                      <span className="text-emerald-200 font-bold">{m.ipAddress ? `${m.ipAddress}:${m.port || 502}` : 'Active'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] font-mono bg-industrial-950/60 border border-industrial-800/80 px-2.5 py-1.5 rounded-lg">
                    <span className="flex items-center gap-1.5 text-industrial-400">
                      <WifiOff className="h-3 w-3 text-industrial-600" />
                      <span className="text-rose-400 font-semibold">No Device · OFFLINE</span>
                    </span>
                    <span className="text-industrial-500">{m.ipAddress ? `${m.ipAddress}:${m.port || 502}` : 'Unassigned'}</span>
                  </div>
                )}

                {ping && (
                  <div className={`text-[10px] font-mono px-2 py-1 rounded border flex items-center justify-between ${ping.reachable ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/50 border-rose-500/40 text-rose-300'}`}>
                    <span>{ping.reachable ? `✓ Reachable (${ping.latencyMs}ms)` : `✗ ${ping.error || 'No device responding'}`}</span>
                    <button type="button" onClick={() => setPingFeedback(prev => { const n = { ...prev }; delete n[m._id]; return n; })} className="text-industrial-400 hover:text-white font-bold ml-1">×</button>
                  </div>
                )}

                {/* Metrics */}
                <div className="space-y-2 pt-1 border-t border-industrial-800/60">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <MetricBar label="Temp" value={m.temperature ?? 24} max={100} color="bg-amber-400" unit="°C" />
                    <MetricBar label="Power" value={m.powerKw ?? 0} max={50} color="bg-cyan-400" unit="kW" />
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-lg py-1.5">
                      <div className="text-[9px] text-industrial-500 uppercase font-mono">Good</div>
                      <div className="text-xs font-bold text-emerald-400 font-mono">{m.goodCount}</div>
                    </div>
                    <div className="bg-rose-950/30 border border-rose-500/20 rounded-lg py-1.5">
                      <div className="text-[9px] text-industrial-500 uppercase font-mono">Rej</div>
                      <div className="text-xs font-bold text-rose-400 font-mono">{m.rejectCount}</div>
                    </div>
                    <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-lg py-1.5">
                      <div className="text-[9px] text-industrial-500 uppercase font-mono">kWh</div>
                      <div className="text-xs font-bold text-indigo-300 font-mono">{m.energyKwh?.toFixed(0) ?? '—'}</div>
                    </div>
                    <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-lg py-1.5">
                      <div className="text-[9px] text-industrial-500 uppercase font-mono">Cycle</div>
                      <div className="text-xs font-bold text-cyan-300 font-mono">{m.cycleTime ?? '—'}s</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="relative border-t border-industrial-800/60 bg-black/20 px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link to={`/machines/${m._id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-industrial-300 hover:text-brand-300 transition-colors font-mono">
                    <Eye className="h-3 w-3" />Diagnostics<ChevronRight className="h-2.5 w-2.5" />
                  </Link>
                  {isMaintenance && (
                    <Link to="/maintenance" className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-2 py-1 text-[10px] font-mono text-cyan-300 hover:bg-cyan-900/30 hover:border-cyan-400 transition-all">
                      <Wrench className="h-2.5 w-2.5" />Work Order
                    </Link>
                  )}
                  {m.ipAddress && (
                    <button type="button" onClick={() => handlePingDevice(m._id)} disabled={pingingId === m._id}
                      className="inline-flex items-center gap-1 rounded-lg border border-industrial-700 bg-industrial-800/80 px-2 py-1 text-[10px] font-mono text-industrial-300 hover:text-white hover:border-brand-500 transition-all">
                      {pingingId === m._id ? <Loader2 className="h-2.5 w-2.5 animate-spin text-brand-400" /> : <Wifi className="h-2.5 w-2.5 text-brand-400" />}Ping
                    </button>
                  )}
                  {canManageMachines && (<>
                    <button type="button" onClick={() => setSelectedMachineForDiConfig(m)}
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-2 py-1 text-[10px] font-mono text-cyan-300 hover:bg-cyan-900/30 hover:border-cyan-400 transition-all">
                      <Sliders className="h-2.5 w-2.5" />WISE DI
                    </button>
                    <button type="button" onClick={() => setSelectedMachineForEdit(m)}
                      className="inline-flex items-center gap-1 rounded-lg border border-industrial-700 bg-industrial-800/80 px-2 py-1 text-[10px] font-mono text-industrial-300 hover:text-white hover:border-cyan-500 transition-all">
                      <Pencil className="h-2.5 w-2.5 text-cyan-400" />Edit
                    </button>
                    <button type="button" onClick={() => setAdminPasswordAction({ isOpen: true, type: 'restart', machine: m })}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-950/20 px-2 py-1 text-[10px] font-mono text-amber-300 hover:bg-amber-900/30 hover:border-amber-400 transition-all">
                      <RotateCcw className="h-2.5 w-2.5" />Restart
                    </button>
                    <button type="button" onClick={() => setAdminPasswordAction({ isOpen: true, type: 'delete', machine: m })}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-950/20 px-1.5 py-1 text-[10px] font-mono text-rose-300 hover:bg-rose-900/30 hover:border-rose-400 transition-all">
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </>)}
                </div>
                <div className="flex items-center gap-1.5">
                  {canManageMachines && (m.isDeviceConnected ? (
                    <button type="button" onClick={() => handleToggleDevice(m._id, false)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-950/20 px-2 py-1 text-[11px] font-mono text-rose-300 hover:bg-rose-900/40 hover:border-rose-400 transition-all">
                      <Power className="h-2.5 w-2.5" />Disconnect
                    </button>
                  ) : (
                    <button type="button" onClick={() => { setConnectModalMachine(m); setConnectForm({ ipAddress: m.ipAddress || '192.168.10.25', port: m.port || 502, protocol: m.protocol || IndustrialProtocol.MODBUS_TCP }); }}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-500/40 bg-brand-950/30 px-2 py-1 text-[11px] font-mono text-brand-300 hover:bg-brand-900/40 hover:border-brand-400 transition-all">
                      <Zap className="h-2.5 w-2.5 text-brand-400" />Connect
                    </button>
                  ))}
                  <button onClick={() => setSelectedMachineForCommand(m)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-industrial-700 bg-industrial-800/80 px-3 py-1 text-xs font-semibold text-white hover:border-brand-500 hover:bg-brand-950/30 transition-all font-mono">
                    <Play className="h-3 w-3 text-brand-400" />Dispatch
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Discovery Modal */}
      <Modal isOpen={isDiscoveryModalOpen} onClose={() => setIsDiscoveryModalOpen(false)}
        title="OT Subnet Discovery & PLC Auto-Detect"
        subtitle={`Broadcasting PLCs, robots & smart sensors on ${discoveredSubnet}`} maxWidth="4xl">
        <div className="space-y-4">
          <div className="bg-industrial-950 p-4 rounded-xl border border-industrial-800 space-y-4 font-mono text-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-industrial-300">Subnet: <strong className="text-white bg-industrial-900 px-2 py-0.5 rounded border border-industrial-800">{discoveredSubnet}</strong></span>
                <span className="text-industrial-500">•</span>
                <span className="text-industrial-400">Devices: <strong className="text-brand-300">{discoveredDevices.length}</strong></span>
                <span className="text-industrial-500">•</span>
                <span className="text-emerald-400 flex items-center gap-1"><Activity className="h-3 w-3" /> Real: <strong>{discoveredDevices.filter((d: any) => d.isRealDevice).length}</strong></span>
              </div>
              <button onClick={() => fetchDiscoveredDevices()} disabled={isDiscoveryLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-500/40 bg-brand-950/40 text-brand-300 hover:bg-brand-900/50 hover:text-white transition-all text-xs font-semibold">
                <RefreshCw className={`h-3.5 w-3.5 ${isDiscoveryLoading ? 'animate-spin' : ''}`} />Re-Scan
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-industrial-900">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-industrial-400 flex items-center gap-1"><Network className="h-3 w-3 text-brand-400" /> Network Adapter:</label>
                <div className="flex items-center gap-2">
                  <select value={selectedInterface} onChange={e => { const val = e.target.value; setSelectedInterface(val); if (val !== 'custom') fetchDiscoveredDevices({ interface: val === 'all' ? undefined : val }); }}
                    className="flex-1 bg-industrial-900 border border-industrial-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-brand-500 focus:outline-none">
                    <option value="all">Auto-Detect Plant Subnet</option>
                    {networkInterfaces.map((iface: any) => <option key={iface.name} value={iface.name}>{iface.name} ({iface.subnet} • {iface.ip})</option>)}
                    <option value="custom">Custom Subnet / CIDR...</option>
                  </select>
                  {selectedInterface === 'custom' && (
                    <div className="flex items-center gap-1">
                      <input type="text" placeholder="192.168.10.0/24" value={customSubnetInput} onChange={e => setCustomSubnetInput(e.target.value)} className="w-36 bg-industrial-900 border border-industrial-700 rounded-lg px-2 py-1 text-xs text-white" />
                      <button onClick={() => fetchDiscoveredDevices({ subnet: customSubnetInput })} disabled={!customSubnetInput.trim() || isDiscoveryLoading} className="px-2 py-1 bg-brand-600 rounded-lg text-white text-xs hover:bg-brand-500">Scan</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-industrial-400 flex items-center gap-1"><Sliders className="h-3 w-3 text-brand-400" /> Discovery Mode:</label>
                <div className="grid grid-cols-2 gap-1 bg-industrial-900 p-1 rounded-lg border border-industrial-800">
                  {(['real', 'hybrid'] as const).map(mode => (
                    <button key={mode} type="button" onClick={() => { setDiscoveryMode(mode); fetchDiscoveredDevices({ mode }); }}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${discoveryMode === mode ? 'bg-brand-600/40 text-brand-200 border border-brand-500/50' : 'text-industrial-400 hover:text-white'}`}>
                      {mode === 'real' ? 'Real' : 'Hybrid'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-industrial-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-industrial-400 flex items-center gap-1 shrink-0"><Search className="h-3 w-3 text-brand-400" /> Direct IP Probe:</span>
              <div className="flex flex-wrap items-center gap-1.5 flex-1 max-w-md">
                <input type="text" placeholder="e.g. 10.220.84.207" value={directProbeIp} onChange={e => setDirectProbeIp(e.target.value)} className="flex-1 min-w-[140px] bg-industrial-900 border border-industrial-700 rounded-lg px-2.5 py-1 text-white text-xs placeholder:text-industrial-600 focus:border-brand-500 focus:outline-none" />
                <input type="number" placeholder="502" value={directProbePort} onChange={e => setDirectProbePort(Number(e.target.value))} className="w-16 bg-industrial-900 border border-industrial-700 rounded-lg px-2 py-1 text-white text-xs focus:border-brand-500 focus:outline-none" />
                <button type="button" onClick={handleDirectIpProbe} disabled={!directProbeIp.trim() || isDirectProbing} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-500 transition-all text-xs disabled:opacity-50">
                  {isDirectProbing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Probe
                </button>
              </div>
            </div>
            {directProbeFeedback && (
              <div className={`text-[11px] p-2 rounded-lg border flex items-center gap-1.5 font-mono ${directProbeFeedback.type === 'success'
                ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30'
                : 'text-rose-400 bg-rose-950/40 border-rose-500/30'
                }`}>
                {directProbeFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                )}
                <span>{directProbeFeedback.text}</span>
              </div>
            )}
          </div>
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {isDiscoveryLoading ? (
              <div className="text-center py-12 text-industrial-500 font-mono text-xs">
                <Loader2 className="h-7 w-7 animate-spin mx-auto mb-2.5 text-brand-400" />
                Interrogating OT network for active PLC hardware...
              </div>
            ) : discoveredDevices.length === 0 ? (
              <div className="text-center py-12 text-industrial-500 font-mono text-xs space-y-2">
                <Radio className="h-8 w-8 mx-auto text-industrial-600 mb-1" />
                <p>No broadcasting devices detected.</p>
                <button onClick={() => { setDiscoveryMode('hybrid'); fetchDiscoveredDevices({ mode: 'hybrid' }); }} className="text-brand-400 hover:underline text-xs">Switch to Hybrid Mode</button>
              </div>
            ) : discoveredDevices.map((d: any) => (
              <div key={d.deviceId} className={`p-4 rounded-xl border transition-all ${d.isClaimed ? 'border-industrial-800 bg-industrial-950/40 opacity-60' : d.isRealDevice ? 'border-emerald-500/40 bg-industrial-950/90 hover:border-emerald-400' : 'border-brand-500/40 bg-industrial-950/90 hover:border-brand-400'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {d.isRealDevice ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />Real Device
                        </span>
                      ) : <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-industrial-800 text-industrial-400 border border-industrial-700">Virtual</span>}
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-brand-500/20 text-brand-300 border border-brand-500/30">{d.vendor}</span>
                      <h4 className="font-bold text-white text-sm">{d.modelNumber}</h4>
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1"><SignalBars latencyMs={d.latencyMs} /> {d.latencyMs}ms</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-industrial-400">
                      <span>IP: <strong className="text-white bg-industrial-900 px-1.5 py-0.5 rounded border border-industrial-800">{d.ipAddress}:{d.port}</strong></span>
                      <span>Protocol: <strong className="text-brand-300">{d.protocol}</strong></span>
                      <span>MAC: <strong className="text-industrial-300">{d.macAddress}</strong></span>
                      {d.openPorts?.length > 0 && <span className="text-emerald-400">Ports: <strong>{d.openPorts.join(', ')}</strong></span>}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {d.isClaimed ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 text-emerald-400 text-xs font-mono font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Connected ({d.connectedAssetId})
                      </span>
                    ) : (
                      <button onClick={() => handleClaimDevice(d)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-brand-500 transition-all font-mono">
                        <Zap className="h-3.5 w-3.5" /> Claim & Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-industrial-800 text-xs font-mono text-industrial-400">
            <span>Devices on the OT LAN are automatically cataloged here.</span>
            <button onClick={() => setIsDiscoveryModalOpen(false)} className="rounded-xl border border-industrial-700 px-4 py-1.5 text-xs font-semibold text-industrial-300 hover:bg-industrial-800">Close</button>
          </div>
        </div>
      </Modal>

      {/* Register Machine Modal */}
      <Modal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)}
        title="Register Industrial Machine Asset"
        subtitle="Configure hardware identifiers, network IP address, and telemetry parameters" maxWidth="2xl">
        <form onSubmit={handleRegisterMachine} className="space-y-4">
          <div className="p-4 rounded-xl border border-brand-500/30 bg-industrial-950/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-300 font-mono flex items-center gap-1.5"><Network className="h-4 w-4 text-brand-400" /> Network IP & Hardware Auto-Detect</span>
              <span className="text-[10px] font-mono text-industrial-400">PLC Socket Handshake</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-1">
                <label className={lCls}>IPv4 / Hostname / Tunnel</label>
                <input
                  type="text"
                  required
                  value={newMachine.ipAddress}
                  onChange={e => setNewMachine({ ...newMachine, ipAddress: e.target.value })}
                  placeholder="192.168.1.11 or edge.plant.local"
                  className={iCls}
                />
              </div>
              <div><label className={lCls}>Port</label><input type="number" required value={newMachine.port} onChange={e => setNewMachine({ ...newMachine, port: parseInt(e.target.value, 10) || 502 })} className={iCls} /></div>
              <div>
                <label className={lCls}>Protocol</label>
                <select value={newMachine.protocol} onChange={e => { const proto = e.target.value as any; setNewMachine({ ...newMachine, protocol: proto, port: proto === IndustrialProtocol.WISE_4051 ? 80 : proto === IndustrialProtocol.MODBUS_TCP ? 502 : newMachine.port }); }} className={iCls}>
                  <option value={IndustrialProtocol.WISE_4051}>Advantech WISE-4051</option>
                  <option value={IndustrialProtocol.MODBUS_TCP}>Modbus TCP (502)</option>
                  <option value={IndustrialProtocol.OPC_UA}>OPC UA (4840)</option>
                  <option value={IndustrialProtocol.MQTT}>MQTT TLS (1883)</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleProbeIp} disabled={isProbing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-500/40 bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 text-xs font-mono font-semibold transition-all disabled:opacity-50">
                  {isProbing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-brand-400" />}
                  {isProbing ? 'Probing Device IP...' : 'Probe IP & Auto-Detect Hardware'}
                </button>
                {newMachine.protocol === IndustrialProtocol.WISE_4051 && (
                  <button type="button" onClick={handleAutoFillWise4051} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-industrial-700 bg-industrial-900 text-industrial-300 hover:text-white hover:border-industrial-600 text-xs font-mono transition-all">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Auto-Fill WISE-4051 Profile
                  </button>
                )}
              </div>
              <span className="text-[10px] text-industrial-500 font-mono">Queries TCP port & interrogates PLC firmware</span>
            </div>
            {probeResult && (
              <div className="p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 text-xs font-mono space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Hardware Handshake Verified ({probeResult.vendor} • {probeResult.modelNumber})</div>
                <div className="text-[11px]">Serial: {probeResult.serialNumber} • MAC: {probeResult.macAddress} • Firmware: {probeResult.firmware}</div>
              </div>
            )}
            {probeError && (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs font-mono flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{probeError}</span>
                </div>
                {/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(newMachine.ipAddress.trim()) && (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-950/20 text-amber-200 text-xs font-mono space-y-1.5">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Radio className="h-3.5 w-3.5 text-amber-400" />
                      Cloud Deployment ➔ Private Local LAN Guidance
                    </div>
                    <p className="text-[11px] text-industrial-300 leading-relaxed">
                      Your target IP <span className="text-white font-bold">{newMachine.ipAddress}</span> is on a local private subnet. Cloud servers cannot route directly across the public internet to private LAN devices without an Edge Gateway or tunnel.
                    </p>
                    <ul className="text-[11px] text-industrial-300 list-disc list-inside space-y-0.5 pl-1">
                      <li><strong className="text-white">Option 1:</strong> Expose the device via Edge Gateway / VPN tunnel (e.g. Tailscale / Cloudflare Tunnel / Moxa) and enter its hostname in the field above.</li>
                      <li><strong className="text-white">Option 2:</strong> In the WISE-4051 web portal, configure outbound MQTT / REST push directly to this cloud server.</li>
                      <li><strong className="text-emerald-400">Ready to proceed:</strong> Click <strong className="text-white font-bold">&quot;Auto-Fill WISE-4051 Profile&quot;</strong> and <strong className="text-white font-bold">&quot;Register Machine Asset&quot;</strong> below to complete registration!</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lCls}>Asset Identifier</label><input type="text" required value={newMachine.assetId} onChange={e => setNewMachine({ ...newMachine, assetId: e.target.value.toUpperCase() })} placeholder="PLC-101" className={iCls} /></div>
            <div><label className={lCls}>Machine / PLC Name</label><input type="text" required value={newMachine.name} onChange={e => setNewMachine({ ...newMachine, name: e.target.value })} placeholder="Siemens S7-1500 Main Controller" className={iCls} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={lCls}>Category</label><input type="text" required value={newMachine.category} onChange={e => setNewMachine({ ...newMachine, category: e.target.value })} placeholder="PLC Automation Controller" className={iCls} /></div>
            <div><label className={lCls}>Manufacturer</label><input type="text" required value={newMachine.manufacturer} onChange={e => setNewMachine({ ...newMachine, manufacturer: e.target.value })} placeholder="Siemens AG" className={iCls} /></div>
            <div><label className={lCls}>Model Number</label><input type="text" required value={newMachine.modelNumber} onChange={e => setNewMachine({ ...newMachine, modelNumber: e.target.value })} placeholder="S7-1500 CPU 1516-3" className={iCls} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lCls}>Serial Number</label><input type="text" required value={newMachine.serialNumber} onChange={e => setNewMachine({ ...newMachine, serialNumber: e.target.value })} placeholder="SN-S7-1516-9921" className={iCls} /></div>
            <div>
              <label className={lCls}>Telemetry Mode</label>
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs text-white font-mono cursor-pointer"><input type="checkbox" checked={newMachine.isMonitored} onChange={e => setNewMachine({ ...newMachine, isMonitored: e.target.checked })} className="rounded border-industrial-700 text-brand-500 focus:ring-brand-500 h-4 w-4" /> Live Monitor</label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lCls}>Plant Facility</label>
              <select value={newMachine.plantId} onChange={e => { setNewMachine({ ...newMachine, plantId: e.target.value }); loadLines(e.target.value); }} className={iCls}>
                {plants.map((p: any) => <option key={p._id} value={p._id}>{p.name} ({p.code})</option>)}
              </select>
            </div>
            <div><label className={lCls}>Production Line</label>
              <select value={newMachine.lineId} onChange={e => setNewMachine({ ...newMachine, lineId: e.target.value })} className={iCls}>
                {lines.map((l: any) => <option key={l._id} value={l._id}>{l.name} ({l.code})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lCls}>Expected Cycle Time (s)</label><input type="number" step="0.1" min="1" value={newMachine.expectedCycleTimeSeconds} onChange={e => setNewMachine({ ...newMachine, expectedCycleTimeSeconds: parseFloat(e.target.value) || 10 })} className={iCls} /></div>
            <div><label className={lCls}>Planned Capacity (units/hr)</label><input type="number" min="1" value={newMachine.plannedCapacityPerHour} onChange={e => setNewMachine({ ...newMachine, plannedCapacityPerHour: parseInt(e.target.value, 10) || 300 })} className={iCls} /></div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-industrial-800">
            <button type="button" onClick={() => setIsRegisterModalOpen(false)} className="w-full sm:w-auto rounded-xl border border-industrial-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800 text-center">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 disabled:opacity-50 text-center">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Register Machine Asset'}
            </button>
          </div>
        </form>
      </Modal>

      {selectedMachineForCommand && (
        <CommandModal isOpen={!!selectedMachineForCommand} onClose={() => setSelectedMachineForCommand(null)}
          machineId={selectedMachineForCommand._id} machineName={selectedMachineForCommand.name}
          currentState={selectedMachineForCommand.state} onSuccess={fetchMachines} />
      )}

      {connectModalMachine && (
        <Modal isOpen={!!connectModalMachine} onClose={() => setConnectModalMachine(null)}
          title={`Connect Field Device — ${connectModalMachine.assetId}`}
          subtitle="Bind a real PLC, robot or field device via OT LAN IP" maxWidth="lg">
          <div className="space-y-4 font-mono text-xs">
            {discoveredDevices.filter((d: any) => !d.isClaimed).length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-brand-300 block">Auto-Detected OT LAN Devices:</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {discoveredDevices.filter((d: any) => !d.isClaimed).map((d: any) => (
                    <button key={d.deviceId} type="button" onClick={() => setConnectForm({ ipAddress: d.ipAddress, port: d.port || 502, protocol: d.protocol || IndustrialProtocol.MODBUS_TCP })}
                      className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between transition-all ${connectForm.ipAddress === d.ipAddress ? 'bg-brand-950/60 border-brand-500 text-white' : 'bg-industrial-950/60 border-industrial-800 text-industrial-300 hover:border-industrial-700'}`}>
                      <div>
                        <div className="font-bold text-white">{d.vendor} • {d.modelNumber}</div>
                        <div className="text-[10px] text-industrial-400">{d.ipAddress}:{d.port} • {d.protocol}</div>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold">{d.latencyMs}ms</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="p-3 rounded-xl border border-industrial-800 bg-industrial-950/80 space-y-3">
              <span className="text-[10px] uppercase font-bold text-industrial-400 block">Target Device Endpoint:</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><label className="text-[10px] text-industrial-400 block mb-1">IPv4 Address</label><input type="text" value={connectForm.ipAddress} onChange={e => setConnectForm({ ...connectForm, ipAddress: e.target.value })} placeholder="192.168.10.1" className="w-full rounded-lg border border-industrial-700 bg-industrial-900 px-3 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none" /></div>
                <div><label className="text-[10px] text-industrial-400 block mb-1">Port</label><input type="number" value={connectForm.port} onChange={e => setConnectForm({ ...connectForm, port: parseInt(e.target.value, 10) || 502 })} className="w-full rounded-lg border border-industrial-700 bg-industrial-900 px-3 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none" /></div>
              </div>
              <div><label className="text-[10px] text-industrial-400 block mb-1">Protocol</label>
                <select value={connectForm.protocol} onChange={e => setConnectForm({ ...connectForm, protocol: e.target.value as any })} className="w-full rounded-lg border border-industrial-700 bg-industrial-900 px-3 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none">
                  <option value={IndustrialProtocol.MODBUS_TCP}>Modbus TCP (502)</option>
                  <option value={IndustrialProtocol.OPC_UA}>OPC UA (4840)</option>
                  <option value={IndustrialProtocol.MQTT}>MQTT TLS (1883)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-industrial-800">
              <button type="button" onClick={() => setConnectModalMachine(null)} className="rounded-lg border border-industrial-700 px-3.5 py-1.5 text-xs text-industrial-300 hover:bg-industrial-800">Cancel</button>
              <button type="button" onClick={() => handleToggleDevice(connectModalMachine._id, true, connectForm)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-emerald-500 transition-all">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connect & Set Running
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedMachineForDiConfig && (
        <WiseDiConfigModal isOpen={Boolean(selectedMachineForDiConfig)} machine={selectedMachineForDiConfig}
          onClose={() => setSelectedMachineForDiConfig(null)} onSuccess={fetchMachines} />
      )}
      {selectedMachineForEdit && (
        <EditMachineModal isOpen={Boolean(selectedMachineForEdit)} machine={selectedMachineForEdit}
          onClose={() => setSelectedMachineForEdit(null)} onSuccess={fetchMachines} />
      )}
      {adminPasswordAction && adminPasswordAction.isOpen && (
        <AdminPasswordModal isOpen={adminPasswordAction.isOpen} onClose={() => setAdminPasswordAction(null)}
          title={adminPasswordAction.type === 'restart' ? `Restart Machine — ${adminPasswordAction.machine.name}` : `Archive Machine — ${adminPasswordAction.machine.name}`}
          description={adminPasswordAction.type === 'restart' ? 'Restarting will re-initialize device communication, reset OT sockets, and restart machine processing. Enter Administrator password to proceed.' : 'This will archive and deactivate this machine asset from active production monitoring. Enter Administrator password to proceed.'}
          actionLabel={adminPasswordAction.type === 'restart' ? 'Restart Machine' : 'Archive Machine'}
          actionVariant={adminPasswordAction.type === 'restart' ? 'warning' : 'danger'}
          machineName={`${adminPasswordAction.machine.name} (${adminPasswordAction.machine.assetId})`}
          onConfirm={async (password: string) => {
            if (adminPasswordAction.type === 'restart') await api.restartMachine(adminPasswordAction.machine._id, password, 'Operator requested restart');
            else await api.archiveMachine(adminPasswordAction.machine._id, password);
            await fetchMachines();
          }} />
      )}
    </div>
  );
};
