import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, badge, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
        {badge}
      </div>
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">{subtitle}</p>}
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

export const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon: Icon, tone = 'teal', onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`text-left w-full bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-card flex items-start gap-3 ${
        onClick ? 'hover:border-teal-300 dark:hover:border-teal-700 hover:-translate-y-px transition-all' : ''
      }`}
    >
      {Icon && (
        <div className={`p-2.5 rounded-xl shrink-0 ${TONES[tone]}`}>
          <Icon className="w-[18px] h-[18px]" aria-hidden />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</div>
        <div className="font-display text-[22px] leading-tight font-semibold text-slate-900 dark:text-slate-100 mt-0.5 tabular">{value}</div>
        {hint && <div className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">{hint}</div>}
      </div>
    </Tag>
  );
};

export const EmptyState: React.FC<{ icon: React.ElementType; title: string; message?: string; action?: React.ReactNode }> = ({
  icon: Icon,
  title,
  message,
  action
}) => (
  <div className="bg-white dark:bg-slate-900 px-6 py-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
    <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
      <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400" aria-hidden />
    </div>
    <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
    {message && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/** Shared form styles so screens look consistent in light & dark mode. */
export const inputClass =
  'w-full text-sm h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-colors hover:border-slate-400 dark:hover:border-slate-600 focus:outline-none focus:border-teal-600 focus:ring-3 focus:ring-teal-600/15';
/** Same look as inputClass but without w-full, for inputs given an explicit width. */
export const compactInputClass = inputClass.replace('w-full ', '');
export const labelClass = 'block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5';
export const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 h-10 px-4 text-sm font-semibold rounded-xl bg-teal-600 text-white shadow-primary hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 disabled:shadow-none transition-colors';
export const secondaryBtn =
  'inline-flex items-center justify-center gap-1.5 h-10 px-3.5 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors';
export const cardClass = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-card';
export const tableHeadClass =
  'bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-400 text-[12.5px] font-medium';
