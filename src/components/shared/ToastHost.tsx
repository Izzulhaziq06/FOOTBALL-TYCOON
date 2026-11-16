import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

export const ToastHost: React.FC = () => {
  const { toasts, dismissToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-6 md:right-6"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const toneClasses =
          toast.tone === 'success'
            ? 'border-emerald-700/70 bg-[#10221C] text-emerald-100'
            : toast.tone === 'error'
              ? 'border-red-700/70 bg-[#261215] text-red-100'
              : toast.tone === 'warning'
                ? 'border-amber-700/70 bg-[#251D10] text-amber-100'
                : 'border-slate-700 bg-[#121824] text-slate-100';

        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm shadow-lg ${toneClasses}`}
          >
            {toast.tone === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
            {toast.tone === 'error' && <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />}
            {toast.tone === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />}
            {toast.tone === 'info' && <Info className="h-4 w-4 text-sky-400 shrink-0" />}
            <span className="max-w-xs leading-snug">{toast.text}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="ml-1 rounded p-0.5 text-slate-400 hover:text-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
