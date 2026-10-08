import React from 'react';

interface StatusPillProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, size = 'sm' }) => {
  const norm = (status || '').toUpperCase();

  let styleClasses = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  // Attendance statuses
  if (norm === 'PRESENT') {
    styleClasses = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
  } else if (norm === 'ABSENT') {
    styleClasses = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
  } else if (norm === 'HALF_DAY') {
    styleClasses = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
  } else if (norm === 'ON_LEAVE' || norm === 'LEAVE') {
    styleClasses = 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800';
  } else if (norm === 'WEEK_OFF') {
    styleClasses = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  } else if (norm === 'HOLIDAY') {
    styleClasses = 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
  } else if (norm === 'LOP') {
    styleClasses = 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800';
  }
  // Leave / Workflow statuses
  else if (norm === 'PENDING') {
    styleClasses = 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
  } else if (norm === 'APPROVED') {
    styleClasses = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
  } else if (norm === 'REJECTED') {
    styleClasses = 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
  } else if (norm === 'WITHDRAWN' || norm === 'CANCELLED') {
    styleClasses = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700';
  }
  // Payroll statuses
  else if (norm === 'PUBLISHED') {
    styleClasses = 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800';
  } else if (norm === 'DRAFT') {
    styleClasses = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
  } else if (norm === 'REVOKED') {
    styleClasses = 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800';
  } else if (norm === 'ACTIVE') {
    styleClasses = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border whitespace-nowrap transition-colors ${sizeClasses} ${styleClasses}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
};
