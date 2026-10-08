import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { teamApi } from '../../api';
import { LeaveRequest } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { CheckCircle2, XCircle, AlertTriangle, Clock, FileText, UserCheck, MessageSquare } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const TeamApprovals: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingList, setPendingList] = useState<LeaveRequest[]>([]);
  const [actioningId, setActioningId] = useState<number | null>(null);

  // Reject modal
  const [rejectingReq, setRejectingReq] = useState<LeaveRequest | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const fetchPendingLeaves = async () => {
    try {
      setLoading(true);
      const data = await teamApi.getPendingLeaves();
      setPendingList(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load pending team leaves', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingLeaves();
  }, [currentUser]);

  const handleApprove = async (id: number) => {
    setActioningId(id);
    try {
      await teamApi.actionLeave(id, 'APPROVE');
      showToast('Leave Approved', 'Request approved. Balances deducted & notification triggered to applicant.', 'success');
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
      await teamApi.actionLeave(rejectingReq.id, 'REJECT', rejectRemarks);
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Direct Reports Leave Approvals</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {pendingList.length} Action Required
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Evaluate team leave requests against operational clinical coverage & SLA guidelines
          </p>
        </div>

        <button
          onClick={fetchPendingLeaves}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
        >
          Refresh Queue
        </button>
      </div>

      {/* Pending List */}
      {loading ? (
        <SkeletonLoader rows={4} />
      ) : pendingList.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">Inbox Zero: No Pending Approvals</h3>
          <p className="text-xs text-slate-500 mt-1">
            All direct report leave requests have been acted on.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingList.map(req => (
            <div
              key={req.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-900">{req.employeeName}</span>
                    <span className="text-xs font-mono text-slate-500">({req.employeeCode})</span>
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-teal-50 text-teal-800 border border-teal-200">
                      {req.leaveTypeName} ({req.leaveTypeCode})
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Department: <span className="font-medium text-slate-700">{req.departmentName}</span> • Applied: {formatDate(req.appliedAt)}
                  </div>
                </div>

                {/* Duration Badge */}
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Requested Duration</span>
                  <span className="text-base font-bold text-teal-900">
                    {req.totalDays} {req.totalDays === 1 ? 'Day' : 'Days'}
                  </span>
                  <span className="block text-xs font-medium text-slate-600">
                    {formatDate(req.fromDate)} – {formatDate(req.toDate)}
                  </span>
                </div>
              </div>

              {/* Conflict Warning (Crucial for clinical coverage!) */}
              {req.conflicts && req.conflicts.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Team Coverage Conflict Warning:</span>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside text-[11px] text-amber-800">
                      {req.conflicts.map((c, i) => (
                        <li key={i}>
                          <strong>{c.employeeName}</strong> is already scheduled on approved leave ({c.leaveDates}).
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Details & Reason */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 text-xs text-slate-700 space-y-1">
                <span className="font-semibold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Stated Reason:
                </span>
                <p>{req.reason}</p>
                {req.contactDuring && (
                  <p className="text-[11px] text-slate-500 pt-1">
                    Emergency Contact: <span className="font-medium text-slate-700">{req.contactDuring}</span>
                  </p>
                )}
                {req.documentName && (
                  <div className="flex items-center gap-1.5 text-teal-800 font-medium pt-1">
                    <FileText className="w-4 h-4" />
                    <span>Medical Document Attached: {req.documentName}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingReq(req)}
                  disabled={actioningId === req.id}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5"
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
                  {actioningId === req.id ? 'Approving...' : 'Approve Leave'}
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mandatory Rejection Remarks <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectRemarks}
                onChange={e => setRejectRemarks(e.target.value)}
                placeholder="e.g. Critical clinical audit scheduled on these dates; please reschedule or coordinate with alternate phlebotomist..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700"
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingReq(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100"
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
