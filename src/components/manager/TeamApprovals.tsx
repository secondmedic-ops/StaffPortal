import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { teamApi } from '../../api';
import { LeaveRequest } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { CheckCircle2, XCircle, AlertTriangle, Clock, FileText, UserCheck, MessageSquare } from 'lucide-react';
import { Modal } from '../common/Modal';

import { SkeletonLoader } from '../common/SkeletonLoader';

type Scope = 'MINE' | 'HR_QUEUE' | 'ALL';

export const TeamApprovals: React.FC = () => {
  const { currentUser, showToast, isHr } = useAuth();
  const [scope, setScope] = useState<Scope>('MINE');
  const [loading, setLoading] = useState(true);
  const [pendingList, setPendingList] = useState<LeaveRequest[]>([]);
  const [actioningId, setActioningId] = useState<number | null>(null);

  // Reject modal
  const [rejectingReq, setRejectingReq] = useState<LeaveRequest | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const fetchPendingLeaves = async () => {
    try {
      setLoading(true);
      const data = await teamApi.getPendingLeaves(scope);
      setPendingList(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load pending team leaves', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingLeaves();
  }, [currentUser?.id, scope]);

  const asHr = (req: LeaveRequest) => isHr && req.currentApproverId !== currentUser?.id;

  const handleApprove = async (id: number) => {
    setActioningId(id);
    try {
      const req = pendingList.find(r => r.id === id);
      const { forwardedTo } = await teamApi.actionLeave(id, 'APPROVE', undefined, { asHr: req ? asHr(req) : false });
      showToast(
        forwardedTo ? 'Approved — forwarded' : 'Leave Approved',
        'Request approved and leave balance updated.',
        'success'
      );
      fetchPendingLeaves();
    } catch (err: any) {
      showToast('Action Failed', err.message || 'Could not approve leave', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReq) return;
    if (!rejectRemarks.trim()) {
      showToast('Mandatory Remarks', 'Please provide a clear reason for rejecting the leave request.', 'error');
      return;
    }

    setActioningId(rejectingReq.id);
    try {
      await teamApi.actionLeave(rejectingReq.id, 'REJECT', rejectRemarks, { asHr: asHr(rejectingReq) });
      showToast('Leave Rejected', 'Request rejected and reserved days released back.', 'info');
      setRejectingReq(null);
      setRejectRemarks('');
      fetchPendingLeaves();
    } catch (err: any) {
      showToast('Action Failed', err.message || 'Could not reject leave', 'error');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">Leave Approvals</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70">
              {pendingList.length} Action Required
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Requests are approved directly by the reporting authority. HR is notified by email.
          </p>
          {isHr && (
            <div className="flex gap-1.5 mt-3">
              {(
                [
                  ['MINE', 'Waiting on me'],
                  ['HR_QUEUE', 'HR queue (no manager)'],
                  ['ALL', 'All pending (HR override)']
                ] as Array<[Scope, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
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
          onClick={fetchPendingLeaves}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
        >
          Refresh Queue
        </button>
      </div>

      {/* Pending List */}
      {loading ? (
        <SkeletonLoader rows={4} />
      ) : pendingList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Inbox Zero: No Pending Approvals</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {scope === 'MINE' ? 'Nothing is waiting on you in your reporting line.' : 'No pending requests in this queue.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingList.map(req => (
            <div
              key={req.id}
              className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-900 dark:text-slate-100">{req.employeeName}</span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">({req.employeeCode})</span>
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/70">
                      {req.leaveTypeName} ({req.leaveTypeCode})
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Department: <span className="font-medium text-slate-700 dark:text-slate-300">{req.departmentName}</span> • Applied: {formatDate(req.appliedAt)}
                  </div>
                </div>

                {/* Duration Badge */}
                <div className="text-right">
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Requested Duration</span>
                  <span className="text-base font-bold text-teal-900 dark:text-teal-200">
                    {req.totalDays} {req.totalDays === 1 ? 'Day' : 'Days'}
                  </span>
                  <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {formatDate(req.fromDate)} – {formatDate(req.toDate)}
                  </span>
                </div>
              </div>

              {/* Conflict Warning (Crucial for clinical coverage!) */}
              {req.conflicts && req.conflicts.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Team Coverage Conflict Warning:</span>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside text-[12.5px] text-amber-800 dark:text-amber-300">
                      {req.conflicts.map((c, i) => (
                        <li key={i}>
                          <strong>{c.employeeName}</strong> is already scheduled on approved leave ({c.leaveDates}).
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Approval chain */}
              <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                <UserCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                {req.timeline.length === 0 ? (
                  <span className="text-slate-500 dark:text-slate-400">Awaiting {req.currentApproverName ?? 'HR'}</span>
                ) : (
                  req.timeline.map((step, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded-full border ${
                        step.action === 'APPROVED'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                          : step.action === 'REJECTED'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/70'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70'
                      }`}
                    >
                      L{step.level} · {step.approverName ?? 'HR'} · {step.action.toLowerCase()}
                    </span>
                  ))
                )}
                {asHr(req) && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/70 font-semibold">
                    You are acting as HR override
                  </span>
                )}
              </div>

              {/* Details & Reason */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block text-[12.5px]">
                  Stated Reason:
                </span>
                <p>{req.reason}</p>
                {req.contactDuring && (
                  <p className="text-[12.5px] text-slate-500 dark:text-slate-400 pt-1">
                    Emergency Contact: <span className="font-medium text-slate-700 dark:text-slate-300">{req.contactDuring}</span>
                  </p>
                )}
                {req.documentName && (
                  <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-medium pt-1">
                    <FileText className="w-4 h-4" />
                    <span>Medical Document Attached: {req.documentName}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRejectingReq(req)}
                  disabled={actioningId === req.id}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 transition-colors flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Reject Request
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(req.id)}
                  disabled={actioningId === req.id}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {actioningId === req.id
                    ? 'Approving...'
                    : 'Approve Leave'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mandatory Remarks Modal on Reject */}
      {rejectingReq && (
        <Modal
          isOpen={!!rejectingReq}
          onClose={() => setRejectingReq(null)}
          title={`Reject Leave: ${rejectingReq.employeeName}`}
          subtitle="A clear explanation is required by HR policy when turning down a leave request."
        >
          <form onSubmit={handleRejectConfirm} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mandatory Rejection Remarks <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectRemarks}
                onChange={e => setRejectRemarks(e.target.value)}
                placeholder="e.g. Critical clinical audit scheduled on these dates; please reschedule or coordinate with alternate phlebotomist..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingReq(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actioningId === rejectingReq.id}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700"
              >
                {actioningId === rejectingReq.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
