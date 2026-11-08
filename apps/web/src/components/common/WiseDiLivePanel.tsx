import React, { useState, useEffect } from 'react';
import { socketService } from '../../services/socket.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { UserRole, DIFunctionType, DIPolarity } from '@factorypulse/shared';
import {
  Radio,
  Sliders,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  ShieldAlert,
  Clock,
  Wifi,
  WifiOff,
  Flame,
  Check,
  X
} from 'lucide-react';

interface WiseDiLivePanelProps {
  machine: any;
  onOpenConfig: () => void;
  onRefreshMachine?: () => void;
}

export const WiseDiLivePanel: React.FC<WiseDiLivePanelProps> = ({
  machine,
  onOpenConfig,
  onRefreshMachine
}) => {
  const { user } = useAuth();
  const canConfigure =
    user?.role === UserRole.MASTER_ADMIN ||
    user?.role === UserRole.COMPANY_ADMIN ||
    user?.role === UserRole.PLANT_IT_HEAD;

  const [liveStatus, setLiveStatus] = useState<any>(machine?.wiseDeviceStatus || null);
  const [isPollingNow, setIsPollingNow] = useState(false);
  const [pollFeedback, setPollFeedback] = useState<string | null>(null);

  // Fallback to configured DI definitions if no live readings received yet
  const diConfigs = machine?.digitalInputConfigs || [];

  useEffect(() => {
    if (machine?.wiseDeviceStatus) {
      setLiveStatus(machine.wiseDeviceStatus);
    }
  }, [machine]);

  useEffect(() => {
    if (!machine?._id) return;

    const handleDiUpdate = (data: any) => {
      if (data.machineId === machine._id) {
        setLiveStatus({
          connectionStatus: data.connectionStatus,
          latencyMs: data.latencyMs,
          lastPollAt: data.timestamp,
          errorMessage: data.errorMessage,
          diStates: data.diStates
        });
      }
    };

    socketService.on('wise:diUpdate', handleDiUpdate);

    return () => {
      socketService.off('wise:diUpdate', handleDiUpdate);
    };
  }, [machine?._id]);

  const handlePollNow = async () => {
    if (!machine?._id) return;
    setIsPollingNow(true);
    setPollFeedback(null);
    try {
      const res = await api.pollWiseDevice(machine._id);
      if (res.success && res.data) {
        setLiveStatus(res.data);
        if (res.data.connectionStatus === 'CONNECTED') {
          setPollFeedback(`Connected (${res.data.latencyMs}ms)`);
        } else {
          setPollFeedback(`Offline: ${res.data.errorMessage || 'No response'}`);
        }
      }
      if (onRefreshMachine) onRefreshMachine();
    } catch (err: any) {
      setPollFeedback(err.message || 'Polling failed');
    } finally {
      setIsPollingNow(false);
    }
  };

  const isConnected = liveStatus?.connectionStatus === 'CONNECTED' || machine?.isDeviceConnected;
  const latency = liveStatus?.latencyMs ?? 14;
  const lastPoll = liveStatus?.lastPollAt
    ? new Date(liveStatus.lastPollAt).toLocaleTimeString()
    : 'Waiting for stream';

  // Merge live DI states with saved configs
  const mergedDis = Array.from({ length: 10 }, (_, idx) => {
    const pinName = `DI${idx}`;
    const liveItem = liveStatus?.diStates?.find((d: any) => d.pinIndex === idx || d.pin === pinName);
    const configItem = diConfigs.find((c: any) => c.pinIndex === idx || c.pin === pinName);

    const name = configItem?.name || liveItem?.name || `Digital Input ${pinName}`;
    const functionType = configItem?.functionType || liveItem?.functionType || (idx === 0 ? 'GOOD' : idx === 1 ? 'REJECT' : 'ALERT');
    const isEnabled = configItem?.isEnabled ?? liveItem?.isEnabled ?? true;
    const polarity = configItem?.polarity || liveItem?.polarity || 'ACTIVE_HIGH';
    const rawLogic = liveItem?.rawLogicLevel ?? false;
    const isActive = liveItem?.isActive ?? false;
    const pulseCount = liveItem?.pulseCount ?? 0;
    const severity = configItem?.severity || liveItem?.severity || 'WARNING';
    const alertMessage = configItem?.alertMessage || liveItem?.alertMessage;

    return {
      pin: pinName,
      pinIndex: idx,
      name,
      functionType,
      isEnabled,
      polarity,
      rawLogic,
      isActive,
      pulseCount,
      severity,
      alertMessage
    };
  });

  return (
    <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-4 sm:p-6 backdrop-blur-sm shadow-xl space-y-4 font-mono">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-industrial-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-cyan-400 animate-pulse" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Advantech WISE-4051 Live I/O Bus
            </h3>
            <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/20">
              10-Channel DI
            </span>
          </div>
          <p className="text-xs text-industrial-400 mt-1">
            Real hardware digital input acquisition, pulse edge detection, and safety interlocks
          </p>
        </div>

        {/* Live Diagnostics & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Connection Status Pill */}
          <div
            className={`flex items-center gap-2 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold border ${
              isConnected
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                : 'border-rose-500/40 bg-rose-950/30 text-rose-300'
            }`}
          >
            {isConnected ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>ONLINE • {latency}ms</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-rose-400" />
                <span>DISCONNECTED</span>
              </>
            )}
          </div>

          {/* Poll Now Button */}
          <button
            type="button"
            onClick={handlePollNow}
            disabled={isPollingNow}
            className="inline-flex items-center gap-1.5 rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-1.5 text-xs text-industrial-300 hover:text-white hover:bg-industrial-800 transition-all font-semibold disabled:opacity-50"
            title="Perform immediate live hardware poll"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${isPollingNow ? 'animate-spin' : ''}`} />
            <span>{isPollingNow ? 'Polling...' : 'Poll Now'}</span>
          </button>

          {/* Configure DI Mappings Button */}
          {canConfigure && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-brand-600/20 hover:bg-brand-500 transition-all"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Configure Inputs</span>
            </button>
          )}
        </div>
      </div>

      {/* Hardware Link Info Banner */}
      <div className="rounded-xl border border-industrial-800/80 bg-industrial-950/60 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-industrial-400">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span>
            IP Address: <strong className="text-white">{machine.ipAddress || 'Not Configured'}</strong>
          </span>
          <span>•</span>
          <span>
            Port: <strong className="text-cyan-400">{machine.port || 502}</strong>
          </span>
          <span>•</span>
          <span>
            Protocol:{' '}
            <strong className="text-brand-400">
              {machine.wiseConnectionSettings?.protocol || machine.protocol || 'REST / Modbus'}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Sampling:{' '}
            <strong className="text-amber-300">
              {machine.wiseConnectionSettings?.pollIntervalMs || 500}ms (Fast Pulse)
            </strong>
          </span>
          <span>•</span>
          <span>
            Last Cycle: <strong className="text-white">{lastPoll}</strong>
          </span>
          {pollFeedback && (
            <span className="text-emerald-400 font-bold ml-1">({pollFeedback})</span>
          )}
        </div>
      </div>

      {/* 10-Channel Live Digital Input Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {mergedDis.map((di) => {
          let functionBadgeStyle = 'border-industrial-700 bg-industrial-950 text-industrial-400';
          let functionLabel = di.functionType;

          if (di.functionType === 'GOOD') {
            functionBadgeStyle = 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300';
          } else if (di.functionType === 'REJECT') {
            functionBadgeStyle = 'border-rose-500/40 bg-rose-950/40 text-rose-300';
          } else if (di.functionType === 'ALERT') {
            functionBadgeStyle = 'border-amber-500/40 bg-amber-950/40 text-amber-300';
          } else if (di.functionType === 'FAULT') {
            functionBadgeStyle = 'border-rose-600/50 bg-rose-950/60 text-rose-300';
          } else if (di.functionType === 'RUNNING') {
            functionBadgeStyle = 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300';
          } else if (di.functionType === 'STOPPED') {
            functionBadgeStyle = 'border-zinc-500/40 bg-zinc-900/60 text-zinc-300';
          }

          const isDiActive = di.isActive;

          return (
            <div
              key={di.pin}
              className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
                isDiActive
                  ? di.functionType === 'ALERT' || di.functionType === 'FAULT'
                    ? 'border-rose-500 bg-rose-950/20 shadow-md shadow-rose-900/20'
                    : di.functionType === 'GOOD'
                    ? 'border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-900/20'
                    : 'border-cyan-500 bg-cyan-950/20 shadow-md shadow-cyan-900/20'
                  : 'border-industrial-800 bg-industrial-950/60'
              } ${!di.isEnabled ? 'opacity-40' : ''}`}
            >
              {/* Card Header: Channel & Function */}
              <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-industrial-800/60">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-white">{di.pin}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${functionBadgeStyle}`}>
                    {functionLabel}
                  </span>
                </div>

                {/* Live LED Indicator */}
                <div className="flex items-center gap-1">
                  <span
                    className={`h-2.5 w-2.5 rounded-full transition-all ${
                      isDiActive
                        ? di.functionType === 'ALERT' || di.functionType === 'FAULT'
                          ? 'bg-rose-500 shadow-lg shadow-rose-500/50 animate-pulse'
                          : di.functionType === 'GOOD'
                          ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse'
                          : 'bg-cyan-400 shadow-lg shadow-cyan-400/50 animate-pulse'
                        : 'bg-industrial-700'
                    }`}
                  />
                  <span
                    className={`text-[10px] font-bold ${
                      isDiActive ? 'text-white' : 'text-industrial-500'
                    }`}
                  >
                    {isDiActive ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
              </div>

              {/* Card Body: Name & State Details */}
              <div className="my-2.5 space-y-1">
                <div className="text-xs font-semibold text-white truncate" title={di.name}>
                  {di.name}
                </div>
                <div className="text-[10px] text-industrial-400 flex items-center justify-between">
                  <span>Logic: <strong className="text-industrial-200">{di.rawLogic ? 'HIGH (1)' : 'LOW (0)'}</strong></span>
                  <span className="text-[9px] text-industrial-500">{di.polarity === 'ACTIVE_LOW' ? 'Active Low' : 'Active High'}</span>
                </div>
              </div>

              {/* Card Footer: Event Counter or Alert details */}
              <div className="pt-2 border-t border-industrial-800/60 flex items-center justify-between text-[10px]">
                {di.functionType === 'GOOD' || di.functionType === 'REJECT' ? (
                  <>
                    <span className="text-industrial-400">Total Pulses:</span>
                    <span className="font-bold text-white text-xs">{di.pulseCount.toLocaleString()}</span>
                  </>
                ) : di.functionType === 'ALERT' || di.functionType === 'FAULT' ? (
                  isDiActive ? (
                    <span className="text-rose-400 font-bold flex items-center gap-1 truncate text-[9px]">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {di.alertMessage || `${di.severity} Incident`}
                    </span>
                  ) : (
                    <span className="text-industrial-500 text-[9px]">{di.severity} Alarm Standby</span>
                  )
                ) : (
                  <>
                    <span className="text-industrial-400">Events:</span>
                    <span className="font-bold text-industrial-300">{di.pulseCount}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
