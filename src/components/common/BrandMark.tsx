import React from 'react';
import { Stethoscope } from 'lucide-react';

interface BrandMarkProps {
  compact?: boolean;
  /** `onDark` for the ink login panel; the default suits white and dark-mode surfaces. */
  tone?: 'default' | 'onDark';
}

export const BrandMark: React.FC<BrandMarkProps> = ({ compact, tone = 'default' }) => (
  <div className="flex items-center gap-2.5">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-primary">
      <Stethoscope className="h-5 w-5" aria-hidden />
    </div>
    {!compact && (
      <div className="leading-tight">
        <div
          className={`font-display text-[19px] font-bold tracking-tight ${
            tone === 'onDark' ? 'text-white' : 'text-teal-600 dark:text-white'
          }`}
        >
          SecondMedic
        </div>
        <div className={`text-[12px] ${tone === 'onDark' ? 'text-slate-300' : 'text-slate-400'}`}>Staff portal</div>
      </div>
    )}
  </div>
);
