import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.js';
import { api } from '../../services/api.js';
import {
  DIFunctionType,
  DIPolarity,
  WiseProtocol,
  AlertSeverity,
  IDigitalInputConfig,
  IWiseConnectionSettings,
  getDefaultDigitalInputConfigs
} from '@factorypulse/shared';
import {
  Cpu,
  Settings,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Radio,
  Zap,
  ShieldAlert,
  Loader2,
  Info
} from 'lucide-react';

interface WiseDiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: any;
  onSuccess: () => void;
}

export const WiseDiConfigModal: React.FC<WiseDiConfigModalProps> = ({
  isOpen,
  onClose,
  machine,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'inputs' | 'connection'>('inputs');
  const [selectedDiIndex, setSelectedDiIndex] = useState<number>(0);
  const [digitalInputs, setDigitalInputs] = useState<IDigitalInputConfig[]>([]);
  const [connSettings, setConnSettings] = useState<IWiseConnectionSettings>({
    model: 'WISE-4051',
    protocol: WiseProtocol.REST,
    slot: 0,
    pollIntervalMs: 500,
    username: 'root',
    password: '00000000',
    timeoutMs: 1000
  });
  const [ipAddress, setIpAddress] = useState<string>('');
  const [port, setPort] = useState<number>(80);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (machine) {
      if (machine.digitalInputConfigs && machine.digitalInputConfigs.length > 0) {
        setDigitalInputs(JSON.parse(JSON.stringify(machine.digitalInputConfigs)));
      } else {
        setDigitalInputs(getDefaultDigitalInputConfigs());
      }

      if (machine.wiseConnectionSettings) {
        setConnSettings({
          model: machine.wiseConnectionSettings.model || 'WISE-4051',
          protocol: machine.wiseConnectionSettings.protocol || WiseProtocol.REST,
          slot: machine.wiseConnectionSettings.slot ?? 0,
          pollIntervalMs: machine.wiseConnectionSettings.pollIntervalMs || 500,
          username: machine.wiseConnectionSettings.username || 'root',
          password: machine.wiseConnectionSettings.password || '00000000',
          timeoutMs: machine.wiseConnectionSettings.timeoutMs || 1000
        });
      }

      setIpAddress(machine.ipAddress || '');
      setPort(machine.port || (machine.wiseConnectionSettings?.protocol === WiseProtocol.MODBUS_TCP ? 502 : 80));
      setStatusMessage(null);
      setValidationError(null);
    }
  }, [machine, isOpen]);

  const validateMappings = (configs: IDigitalInputConfig[]): string | null => {
    const enabled = configs.filter(c => c.isEnabled);
    const goodCounters = enabled.filter(c => c.functionType === DIFunctionType.GOOD);
    const rejectCounters = enabled.filter(c => c.functionType === DIFunctionType.REJECT);

    if (goodCounters.length > 1) {
      return `Conflict detected: Multiple inputs (${goodCounters.map(c => c.pin).join(', ')}) mapped to GOOD. Only one primary GOOD counter is permitted to prevent duplicate counting.`;
    }
    if (rejectCounters.length > 1) {
      return `Conflict detected: Multiple inputs (${rejectCounters.map(c => c.pin).join(', ')}) mapped to REJECT. Only one primary REJECT counter is permitted to prevent duplicate counting.`;
    }
    return null;
  };

  const handleInputChange = (idx: number, field: keyof IDigitalInputConfig, value: any) => {
    setDigitalInputs(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      const err = validateMappings(updated);
      setValidationError(err);
      return updated;
    });
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultDigitalInputConfigs();
    setDigitalInputs(defaults);
    setValidationError(null);
    setStatusMessage({
      type: 'success',
      text: 'Default digital input mapping loaded (DI0=GOOD, DI1=REJECT, DI2..DI9=ALERT). Click Save to apply.'
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateMappings(digitalInputs);
    if (err) {
      setValidationError(err);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      // Also update machine connection settings, IP/port, and set real hardware device mode
      await api.updateMachine(machine._id, {
        ipAddress,
        port,
        protocol: connSettings.protocol === WiseProtocol.MODBUS_TCP ? 'MODBUS_TCP' : 'WISE_4051',
        isRealDevice: true,
        isSimulated: false,
        isDeviceConnected: true
      });

      const res = await api.updateMachineDiConfig(machine._id, {
        digitalInputConfigs: digitalInputs,
        wiseConnectionSettings: connSettings
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'WISE-4051 digital input mappings and hardware parameters saved successfully!'
        });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 800);
      }
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        text: error.message || 'Failed to save digital input configuration'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDi = digitalInputs[selectedDiIndex] || {
    pin: `DI${selectedDiIndex}`,
    pinIndex: selectedDiIndex,
    name: '',
    functionType: DIFunctionType.ALERT,
    isEnabled: true,
    polarity: DIPolarity.ACTIVE_HIGH,
    severity: AlertSeverity.WARNING,
    alertMessage: '',
    debounceMs: 50
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`WISE-4051 Configuration — ${machine?.name || 'Machine'}`}
      maxWidth="4xl"
    >

      <div className="space-y-5 font-mono text-xs">
        {/* Machine Header Summary */}
        <div className="rounded-xl border border-industrial-800 bg-industrial-950 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-500/10 p-2 text-brand-400 border border-brand-500/20 shrink-0">
              <Cpu className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold text-sm truncate">{machine?.name}</div>
              <div className="text-industrial-400 text-[11px] flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5">
                <span>Asset: <strong className="text-brand-400">{machine?.assetId}</strong></span>
                <span>•</span>
                <span>Device: <strong className="text-white">{connSettings.model}</strong></span>
                <span>•</span>
                <span>Endpoint: <strong className="text-cyan-400">{ipAddress || 'Not set'}:{port}</strong></span>
              </div>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1.5 bg-industrial-900 p-1 rounded-lg border border-industrial-800 w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('inputs')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'inputs'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-industrial-400 hover:text-white'
                }`}
            >
              <Sliders className="h-3.5 w-3.5 shrink-0" />
              <span>Digital Inputs (DI0–DI9)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('connection')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'connection'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-industrial-400 hover:text-white'
                }`}
            >
              <Radio className="h-3.5 w-3.5 shrink-0" />
              <span>Device Connection</span>
            </button>
          </div>
        </div>

        {/* Validation Warning Notice */}
        {validationError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 flex items-start gap-2.5 text-rose-300">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Configuration Conflict</div>
              <div className="text-[11px] mt-0.5 opacity-90">{validationError}</div>
            </div>
          </div>
        )}

        {/* Status Feedback Notice */}
        {statusMessage && (
          <div
            className={`rounded-xl border p-3 flex items-center gap-2.5 ${statusMessage.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                : 'border-rose-500/40 bg-rose-950/30 text-rose-300'
              }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {activeTab === 'inputs' ? (
          <div className="space-y-4">
            {/* Input Selection Ribbon (DI0 to DI9) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-industrial-400">
                  Select Digital Channel (10 Channels Available)
                </span>
                <span className="text-[11px] text-industrial-400">
                  DI0 default: <strong className="text-emerald-400">GOOD</strong> • DI1 default: <strong className="text-rose-400">REJECT</strong>
                </span>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {digitalInputs.map((di, idx) => {
                  const isSelected = selectedDiIndex === idx;
                  let badgeColor = 'text-industrial-400 border-industrial-800 bg-industrial-950';

                  if (di.functionType === DIFunctionType.GOOD) {
                    badgeColor = isSelected ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300 font-bold' : 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400';
                  } else if (di.functionType === DIFunctionType.REJECT) {
                    badgeColor = isSelected ? 'border-rose-500 bg-rose-950/60 text-rose-300 font-bold' : 'border-rose-500/40 bg-rose-950/20 text-rose-400';
                  } else if (di.functionType === DIFunctionType.FAULT) {
                    badgeColor = isSelected ? 'border-amber-500 bg-amber-950/60 text-amber-300 font-bold' : 'border-amber-500/40 bg-amber-950/20 text-amber-400';
                  } else if (isSelected) {
                    badgeColor = 'border-brand-500 bg-brand-950/40 text-brand-300 font-bold';
                  }

                  return (
                    <button
                      key={di.pin}
                      type="button"
                      onClick={() => setSelectedDiIndex(idx)}
                      className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-between ${badgeColor} ${!di.isEnabled ? 'opacity-40 line-through' : ''
                        }`}
                    >
                      <span className="text-xs font-bold">{di.pin}</span>
                      <span className="text-[9px] uppercase tracking-tighter mt-1 truncate max-w-full">
                        {di.functionType}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Individual Channel Editor Box */}
            <div className="rounded-2xl border border-industrial-800 bg-industrial-900/60 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-industrial-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 font-bold text-xs">
                    {currentDi.pin}
                  </span>
                  <span className="text-white font-bold text-sm">
                    {currentDi.name || `Digital Input ${currentDi.pin}`}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-industrial-300 text-[11px]">Enabled</span>
                    <input
                      type="checkbox"
                      checked={currentDi.isEnabled}
                      onChange={(e) => handleInputChange(selectedDiIndex, 'isEnabled', e.target.checked)}
                      className="h-4 w-4 rounded border-industrial-700 bg-industrial-950 text-brand-500 focus:ring-brand-500"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Custom Name */}
                <div>
                  <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                    Custom Input Name
                  </label>
                  <input
                    type="text"
                    value={currentDi.name}
                    onChange={(e) => handleInputChange(selectedDiIndex, 'name', e.target.value)}
                    placeholder="e.g., Optical Part Sorter"
                    className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white placeholder-industrial-500 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Function Type */}
                <div>
                  <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                    Function Type
                  </label>
                  <select
                    value={currentDi.functionType}
                    onChange={(e) => handleInputChange(selectedDiIndex, 'functionType', e.target.value as DIFunctionType)}
                    className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value={DIFunctionType.GOOD}>GOOD — Part Count Increment (Pulse)</option>
                    <option value={DIFunctionType.REJECT}>REJECT — Scrap Count Increment (Pulse)</option>
                    <option value={DIFunctionType.ALERT}>ALERT — Industrial Incident Alarm</option>
                    <option value={DIFunctionType.RUNNING}>RUNNING — Sets Machine State to RUNNING</option>
                    <option value={DIFunctionType.STOPPED}>STOPPED — Sets Machine State to STOPPED</option>
                    <option value={DIFunctionType.FAULT}>FAULT — Safety Trip / FAULTED State</option>
                    <option value={DIFunctionType.CUSTOM}>CUSTOM — Auxiliary Digital Signal</option>
                  </select>
                </div>

                {/* Signal Polarity */}
                <div>
                  <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                    Signal Polarity
                  </label>
                  <select
                    value={currentDi.polarity}
                    onChange={(e) => handleInputChange(selectedDiIndex, 'polarity', e.target.value as DIPolarity)}
                    className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value={DIPolarity.ACTIVE_HIGH}>Active HIGH (Logic 1 = Active / Contact Closed)</option>
                    <option value={DIPolarity.ACTIVE_LOW}>Active LOW (Logic 0 = Active / Fail-Safe Open)</option>
                  </select>
                </div>

                {/* Debounce / Threshold */}
                <div>
                  <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                    Noise Debounce Filter (ms)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    step="10"
                    value={currentDi.debounceMs ?? 50}
                    onChange={(e) => handleInputChange(selectedDiIndex, 'debounceMs', Number(e.target.value))}
                    className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-industrial-500 mt-1 block">
                    Minimum pulse duration required to trigger count/alert (default: 50ms)
                  </span>
                </div>

                {/* Conditional Alert Severity */}
                {(currentDi.functionType === DIFunctionType.ALERT || currentDi.functionType === DIFunctionType.FAULT) && (
                  <div>
                    <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                      Alert Severity
                    </label>
                    <select
                      value={currentDi.severity || AlertSeverity.WARNING}
                      onChange={(e) => handleInputChange(selectedDiIndex, 'severity', e.target.value as AlertSeverity)}
                      className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                    >
                      <option value={AlertSeverity.INFO}>INFO (Advisory telemetry notification)</option>
                      <option value={AlertSeverity.WARNING}>WARNING (Operational caution)</option>
                      <option value={AlertSeverity.CRITICAL}>CRITICAL (Emergency shutdown / interlock)</option>
                    </select>
                  </div>
                )}

                {/* Custom Alert Message */}
                {(currentDi.functionType === DIFunctionType.ALERT || currentDi.functionType === DIFunctionType.FAULT) && (
                  <div>
                    <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                      Custom Alert Message
                    </label>
                    <input
                      type="text"
                      value={currentDi.alertMessage || ''}
                      onChange={(e) => handleInputChange(selectedDiIndex, 'alertMessage', e.target.value)}
                      placeholder="e.g., Conveyor Optical Jam Detected"
                      className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white placeholder-industrial-500 focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Connection Settings Tab */
          <div className="rounded-2xl border border-industrial-800 bg-industrial-900/60 p-4 space-y-4">
            <h4 className="text-white font-bold text-sm flex items-center gap-2">
              <Radio className="h-4 w-4 text-cyan-400" />
              Advantech WISE-4051 Hardware Connection Parameters
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                  Device Model
                </label>
                <input
                  type="text"
                  value={connSettings.model}
                  onChange={(e) => setConnSettings(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                  Protocol Driver
                </label>
                <select
                  value={connSettings.protocol}
                  onChange={(e) => {
                    const proto = e.target.value as WiseProtocol;
                    setConnSettings(prev => ({ ...prev, protocol: proto }));
                    if (proto === WiseProtocol.MODBUS_TCP && port === 80) setPort(502);
                    if (proto === WiseProtocol.REST && port === 502) setPort(80);
                  }}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value={WiseProtocol.REST}>REST Web API (HTTP JSON /di_value/slot_0)</option>
                  <option value={WiseProtocol.MODBUS_TCP}>Modbus TCP (Port 502, Function Code 02)</option>
                  <option value={WiseProtocol.AUTO}>AUTO (Automatic Handshake Negotiation)</option>
                </select>
              </div>

              <div>
                <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                  IP Address
                </label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white font-mono focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                  Port
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white font-mono focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                  Fast Polling Interval (ms)
                </label>
                <input
                  type="number"
                  min="200"
                  max="10000"
                  step="100"
                  value={connSettings.pollIntervalMs}
                  onChange={(e) => setConnSettings(prev => ({ ...prev, pollIntervalMs: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white font-mono focus:border-brand-500 focus:outline-none"
                />
                <span className="text-[10px] text-industrial-500 mt-1 block">
                  Recommended: 500ms for high-speed edge pulse acquisition
                </span>
              </div>

              <div>
                <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                  I/O Slot
                </label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={connSettings.slot ?? 0}
                  onChange={(e) => setConnSettings(prev => ({ ...prev, slot: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white font-mono focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                  REST HTTP Username
                </label>
                <input
                  type="text"
                  value={connSettings.username || ''}
                  onChange={(e) => setConnSettings(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="root"
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-industrial-400 text-[11px] uppercase tracking-wider mb-1.5 font-bold">
                  REST HTTP Password
                </label>
                <input
                  type="password"
                  value={connSettings.password || ''}
                  onChange={(e) => setConnSettings(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-industrial-800">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-industrial-700 bg-industrial-900 px-3 py-2 text-industrial-300 hover:text-white hover:bg-industrial-800 transition-all font-bold text-center"
          >
            <RotateCcw className="h-4 w-4 text-amber-400" />
            Reset to Industrial Defaults
          </button>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto rounded-xl border border-industrial-800 px-4 py-2 text-industrial-400 hover:text-white transition-all font-bold text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || Boolean(validationError)}
              onClick={handleSave}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2 font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 transition-all disabled:opacity-50 text-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
