import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { resignationsApi } from '../../api/resignations';
import { NOTICE_PERIOD_POLICY } from '../../config/policy';
import { PageHeader } from '../common/PageHeader';
import { StatusPill } from '../common/StatusPill';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { formatDate } from '../../utils/dateUtils';
import type { Resignation } from '../../types';
import {
  FileText,
  AlertTriangle,
  Send,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Users,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

export const ResignationView: React.FC = () => {
  const { currentUser, isHr, isManager, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myResignation, setMyResignation] = useState<Resignation | null>(null);

  // Form state
  const defaultLwd = new Date();
  defaultLwd.setDate(defaultLwd.getDate() + NOTICE_PERIOD_POLICY.defaultDays);
  const defaultLwdStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(defaultLwd);

  const [reason, setReason] = useState('');
  const [requestedLwd, setRequestedLwd] = useState(defaultLwdStr);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // HR / Manager review queue
  const [activeTab, setActiveTab] = useState<'my' | 'team' | 'hr'>('my');
  const [queue, setQueue] = useState<Resignation[]>([]);
  const [selectedResignation, setSelectedResignation] = useState<Resignation | null>(null);
  const [reviewAction, setReviewAction] = useState<'ACCEPT' | 'REJECT' | null>(null);
  const [confirmedLwd, setConfirmedLwd] = useState('');
  const [reviewComments, setReviewComments] = useState('');
  const [actioning, setActioning] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await resignationsApi.getMyResignation();
      setMyResignation(res);

      if (isHr || isManager) {
        const all = await resignationsApi.getAllResignations();
        setQueue(all);
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load resignation details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id, isHr, isManager]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      showToast('Validation Error', 'Please enter your reason for resignation.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await resignationsApi.submitResignation({
        reason,
        requestedLwd,
        noticeDays: NOTICE_PERIOD_POLICY.defaultDays
      });
      showToast('Resignation Submitted', 'Your formal resignation request has been forwarded to your reporting authority and HR.', 'success');
      loadData();
    } catch (err: any) {
      showToast('Submission Failed', err.message || 'Could not submit resignation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (id: number) => {
    if (!confirm('Are you sure you wish to withdraw your resignation? This action will restore your active employment status.')) {
      return;
    }

    setWithdrawing(true);
    try {
      await resignationsApi.withdrawResignation(id);
      showToast('Resignation Withdrawn', 'Your resignation request has been withdrawn.', 'success');
      loadData();
    } catch (err: any) {
      showToast('Withdrawal Failed', err.message || 'Could not withdraw resignation', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResignation || !reviewAction) return;

    setActioning(true);
    try {
      if (isHr) {
        await resignationsApi.hrAction(
          selectedResignation.id,
          reviewAction,
          confirmedLwd || selectedResignation.requestedLwd,
          reviewComments
        );
        showToast('Decision Recorded', `Resignation ${reviewAction === 'ACCEPT' ? 'accepted' : 'rejected'}.`, 'success');
      } else if (isManager) {
        await resignationsApi.managerAction(
          selectedResignation.id,
          reviewAction,
          reviewComments
        );
        showToast('Decision Recorded', `Manager recommendation recorded as ${reviewAction}.`, 'success');
      }
      setSelectedResignation(null);
      setReviewAction(null);
      setReviewComments('');
      loadData();
    } catch (err: any) {
      showToast('Action Failed', err.message || 'Failed to process resignation review', 'error');
    } finally {
      setActioning(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resignation & Separation"
        subtitle="Submit formal separation notice, track handover milestones, and manage relieving workflows."
        actions={
          (isHr || isManager) ? (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('my')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'my'
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                My Notice
              </button>
              {isManager && (
                <button
                  onClick={() => setActiveTab('team')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    activeTab === 'team'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Team Resignations
                </button>
              )}
              {isHr && (
                <button
                  onClick={() => setActiveTab('hr')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    activeTab === 'hr'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  HR Review Queue ({queue.filter(q => q.status === 'SUBMITTED' || q.status === 'ACCEPTED_BY_MANAGER').length})
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {loading ? (
        <SkeletonLoader rows={4} />
      ) : activeTab === 'my' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Status or Application Form */}
          <div className="lg:col-span-2 space-y-6">
            {myResignation && myResignation.status !== 'WITHDRAWN' ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Active Separation Request
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Submitted on {formatDate(myResignation.createdAt)}
                    </p>
                  </div>
                  <StatusPill status={myResignation.status} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                    <span className="text-xs text-slate-500 font-medium">Requested Last Working Day</span>
                    <div className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      {formatDate(myResignation.requestedLwd)}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                    <span className="text-xs text-slate-500 font-medium">Confirmed Last Working Day</span>
                    <div className="text-base font-semibold text-teal-700 dark:text-teal-300 mt-1 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      {myResignation.confirmedLwd ? formatDate(myResignation.confirmedLwd) : 'Under Review'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Reason for Separation
                  </label>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    {myResignation.reason}
                  </p>
                </div>

                {myResignation.managerComments && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Reporting Manager Comments
                    </label>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                      {myResignation.managerComments}
                    </p>
                  </div>
                )}

                {myResignation.hrComments && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      HR Department Comments
                    </label>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                      {myResignation.hrComments}
                    </p>
                  </div>
                )}

                {myResignation.status === 'ACCEPTED' ? (
                  <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl text-teal-900 dark:text-teal-200 text-sm">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-5 h-5 text-teal-600" />
                      Resignation Formally Accepted
                    </div>
                    <p className="text-xs mt-1 text-teal-800 dark:text-teal-300">
                      Your exit has been scheduled for {formatDate(myResignation.confirmedLwd || myResignation.requestedLwd)}. Accounts will prepare your Full & Final (F&F) settlement, and IT will arrange asset handovers.
                    </p>
                  </div>
                ) : myResignation.status === 'SUBMITTED' ? (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => handleWithdraw(myResignation.id)}
                      disabled={withdrawing}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50 rounded-lg border border-red-200 dark:border-red-800 transition"
                    >
                      <RotateCcw className="w-4 h-4 mr-1.5" />
                      Withdraw Resignation
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Submit Formal Resignation
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Company policy requires a standard {NOTICE_PERIOD_POLICY.defaultDays}-day notice period.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Reason for Leaving *
                    </label>
                    <textarea
                      rows={4}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Please provide details regarding your decision to separate from SecondMedic..."
                      required
                      className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Requested Last Working Day (LWD) *
                    </label>
                    <input
                      type="date"
                      value={requestedLwd}
                      onChange={e => setRequestedLwd(e.target.value)}
                      required
                      className="w-full sm:w-64 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-teal-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Defaults to {NOTICE_PERIOD_POLICY.defaultDays} days from today. Early release is subject to management approval and notice recovery terms.
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition disabled:opacity-50"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {submitting ? 'Submitting...' : 'Submit Resignation Notice'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Policy & Checklist Sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                Separation Guidelines
              </h4>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2.5">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-teal-600">•</span>
                  <span><strong>Notice Period:</strong> {NOTICE_PERIOD_POLICY.defaultDays} calendar days from date of submission.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-teal-600">•</span>
                  <span><strong>Asset Handover:</strong> All assigned laptops, monitors, access cards, and company tokens must be returned to IT before the final day.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-teal-600">•</span>
                  <span><strong>Full & Final (F&F):</strong> Processed by Accounts within 30 days of last working day following clearance sign-offs.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-teal-600">•</span>
                  <span><strong>Relieving & Experience:</strong> Digital relieving and experience certificates become available in your portal upon F&F clearance.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* Team or HR Queue Table */
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {activeTab === 'hr' ? 'HR Resignation & Exit Pipeline' : 'Direct Report Resignations'}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Designation</th>
                  <th className="px-6 py-3.5">Requested LWD</th>
                  <th className="px-6 py-3.5">Confirmed LWD</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-xs">
                      No resignation records found in this queue.
                    </td>
                  </tr>
                ) : (
                  queue.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {(item as any).employee?.full_name || 'Staff Member'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {(item as any).employee?.emp_code || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                        {(item as any).employee?.designation || 'Staff'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">
                        {formatDate(item.requestedLwd)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-teal-600">
                        {item.confirmedLwd ? formatDate(item.confirmedLwd) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusPill status={item.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(item.status === 'SUBMITTED' || (isHr && item.status === 'ACCEPTED_BY_MANAGER')) && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedResignation(item);
                                setReviewAction('ACCEPT');
                                setConfirmedLwd(item.requestedLwd);
                              }}
                              className="px-2.5 py-1 text-xs font-medium bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 rounded border border-teal-200 dark:border-teal-800"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => {
                                setSelectedResignation(item);
                                setReviewAction('REJECT');
                              }}
                              className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 rounded border border-red-200 dark:border-red-800"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedResignation && reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {reviewAction === 'ACCEPT' ? 'Accept Resignation' : 'Reject Resignation'} — {(selectedResignation as any).employee?.full_name}
            </h3>

            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
              <span className="font-semibold">Reason:</span> {selectedResignation.reason}
            </div>

            {isHr && reviewAction === 'ACCEPT' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Confirmed Last Working Day (LWD)
                </label>
                <input
                  type="date"
                  value={confirmedLwd}
                  onChange={e => setConfirmedLwd(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Comments & Handover Notes
              </label>
              <textarea
                rows={3}
                value={reviewComments}
                onChange={e => setReviewComments(e.target.value)}
                placeholder="Optional notes for the record..."
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedResignation(null);
                  setReviewAction(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReviewSubmit}
                disabled={actioning}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm ${
                  reviewAction === 'ACCEPT' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actioning ? 'Saving...' : `Confirm ${reviewAction === 'ACCEPT' ? 'Acceptance' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
