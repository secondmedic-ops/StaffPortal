import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { compensationApi, meApi } from '../../api';
import type { PayrollEntry, SalaryRevision } from '../../types';
import { computePayroll, formatInr, type PayDay } from '../../lib/payrollEngine';
import { formatDate, getMonthName } from '../../utils/dateUtils';
import { CalendarCheck, Eye, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal } from '../common/Modal';
import { PayslipView } from '../common/PayslipView';
import { cardClass, tableHeadClass } from '../common/PageHeader';

/**
 * Attendance-computed payslips published by Accounts, plus the employee's own
 * salary revision history. Shown at the top of My Payslips.
 */
export const AttendancePayslips: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [history, setHistory] = useState<SalaryRevision[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [viewing, setViewing] = useState<PayrollEntry | null>(null);
  const [days, setDays] = useState<PayDay[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [e, h] = await Promise.all([compensationApi.getMyPublishedEntries(), compensationApi.getMySalaryHistory()]);
        setEntries(e);
        setHistory(h);
      } catch {
        // Tables may not be migrated yet; the legacy payslip list below still works.
      } finally {
        setLoaded(true);
      }
    })();
  }, [currentUser?.id]);

  const open = async (entry: PayrollEntry) => {
    setViewing(entry);
    setDays([]);
    try {
      // Rebuild the day-by-day ledger so the employee sees exactly why pay was what it was.
      const [attendance, calendar] = await Promise.all([meApi.getAttendance(entry.month, entry.year), meApi.getCalendar(entry.month, entry.year)]);
      const ledger = computePayroll({
        year: entry.year,
        month: entry.month,
        dateOfJoining: currentUser?.dateOfJoining,
        dateOfExit: currentUser?.dateOfExit,
        salary: null,
        attendance,
        leaves: calendar.myLeaves
          .filter(l => l.status === 'APPROVED')
          .map(l => ({ fromDate: l.fromDate, toDate: l.toDate, fromHalf: l.fromHalf, toHalf: l.toHalf, isPaid: l.leaveTypeCode !== 'LOP' })),
        holidays: calendar.holidays.filter(h => !h.isRestricted && !h.isOptional).map(h => h.holidayDate)
      });
      setDays(ledger.days);
    } catch (err: any) {
      showToast('Attendance detail unavailable', err.message, 'info');
    }
  };

  if (!loaded || (entries.length === 0 && history.length === 0)) return null;

  return (
    <div className="space-y-4">
      {entries.length > 0 && (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Attendance-based salary slips</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-5 py-3">Month</th>
                  <th className="px-5 py-3 text-center">Paid days</th>
                  <th className="px-5 py-3 text-center">LOP days</th>
                  <th className="px-5 py-3 text-center">Late marks</th>
                  <th className="px-5 py-3">Published</th>
                  <th className="px-5 py-3 text-right">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="px-5 py-3 font-bold text-slate-900 dark:text-slate-100">
                      {getMonthName(e.month)} {e.year}
                    </td>
                    <td className="px-5 py-3 text-center font-mono">
                      {e.payableDays}/{e.calendarDays}
                    </td>
                    <td className={`px-5 py-3 text-center ${e.lopDays > 0 ? 'text-rose-600 font-bold' : ''}`}>{e.lopDays}</td>
                    <td className="px-5 py-3 text-center">{e.lateMarks}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(e.publishedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => open(e)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className={`${cardClass} p-4`}>
          <button onClick={() => setShowHistory(s => !s)} className="w-full flex items-center justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-700 dark:text-teal-400" /> My salary & increment history
            </span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showHistory && (
            <ol className="mt-3 space-y-2">
              {history.map(h => (
                <li key={h.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-700 dark:text-slate-300">
                    <strong>{h.revisionType.charAt(0) + h.revisionType.slice(1).toLowerCase()}</strong> · from {formatDate(h.effectiveFrom)}
                    {h.newDesignation && ` · ${h.newDesignation}`}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {h.payType === 'DAILY' ? `${formatInr(h.dailyRate ?? 0)} / day` : `${formatInr(h.ctcAnnual)} p.a.`}
                    {h.incrementPct != null && <span className="ml-2 text-emerald-600">+{h.incrementPct}%</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Salary slip · ${getMonthName(viewing.month)} ${viewing.year}` : ''}
        maxWidth="2xl"
      >
        {viewing && currentUser && (
          <PayslipView
            entry={viewing}
            employeeId={currentUser.id}
            employee={{
              name: currentUser.fullName,
              code: currentUser.empCode,
              designation: currentUser.designation,
              department: currentUser.departmentName
            }}
            days={days}
            status="Published"
          />
        )}
      </Modal>
    </div>
  );
};
