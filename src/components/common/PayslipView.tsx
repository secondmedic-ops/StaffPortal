import React from 'react';
import type { PayrollEntry } from '../../types';
import { amountInWords, formatInr, type PayDay } from '../../lib/payrollEngine';
import { getMonthName } from '../../utils/dateUtils';
import { ATTENDANCE_POLICY } from '../../config/policy';
import { Printer, Stethoscope } from 'lucide-react';

const DAY_STYLE: Record<PayDay['kind'], string> = {
  PRESENT: 'bg-emerald-500',
  HALF_DAY: 'bg-amber-400',
  PAID_LEAVE: 'bg-sky-500',
  UNPAID_LEAVE: 'bg-rose-400',
  HOLIDAY: 'bg-purple-500',
  WEEK_OFF: 'bg-slate-300 dark:bg-slate-600',
  ABSENT: 'bg-rose-600',
  PROJECTED: 'bg-teal-200 dark:bg-teal-800',
  NOT_EMPLOYED: 'bg-slate-100 dark:bg-slate-800'
};

/** Month strip showing how every day was paid — makes the attendance → pay link visible. */
export const AttendanceStrip: React.FC<{ days: PayDay[] }> = ({ days }) => (
  <div>
    <div className="flex flex-wrap gap-0.5">
      {days.map(d => (
        <div
          key={d.date}
          title={`${d.date}: ${d.kind.replace(/_/g, ' ').toLowerCase()}${d.late ? ' · late' : ''}${d.note ? ` · ${d.note}` : ''}`}
          className={`relative w-5 h-6 rounded-sm text-[11.5px] leading-6 text-center text-white font-bold ${DAY_STYLE[d.kind]}`}
        >
          {Number(d.date.slice(8))}
          {d.late && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-500 ring-1 ring-white" />}
        </div>
      ))}
    </div>
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11.5px] text-slate-500">
      {(
        [
          ['PRESENT', 'Present'],
          ['HALF_DAY', 'Half day'],
          ['PAID_LEAVE', 'Paid leave'],
          ['HOLIDAY', 'Holiday'],
          ['WEEK_OFF', 'Week off'],
          ['ABSENT', 'Absent (LOP)'],
          ['UNPAID_LEAVE', 'LOP leave'],
          ['PROJECTED', 'Upcoming']
        ] as Array<[PayDay['kind'], string]>
      ).map(([k, l]) => (
        <span key={k} className="flex items-center gap-1">
          <span className={`w-2.5 h-2.5 rounded-sm ${DAY_STYLE[k]}`} /> {l}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Late mark
      </span>
    </div>
  </div>
);

interface PayslipViewProps {
  entry: Pick<
    PayrollEntry,
    | 'year'
    | 'month'
    | 'calendarDays'
    | 'payableDays'
    | 'presentDays'
    | 'paidLeaveDays'
    | 'holidayDays'
    | 'weekOffDays'
    | 'lopDays'
    | 'lateMarks'
    | 'earnings'
    | 'deductions'
    | 'employerContributions'
    | 'grossEarnings'
    | 'totalDeductions'
    | 'netPay'
  >;
  employee: { name: string; code: string; designation?: string; department?: string };
  bank?: { name?: string; account?: string; pan?: string; uan?: string };
  days?: PayDay[];
  status?: string;
}

export const PayslipView: React.FC<PayslipViewProps> = ({ entry, employee, bank, days, status }) => {
  const rows = Math.max(entry.earnings.length, entry.deductions.length);
  return (
    <div className="space-y-3">
      <div className="flex justify-end no-print">
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>
      <div className="print-area bg-white text-slate-900 rounded-lg border border-slate-200 p-5 text-xs space-y-4">
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-teal-700 text-white flex items-center justify-center">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">SecondMedic</div>
              <div className="text-[11.5px] text-slate-500">Salary slip · computed from attendance</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-sm">
              {getMonthName(entry.month)} {entry.year}
            </div>
            {status && <div className="text-[11.5px] text-slate-500 uppercase">{status}</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <Info label="Employee" value={`${employee.name} (${employee.code})`} />
          <Info label="Designation" value={employee.designation} />
          <Info label="Department" value={employee.department} />
          <Info label="PAN" value={bank?.pan} />
          <Info label="Bank" value={bank?.name && bank.account ? `${bank.name} ••••${bank.account.slice(-4)}` : undefined} />
          <Info label="UAN" value={bank?.uan} />
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
          {[
            ['Month days', entry.calendarDays],
            ['Paid days', entry.payableDays],
            ['Worked', entry.presentDays],
            ['Paid leave', entry.paidLeaveDays],
            ['Late marks', entry.lateMarks],
            ['LOP days', entry.lopDays]
          ].map(([l, v]) => (
            <div key={l as string} className={`p-2 rounded border ${l === 'LOP days' && Number(v) > 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-[11.5px] text-slate-500">{l}</div>
              <div className="font-bold text-sm">{v}</div>
            </div>
          ))}
        </div>

        {days && days.length > 0 && <AttendanceStrip days={days} />}

        <table className="w-full border border-slate-200">
          <thead className="bg-slate-50 text-[11.5px] uppercase text-slate-600">
            <tr>
              <th className="text-left px-2 py-1.5">Earnings</th>
              <th className="text-right px-2 py-1.5">Amount</th>
              <th className="text-left px-2 py-1.5 border-l border-slate-200">Deductions</th>
              <th className="text-right px-2 py-1.5">Amount</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-2 py-1">{entry.earnings[i]?.label ?? ''}</td>
                <td className="px-2 py-1 text-right font-mono">{entry.earnings[i] ? formatInr(entry.earnings[i].amount) : ''}</td>
                <td className="px-2 py-1 border-l border-slate-200">{entry.deductions[i]?.label ?? ''}</td>
                <td className="px-2 py-1 text-right font-mono">{entry.deductions[i] ? formatInr(entry.deductions[i].amount) : ''}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-300 font-bold bg-slate-50">
              <td className="px-2 py-1.5">Gross earnings</td>
              <td className="px-2 py-1.5 text-right font-mono">{formatInr(entry.grossEarnings)}</td>
              <td className="px-2 py-1.5 border-l border-slate-200">Total deductions</td>
              <td className="px-2 py-1.5 text-right font-mono">{formatInr(entry.totalDeductions)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex flex-col sm:flex-row justify-between gap-2 p-3 rounded-lg bg-teal-50 border border-teal-200">
          <div>
            <div className="text-[11.5px] uppercase text-teal-800 font-bold">Net pay</div>
            <div className="text-[12.5px] text-teal-900 italic">{amountInWords(entry.netPay)}</div>
          </div>
          <div className="text-xl font-bold text-teal-900">{formatInr(entry.netPay)}</div>
        </div>

        {entry.employerContributions.length > 0 && (
          <div className="text-[11.5px] text-slate-500">
            Employer contributions (part of CTC, not deducted):{' '}
            {entry.employerContributions.map(c => `${c.label} ${formatInr(c.amount)}`).join(' · ')}
          </div>
        )}
        <div className="text-[11.5px] text-slate-400 border-t border-slate-100 pt-2">
          Pay is prorated on paid days. Absence without approved leave reduces paid days; a missing punch-out counts as a half day, and every {ATTENDANCE_POLICY.lateMarksPerHalfDayLop} late marks deduct half a day.
        </div>
      </div>
    </div>
  );
};

const Info: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-2">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-right">{value || '—'}</span>
  </div>
);
