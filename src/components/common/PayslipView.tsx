import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EmployeeProfile, PayrollEntry, PayrollLine } from '../../types';
import { formatAmount, amountInWords, type PayDay } from '../../lib/payrollEngine';
import { getMonthName } from '../../utils/dateUtils';
import { COMPANY } from '../../config/company';
import { lifecycleApi } from '../../api';
import {
  Printer,
  ShieldCheck,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CreditCard
} from 'lucide-react';

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
    <div className="flex flex-wrap gap-1">
      {days.map(d => (
        <div
          key={d.date}
          title={`${d.date}: ${d.kind.replace(/_/g, ' ').toLowerCase()}${d.late ? ' · late' : ''}${d.note ? ` · ${d.note}` : ''}`}
          className={`relative w-6 h-7 rounded text-[11px] font-bold leading-7 text-center text-white shadow-xs ${DAY_STYLE[d.kind]}`}
        >
          {Number(d.date.slice(8))}
          {d.late && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white" />}
        </div>
      ))}
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-600 dark:text-slate-400">
      {(
        [
          ['PRESENT', 'Present'],
          ['HALF_DAY', 'Half Day'],
          ['PAID_LEAVE', 'Paid Leave'],
          ['HOLIDAY', 'Holiday'],
          ['WEEK_OFF', 'Week Off'],
          ['ABSENT', 'Absent / LOP'],
          ['UNPAID_LEAVE', 'Unpaid Leave'],
          ['PROJECTED', 'Upcoming']
        ] as Array<[PayDay['kind'], string]>
      ).map(([k, l]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-sm ${DAY_STYLE[k]}`} /> {l}
        </span>
      ))}
      <span className="flex items-center gap-1.5 font-medium text-orange-600 dark:text-orange-400">
        <span className="w-2 h-2 rounded-full bg-orange-500" /> Late Mark
      </span>
    </div>
  </div>
);

/** Deductions always printed in standardized company order */
const STANDARD_DEDUCTIONS: Array<[string, string]> = [
  ['PF', 'Provident Fund (EPF)'],
  ['ESI', 'Employee State Insurance (ESIC)'],
  ['PT', 'Professional Tax (PT)'],
  ['TDS', 'Income Tax (TDS)'],
  ['LWF', 'Labour Welfare Fund (LWF)'],
  ['ADVANCE', 'Salary Advance Recovery']
];

const OTHER_DEDUCTION_LABELS: Record<string, string> = {
  LOP: 'Loss of Pay (LOP) Deduction',
  OTHER: 'Other Statutory Recovery'
};

function buildDeductionRows(deductions: PayrollLine[]): Array<{ code: string; label: string; amount: number }> {
  const byCode = new Map(deductions.map(d => [d.code, d]));
  const rows: Array<{ code: string; label: string; amount: number }> = [];

  for (const [code, standardLabel] of STANDARD_DEDUCTIONS) {
    const found = byCode.get(code);
    if (found || code === 'PF' || code === 'PT') {
      rows.push({ code, label: standardLabel, amount: found?.amount ?? 0 });
    }
  }

  for (const d of deductions) {
    if (rows.some(r => r.code === d.code)) continue;
    rows.push({
      code: d.code,
      label: OTHER_DEDUCTION_LABELS[d.code] ?? d.label,
      amount: d.amount
    });
  }

  return rows;
}

/** Full or masked Aadhaar string */
const formatAadhaar = (p: EmployeeProfile | null) => {
  if (p?.aadhaarNumber) {
    const raw = p.aadhaarNumber.replace(/\s+/g, '');
    return raw.length === 12
      ? `XXXX XXXX ${raw.slice(-4)}`
      : p.aadhaarNumber;
  }
  return p?.aadhaarLast4 ? `XXXX XXXX ${p.aadhaarLast4}` : '—';
};

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
    Partial<Pick<PayrollEntry, 'payType' | 'workedHours' | 'hourlyRate' | 'dailyRate'>>;
  /** Loads division, location, ID and bank details for the slip. */
  employeeId?: number;
  employee: { name: string; code: string; designation?: string; department?: string };
  days?: PayDay[];
  status?: string;
}

export const PayslipView: React.FC<PayslipViewProps> = ({ entry, employeeId, employee, days, status }) => {
  const [details, setDetails] = useState<{ profile: EmployeeProfile | null; division?: string; workLocation?: string } | null>(null);
  const [printing, setPrinting] = useState(false);

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

  // Clean print portal integration: renders slip directly under <body> so the modal/shell doesn't split onto a 2nd page
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

  const profile = details?.profile ?? null;
  const hourly = entry.payType === 'HOURLY';
  const daily = entry.payType === 'DAILY';
  const arrears = entry.earnings.find(e => e.code === 'ARREARS')?.amount ?? 0;
  const earningLines = entry.earnings.filter(e => e.code !== 'ARREARS');
  const dRows = buildDeductionRows(entry.deductions);

  // Equalize table rows for a balanced look
  const rowCount = Math.max(hourly || daily ? 1 : earningLines.length, dRows.length);

  const payslipRef = `SMPAY-${entry.year}${String(entry.month).padStart(2, '0')}-${employee.code}`;
  const payPeriod = `${getMonthName(entry.month).toUpperCase()} ${entry.year}`;

  const slip = (
    <div className="print-area min-w-[720px] max-w-[850px] mx-auto bg-white text-slate-900 p-8 sm:p-10 font-sans text-xs leading-normal border border-slate-200 shadow-sm rounded-xl">
      {/* Header & Corporate Letterhead */}
      <div className="flex items-start justify-between pb-6 border-b-2 border-teal-700">
        <div className="flex items-start gap-4">
          <img
            src={COMPANY.logoUrl}
            alt="SecondMedic"
            className="h-16 w-16 object-contain rounded-lg border border-slate-100 p-1 shrink-0 bg-white"
            onError={e => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <div className="text-lg font-extrabold text-teal-900 tracking-tight">
              {COMPANY.legalName}
            </div>
            <div className="text-xs font-bold text-teal-700 mt-0.5">
              SecondMedic Healthcare Network
            </div>
            <div className="text-[11px] text-slate-500 mt-1 max-w-[48ch]">
              {COMPANY.addressLine}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              CIN: {COMPANY.cin} • Web: {COMPANY.website}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="inline-block px-3 py-1 rounded-md bg-teal-800 text-white font-bold text-xs uppercase tracking-wider">
            Salary Slip
          </div>
          <div className="text-sm font-extrabold text-slate-800 mt-2">
            {payPeriod}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            Ref: {payslipRef}
          </div>
        </div>
      </div>

      {/* Employee & Bank / Statutory Details Matrix */}
      <div className="grid grid-cols-2 gap-4 my-5">
        {/* Box 1: Employee Details */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-teal-900 border-b border-slate-200 pb-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-teal-700" />
            Employee Information
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-y-1.5 text-xs">
            <span className="text-slate-500">Employee Name:</span>
            <span className="font-bold text-slate-900">{employee.name.toUpperCase()}</span>

            <span className="text-slate-500">Employee Code:</span>
            <span className="font-mono font-bold text-teal-800">{employee.code}</span>

            <span className="text-slate-500">Designation:</span>
            <span className="font-medium text-slate-800">{employee.designation || 'Staff Associate'}</span>

            <span className="text-slate-500">Department:</span>
            <span className="font-medium text-slate-800">{employee.department || 'Operations'}</span>

            <span className="text-slate-500">Work Location:</span>
            <span className="text-slate-800">{details?.workLocation || 'Headquarters'} ({details?.division || COMPANY.defaultDivision})</span>
          </div>
        </div>

        {/* Box 2: Bank & Statutory Details */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-teal-900 border-b border-slate-200 pb-1 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-teal-700" />
            Banking & Statutory Details
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-y-1.5 text-xs">
            <span className="text-slate-500">Bank Name:</span>
            <span className="font-medium text-slate-900">{profile?.bankName || 'Direct Salary Account'}</span>

            <span className="text-slate-500">Bank A/c No:</span>
            <span className="font-mono font-semibold text-slate-900">
              {profile?.bankAccountNumber ? profile.bankAccountNumber : 'Recorded with Accounts'}
            </span>

            <span className="text-slate-500">IFSC Code:</span>
            <span className="font-mono text-slate-800">{profile?.bankIfsc || '—'}</span>

            <span className="text-slate-500">PAN Number:</span>
            <span className="font-mono font-bold text-slate-900">{profile?.panNumber || '—'}</span>

            <span className="text-slate-500">UAN / PF No:</span>
            <span className="font-mono text-slate-800">{profile?.uanNumber || '—'}</span>

            <span className="text-slate-500">ESIC / Aadhaar:</span>
            <span className="font-mono text-slate-800">
              {profile?.esicNumber ? `ESI: ${profile.esicNumber}` : formatAadhaar(profile)}
            </span>
          </div>
        </div>
      </div>

      {/* Attendance Summary Bar */}
      <div className="rounded-lg bg-teal-50/70 border border-teal-200 p-3 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-teal-900 font-bold">
          <CalendarCheck className="w-4 h-4 text-teal-700" />
          <span>Attendance Record:</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <span className="text-slate-500">Calendar Days:</span>{' '}
            <span className="font-bold text-slate-900">{entry.calendarDays}</span>
          </div>

          <div>
            <span className="text-slate-500">Payable Days:</span>{' '}
            <span className="font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
              {hourly ? `${entry.presentDays} days (${entry.workedHours ?? 0} hrs)` : `${entry.payableDays} Days`}
            </span>
          </div>

          {!hourly && (
            <>
              <div>
                <span className="text-slate-500">Present:</span>{' '}
                <span className="font-bold text-slate-800">{entry.presentDays}</span>
              </div>

              <div>
                <span className="text-slate-500">Paid Leave:</span>{' '}
                <span className="font-bold text-slate-800">{entry.paidLeaveDays}</span>
              </div>

              <div>
                <span className="text-slate-500">Offs/Holidays:</span>{' '}
                <span className="font-bold text-slate-800">{(entry.holidayDays || 0) + (entry.weekOffDays || 0)}</span>
              </div>

              {entry.lopDays > 0 && (
                <div>
                  <span className="text-slate-500">LOP Days:</span>{' '}
                  <span className="font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                    {entry.lopDays}
                  </span>
                </div>
              )}

              {entry.lateMarks > 0 && (
                <div>
                  <span className="text-slate-500">Late Marks:</span>{' '}
                  <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    {entry.lateMarks}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Earnings & Deductions Table */}
      <div className="grid grid-cols-2 border border-slate-300 rounded-lg overflow-hidden mb-5">
        {/* Earnings Column */}
        <div className="border-r border-slate-300 flex flex-col justify-between">
          <div>
            <div className="bg-teal-700 text-white font-bold px-4 py-2.5 flex justify-between items-center text-xs uppercase tracking-wider">
              <span>{daily ? 'Daily Pay Details' : hourly ? 'Hourly Services' : 'Earnings (A)'}</span>
              <span>Amount (INR)</span>
            </div>
            <div className="divide-y divide-slate-100">
              {daily ? (
                <div className="px-4 py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">Daily Services Remuneration</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {entry.presentDays} days @ ₹{formatAmount(entry.dailyRate ?? 0)}/day
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{formatAmount(earningLines[0]?.amount ?? 0)}
                  </span>
                </div>
              ) : hourly ? (
                <div className="px-4 py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">Hourly Services Remuneration</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {formatAmount(entry.workedHours ?? 0).replace(/\.00$/, '')} hrs @ ₹{formatAmount(entry.hourlyRate ?? 0)}/hr
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{formatAmount(earningLines[0]?.amount ?? 0)}
                  </span>
                </div>
              ) : (
                Array.from({ length: rowCount }).map((_, i) => {
                  const line = earningLines[i];
                  return (
                    <div key={i} className="px-4 py-2 flex justify-between items-center text-xs min-h-[34px]">
                      <span className={line ? 'font-medium text-slate-700' : 'text-transparent'}>
                        {line?.label || '—'}
                      </span>
                      <span className={`font-mono font-semibold ${line ? 'text-slate-900' : 'text-transparent'}`}>
                        {line ? `₹${formatAmount(line.amount)}` : '—'}
                      </span>
                    </div>
                  );
                })
              )}

              {arrears > 0 && (
                <div className="px-4 py-2 flex justify-between items-center text-xs bg-amber-50/60 text-amber-900 font-semibold">
                  <span>Salary Arrears / Bonus</span>
                  <span className="font-mono">₹{formatAmount(arrears)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Gross Earnings Subtotal */}
          <div className="bg-teal-50 border-t border-teal-200 px-4 py-2.5 flex justify-between items-center font-bold text-xs">
            <span className="text-teal-900 uppercase">Gross Earnings (A)</span>
            <span className="font-mono text-sm text-teal-900">₹{formatAmount(entry.grossEarnings)}</span>
          </div>
        </div>

        {/* Deductions Column */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="bg-slate-700 text-white font-bold px-4 py-2.5 flex justify-between items-center text-xs uppercase tracking-wider">
              <span>Deductions (B)</span>
              <span>Amount (INR)</span>
            </div>
            <div className="divide-y divide-slate-100">
              {Array.from({ length: rowCount }).map((_, i) => {
                const d = dRows[i];
                return (
                  <div key={i} className="px-4 py-2 flex justify-between items-center text-xs min-h-[34px]">
                    <span className={d ? 'font-medium text-slate-700' : 'text-transparent'}>
                      {d?.label || '—'}
                    </span>
                    <span className={`font-mono font-semibold ${d ? 'text-slate-900' : 'text-transparent'}`}>
                      {d ? `₹${formatAmount(d.amount)}` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Deductions Subtotal */}
          <div className="bg-slate-100 border-t border-slate-300 px-4 py-2.5 flex justify-between items-center font-bold text-xs">
            <span className="text-slate-800 uppercase">Total Deductions (B)</span>
            <span className="font-mono text-sm text-rose-700">₹{formatAmount(entry.totalDeductions)}</span>
          </div>
        </div>
      </div>

      {/* Net Salary Payable Card */}
      <div className="rounded-xl bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-5 shadow-sm mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
              Net Salary Payable (A - B)
            </div>
            <div className="text-2xl font-extrabold font-mono tracking-tight text-white mt-0.5">
              ₹{formatAmount(entry.netPay)}
            </div>
            <div className="text-xs text-teal-100 mt-1.5 font-medium">
              Amount in Words:{' '}
              <span className="font-semibold text-white underline decoration-teal-400 decoration-1 underline-offset-2">
                {amountInWords(entry.netPay)}
              </span>
            </div>
          </div>

          <div className="sm:border-l sm:border-teal-700/80 sm:pl-6 text-xs text-teal-200 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Direct Bank Transfer</span>
            </div>
            <div>
              {profile?.bankName
                ? `${profile.bankName} ${profile.bankAccountNumber ? `• A/c: ${profile.bankAccountNumber}` : ''}`
                : 'Accounts Verified Bank Transfer'}
            </div>
            <div className="text-[11px] font-mono text-teal-300">
              Status: Approved for Disbursal
            </div>
          </div>
        </div>
      </div>

      {/* Employer Contributions Note (CTC Component - Informational) */}
      {entry.employerContributions && entry.employerContributions.length > 0 && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2 mb-5 text-[11px] text-slate-600 flex items-center justify-between">
          <span className="font-semibold text-slate-700">Employer Contributions (Part of CTC, not deducted from salary):</span>
          <div className="flex items-center gap-4 font-mono">
            {entry.employerContributions.map(c => (
              <span key={c.code}>
                {c.label}: <strong className="text-slate-800">₹{formatAmount(c.amount)}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Signatures & Corporate Authentication Footer */}
      <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 items-end text-xs">
        <div>
          <div className="flex items-center gap-1.5 text-teal-900 font-bold mb-1">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>SecondMedic Payroll Authentication</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed max-w-[42ch]">
            This is a digitally generated and verified payroll advice issued under the authority of Remote Healthcare Technologies Pvt. Ltd. No physical signature is required.
          </p>
          <div className="text-[10px] font-mono text-slate-400 mt-2">
            Authentication Code: SHA256:{payslipRef.toLowerCase()}
          </div>
        </div>

        <div className="text-right space-y-1">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            For {COMPANY.legalName}
          </div>
          <div className="h-10 flex items-center justify-end">
            <div className="inline-block border-b border-dashed border-slate-400 px-8 py-1 text-[11px] font-semibold text-teal-800 italic">
              Digitally Authorized
            </div>
          </div>
          <div className="text-[11px] font-bold text-slate-800">
            Authorized Signatory
          </div>
          <div className="text-[10px] text-slate-400">
            Finance & Accounts Department
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Top Action Bar (hidden in print) */}
      <div className="flex items-center justify-between gap-3 no-print bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            {status || 'Official Payslip'}
          </span>
          <span className="text-xs text-slate-500 font-mono">Ref: {payslipRef}</span>
        </div>
        <button
          type="button"
          onClick={() => setPrinting(true)}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white shadow-xs flex items-center gap-2 transition-all active:scale-95"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Screen Presentation */}
      <div className="overflow-x-auto">
        {slip}
      </div>

      {/* Attendance Detail Strip below the slip (Interactive on screen, hidden in print) */}
      {!hourly && !daily && days && days.length > 0 && (
        <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <span>Monthly Attendance Ledger ({days.length} Days)</span>
          </div>
          <AttendanceStrip days={days} />
        </div>
      )}

      {/* Portal copy mounted to document.body during print so no modals/shells push onto a second page */}
      {printing && createPortal(<div className="print-portal">{slip}</div>, document.body)}

      {/* Print Specific CSS */}
      <style>{`
        @media print {
          body > *:not(.print-portal) {
            display: none !important;
          }
          .print-portal {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
        }
      `}</style>
    </div>
  );
};
