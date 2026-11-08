import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subValue?: string;
  icon: LucideIcon;
  variant?: 'default' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'cyan';
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  subValue,
  icon: Icon,
  variant = 'default',
  trend
}) => {
  const variantStyles = {
    default: {
      border: 'border-industrial-800',
      iconBg: 'bg-industrial-800/80 text-industrial-300',
      glow: 'hover:border-industrial-700'
    },
    emerald: {
      border: 'border-emerald-500/20',
      iconBg: 'bg-emerald-950/60 text-emerald-400',
      glow: 'hover:border-emerald-500/40'
    },
    amber: {
      border: 'border-amber-500/20',
      iconBg: 'bg-amber-950/60 text-amber-400',
      glow: 'hover:border-amber-500/40'
    },
    rose: {
      border: 'border-rose-500/20',
      iconBg: 'bg-rose-950/60 text-rose-400',
      glow: 'hover:border-rose-500/40'
    },
    indigo: {
      border: 'border-indigo-500/20',
      iconBg: 'bg-indigo-950/60 text-indigo-400',
      glow: 'hover:border-indigo-500/40'
    },
    cyan: {
      border: 'border-cyan-500/20',
      iconBg: 'bg-cyan-950/60 text-cyan-400',
      glow: 'hover:border-cyan-500/40'
    }
  }[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${variantStyles.border} bg-industrial-900/70 p-4 sm:p-5 backdrop-blur-sm transition-all duration-200 ${variantStyles.glow} shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-industrial-400">
          {title}
        </p>
        <div className={`rounded-lg p-2.5 ${variantStyles.iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs font-medium text-industrial-400">
            {unit}
          </span>
        )}
      </div>

      {(subValue || trend) && (
        <div className="mt-2 flex items-center justify-between text-xs text-industrial-400">
          {subValue && <span>{subValue}</span>}
          {trend && (
            <span
              className={`font-mono font-medium ${
                trend.isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
