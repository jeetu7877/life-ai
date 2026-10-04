import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div className={`p-8 text-center flex flex-col items-center justify-center space-y-3 rounded-2xl border border-dashed border-[#202B3D] bg-[#0A0F18]/50 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-[#101722] border border-[#202B3D] flex items-center justify-center text-[#00D9FF]">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-200 tracking-tight">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] hover:from-[#00D9FF] hover:to-[#00A8FF] text-black text-xs font-bold transition-all shadow-md shadow-[#00A8FF]/20 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
