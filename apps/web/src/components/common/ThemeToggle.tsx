import React from 'react';
import { useTheme } from '../../context/ThemeContext.js';
import { Sun, Moon, Sparkles } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  variant?: 'compact' | 'pill' | 'button';
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  variant = 'pill',
  showLabel = true
}) => {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${isDark ? 'Bright' : 'Dark'} mode`}
        title={`Current mode: ${isDark ? 'Dark' : 'Bright'}. Click to switch.`}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${isDark
            ? 'border-industrial-700 bg-industrial-900/90 text-amber-400 hover:border-amber-400/50 hover:bg-industrial-850 hover:shadow-lg hover:shadow-amber-500/10'
            : 'border-slate-300 bg-white/95 text-indigo-600 hover:border-indigo-400 hover:bg-slate-50 hover:shadow-lg hover:shadow-indigo-500/10 shadow-sm'
          } ${className}`}
      >
        <span className="sr-only">Toggle theme</span>
        {isDark ? (
          <Sun className="h-4 w-4 transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon className="h-4 w-4 transition-transform duration-300 hover:-rotate-12" />
        )}
      </button>
    );
  }

  // Pill style toggle with both icons and animated slider indicator
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch theme to ${isDark ? 'Bright' : 'Dark'}`}
      title={`Switch to ${isDark ? 'Bright (Light)' : 'Dark'} mode`}
      className={`group relative flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-mono font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40 select-none ${isDark
          ? 'border-industrial-700 bg-industrial-900/80 text-industrial-200 hover:border-amber-400/60 hover:text-white shadow-inner'
          : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-indigo-500 hover:text-slate-900 shadow-sm'
        } ${className}`}
    >
      {/* Pill toggle background track */}
      <div
        className={`relative flex h-5 w-10 items-center rounded-full p-0.5 transition-colors duration-300 ${isDark ? 'bg-industrial-950 border border-industrial-700' : 'bg-slate-300 border border-slate-400'
          }`}
      >
        <div
          className={`h-4 w-4 rounded-full transition-transform duration-300 flex items-center justify-center shadow-sm ${isDark
              ? 'translate-x-5 bg-gradient-to-tr from-amber-400 to-amber-300 text-industrial-950'
              : 'translate-x-0 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white'
            }`}
        >
          {isDark ? (
            <Sun className="h-2.5 w-2.5" />
          ) : (
            <Moon className="h-2.5 w-2.5" />
          )}
        </div>
      </div>

      {showLabel && (
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono tracking-wide">
          {isDark ? (
            <>
              <span className="text-amber-400">Dark</span>
              <span className="text-industrial-500 text-[10px]">/ Bright</span>
            </>
          ) : (
            <>
              <span className="text-indigo-600 font-bold">Bright</span>
              <span className="text-slate-400 text-[10px]">/ Dark</span>
            </>
          )}
        </span>
      )}
    </button>
  );
};
