import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#0F1722] border border-[#223147] rounded-2xl p-6 shadow-2xl relative space-y-4">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            isDangerous ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/20'
          }`}>
            {isDangerous ? <AlertTriangle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-[#1C283B]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl border border-[#223147] bg-[#141E2D] hover:bg-[#1A2639] text-xs font-semibold text-slate-300 transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md ${
              isDangerous
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                : 'bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black font-semibold shadow-[#00A8FF]/30'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
