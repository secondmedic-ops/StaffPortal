import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, badge, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {badge}
      </div>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ElementType;
  tone?: 'teal' | 'amber' | 'rose' | 'sky' | 'purple' | 'slate';
  onClick?: () => void;
}

const TONES: Record<NonNullable<StatCardProps['tone']>, string> = {
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  purple: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon: Icon, tone = 'teal', onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-start gap-3 ${
      onClick ? 'cursor-pointer hover:border-teal-400 dark:hover:border-teal-600 transition-colors' : ''
    }`}
  >
    {Icon && (
      <div className={`p-2 rounded-lg ${TONES[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
    )}
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{value}</div>
      {hint && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{hint}</div>}
    </div>
  </div>
);

export const EmptyState: React.FC<{ icon: React.ElementType; title: string; message?: string; action?: React.ReactNode }> = ({
  icon: Icon,
  title,
  message,
  action
}) => (
  <div className="bg-white dark:bg-slate-900 p-10 text-center rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
    <Icon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</h3>
    {message && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/** Shared form styles so new screens look consistent in light & dark mode. */
export const inputClass =
  'w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-600';
/** Same look as inputClass but without w-full, for inputs given an explicit width. */
export const compactInputClass = inputClass.replace('w-full ', '');
export const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';
export const primaryBtn =
  'px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5';
export const secondaryBtn =
  'px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5';
export const cardClass =
  'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs';
export const tableHeadClass =
  'bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold';
