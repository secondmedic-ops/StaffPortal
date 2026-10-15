import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { compensationApi } from '../../api';
import type { PayrollEntry } from '../../types';
import { formatInr } from '../../lib/payrollEngine';
import { getMonthName } from '../../utils/dateUtils';
import { BadgeCheck, Undo2, IndianRupee, Users, CalendarX, ClipboardCheck } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { StatusPill } from '../common/StatusPill';
import { PayslipView } from '../common/PayslipView';
import { PageHeader, StatCard, EmptyState, primaryBtn, secondaryBtn, cardClass, tableHeadClass } from '../common/PageHeader';

/**
 * Approval screen for the reporting manager of the Accounts person who computed
 * payroll. Shows the saved entries exactly as staff will see them once published.
 */
export const PayrollApproval: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<Array<{ year: number; month: number; count: number }>>([]);
  const [period, setPeriod] = useState<{ year: number; month: number } | null>(null);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<PayrollEntry | null>(null);

  const loadMonths = async () => {
    try {
      setLoading(true);
      const list = await compensationApi.getMonthsAwaitingApproval();
      setMonths(list);
      setPeriod(prev => prev ?? (list[0] ? { year: list[0].year, month: list[0].month } : null));
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load payroll approvals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonths();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!period) return;
    compensationApi
      .getEntries(period.year, period.month)
      .then(setEntries)
      .catch(err => showToast('Error', err.message, 'error'));
  }, [period]);

  const pending = useMemo(() => entries.filter(e => e.status === 'DRAFT' && e.computedById !== currentUser?.id), [entries, currentUser?.id]);
  const approved = entries.filter(e => e.status === 'APPROVED');
  const computedBy = Array.from(new Set(pending.map(e => e.computedByName).filter(Boolean))).join(', ');

  const act = async (action: 'APPROVE' | 'SEND_BACK') => {
    if (!period) return;
    setBusy(true);
    try {
      const n =
        action === 'APPROVE'
          ? await compensationApi.setEntriesStatus(period.year, period.month, 'DRAFT', 'APPROVED')
          : await compensationApi.setEntriesStatus(period.year, period.month, 'APPROVED', 'DRAFT');
      showToast(
        action === 'APPROVE' ? 'Payroll approved' : 'Sent back to Accounts',
        action === 'APPROVE' ? `${n} payslips approved — Accounts can now publish.` : `${n} payslips returned for correction.`,
        action === 'APPROVE' ? 'success' : 'info'
      );
      setEntries(await compensationApi.getEntries(period.year, period.month));
      loadMonths();
    } catch (err: any) {
      showToast('Action failed', err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const list = pending.length > 0 ? pending : approved;
  const gross = list.reduce((s, e) => s + e.grossEarnings, 0);
  const net = list.reduce((s, e) => s + e.netPay, 0);
  const lop = list.reduce((s, e) => s + e.lopDays, 0);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Payroll Approval"
        subtitle="Payroll computed by Accounts must be approved by their reporting manager before payslips are published"
        actions={
          months.length > 1 ? (
            <div className="flex gap-1.5">
              {months.map(m => (
                <button
                  key={`${m.year}-${m.month}`}
                  onClick={() => setPeriod({ year: m.year, month: m.month })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    period?.year === m.year && period?.month === m.month ? 'bg-teal-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {getMonthName(m.month, true)} {m.year} ({m.count})
                </button>
              ))}
            </div>
          ) : undefined
        }
      />

      {loading ? (
        <SkeletonLoader rows={6} />
      ) : !period || entries.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing to approve" message="When Accounts saves a month's payroll, it appears here for your approval." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={`${getMonthName(period.month)} ${period.year}`} value={list.length} hint={computedBy ? `Computed by ${computedBy}` : undefined} icon={Users} />
            <StatCard label="Gross payroll" value={formatInr(gross)} icon={IndianRupee} tone="sky" />
            <StatCard label="Net payout" value={formatInr(net)} icon={IndianRupee} tone="purple" />
            <StatCard label="Loss of pay" value={`${lop} days`} icon={CalendarX} tone="rose" />
          </div>

          <div className={`${cardClass} p-3 flex flex-wrap items-center justify-between gap-2`}>
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {pending.length > 0
                ? `${pending.length} payslips waiting for your approval. Click a row to see the full payslip.`
                : approved.length > 0
                ? `${approved.length} approved, waiting for Accounts to publish.`
                : 'Nothing pending for this month.'}
            </span>
            <div className="flex gap-2">
              <button onClick={() => act('SEND_BACK')} disabled={busy || approved.length === 0} className={secondaryBtn}>
                <Undo2 className="w-4 h-4" /> Send Back
              </button>
              <button onClick={() => act('APPROVE')} disabled={busy || pending.length === 0} className={primaryBtn}>
                <BadgeCheck className="w-4 h-4" /> Approve Payroll
              </button>
            </div>
          </div>

          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-3 py-3 text-center">Paid / Month</th>
                    <th className="px-3 py-3 text-center">LOP</th>
                    <th className="px-3 py-3 text-right">Gross</th>
                    <th className="px-3 py-3 text-right">Deductions</th>
                    <th className="px-3 py-3 text-right">Net</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {entries.map(e => (
                    <tr key={e.id} onClick={() => setViewing(e)} className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{e.employeeName}</div>
                        <div className="text-[12.5px] text-slate-500">
                          {e.employeeCode} · {e.departmentName}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        {e.payableDays}/{e.calendarDays}
                      </td>
                      <td className={`px-3 py-2.5 text-center ${e.lopDays > 0 ? 'text-rose-600 font-bold' : ''}`}>{e.lopDays}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{formatInr(e.grossEarnings)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{formatInr(e.totalDeductions)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{formatInr(e.netPay)}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.employeeName} · ${getMonthName(viewing.month)} ${viewing.year}` : ''} maxWidth="2xl">
        {viewing && (
          <PayslipView
            entry={viewing}
            employeeId={viewing.employeeId}
            employee={{ name: viewing.employeeName ?? '', code: viewing.employeeCode ?? '', designation: viewing.designation, department: viewing.departmentName }}
            status={viewing.status}
          />
        )}
      </Modal>
    </div>
  );
};
