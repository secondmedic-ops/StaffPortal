import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { meApi } from '../../api';
import { LeaveRequest } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { StatusPill } from '../common/StatusPill';
import { SkeletonLoader } from '../common/SkeletonLoader';
import {
  Clock,
  ChevronDown,
  ChevronUp,
  XCircle,
  FileText,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const MyLeaveRequests: React.FC = () => {
  const { currentUser, setActiveNav, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await meApi.getLeaveRequests();
      setRequests(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load leave history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [currentUser]);

  const handleWithdraw = async (requestId: number) => {
    if (!confirm('Are you sure you want to withdraw this leave request? Reserved days will be credited back.')) {
      return;
    }

    setWithdrawingId(requestId);
    try {
      await meApi.withdrawLeaveRequest(requestId);
      showToast('Request Withdrawn', 'Leave application cancelled. Quota reserved days have been released back.', 'info');
      fetchRequests();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to withdraw leave request', 'error');
    } finally {
      setWithdrawingId(null);
    }
  };

  const filtered = requests.filter(r => {
    if (filterStatus === 'ALL') return true;
    return r.status === filterStatus;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Leave Applications</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track status, multi-tier approval timeline, and withdraw active requests
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  filterStatus === st ? 'bg-white text-teal-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={() => setActiveNav('apply-leave')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-xs"
          >
            + Apply Leave
          </button>
        </div>
      </div>

      {/* Requests Table */}
      {loading ? (
        <SkeletonLoader type="table" rows={4} />
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No Leave Requests Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {filterStatus === 'ALL'
              ? 'You have not submitted any leave applications yet.'
              : `No requests with status "${filterStatus}".`}
          </p>
          <button
            onClick={() => setActiveNav('apply-leave')}
            className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800"
          >
            Apply for Leave Now
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="px-5 py-3">Leave Type</th>
                  <th className="px-5 py-3">Dates</th>
                  <th className="px-5 py-3">Days</th>
                  <th className="px-5 py-3">Applied On</th>
                  <th className="px-5 py-3">Current Approver</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(req => {
                  const isExpanded = expandedId === req.id;
                  return (
                    <React.Fragment key={req.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : req.id)}
                        className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-teal-50/20' : ''
                        }`}
                      >
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          <span className="inline-block font-bold text-teal-800 mr-1.5">
                            [{req.leaveTypeCode}]
                          </span>
                          {req.leaveTypeName}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900">
                            {formatDate(req.fromDate)} – {formatDate(req.toDate)}
                          </div>
                          {(req.fromHalf || req.toHalf) && (
                            <span className="text-[10px] text-amber-700 font-medium">
                              Half day tagged
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-900">
                          {req.totalDays} {req.totalDays === 1 ? 'day' : 'days'}
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-mono">
                          {formatDate(req.appliedAt)}
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-medium text-slate-800">{req.currentApproverName}</span>
                          <span className="block text-[10px] text-slate-400">Level {req.currentLevel}</span>
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill status={req.status} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setExpandedId(isExpanded ? null : req.id);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-600"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Row with Timeline & Reason */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-6 py-4 border-t border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              {/* Reason & Details */}
                              <div className="space-y-2">
                                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                                  Application Reason
                                </span>
                                <p className="text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                                  {req.reason}
                                </p>
                                {req.contactDuring && (
                                  <p className="text-[11px] text-slate-500">
                                    <span className="font-medium">Emergency Contact:</span> {req.contactDuring}
                                  </p>
                                )}
                                {req.documentName && (
                                  <div className="flex items-center gap-2 text-teal-800 bg-white p-2 rounded-lg border border-slate-200 w-fit">
                                    <FileText className="w-4 h-4" />
                                    <span className="font-medium">{req.documentName}</span>
                                  </div>
                                )}
                              </div>

                              {/* Approver Timeline */}
                              <div className="md:col-span-2 space-y-2">
                                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                                  Approval Chain & Audit Trail
                                </span>
                                <div className="space-y-2">
                                  {req.timeline.map((step, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-start gap-3 p-2.5 rounded-lg bg-white border border-slate-200"
                                    >
                                      <div className="mt-0.5">
                                        {step.action === 'APPROVED' ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        ) : step.action === 'REJECTED' ? (
                                          <XCircle className="w-4 h-4 text-rose-600" />
                                        ) : (
                                          <Clock className="w-4 h-4 text-amber-500" />
                                        )}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                          <span className="font-semibold text-slate-900">
                                            {step.approverName} ({step.approverRole})
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            {step.actedAt ? formatDate(step.actedAt) : 'Pending Action'}
                                          </span>
                                        </div>
                                        {step.remarks && (
                                          <p className="text-slate-600 mt-1 italic">
                                            "{step.remarks}"
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Withdraw action if still pending */}
                                {req.status === 'PENDING' && (
                                  <div className="pt-2 flex justify-end">
                                    <button
                                      onClick={() => handleWithdraw(req.id)}
                                      disabled={withdrawingId === req.id}
                                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      {withdrawingId === req.id ? 'Cancelling...' : 'Withdraw / Cancel Request'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
