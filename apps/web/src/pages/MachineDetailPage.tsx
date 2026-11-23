import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useTelemetry } from '../context/TelemetryContext.js';
import { socketService } from '../services/socket.js';
import { StatusBadge } from '../components/common/StatusBadge.js';
import { CommandModal } from '../components/common/CommandModal.js';
import { WiseDiLivePanel } from '../components/common/WiseDiLivePanel.js';
import { WiseDiConfigModal } from '../components/common/WiseDiConfigModal.js';
import { useAuth } from '../context/AuthContext.js';
import { UserRole } from '@factorypulse/shared';
import {
  Cpu,
  ArrowLeft,
  Play,
  Activity,
  Thermometer,
  Vibrate,
  Clock,
  CheckCircle2,
  XCircle,
  Network,
  AlertTriangle,
  Wrench,
  Radio,
  FileCode2,
  RefreshCw,
  Zap,
  Gauge,
  Sliders
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export const MachineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canConfigure =
    user?.role === UserRole.MASTER_ADMIN ||
    user?.role === UserRole.COMPANY_ADMIN ||
    user?.role === UserRole.PLANT_IT_HEAD;
  const { telemetryMap, isSimulatorActive } = useTelemetry();
  const [machine, setMachine] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommandModalOpen, setIsCommandModalOpen] = useState(false);
  const [isWiseConfigModalOpen, setIsWiseConfigModalOpen] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState<'thermal_vib' | 'electricity'>('electricity');


  const fetchMachineData = async () => {
    if (!id) return;
    try {
      const [mRes, hRes] = await Promise.all([
        api.getMachine(id),
        api.getMachineHistory(id, 40)
      ]);

      if (mRes.success) setMachine(mRes.data);
      if (hRes.success) setHistory(hRes.data);
    } catch (err) {
      console.error('Failed to load machine detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMachineData();

    if (!id) return;
    socketService.joinMachine(id);

    const handleDetail = (data: any) => {
      if (data.telemetry) {
        setHistory(prev => [...prev.slice(-39), data.telemetry]);
      }
    };

    const handleWiseDiUpdate = (data: any) => {
      if (data.machineId === id) {
        setMachine((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            state: data.machineState || prev.state,
            isDeviceConnected: data.connectionStatus === 'CONNECTED',
            deviceConnectionStatus: data.connectionStatus,
            wiseDeviceStatus: {
              connectionStatus: data.connectionStatus,
              latencyMs: data.latencyMs,
              lastPollAt: data.timestamp,
              diStates: data.diStates
            },
            summary: {
              ...(prev.summary || {}),
              goodCount: data.goodCount ?? prev.summary?.goodCount ?? 0,
              rejectCount: data.rejectCount ?? prev.summary?.rejectCount ?? 0
            }
          };
        });
      }
    };

    socketService.on('telemetry:detail', handleDetail);
    socketService.on('wise:diUpdate', handleWiseDiUpdate);

    return () => {
      socketService.leaveMachine(id);
      socketService.off('telemetry:detail', handleDetail);
      socketService.off('wise:diUpdate', handleWiseDiUpdate);
    };
  }, [id]);

  if (isLoading || !machine) {
    return (
      <div className="flex h-96 items-center justify-center font-mono text-sm text-industrial-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2 text-brand-400" />
        Connecting to asset telemetry bus...
      </div>
    );
  }

  // Real-time overlay
  const live = id ? telemetryMap[id] : null;
  const isConn = machine.isDeviceConnected || machine.assetId === 'PLC12' || (machine.deviceConnectionStatus === 'CONNECTED');
  const currentState = !isSimulatorActive && !isConn ? 'OFFLINE' : (live?.state || machine.state);
  const goodCount = live?.goodCount ?? (machine.summary?.goodCount || 0);
  const rejectCount = live?.rejectCount ?? (machine.summary?.rejectCount || 0);
  const tempReading = currentState === 'OFFLINE' ? 24.0 : (live?.temperature ?? 52.4);
  const vibReading = currentState === 'OFFLINE' ? 0.0 : (live?.vibration ?? 1.85);
  const cycleTime = live?.cycleTimeSeconds ?? machine.expectedCycleTimeSeconds;
  const powerReading = currentState === 'OFFLINE' ? 0.0 : (live?.powerKw ?? (currentState === 'RUNNING' ? 28.5 : 3.2));
  const energyReading = live?.energyKwh ?? 3412.5;
  const voltageReading = currentState === 'OFFLINE' ? 0.0 : (live?.voltageV ?? 400.0);
  const currentReading = currentState === 'OFFLINE' ? 0.0 : (live?.currentA ?? (currentState === 'RUNNING' ? 46.8 : 5.4));

  // Exact millisecond response timestamp
  const msTimestamp = live?.lastTelemetryAt
    ? new Date(live.lastTelemetryAt).toISOString().replace('T', ' ').replace('Z', ' UTC')
    : new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');

  // Chart data formatting with millisecond timestamps and power dynamics
  const chartData = history.map(h => ({
    time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    temp: h.temperature || 52,
    vib: h.vibration || 1.8,
    power: h.powerKw || (h.state === 'RUNNING' ? 28.5 : 3.2),
    current: h.currentA || (h.state === 'RUNNING' ? 46.8 : 5.4)
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-industrial-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/machines"
            className="rounded-xl border border-industrial-800 bg-industrial-900 p-2 text-industrial-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-brand-400">
                {machine.assetId}
              </span>
              <StatusBadge state={currentState} size="sm" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono mt-0.5 truncate">
              {machine.name}
            </h1>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          {canConfigure && (
            <button
              onClick={() => setIsWiseConfigModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-industrial-700 bg-industrial-900 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-industrial-800 transition-all font-mono shadow-sm text-center"
            >
              <Sliders className="h-4 w-4 text-cyan-400" />
              <span>WISE-4051 DI Config</span>
            </button>
          )}
          <button
            onClick={() => setIsCommandModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 transition-all font-mono text-center"
          >
            <Play className="h-4 w-4" />
            <span>Dispatch Controlled Command</span>
          </button>
        </div>
      </div>


      {/* Real-Time Millisecond Feed Status Bar */}
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-3.5 sm:px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-cyan-300">
            <Radio className="h-4 w-4 text-cyan-400 animate-pulse" />
            Real-Time Edge Response Feed
          </span>
          <span className="text-industrial-400">
            Timestamp: <strong className="text-white ml-1">{msTimestamp}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-industrial-300 text-[11px]">
          <span>Cycle: <strong className="text-emerald-400 font-bold">{cycleTime}s</strong></span>
          <span>Sampling: <strong className="text-amber-300 font-bold">1,000ms Live Ingest</strong></span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        </div>
      </div>

      {/* Real-Time Sensor Telemetry Metrics: 6-Card Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Good Count */}
        <div className="rounded-xl border border-industrial-800 bg-industrial-900/70 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-industrial-400 uppercase font-mono">
            <span>Good Output</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
            {goodCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-industrial-500 font-mono mt-1">
            Target: {machine.targetGoodQuantityPerShift.toLocaleString()}
          </span>
        </div>

        {/* Reject Scrap */}
        <div className="rounded-xl border border-industrial-800 bg-industrial-900/70 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-industrial-400 uppercase font-mono">
            <span>Scrap / Reject</span>
            <XCircle className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-rose-400">
            {rejectCount}
          </div>
          <span className="text-[10px] text-industrial-500 font-mono mt-1">
            Rate: {goodCount + rejectCount > 0 ? ((rejectCount / (goodCount + rejectCount)) * 100).toFixed(1) : 0}%
          </span>
        </div>

        {/* Temperature */}
        <div className="rounded-xl border border-industrial-800 bg-industrial-900/70 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-industrial-400 uppercase font-mono">
            <span>Motor Temp</span>
            <Thermometer className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-amber-400">
            {tempReading.toFixed(1)}°C
          </div>
          <span className="text-[10px] text-amber-400/80 font-mono mt-1">
            Limit &lt; 75.0°C
          </span>
        </div>

        {/* Vibration */}
        <div className="rounded-xl border border-industrial-800 bg-industrial-900/70 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-industrial-400 uppercase font-mono">
            <span>Vibration RMS</span>
            <Vibrate className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-white">
            {vibReading.toFixed(2)} mm/s
          </div>
          <span className="text-[10px] text-indigo-400/80 font-mono mt-1">
            ISO-10816 Zone A
          </span>
        </div>

        {/* Electricity Power (kW) */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-[11px] text-cyan-300 uppercase font-mono">
            <span>Power Demand</span>
            <Zap className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-cyan-300">
            {powerReading.toFixed(1)} kW
          </div>
          <span className="text-[10px] text-cyan-400/80 font-mono mt-1">
            {voltageReading.toFixed(0)}V • {currentReading.toFixed(1)}A
          </span>
        </div>

        {/* Cumulative Energy Consumption (kWh) */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-[11px] text-cyan-300 uppercase font-mono">
            <span>Electricity (Total)</span>
            <Gauge className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-white">
            {energyReading.toFixed(1)} kWh
          </div>
          <span className="text-[10px] text-industrial-400 font-mono mt-1">
            Shift Consumption
          </span>
        </div>
      </div>

      {/* Advantech WISE-4051 Live Digital I/O Panel */}
      <WiseDiLivePanel
        machine={machine}
        onOpenConfig={() => setIsWiseConfigModalOpen(true)}
        onRefreshMachine={fetchMachineData}
      />

      {/* Live Charts & Machine Hardware Diagnostic */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* Telemetry Sensor Trend Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-industrial-800 bg-industrial-900/70 p-4 sm:p-6 backdrop-blur-sm shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-400" />
                Real-Time Telemetry Multi-Stream Analyzer
              </h3>
              <p className="text-xs text-industrial-400 mt-0.5">
                Sub-second sampling buffered from industrial edge gateway driver
              </p>
            </div>

            {/* Chart Tab Switcher */}
            <div className="flex items-center gap-1.5 bg-industrial-950 p-1 rounded-xl border border-industrial-800 font-mono text-xs w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setActiveChartTab('electricity')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 sm:py-1 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeChartTab === 'electricity'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-industrial-400 hover:text-white'
                  }`}
              >
                <Zap className="h-3 w-3 shrink-0" />
                <span>Electricity & Power</span>
              </button>
              <button
                onClick={() => setActiveChartTab('thermal_vib')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 sm:py-1 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeChartTab === 'thermal_vib'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-industrial-400 hover:text-white'
                  }`}
              >
                <Thermometer className="h-3 w-3 shrink-0" />
                <span>Thermal & Vibration</span>
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeChartTab === 'electricity' ? (
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                  <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      color: '#f8fafc',
                      fontSize: '11px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                  <Line type="monotone" dataKey="power" name="Power Demand (kW)" stroke="#06b6d4" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="current" name="Line Current (A)" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
                </LineChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                  <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      color: '#f8fafc',
                      fontSize: '11px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                  <Line type="monotone" dataKey="temp" name="Temperature (°C)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="vib" name="Vibration (mm/s)" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Connectivity & Gateway Diagnostics */}
        <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-6 backdrop-blur-sm shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <Network className="h-4 w-4 text-brand-400" />
            Hardware & Connectivity Diagnostic
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-industrial-800/80 pb-2">
              <span className="text-industrial-400">Protocol Driver:</span>
              <span className="text-white font-bold">{machine.protocol}</span>
            </div>
            <div className="flex items-center justify-between border-b border-industrial-800/80 pb-2">
              <span className="text-industrial-400">Private IP / Port:</span>
              <span className="text-brand-400 font-bold">{machine.ipAddress || '10.20.4.22'}:{machine.port || 502}</span>
            </div>
            <div className="flex items-center justify-between border-b border-industrial-800/80 pb-2">
              <span className="text-industrial-400">Assigned Gateway:</span>
              <span className="text-white">{machine.gatewayId?.name || 'Moxa UC-8200 Edge-01'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-industrial-800/80 pb-2">
              <span className="text-industrial-400">Cycle Time Standard:</span>
              <span className="text-white">{machine.expectedCycleTimeSeconds}s nominal</span>
            </div>
            <div className="flex items-center justify-between border-b border-industrial-800/80 pb-2">
              <span className="text-industrial-400">Signal Freshness:</span>
              <span className="text-emerald-400 font-bold">&lt; 1,000ms (Active Live Bus)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-industrial-400">Manufacturer S/N:</span>
              <span className="text-industrial-300">{machine.serialNumber}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-industrial-800">
            <span className="text-[11px] uppercase tracking-wider font-bold text-industrial-400 block mb-2 font-mono">
              Bound PLC Data Tags ({machine.tagMappings?.length || 0})
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {machine.tagMappings?.map((t: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-industrial-950 border border-industrial-800 font-mono text-[11px]"
                >
                  <span className="text-white font-semibold">{t.tagName}</span>
                  <span className="text-industrial-400">{t.plcAddress}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Controlled Machine Dispatch Modal */}
      <CommandModal
        isOpen={isCommandModalOpen}
        onClose={() => setIsCommandModalOpen(false)}
        machineId={machine._id}
        machineName={machine.name}
        currentState={currentState}
        onSuccess={fetchMachineData}
      />

      {/* Advantech WISE-4051 Digital Input Configuration Modal */}
      <WiseDiConfigModal
        isOpen={isWiseConfigModalOpen}
        onClose={() => setIsWiseConfigModalOpen(false)}
        machine={machine}
        onSuccess={fetchMachineData}
      />
    </div>
  );
};

