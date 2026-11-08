import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../services/api.js';
import { useTelemetry } from '../../context/TelemetryContext.js';
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  X,
  Server,
  Zap,
  Activity,
  Pause,
  Play
} from 'lucide-react';

interface ServerErrorDetail {
  endpoint?: string;
  status?: number;
  message?: string;
  timestamp: string;
}

export const ServerAutoRecoveryBanner: React.FC = () => {
  const { isConnected } = useTelemetry();
  const [errorDetail, setErrorDetail] = useState<ServerErrorDetail | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryState, setRecoveryState] = useState<'idle' | 'in_progress' | 'success' | 'failed'>('idle');
  const [dismissed, setDismissed] = useState(false);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear running countdown
  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // Self-healing server recovery execution
  const executeRecovery = useCallback(async () => {
    clearCountdown();
    setCountdown(null);
    setIsRecovering(true);
    setRecoveryState('in_progress');
    setRecoveryMessage('Initiating self-healing restart & reconnecting all engines...');

    try {
      const res = await api.triggerRestart();
      setRecoveryState('success');
      setRecoveryMessage(
        res?.message || 'Server self-recovery completed successfully. All engines operational.'
      );

      // Dismiss after 3.5 seconds on success
      setTimeout(() => {
        setErrorDetail(null);
        setRecoveryState('idle');
        setRecoveryMessage(null);
        setIsRecovering(false);
        setDismissed(false);
      }, 3500);
    } catch (err: any) {
      setRecoveryState('failed');
      setRecoveryMessage(
        err?.message || 'Failed to trigger recovery. Server may still be starting up.'
      );
      setIsRecovering(false);
    }
  }, [clearCountdown]);

  // Start auto-recovery countdown timer
  const startCountdown = useCallback(
    (seconds: number = 5) => {
      clearCountdown();
      setCountdown(seconds);
      setIsPaused(false);

      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearCountdown();
            executeRecovery();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearCountdown, executeRecovery]
  );

  // Pause / Resume countdown toggle
  const togglePauseCountdown = () => {
    if (isPaused) {
      if (countdown !== null && countdown > 0) {
        startCountdown(countdown);
      } else {
        startCountdown(5);
      }
    } else {
      clearCountdown();
      setIsPaused(true);
    }
  };

  // Event listener for HTTP 500 / 503 errors dispatched by api.ts
  useEffect(() => {
    const handleServerError = (event: Event) => {
      const customEvent = event as CustomEvent<{
        endpoint?: string;
        status?: number;
        message?: string;
      }>;
      const detail = customEvent.detail;

      setErrorDetail({
        endpoint: detail?.endpoint || 'API Request',
        status: detail?.status || 500,
        message: detail?.message || 'Internal server error encountered',
        timestamp: new Date().toLocaleTimeString()
      });

      setDismissed(false);
      setRecoveryState('idle');
      setRecoveryMessage(null);

      // Automatically engage 5-second countdown to self-heal
      startCountdown(5);
    };

    window.addEventListener('server:error500', handleServerError);

    return () => {
      window.removeEventListener('server:error500', handleServerError);
      clearCountdown();
    };
  }, [startCountdown, clearCountdown]);

  // If dismissed or no fault and not in recovery/success state, render nothing
  if (dismissed || (!errorDetail && recoveryState === 'idle')) {
    return null;
  }

  const isSuccess = recoveryState === 'success';
  const isFailed = recoveryState === 'failed';
  const inProgress = recoveryState === 'in_progress' || isRecovering;

  return (
    <div
      role="alert"
      className={`border-b font-mono text-xs transition-all duration-300 shadow-lg ${
        isSuccess
          ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100'
          : isFailed
          ? 'bg-rose-950/95 border-rose-500/50 text-rose-100'
          : inProgress
          ? 'bg-amber-950/95 border-amber-500/50 text-amber-100'
          : 'bg-rose-950/95 border-rose-500/40 text-rose-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Status Icon, Title, and Diagnostics */}
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            ) : inProgress ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <RotateCcw className="h-4 w-4 animate-spin" />
              </span>
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40">
                <AlertTriangle className="h-4 w-4 animate-pulse" />
              </span>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold uppercase tracking-wider text-xs">
                {isSuccess
                  ? 'System Self-Healed'
                  : inProgress
                  ? 'Self-Recovery In Progress'
                  : `Server Fault [HTTP ${errorDetail?.status || 500}]`}
              </span>

              {errorDetail?.endpoint && !isSuccess && (
                <span className="rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-industrial-300 border border-white/10 max-w-[200px] sm:max-w-xs truncate">
                  {errorDetail.endpoint}
                </span>
              )}
            </div>
          </div>

          {/* Diagnostic message */}
          <div className="text-[11px] text-industrial-300 truncate max-w-md hidden md:block">
            {recoveryMessage || errorDetail?.message || 'Backend service connection degraded.'}
          </div>
        </div>

        {/* Right Side: Recovery Controls & Actions */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end ml-0 sm:ml-auto">
          {/* Auto-Recovery Countdown Badge */}
          {countdown !== null && countdown > 0 && !inProgress && !isSuccess && (
            <div className="flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-black/40 px-2 py-1 text-[11px]">
              <Activity className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
              <span>
                Auto-restart in{' '}
                <strong className="text-amber-300 font-extrabold">{countdown}s</strong>
              </span>
              <button
                type="button"
                onClick={togglePauseCountdown}
                title={isPaused ? 'Resume auto-restart countdown' : 'Pause auto-restart countdown'}
                className="ml-1 text-industrial-400 hover:text-white transition-colors"
              >
                {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </button>
            </div>
          )}

          {/* Manual Trigger / Retry Action Button */}
          {!isSuccess && (
            <button
              type="button"
              disabled={inProgress}
              onClick={executeRecovery}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold text-xs transition-all shadow-sm focus:outline-none focus:ring-2 ${
                inProgress
                  ? 'bg-amber-600/50 text-amber-200 cursor-not-allowed border border-amber-500/30'
                  : isFailed
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50 border border-rose-400/40 focus:ring-rose-400'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50 border border-rose-400/40 focus:ring-rose-400'
              }`}
            >
              <RotateCcw className={`h-3.5 w-3.5 ${inProgress ? 'animate-spin' : ''}`} />
              <span>{inProgress ? 'Heal Engines...' : 'Heal & Restart Now'}</span>
            </button>
          )}

          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => {
              clearCountdown();
              setDismissed(true);
            }}
            title="Dismiss recovery notification"
            className="rounded-lg p-1 text-industrial-400 hover:bg-black/30 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
