import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePendingCounts } from '../../context/PendingCountsContext';
import { teamApi } from '../../api';
import { AttendanceRegularization } from '../../types';
import { formatDate, formatTime, toClockHm } from '../../utils/dateUtils';
import { SHIFT_POLICY } from '../../config/policy';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

type Scope = 'MINE' | 'HR_QUEUE' | 'ALL';

/** Hours between two "HH:MM" times, or null if either is unreadable or out is not after in. */
function requestedHours(reg: AttendanceRegularization): number | null {
  const from = toClockHm(reg.requestedIn);
  const to = toClockHm(reg.requestedOut);
  if (!from || !to) return null;
  const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
  const diff = mins(to) - mins(from);
  return diff > 0 ? Number((diff / 60).toFixed(1)) : null;
}

const dayCredit = (hours: number | null) =>
  hours == null ? 'Invalid times' : hours >= SHIFT_POLICY.fullDayHours ? 'Full day' : hours >= SHIFT_POLICY.halfDayHours ? 'Half day' : 'Unpaid (short day)';

export const TeamRegularization: React.FC = () => {
  const { currentUser, showToast, isHr, isManager } = useAuth();
  const { refresh: refreshCounts } = usePendingCounts();
  const [scope, setScope] = useState<Scope>(isHr && !isManager ? 'HR_QUEUE' : 'MINE');
  const [loading, setLoading] = useState(true);
  const [regList, setRegList] = useState<AttendanceRegularization[]>([]);
  const [actingId, setActingId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<AttendanceRegularization | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const fetchRegularizations = async () => {
    try {
      setLoading(true);
      setRegList(await teamApi.getPendingRegularizations(scope));
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load regularizations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegularizations();
  }, [currentUser?.id, scope]);

  // HR acting on a request outside their own team is an override.
  const asHr = (reg: AttendanceRegularization) => isHr && reg.approverId !== currentUser?.id;

  const runAction = async (reg: AttendanceRegularization, action: 'APPROVE' | 'REJECT', remarks?: string) => {
    setActingId(reg.id);
    try {
      await teamApi.actionRegularization(reg.id, action, remarks, { asHr: asHr(reg) });
      showToast(
        action === 'APPROVE' ? 'Time Update Approved' : 'Time Update Rejected',
        action === 'APPROVE'
          ? `${reg.employeeName}'s attendance for ${formatDate(reg.workDate)} now shows ${toClockHm(reg.requestedIn)}–${toClockHm(reg.requestedOut)}.`
          : `${reg.employeeName} can see your remarks on their attendance page.`,
        action === 'APPROVE' ? 'success' : 'info'
      );
      setRejecting(null);
      setRejectRemarks('');
      fetchRegularizations();
      refreshCounts();
    } catch (err: any) {
      showToast('Action Failed', err.message || 'Action failed', 'error');
    } finally {
      setActingId(null);
    }
  };

  const handleRejectConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejecting) return;
    if (!rejectRemarks.trim()) {
      showToast('Remarks Required', 'Tell the employee why the time update is rejected.', 'error');
      return;
    }
    runAction(rejecting, 'REJECT', rejectRemarks);
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">Attendance Regularization Queue</h1>
            <span
              data-testid="reg-pending-count"
              className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70"
            >
              {regList.length} Pending
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Approving writes the requested times onto the employee's attendance for payroll. Rejections need a reason.
          </p>
          {isHr && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(
                [
                  ['MINE', 'My team'],
                  ['HR_QUEUE', 'HR queue (no manager)'],
                  ['ALL', 'All pending (HR override)']
                ] as Array<[Scope, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScope(id)}
                  className={`px-2.5 py-1 rounded-lg text-[12.5px] font-semibold ${
                    scope === id ? 'bg-teal-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={fetchRegularizations}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
        >
          Refresh Queue
        </button>
      </div>

      {loading ? (
        <SkeletonLoader rows={4} />
      ) : regList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Pending Regularizations</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {scope === 'MINE' ? 'Your team has no unresolved punch disputes.' : 'No pending requests in this queue.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {regList.map(reg => {
            const hours = requestedHours(reg);
            return (
              <div
                key={reg.id}
                data-testid={`reg-card-${reg.id}`}
                className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{reg.employeeName}</span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-2">({reg.employeeCode})</span>
                    {scope !== 'MINE' && (
                      <span className="text-[11.5px] text-slate-500 dark:text-slate-400 ml-2">
                        Approver: {reg.approverName || 'none (HR)'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Work Date: <span className="font-bold text-slate-900 dark:text-slate-100">{formatDate(reg.workDate)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[12.5px]">On record</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {reg.currentPunchIn ? formatTime(reg.currentPunchIn) : '—'} → {reg.currentPunchOut ? formatTime(reg.currentPunchOut) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[12.5px]">Requested Punch In</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{toClockHm(reg.requestedIn) ?? reg.requestedIn}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[12.5px]">Requested Punch Out</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{toClockHm(reg.requestedOut) ?? reg.requestedOut}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[12.5px]">Payroll effect</span>
                    <span className={`font-bold ${hours != null && hours >= SHIFT_POLICY.halfDayHours ? 'text-teal-700 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {hours != null ? `${hours}h · ` : ''}{dayCredit(hours)}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block text-[12.5px] mb-0.5">
                    Reason for missed punch:
                  </span>
                  <p>{reg.reason}</p>
                </div>

                {hours == null && (
                  <div className="text-[12.5px] text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> The requested times are invalid — reject and ask the employee to resubmit.
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    data-testid={`reg-reject-${reg.id}`}
                    onClick={() => setRejecting(reg)}
                    disabled={actingId === reg.id}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button
                    type="button"
                    data-testid={`reg-approve-${reg.id}`}
                    onClick={() => runAction(reg, 'APPROVE')}
                    disabled={actingId === reg.id || hours == null}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {actingId === reg.id ? 'Saving...' : 'Approve Regularization'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejecting && (
        <Modal
          isOpen={!!rejecting}
          onClose={() => setRejecting(null)}
          title={`Reject Time Update: ${rejecting.employeeName}`}
          subtitle={`${formatDate(rejecting.workDate)} • The employee will see your remarks.`}
        >
          <form onSubmit={handleRejectConfirm} className="space-y-4">
            <div>
              <label htmlFor="reg-reject-remarks" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Rejection Remarks <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <textarea
                id="reg-reject-remarks"
                rows={3}
                value={rejectRemarks}
                onChange={e => setRejectRemarks(e.target.value)}
                placeholder="e.g. Biometric log shows no entry before 11:00 — please apply half-day leave instead."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                required
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actingId === rejecting.id}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {actingId === rejecting.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
