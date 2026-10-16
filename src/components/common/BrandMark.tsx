import React from 'react';

interface BrandMarkProps {
  compact?: boolean;
  /** `onDark` for the ink login panel; the default suits white and dark-mode surfaces. */
  tone?: 'default' | 'onDark';
}

export const BrandMark: React.FC<BrandMarkProps> = ({ compact, tone = 'default' }) => {
  if (compact) {
    return (
      <img
        src="/favicon.png"
        alt="SecondMedic"
        className="h-8 w-8 shrink-0 object-contain"
      />
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex items-center rounded-lg ${tone === 'onDark' ? 'bg-white/95 p-1.5 shadow-xs' : ''}`}>
        <img
          src="/company-logo.webp"
          alt="SecondMedic"
          className="h-7 w-auto object-contain"
        />
      </div>
      <div className="leading-tight">
        <span
          className={`text-[10.5px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded ${
            tone === 'onDark'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-400/30'
              : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
          }`}
        >
          Staff Portal
        </span>
      </div>
    </div>
  );
};
