import React from 'react';

interface SkeletonProps {
  rows?: number;
  count?: number;
  type?: 'table' | 'card' | 'line';
  height?: string;
  className?: string;
}

export const SkeletonLoader: React.FC<SkeletonProps> = ({
  rows,
  count,
  type = 'line',
  height,
  className = ''
}) => {
  const numItems = count ?? rows ?? 4;

  if (height) {
    return (
      <div className={`space-y-3 animate-pulse ${className}`}>
        {Array.from({ length: numItems }).map((_, i) => (
          <div
            key={i}
            style={{ height }}
            className="w-full bg-slate-200/80 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60"
          />
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse ${className}`}>
        {Array.from({ length: numItems }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-slate-200/70 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700/60"
          />
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 animate-pulse space-y-3 ${className}`}>
        <div className="h-8 bg-slate-200/80 dark:bg-slate-800 rounded w-full" />
        {Array.from({ length: numItems }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded w-full flex items-center gap-4 px-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/6" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/6" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2.5 animate-pulse ${className}`}>
      {Array.from({ length: numItems }).map((_, i) => (
        <div key={i} className="h-4 bg-slate-200/70 dark:bg-slate-800/70 rounded w-full" />
      ))}
    </div>
  );
};
