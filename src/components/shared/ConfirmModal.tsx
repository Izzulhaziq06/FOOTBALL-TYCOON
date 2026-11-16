import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-800 bg-[#121824] p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h3 id="confirm-modal-title" className="text-xl font-bold tracking-tight text-slate-100">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close modal"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0 ${
              destructive
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
