import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi } from '../../api';
import { MonthlyAttendanceSummary } from '../../types';
import { getMonthName, formatDate } from '../../utils/dateUtils';
import {
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const AttendanceRegister: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(8); // August 2026
  const [year, setYear] = useState(2026);
  const [summaries, setSummaries] = useState<MonthlyAttendanceSummary[]>([]);
  const [locking, setLocking] = useState(false);

  // Unlock modal
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const fetchSummaries = async () => {
    try {
      setLoading(true);
      const data = await hrApi.getAttendanceSummary(month, year);
      setSummaries(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load attendance register', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaries();
  }, [month, year, currentUser]);

  const isMonthLocked = summaries.length > 0 && summaries.every(s => s.locked);
  const totalLopDays = summaries.reduce((acc, s) => acc + s.lopDays, 0);
  const totalPayable = summaries.reduce((acc, s) => acc + s.payableDays, 0);

  const handleLockAttendance = async () => {
    if (!confirm(`Are you sure you want to freeze and lock attendance for ${getMonthName(month)} ${year}? Once locked, Accounts will use this ledger to process monthly payroll.`)) {
      return;
    }

    setLocking(true);
    try {
      await hrApi.lockAttendanceMonth(month, year);
      showToast(
        'Attendance Locked for Payroll',
        `August 2026 attendance frozen. Dispatched ${totalLopDays} total LOP days to Accounts module.`,
        'success'
      );
      fetchSummaries();
    } catch (err: any) {
      showToast('Lock Failed', err.message || 'Could not lock attendance', 'error');
    } finally {
      setLocking(false);
    }
  };

  const handleUnlockRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockReason.trim()) {
      showToast('Reason Required', 'Please provide a justification for unfreezing locked attendance.', 'error');
      return;
    }

    setUnlocking(true);
    try {
      await hrApi.unlockAttendanceMonth(month, year, unlockReason);
      showToast(
        'Attendance Unlocked',
        'Attendance ledger reopened for corrections. Accounts payroll sync invalidated.',
        'info'
      );
      setShowUnlockModal(false);
      setUnlockReason('');
      fetchSummaries();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to unlock attendance', 'error');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Monthly Attendance Register & Payroll Lock</h1>
            {isMonthLocked ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-teal-50 text-teal-800 border border-teal-300 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Frozen & Locked for Payroll
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                <Unlock className="w-3 h-3" /> Open / Unlocked (HR Review Active)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Sole transactional contract between HR and Accounts for payable days and LOP deductions
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(m => (m === 1 ? 12 : m - 1))}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-xs text-slate-800 min-w-36 text-center">
            {getMonthName(month)} {year}
          </div>
          <button
            onClick={() => setMonth(m => (m === 12 ? 1 : m + 1))}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contract Explanation Banner */}
      <div className="p-4 rounded-xl bg-slate-900 text-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-teal-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-white">The HR ↔ Accounts Architectural Contract</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-3xl">
              "The <code className="bg-slate-800 px-1 py-0.5 rounded text-teal-300">monthly_attendance_summary</code> table is the sole contract between HR and Accounts. HR verifies shifts, regularizations and leaves, then locks the month. Accounts reads the locked summary to calculate Loss of Pay (LOP) deductions. HR has zero access to salary tables."
            </p>
          </div>
        </div>

        <div className="flex-shrink-0">
          {!isMonthLocked ? (
            <button
              onClick={handleLockAttendance}
              disabled={locking || summaries.length === 0}
              className="w-full md:w-auto px-4 py-2.5 rounded-lg font-bold text-xs bg-teal-600 hover:bg-teal-500 text-white shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {locking ? 'Freezing Ledger...' : 'Lock Month for Payroll'}
            </button>
          ) : (
            <button
              onClick={() => setShowUnlockModal(true)}
              className="w-full md:w-auto px-3.5 py-2 rounded-lg font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-colors flex items-center justify-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              Emergency Unlock
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Headcount in Register</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{summaries.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Payable Days</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{totalPayable}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Loss of Pay (LOP)</span>
          <div className="text-2xl font-bold text-rose-700 mt-1">{totalLopDays} Days</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Lock Status</span>
          <div className="text-sm font-bold text-slate-800 mt-2">
            {isMonthLocked ? `Locked by ${summaries[0]?.lockedBy || 'HR'}` : 'Unlocked / Editable'}
          </div>
        </div>
      </div>

      {/* Register Table */}
      {loading ? (
        <SkeletonLoader type="table" rows={5} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5 text-center">Calendar Days</th>
                  <th className="px-5 py-3.5 text-center">Present Days</th>
                  <th className="px-5 py-3.5 text-center">Approved Leaves</th>
                  <th className="px-5 py-3.5 text-center">Week-Offs & Holidays</th>
                  <th className="px-5 py-3.5 text-center">LOP Days</th>
                  <th className="px-5 py-3.5 text-center font-bold text-slate-900">Payable Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{s.employeeName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{s.employeeCode}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{s.departmentName}</td>
                    <td className="px-5 py-4 text-center font-mono">{s.totalDays}</td>
                    <td className="px-5 py-4 text-center font-mono text-emerald-700 font-medium">
                      {s.presentDays}
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-sky-700 font-medium">
                      {s.leaveDays}
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-slate-600">
                      {s.weekOffDays + s.holidayDays}
                    </td>
                    <td className="px-5 py-4 text-center font-mono font-bold text-rose-700">
                      {s.lopDays > 0 ? `${s.lopDays}d LOP` : '0'}
                    </td>
                    <td className="px-5 py-4 text-center font-mono font-extrabold text-teal-800 text-sm bg-teal-50/30">
                      {s.payableDays}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Emergency Unlock Modal */}
      {showUnlockModal && (
        <Modal
          isOpen={showUnlockModal}
          onClose={() => setShowUnlockModal(false)}
          title="Emergency Attendance Unlock Request"
          subtitle="Unfreezing locked attendance invalidates downstream payroll drafts"
        >
          <form onSubmit={handleUnlockRequest} className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Reopening attendance allows attendance modifications but will require Accounts to re-verify LOP and re-run draft payslips. This action is logged in the system audit trail.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Audit Reason for Unlock <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={unlockReason}
                onChange={e => setUnlockReason(e.target.value)}
                placeholder="e.g. Retroactive regularization approved for phlebotomist Dr. Rajesh Kumar due to verified hospital duty..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700"
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={unlocking}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              >
                {unlocking ? 'Unlocking...' : 'Confirm Emergency Unlock'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
