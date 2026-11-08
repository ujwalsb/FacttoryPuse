import React, { useState } from 'react';
import { Modal } from './Modal.js';
import { api } from '../../services/api.js';
import { CommandType, MachineState } from '@factorypulse/shared';
import { Play, Square, RefreshCw, AlertTriangle, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';

interface CommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineId: string;
  machineName: string;
  currentState: string;
  onSuccess?: () => void;
}

export const CommandModal: React.FC<CommandModalProps> = ({
  isOpen,
  onClose,
  machineId,
  machineName,
  currentState,
  onSuccess
}) => {
  const [selectedCommand, setSelectedCommand] = useState<CommandType>(CommandType.START);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string; details?: any } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await api.issueCommand(machineId, selectedCommand, reason.trim());
      setStatusMessage({
        type: 'success',
        text: `Command [${selectedCommand}] verified and executed! Result: OBSERVED`,
        details: res.data
      });
      setReason('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Safety Interlock rejection: Unable to execute command'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const commandOptions = [
    {
      type: CommandType.START,
      label: 'START PRODUCTION',
      description: 'Engage drives, initiate spindle, and transition machine to RUNNING state.',
      icon: Play,
      color: 'hover:border-emerald-500/50 hover:bg-emerald-950/20 text-emerald-400',
      activeColor: 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
    },
    {
      type: CommandType.STOP,
      label: 'CONTROLLED STOP',
      description: 'Gracefully complete current cycle, decelerate axes, and halt in safe park position.',
      icon: Square,
      color: 'hover:border-slate-500/50 hover:bg-slate-900 text-slate-300',
      activeColor: 'border-slate-400 bg-slate-800 text-white'
    },
    {
      type: CommandType.RESET_FAULT,
      label: 'RESET FAULT REGISTERS',
      description: 'Clear PLC fault alarms, acknowledge safety circuit trip, and return to IDLE.',
      icon: RefreshCw,
      color: 'hover:border-amber-500/50 hover:bg-amber-950/20 text-amber-400',
      activeColor: 'border-amber-500 bg-amber-950/40 text-amber-300'
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Machine Control Dispatch: ${machineName}`}
      subtitle={`Current Asset State: ${currentState} • Requires Authenticated Reason & Safety Audit`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Safety Warning Notice */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3.5 text-xs text-amber-300">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <span className="font-semibold uppercase tracking-wider block mb-0.5">
              Industrial Safety Compliance Mandatory
            </span>
            Commands are cryptographically signed, checked against machine safety interlocks, and logged to the immutable compliance audit ledger. Physical emergency-stop circuits retain hardware override authority.
          </div>
        </div>

        {/* Command Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-2">
            Select Permitted Operation
          </label>
          <div className="grid grid-cols-1 gap-2.5">
            {commandOptions.map(opt => {
              const Icon = opt.icon;
              const isSelected = selectedCommand === opt.type;
              return (
                <button
                  type="button"
                  key={opt.type}
                  onClick={() => setSelectedCommand(opt.type)}
                  className={`flex items-start gap-3.5 p-3.5 rounded-xl border text-left transition-all ${isSelected ? opt.activeColor : `border-industrial-800 bg-industrial-950/50 ${opt.color}`
                    }`}
                >
                  <div className="p-2 rounded-lg bg-black/40 mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-mono text-sm font-bold tracking-wide block">
                      {opt.label}
                    </span>
                    <span className="text-xs text-industrial-400 block mt-0.5 leading-relaxed">
                      {opt.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reason / Justification Input */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1.5">
            Operational Justification / Work Ticket Reason <span className="text-rose-400">*</span>
          </label>
          <textarea
            required
            rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g., Starting production shift 1 after morning tooling inspection and safety gate verification..."
            className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2.5 text-sm text-white placeholder-industrial-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Result Feedback Banner */}
        {statusMessage && (
          <div
            className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs ${statusMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
              : 'border-rose-500/30 bg-rose-950/30 text-rose-300'
              }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
            )}
            <div>
              <span className="font-semibold block">{statusMessage.text}</span>
              {statusMessage.details && (
                <span className="font-mono text-[11px] text-industrial-400 block mt-1">
                  Command ID: {statusMessage.details.commandId} • Nonce Verified
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-industrial-700 px-4 py-2.5 text-xs font-semibold tracking-wide text-industrial-300 hover:bg-industrial-800 transition-colors text-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !reason.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 disabled:opacity-50 transition-all text-center"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Dispatching & Verifying...
              </>
            ) : (
              'Confirm & Dispatch Command'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
