import React from 'react';
import { MachineState } from '@factorypulse/shared';
import { Play, Pause, Square, AlertTriangle, Wrench, WifiOff, Clock } from 'lucide-react';

interface StatusBadgeProps {
  state: MachineState | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state, size = 'md' }) => {
  const normState = (state || 'OFFLINE').toUpperCase();

  const configMap: Record<string, { label: string; bg: string; text: string; border: string; icon: any; beaconClass: string }> = {
    [MachineState.RUNNING]: {
      label: 'RUNNING',
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-400',
      border: 'border-emerald-500/40',
      icon: Play,
      beaconClass: 'bg-emerald-500 beacon-running'
    },
    [MachineState.IDLE]: {
      label: 'IDLE',
      bg: 'bg-amber-950/60',
      text: 'text-amber-400',
      border: 'border-amber-500/40',
      icon: Pause,
      beaconClass: 'bg-amber-500'
    },
    [MachineState.STOPPED]: {
      label: 'STOPPED',
      bg: 'bg-slate-900/80',
      text: 'text-slate-400',
      border: 'border-slate-700',
      icon: Square,
      beaconClass: 'bg-slate-500'
    },
    [MachineState.FAULTED]: {
      label: 'FAULTED',
      bg: 'bg-rose-950/60',
      text: 'text-rose-400',
      border: 'border-rose-500/50',
      icon: AlertTriangle,
      beaconClass: 'bg-rose-500 beacon-faulted'
    },
    [MachineState.MAINTENANCE]: {
      label: 'MAINTENANCE',
      bg: 'bg-purple-950/60',
      text: 'text-purple-400',
      border: 'border-purple-500/40',
      icon: Wrench,
      beaconClass: 'bg-purple-500'
    },
    [MachineState.OFFLINE]: {
      label: 'OFFLINE',
      bg: 'bg-zinc-900/80',
      text: 'text-zinc-500',
      border: 'border-zinc-800',
      icon: WifiOff,
      beaconClass: 'bg-zinc-600'
    },
    [MachineState.STALE]: {
      label: 'STALE DATA',
      bg: 'bg-yellow-950/60',
      text: 'text-yellow-400',
      border: 'border-yellow-600/40 border-dashed',
      icon: Clock,
      beaconClass: 'bg-yellow-500'
    }
  };

  const current = configMap[normState] || configMap[MachineState.OFFLINE];
  const IconComponent = current.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-2 font-medium',
    lg: 'text-sm px-3.5 py-1.5 gap-2.5 font-semibold'
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border ${current.border} ${current.bg} ${current.text} ${sizeClasses} tracking-wider font-mono uppercase shadow-sm`}
    >
      <span className={`w-2 h-2 rounded-full ${current.beaconClass}`} />
      <IconComponent className="w-3 h-3" />
      <span>{current.label}</span>
    </span>
  );
};
