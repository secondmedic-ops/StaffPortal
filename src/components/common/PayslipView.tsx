import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EmployeeProfile, PayrollEntry, PayrollLine } from '../../types';
import { formatAmount, numberInWords, type PayDay } from '../../lib/payrollEngine';
import { getMonthName } from '../../utils/dateUtils';
import { COMPANY } from '../../config/company';
import { lifecycleApi } from '../../api';
import { Printer } from 'lucide-react';

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

/** Deductions always printed, in the order of the company payslip, even at zero. */
const STANDARD_DEDUCTIONS: Array<[string, string]> = [
  ['LWF', 'LWF'],
  ['ADVANCE', 'ADVANCE'],
  ['ESI', 'ESI'],
  ['PF', 'PF']
];
const OTHER_DEDUCTION_LABELS: Record<string, string> = { PT: 'PROF. TAX', TDS: 'TDS' };

function deductionRows(deductions: PayrollLine[]): Array<{ label: string; amount: number }> {
  const byCode = new Map(deductions.map(d => [d.code, d]));
  const rows = STANDARD_DEDUCTIONS.map(([code, label]) => ({ label, amount: byCode.get(code)?.amount ?? 0 }));
  for (const d of deductions) {
    if (STANDARD_DEDUCTIONS.some(([code]) => code === d.code)) continue;
    rows.push({ label: OTHER_DEDUCTION_LABELS[d.code] ?? d.label.toUpperCase(), amount: d.amount });
  }
  return rows;
}

/** Full Aadhaar as on the company payslip; older records holding only the last 4 digits stay masked. */
const aadhaarText = (p: EmployeeProfile | null) =>
  p?.aadhaarNumber ? p.aadhaarNumber : p?.aadhaarLast4 ? `XXXX XXXX ${p.aadhaarLast4}` : '';

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
  > &
    Partial<Pick<PayrollEntry, 'payType' | 'workedHours' | 'dailyRate'>>;
  /** Loads division, location, ID and bank details for the slip. */
  employeeId?: number;
  employee: { name: string; code: string; designation?: string; department?: string };
  days?: PayDay[];
  status?: string;
}

/**
 * Payslip in the company format (Remote Healthcare Technologies part-time slip):
 * employee block, earnings beside deductions, gross and total, then net payable
 * worked out, bank transfer and the amount in words.
 */
export const PayslipView: React.FC<PayslipViewProps> = ({ entry, employeeId, employee, days, status }) => {
  const [details, setDetails] = useState<{ profile: EmployeeProfile | null; division?: string; workLocation?: string } | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    lifecycleApi
      .getPayslipDetails(employeeId)
      .then(d => !cancelled && setDetails(d))
      .catch(() => !cancelled && setDetails({ profile: null }));
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const profile = details?.profile ?? null;
  const daily = entry.payType === 'DAILY';
  const arrears = entry.earnings.find(e => e.code === 'ARREARS')?.amount ?? 0;
  const earningLines = entry.earnings.filter(e => e.code !== 'ARREARS');
  const dRows = deductionRows(entry.deductions);
  const earningRows = daily ? 1 : earningLines.length;
  const bodyRows = Math.max(earningRows, dRows.length);

  const idLine = [aadhaarText(profile), profile?.panNumber].filter(Boolean).join(' / ');
  const info: Array<[string, string | undefined]> = [
    ['Division', details?.division || COMPANY.defaultDivision],
    ['Location', details?.workLocation],
    ['Code', employee.code],
    ['Name', employee.name.toUpperCase()],
    ['AADHAR & PAN', idLine],
    ['Designation', employee.designation],
    ['Department', employee.department],
    ['ESI Number', profile?.esicNumber]
  ];

  // Print only the slip: render a copy straight under <body> so nothing else on
  // the page (sidebar, tables, the dialog) takes up space on the printed sheet.
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const t = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  const cell = 'border-black px-2 py-1';
  const num = 'text-right tabular';

  const slip = (
        <div className="print-area min-w-[640px] bg-white text-black p-6 sm:p-8 font-[Georgia,'Times_New_Roman',serif] text-[13px] leading-snug">
      {/* Letterhead */}
      <div className="flex items-center gap-4">
        <img src={COMPANY.logoUrl} alt="" className="h-14 w-14 object-contain shrink-0" />
        <div className="flex-1 text-center pr-14">
          <div className="text-[19px] font-bold">{COMPANY.legalName}</div>
        </div>
      </div>
      <div className="mt-4 text-center text-[14px]">
        Pay Slip For The Month Of {getMonthName(entry.month)} - {entry.year}
      </div>

      {/* Employee block */}
      <table className="mt-4 w-full border-collapse border-y-2 border-black">
        <tbody>
          <tr>
            <td className="align-top py-2 pr-2 w-[62%] border-r border-black">
              <table className="w-full">
                <tbody>
                  {info.map(([label, value]) => (
                    <tr key={label}>
                      <td className="font-bold pr-2 py-[1px] whitespace-nowrap w-32">{label}</td>
                      <td className="font-bold py-[1px]">: {value || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
            <td className="align-top py-2 pl-3 text-[12.5px]">
              <table className="w-full">
                <tbody>
                  {(
                    daily
                      ? [
                          ['Days worked', String(entry.presentDays)],
                          ['UAN', profile?.uanNumber]
                        ]
                      : [
                          ['Paid days', `${entry.payableDays} / ${entry.calendarDays}`],
                          ['LOP days', String(entry.lopDays)],
                          ['UAN', profile?.uanNumber]
                        ]
                  ).map(([l, v]) => (
                    <tr key={l}>
                      <td className="pr-2 py-[1px] whitespace-nowrap">{l}</td>
                      <td className="py-[1px]">: {v || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Earnings | Deductions */}
      <table className="w-full border-collapse border-b border-black">
        <thead>
          <tr className="border-b border-black">
            <th className={`${cell} font-normal text-left`}>{daily ? 'Days Worked' : 'Earnings'}</th>
            <th className={`${cell} font-normal ${num}`}>{daily ? 'Rate / Day' : 'Paid Days'}</th>
            <th className={`${cell} font-normal ${num}`}>Earning</th>
            <th className={`${cell} font-normal ${num} border-r`}>Arrears</th>
            <th className={`${cell} font-normal text-left`}>Deduction</th>
            <th className={`${cell} font-normal ${num}`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: bodyRows }).map((_, i) => {
            const d = dRows[i];
            let left: React.ReactNode = null;
            if (daily && i === 0) {
              left = (
                <>
                  <td className={`${cell} text-center`}>{String(entry.presentDays)}</td>
                  <td className={`${cell} ${num}`}>{formatAmount(entry.dailyRate ?? 0)}</td>
                  <td className={`${cell} ${num}`}>{formatAmount(earningLines[0]?.amount ?? 0)}</td>
                  <td className={`${cell} ${num} border-r`}>{arrears ? formatAmount(arrears) : ''}</td>
                </>
              );
            } else if (!daily && earningLines[i]) {
              left = (
                <>
                  <td className={cell}>{earningLines[i].label}</td>
                  <td className={`${cell} ${num}`}>{i === 0 ? `${entry.payableDays} / ${entry.calendarDays}` : ''}</td>
                  <td className={`${cell} ${num}`}>{formatAmount(earningLines[i].amount)}</td>
                  <td className={`${cell} ${num} border-r`}>{i === 0 && arrears ? formatAmount(arrears) : ''}</td>
                </>
              );
            }
            return (
              <tr key={i}>
                {left ?? (
                  <>
                    <td className={cell} />
                    <td className={cell} />
                    <td className={cell} />
                    <td className={`${cell} border-r`} />
                  </>
                )}
                <td className={cell}>{d?.label ?? ''}</td>
                <td className={`${cell} ${num}`}>{d ? formatAmount(d.amount) : ''}</td>
              </tr>
            );
          })}
          <tr className="border-t border-black font-bold">
            <td className={cell}>Gross Pay</td>
            <td className={cell} />
            <td className={`${cell} ${num}`} colSpan={2}>
              {formatAmount(entry.grossEarnings)}
            </td>
            <td className={`${cell} border-l`}>Total</td>
            <td className={`${cell} ${num}`}>{formatAmount(entry.totalDeductions)}</td>
          </tr>
        </tbody>
      </table>

      {/* Net payable */}
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
        <div>
          <span className="font-bold">Net Payable:</span>{' '}
          <span className="font-bold tabular">
            {formatAmount(entry.grossEarnings)} – {formatAmount(entry.totalDeductions)} = {formatAmount(entry.netPay)}
          </span>
        </div>
        <div>{profile?.bankName ? `Transferred into ${profile.bankName}` : 'Bank details not on record'}</div>
        <div className="col-span-2">
          {profile?.bankAccountNumber ? `A/c No. ${profile.bankAccountNumber} ` : ''}
          Rupees – {numberInWords(entry.netPay)} Only
        </div>
      </div>

      <div className="mt-6">THANK YOU</div>
      <div className="mt-10 text-right text-[12.5px]">Computer Generated Slip, Hence signature not required</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 no-print">
        {status ? <span className="text-[12.5px] text-slate-500 dark:text-slate-400">Status: {status}</span> : <span />}
        <button
          type="button"
          onClick={() => setPrinting(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      <div className="overflow-x-auto">
        {slip}
      </div>

      {!daily && days && days.length > 0 && (
        <div className="no-print rounded-lg border border-slate-200 dark:border-slate-800 p-3">
          <div className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-300 mb-2">How each day was counted</div>
          <AttendanceStrip days={days} />
        </div>
      )}

      {printing && createPortal(<div className="print-portal">{slip}</div>, document.body)}
    </div>
  );
};
