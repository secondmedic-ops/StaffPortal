import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { compensationApi } from '../../api';
import { recomputeRow, type PayrollPreviewRow } from '../../api/compensation';
import { formatInr } from '../../lib/payrollEngine';
import { ATTENDANCE_POLICY, OVERTIME_POLICY, PAYROLL_POLICY, SHIFT_POLICY, STATUTORY_DEDUCTIONS } from '../../config/policy';
import { getMonthName } from '../../utils/dateUtils';
import {
  Calculator,
  Save,
  BadgeCheck,
  Send,
  AlertTriangle,
  Users,
  IndianRupee,
  CalendarX,
  Download,
  Info
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { StatusPill } from '../common/StatusPill';
import { PayslipView } from '../common/PayslipView';
import { PageHeader, StatCard, EmptyState, inputClass, compactInputClass, primaryBtn, secondaryBtn, cardClass, tableHeadClass } from '../common/PageHeader';

function defaultPeriod() {
  const d = new Date();
  // Before the 5th, Accounts is usually closing last month.
  if (d.getDate() < 5) d.setMonth(d.getMonth() - 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export const AttendancePayroll: React.FC = () => {
  const { showToast } = useAuth();
  const initial = defaultPeriod();
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PayrollPreviewRow[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [search, setSearch] = useState('');

  const [viewing, setViewing] = useState<PayrollPreviewRow | null>(null);
  const [adjust, setAdjust] = useState({ arrears: '', advance: '' });

  const compute = async () => {
    try {
      setLoading(true);
      const res = await compensationApi.previewMonth(year, month);
      setRows(res.rows);
      setWarnings(res.warnings);
    } catch (err: any) {
      showToast('Could not compute payroll', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter(r => !q || r.employee.fullName.toLowerCase().includes(q) || r.employee.empCode.toLowerCase().includes(q));
  }, [rows, search]);

  const totals = useMemo(() => {
    const list = rows ?? [];
    const paid = list.filter(r => r.revision);
    return {
      headcount: list.length,
      missingSalary: list.filter(r => !r.revision).length,
      missingBank: list.filter(r => r.revision && r.bankMissing).length,
      gross: paid.reduce((s, r) => s + r.computation.grossEarnings, 0),
      net: paid.reduce((s, r) => s + r.computation.netPay, 0),
      lop: list.reduce((s, r) => s + r.computation.lopDays, 0),
      withLop: list.filter(r => r.computation.lopDays > 0).length,
      drafts: list.filter(r => r.existing?.status === 'DRAFT').length,
      approved: list.filter(r => r.existing?.status === 'APPROVED').length,
      published: list.filter(r => r.existing?.status === 'PUBLISHED').length
    };
  }, [rows]);

  // Who has to approve: the reporting manager of whoever saved the drafts.
  const awaitingApprover = useMemo(() => {
    const list = rows ?? [];
    const computerId = list.find(r => r.existing?.status === 'DRAFT')?.existing?.computedById;
    const computer = list.find(r => r.employee.id === computerId)?.employee;
    return computer?.managerName;
  }, [rows]);

  const run = async (label: string, fn: () => Promise<number>, success: (n: number) => string) => {
    setBusy(label);
    try {
      const n = await fn();
      showToast(label, success(n), n > 0 ? 'success' : 'info');
      await compute();
    } catch (err: any) {
      showToast(`${label} failed`, err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const openPayslip = (row: PayrollPreviewRow) => {
    setViewing(row);
    setAdjust({
      arrears: row.input.arrears ? String(row.input.arrears) : '',
      advance: row.input.advance ? String(row.input.advance) : ''
    });
  };

  /** Re-run this employee's pay with the arrears / advance Accounts entered. */
  const applyAdjustments = () => {
    if (!viewing) return;
    const next = recomputeRow(viewing, { arrears: Number(adjust.arrears) || 0, advance: Number(adjust.advance) || 0 });
    setRows(prev => (prev ?? []).map(r => (r.employee.id === next.employee.id ? next : r)));
    setViewing(next);
    showToast('Payslip updated', 'Save & send for approval to keep these amounts.', 'success');
  };
  const locked = viewing?.existing?.status === 'PUBLISHED';

  const exportCsv = () => {
    const header = ['Emp Code', 'Name', 'Department', 'Pay Type', 'Worked Hrs', 'Rate', 'Month Days', 'Paid Days', 'LOP Days', 'Late Marks', 'Arrears', 'Gross', 'LWF', 'Advance', 'ESI', 'PF', 'PT', 'TDS', 'Total Deductions', 'Net Pay'];
    const find = (r: PayrollPreviewRow, code: string) => r.computation.deductions.find(d => d.code === code)?.amount ?? 0;
    const lines = (rows ?? []).map(r => [
      r.employee.empCode,
      r.employee.fullName,
      r.employee.departmentName,
      r.computation.payType === 'HOURLY' ? 'Hourly' : 'Monthly',
      r.computation.workedHours,
      r.computation.hourlyRate ?? '',
      r.computation.calendarDays,
      r.computation.payableDays,
      r.computation.lopDays,
      r.computation.lateMarks,
      r.computation.earnings.find(e => e.code === 'ARREARS')?.amount ?? 0,
      r.computation.grossEarnings,
      find(r, 'LWF'),
      find(r, 'ADVANCE'),
      find(r, 'ESI'),
      find(r, 'PF'),
      find(r, 'PT'),
      find(r, 'TDS'),
      r.computation.totalDeductions,
      r.computation.netPay
    ]);
    const csv = [header, ...lines].map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-register-${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Attendance-Based Payroll"
        subtitle="Salary is calculated from punches, approved leave, holidays and late marks — no attendance, no pay"
        actions={
          <>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className={`${compactInputClass} w-32`}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {getMonthName(i + 1)}
                </option>
              ))}
            </select>
            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className={`${compactInputClass} w-24 font-mono`} />
            <button onClick={compute} disabled={loading} className={primaryBtn}>
              <Calculator className="w-4 h-4" /> {loading ? 'Computing…' : 'Compute from Attendance'}
            </button>
          </>
        }
      />

      {/* Policy summary keeps the rules visible to Accounts */}
      <div className={`${cardClass} p-4 text-[12.5px] text-slate-600 dark:text-slate-400 flex gap-3`}>
        <Info className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div>
            <strong className="text-slate-800 dark:text-slate-200">Rules in force:</strong> shift {SHIFT_POLICY.startTime}–{SHIFT_POLICY.endTime}, grace{' '}
            {SHIFT_POLICY.graceMinutes} min · full day ≥ {SHIFT_POLICY.fullDayHours}h, half day ≥ {SHIFT_POLICY.halfDayHours}h · every{' '}
            {ATTENDANCE_POLICY.lateMarksPerHalfDayLop} late marks = ½ day LOP · missing punch-out = ½ day · absent without approved leave = LOP.
          </div>
          <div>
            Pay basis: {PAYROLL_POLICY.payBasis === 'CALENDAR' ? 'monthly salary ÷ calendar days × paid days' : 'monthly salary ÷ 26 per LOP day'} · PF{' '}
            {PAYROLL_POLICY.pfRate * 100}% of basic (ceiling {formatInr(PAYROLL_POLICY.pfWageCeiling)}) · ESI if gross ≤ {formatInr(PAYROLL_POLICY.esiGrossThreshold)} · PT {formatInr(PAYROLL_POLICY.professionalTaxMonthly)}/month · TDS from salary revision · approved time updates replace punch times · approved holiday/Sunday work chosen as overtime is paid at {OVERTIME_POLICY.payMultiplier}× a day's gross.
          </div>
          <div>
            Part-time (hourly): hours worked × hourly rate · PF {PAYROLL_POLICY.pfRate * 100}% of gross · ESI {PAYROLL_POLICY.esiEmployeeRate * 100}% of gross · no PT · LWF{' '}
            {STATUTORY_DEDUCTIONS.lwfEmployeeAmount > 0
              ? `${formatInr(STATUTORY_DEDUCTIONS.lwfEmployeeAmount)} in ${STATUTORY_DEDUCTIONS.lwfMonths.map(m => getMonthName(m, true)).join(' & ')}`
              : 'rate not set (prints as 0.00)'}{' '}
            · open a payslip to add arrears or an advance recovery.
          </div>
        </div>
      </div>

      {warnings.map(w => (
        <div key={w} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {w}
        </div>
      ))}

      {loading ? (
        <SkeletonLoader rows={8} />
      ) : !rows ? (
        <EmptyState
          icon={Calculator}
          title={`Compute ${getMonthName(month)} ${year} payroll`}
          message="Pulls every employee's punches, approved leave and holidays for the month, applies the attendance policy and their approved salary, and shows exactly how each rupee was arrived at."
          action={
            <button onClick={compute} className={`${primaryBtn} mx-auto`}>
              <Calculator className="w-4 h-4" /> Compute now
            </button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Employees" value={totals.headcount} hint={
                [totals.missingSalary && `${totals.missingSalary} without approved salary`, totals.missingBank && `${totals.missingBank} without bank details`]
                  .filter(Boolean)
                  .join(', ') || 'All set for payslips'
              } icon={Users} tone={totals.missingSalary || totals.missingBank ? 'amber' : 'teal'} />
            <StatCard label="Gross payroll" value={formatInr(totals.gross)} icon={IndianRupee} tone="sky" />
            <StatCard label="Net payout" value={formatInr(totals.net)} icon={IndianRupee} tone="purple" />
            <StatCard label="Loss of pay" value={`${totals.lop} days`} hint={`${totals.withLop} employees affected`} icon={CalendarX} tone="rose" />
          </div>

          <div className={`${cardClass} p-3 flex flex-col md:flex-row gap-3 md:items-center justify-between`}>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="text-slate-500">Saved:</span>
              <StatusPill status="DRAFT" /> <strong className="text-slate-700 dark:text-slate-300">{totals.drafts}</strong>
              <StatusPill status="APPROVED" /> <strong className="text-slate-700 dark:text-slate-300">{totals.approved}</strong>
              <StatusPill status="PUBLISHED" /> <strong className="text-slate-700 dark:text-slate-300">{totals.published}</strong>
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…" className={`${compactInputClass} w-44`} />
              <button onClick={exportCsv} className={secondaryBtn}>
                <Download className="w-4 h-4" /> Register CSV
              </button>
              <button
                onClick={() => run('Saved as draft', () => compensationApi.saveDrafts(year, month, rows), n =>
                      `${n} entries saved and sent to your reporting manager for approval.${
                        totals.missingBank ? ` ${totals.missingBank} skipped: no bank details.` : ''
                      }`
                  )
                }
                disabled={!!busy}
                className={secondaryBtn}
              >
                <Save className="w-4 h-4" /> {busy === 'Saved as draft' ? 'Saving…' : 'Save & Send for Approval'}
              </button>
              {totals.drafts > 0 && (
                <span className="text-[12.5px] font-semibold text-amber-700 dark:text-amber-400 self-center">
                  {totals.drafts} awaiting {awaitingApprover ? `${awaitingApprover}'s` : "your reporting manager's"} approval
                </span>
              )}
              <button onClick={() => setConfirmPublish(true)} disabled={!!busy || totals.approved === 0} className={primaryBtn}>
                <Send className="w-4 h-4" /> Publish to Staff
              </button>
            </div>
          </div>

          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-3 py-3 text-center" title="Paid days of the month, or hours worked for part-time staff">Paid / Month</th>
                    <th className="px-3 py-3 text-center">Worked</th>
                    <th className="px-3 py-3 text-center">Leave</th>
                    <th className="px-3 py-3 text-center">Late</th>
                    <th className="px-3 py-3 text-center">LOP</th>
                    <th className="px-3 py-3 text-center" title="Holidays/Sundays worked · of which paid as overtime">Hol. worked / OT</th>
                    <th className="px-3 py-3 text-right">Gross</th>
                    <th className="px-3 py-3 text-right">Deductions</th>
                    <th className="px-3 py-3 text-right">Net</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visible.map(r => {
                    const c = r.computation;
                    return (
                      <tr key={r.employee.id} onClick={() => openPayslip(r)} className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{r.employee.fullName}</div>
                          <div className="text-[12.5px] text-slate-500">
                            {r.employee.empCode} · {r.employee.departmentName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono">
                          {c.payType === 'HOURLY' ? (
                            <span title={`Hourly: ${c.workedHours} h × ${formatInr(c.hourlyRate ?? 0)}`}>{c.workedHours} h</span>
                          ) : (
                            <>
                              {c.payableDays}/{c.calendarDays}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">{c.presentDays}</td>
                        <td className="px-3 py-2.5 text-center">{c.paidLeaveDays}</td>
                        <td className={`px-3 py-2.5 text-center ${c.lateMarks >= ATTENDANCE_POLICY.lateMarksPerHalfDayLop ? 'text-orange-600 font-semibold' : ''}`}>{c.lateMarks}</td>
                        <td className={`px-3 py-2.5 text-center ${c.lopDays > 0 ? 'text-rose-600 font-bold' : ''}`}>{c.lopDays}</td>
                        <td className={`px-3 py-2.5 text-center ${c.holidayWorkedDays > 0 ? 'text-sky-700 dark:text-sky-400 font-semibold' : ''}`}>
                          {c.holidayWorkedDays}
                          {c.overtimeDays > 0 && <span className="ml-1 text-[11.5px] text-emerald-700 dark:text-emerald-400">/ {c.overtimeDays} OT</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{r.revision ? formatInr(c.grossEarnings) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{r.revision ? formatInr(c.totalDeductions) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{r.revision ? formatInr(c.netPay) : '—'}</td>
                        <td className="px-3 py-2.5">
                          {!r.revision ? (
                            <span className="text-[11.5px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> No salary
                            </span>
                          ) : r.bankMissing && r.existing?.status !== 'PUBLISHED' ? (
                            <span className="text-[11.5px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1" title="HR must add bank details under Staff directory → Bank & ID">
                              <AlertTriangle className="w-3 h-3" /> No bank details
                            </span>
                          ) : r.existing ? (
                            <StatusPill status={r.existing.status} />
                          ) : (
                            <span className="text-[11.5px] text-slate-400">Not saved</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.employee.fullName} · ${getMonthName(month)} ${year}` : ''}
        subtitle={viewing?.revision ? `Salary revision effective ${viewing.revision.effectiveFrom} · ${viewing.revision.payType === 'HOURLY' ? `hourly rate ${formatInr(viewing.revision.hourlyRate ?? 0)}` : `CTC ${formatInr(viewing.revision.ctcAnnual)}`}` : 'No approved salary revision'}
        maxWidth="2xl"
      >
        {viewing && (
          <div className="space-y-3">
            {viewing.computation.warnings.map(w => (
              <div key={w} className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[12.5px] text-amber-900 dark:text-amber-200">
                {w}
              </div>
            ))}
            {viewing.revision && (
              <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Arrears (₹)</label>
                  <input type="number" min={0} value={adjust.arrears} disabled={locked} onChange={e => setAdjust(a => ({ ...a, arrears: e.target.value }))} className={`${compactInputClass} w-32`} placeholder="0" />
                </div>
                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Advance recovery (₹)</label>
                  <input type="number" min={0} value={adjust.advance} disabled={locked} onChange={e => setAdjust(a => ({ ...a, advance: e.target.value }))} className={`${compactInputClass} w-36`} placeholder="0" />
                </div>
                <button type="button" onClick={applyAdjustments} disabled={locked} className={secondaryBtn}>
                  Update payslip
                </button>
                {locked && <span className="text-[12.5px] text-slate-500">Published payslips can't be changed.</span>}
              </div>
            )}
            <PayslipView
              entry={{ year, month, ...viewing.computation }}
              employeeId={viewing.employee.id}
              employee={{
                name: viewing.employee.fullName,
                code: viewing.employee.empCode,
                designation: viewing.employee.designation,
                department: viewing.employee.departmentName
              }}
              days={viewing.computation.days}
              status={viewing.existing?.status ?? 'Preview'}
            />
          </div>
        )}
      </Modal>

      <Modal isOpen={confirmPublish} onClose={() => setConfirmPublish(false)} title={`Publish ${getMonthName(month)} ${year} payslips?`}>
        <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
          <p>
            {totals.approved} approved payslips will become visible to employees in <strong>My Payslips</strong>. Published payslips are locked and cannot be
            edited.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmPublish(false)} className={secondaryBtn}>
              Cancel
            </button>
            <button
              onClick={async () => {
                setConfirmPublish(false);
                await run('Published', () => compensationApi.setEntriesStatus(year, month, 'APPROVED', 'PUBLISHED'), n => `${n} payslips published to staff.`);
              }}
              className={primaryBtn}
            >
              <Send className="w-4 h-4" /> Publish
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
