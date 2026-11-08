import React, { useState } from 'react';
import { Modal } from './Modal.js';
import { Lock, ShieldAlert, KeyRound, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  actionLabel?: string;
  actionVariant?: 'warning' | 'danger' | 'primary';
  machineName?: string;
  onConfirm: (password: string) => Promise<void> | void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  actionLabel = 'Authorize Action',
  actionVariant = 'primary',
  machineName,
  onConfirm
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('Administrator password is required to authorize this action.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirm(password);
      setPassword('');
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.message || err?.error || 'Authorization failed. Please verify your admin credentials.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setPassword('');
    setErrorMessage(null);
    onClose();
  };

  const buttonVariantClasses = {
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50 border border-rose-500/40 focus:ring-rose-500',
    warning: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50 border border-amber-500/40 focus:ring-amber-500',
    primary: 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-950/50 border border-brand-500/40 focus:ring-brand-500'
  }[actionVariant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle="Privileged Security Verification"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
        {/* Security badge and info banner */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-amber-200">
          <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {machineName && (
              <div className="font-bold text-white text-[11px] flex items-center gap-1.5">
                Target Asset: <span className="text-amber-300 font-mono">{machineName}</span>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-amber-200/90">{description}</p>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/50 p-3 text-rose-300 text-[11px]">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Password input */}
        <div className="space-y-1.5 pt-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-industrial-300">
            Administrator Password
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <KeyRound className="h-4 w-4 text-industrial-500" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password..."
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 py-2.5 pl-9 pr-10 text-xs text-white placeholder-industrial-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-industrial-500 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-industrial-500">
            Requires Tenant Admin or Master Admin authorization key to execute.
          </p>
        </div>

        {/* Modal footer buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-industrial-800">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            className="w-full sm:w-auto rounded-xl border border-industrial-700 bg-industrial-800 px-4 py-2.5 sm:py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-700 hover:text-white transition-all disabled:opacity-50 text-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !password.trim()}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition-all shadow-md focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${buttonVariantClasses}`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span>{actionLabel}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
