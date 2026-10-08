import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAuth();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-lg transition-all duration-200 bg-white dark:bg-slate-900 ${
            toast.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-300'
              : toast.type === 'error'
              ? 'border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-300'
              : toast.type === 'warning'
              ? 'border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-300'
              : 'border-teal-200 dark:border-teal-800/80 text-teal-900 dark:text-teal-300'
          }`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
          </div>
          <div className="flex-1 text-xs">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">{toast.title}</h4>
            {toast.message && <p className="mt-0.5 text-slate-600 dark:text-slate-300 leading-relaxed">{toast.message}</p>}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
