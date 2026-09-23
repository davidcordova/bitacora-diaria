import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  compact?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  isDark,
  onToggle,
  compact = false,
  className = '',
}) => {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
          isDark
            ? 'bg-slate-800/80 border-slate-700/80 text-amber-400 hover:bg-slate-700 hover:text-amber-300 shadow-xs'
            : 'bg-slate-100 border-slate-200/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 shadow-2xs'
        } ${className}`}
      >
        {isDark ? (
          <Sun className="w-4 h-4 transition-transform duration-300 rotate-0 hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 transition-transform duration-300 rotate-0 hover:-rotate-12" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer select-none ${
        isDark
          ? 'bg-slate-800/80 border-slate-700/70 hover:bg-slate-800 text-slate-200 shadow-xs'
          : 'bg-slate-100/80 border-slate-200/80 hover:bg-slate-100 text-slate-700 shadow-2xs'
      } ${className}`}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`p-1.5 rounded-xl transition-colors ${
            isDark ? 'bg-amber-400/10 text-amber-400' : 'bg-slate-200 text-slate-700'
          }`}
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </div>
        <span className="text-xs font-bold tracking-tight">
          {isDark ? 'Modo Oscuro' : 'Modo Claro'}
        </span>
      </div>

      {/* Pill Switch Indicator */}
      <div
        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 relative flex items-center ${
          isDark ? 'bg-[#00C9A7]' : 'bg-slate-300'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
            isDark ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
    </button>
  );
};
