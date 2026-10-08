import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { teamApi } from '../../api';
import { AttendanceRegularization } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { StatusPill } from '../common/StatusPill';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const TeamRegularization: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [regList, setRegList] = useState<AttendanceRegularization[]>([]);
  const [actingId, setActingId] = useState<number | null>(null);

  const fetchRegularizations = async () => {
    try {
      setLoading(true);
      const data = await teamApi.getPendingRegularizations();
      setRegList(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load regularizations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegularizations();
  }, [currentUser]);

  const handleAction = async (id: number, action: 'APPROVE' | 'REJECT') => {
    setActingId(id);
    try {
      await teamApi.actionRegularization(id, action);
      showToast(
        `Regularization ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`,
        `Attendance record updated for reporting employee.`,
        action === 'APPROVE' ? 'success' : 'info'
      );
      fetchRegularizations();
    } catch (err: any) {
      showToast('Error', err.message || 'Action failed', 'error');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Attendance Regularization Queue</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {regList.length} Pending
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Resolve biometric / network missed punches for payroll compliance
          </p>
        </div>
      </div>

      {loading ? (
        <SkeletonLoader rows={4} />
      ) : regList.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No Pending Regularizations</h3>
          <p className="text-xs text-slate-500 mt-1">
            Your team has no unresolved punch disputes.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {regList.map(reg => (
            <div
              key={reg.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-bold text-slate-900">{reg.employeeName}</span>
                  <span className="text-xs font-mono text-slate-500 ml-2">({reg.employeeCode})</span>
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  Work Date: <span className="font-bold text-slate-900">{formatDate(reg.workDate)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Requested Punch In</span>
                  <span className="font-bold text-slate-800 font-mono">{reg.requestedIn}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Requested Punch Out</span>
                  <span className="font-bold text-slate-800 font-mono">{reg.requestedOut}</span>
                </div>
              </div>

              <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-800 block text-[11px] uppercase tracking-wider mb-0.5">
                  Reason for missed punch:
                </span>
                <p>{reg.reason}</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleAction(reg.id, 'REJECT')}
                  disabled={actingId === reg.id}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(reg.id, 'APPROVE')}
                  disabled={actingId === reg.id}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve Regularization
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
