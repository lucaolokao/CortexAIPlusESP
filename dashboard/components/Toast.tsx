'use client';

import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast } from '@/lib/context';
import type { ToastMessage } from '@/lib/types';

const CONFIG: Record<ToastMessage['type'], { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  success: {
    icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-emerald-500',
    text: 'text-slate-800 dark:text-slate-100',
  },
  error: {
    icon: <XCircle className="w-5 h-5 text-red-500" />,
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-red-500',
    text: 'text-slate-800 dark:text-slate-100',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-amber-500',
    text: 'text-slate-800 dark:text-slate-100',
  },
  info: {
    icon: <Info className="w-5 h-5 text-indigo-500" />,
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-indigo-500',
    text: 'text-slate-800 dark:text-slate-100',
  },
};

function ToastItem({ toast }: { toast: ToastMessage }) {
  const { removeToast } = useToast();
  const c = CONFIG[toast.type];

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border-l-4
        ${c.bg} ${c.border} ${c.text}
        animate-slideIn min-w-[280px] max-w-[380px]`}
    >
      <span className="flex-shrink-0 mt-0.5">{c.icon}</span>
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200
          transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function Toast() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
