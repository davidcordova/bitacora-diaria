import React from 'react';
import { LucideIcon, Plus, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  secondaryText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  secondaryText,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`text-center py-12 px-6 bg-slate-50/60 dark:bg-[#13141F]/60 rounded-3xl border border-dashed border-slate-200/90 dark:border-[#252636] flex flex-col items-center justify-center ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center mb-3.5 shadow-xs border border-[#00F0FF]/30">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 mb-1 max-w-sm">
        {title}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-5 leading-relaxed">
        {description}
      </p>

      {(actionText || secondaryText) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {actionText && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 rounded-full text-xs font-bold shadow-sm shadow-[#00F0FF]/20 transition-all cursor-pointer min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              <span>{actionText}</span>
            </button>
          )}
          {secondaryText && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] text-slate-700 dark:text-slate-200 rounded-full text-xs font-semibold border border-slate-200 dark:border-[#252636] shadow-2xs transition-all cursor-pointer min-h-[40px]"
            >
              <span>{secondaryText}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
