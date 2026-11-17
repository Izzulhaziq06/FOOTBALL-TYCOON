import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

export const ToastHost: React.FC = () => {
  const { toasts, dismissToast } = useUiStore();

  return (
    <div
      className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-6 md:right-6 pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const toneClasses =
            toast.tone === 'success'
              ? 'border-emerald-500/50 bg-[#0D1E1A] text-emerald-100'
              : toast.tone === 'error'
                ? 'border-red-500/50 bg-[#231014] text-red-100'
                : toast.tone === 'warning'
                  ? 'border-amber-500/50 bg-[#221A0E] text-amber-100'
                  : 'border-slate-600/60 bg-[#101726] text-[#F4F5F0]';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className={`pointer-events-auto flex items-center gap-3 rounded border-l-2 border px-4 py-3 text-xs sm:text-sm shadow-2xl ${toneClasses}`}
            >
              {toast.tone === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
              {toast.tone === 'error' && <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />}
              {toast.tone === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />}
              {toast.tone === 'info' && <Info className="h-4 w-4 text-sky-400 shrink-0" />}
              <span className="max-w-xs leading-snug font-medium">{toast.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="ml-1 rounded p-1 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
