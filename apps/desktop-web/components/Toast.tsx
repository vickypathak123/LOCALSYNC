'use client';

import { useEffect } from 'react';
import { BellIcon } from './icons';

export interface ToastMessage {
  id: string;
  title: string;
  body: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      className="animate-toast-in flex w-80 items-start gap-3 rounded-xl border border-border bg-white p-3.5 shadow-elevation-3 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-verified/10 text-status-verified">
        <BellIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground dark:text-slate-100">{toast.title}</p>
        <p className="text-xs text-muted-foreground dark:text-slate-400">{toast.body}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="cursor-pointer text-muted-foreground hover:text-foreground dark:hover:text-slate-200"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastStack({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[1100] flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
