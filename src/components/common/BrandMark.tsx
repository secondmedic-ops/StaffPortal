import React from 'react';
import { Stethoscope } from 'lucide-react';

export const BrandMark: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className="flex items-center gap-2.5">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-teal-500 text-white">
      <Stethoscope className="h-5 w-5" aria-hidden />
    </div>
    {!compact && (
      <div className="leading-tight">
        <div className="font-display text-[15px] font-semibold tracking-tight text-white">SecondMedic</div>
        <div className="text-[12.5px] text-slate-300">Staff portal</div>
      </div>
    )}
  </div>
);
