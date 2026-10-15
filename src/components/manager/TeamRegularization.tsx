import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { teamApi } from '../../api';
import { AttendanceRegularization } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { StatusPill } from '../common/StatusPill';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const TeamRegularization: React.FC = () => {
  const { currentUser, showToast, isHr } = useAuth();
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
  }, [currentUser?.id]);

  const handleAction = async (id: number, action: 'APPROVE' | 'REJECT') => {
    setActingId(id);
    try {
      await teamApi.actionRegularization(id, action, { asHr: isHr });
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
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">Attendance Regularization Queue</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70">
              {regList.length} Pending
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Resolve biometric / network missed punches for payroll compliance
          </p>
        </div>
      </div>

      {loading ? (
        <SkeletonLoader rows={4} />
      ) : regList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Pending Regularizations</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Your team has no unresolved punch disputes.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {regList.map(reg => (
            <div
              key={reg.id}
              className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{reg.employeeName}</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-2">({reg.employeeCode})</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Work Date: <span className="font-bold text-slate-900 dark:text-slate-100">{formatDate(reg.workDate)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[12.5px]">Requested Punch In</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{reg.requestedIn}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[12.5px]">Requested Punch Out</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{reg.requestedOut}</span>
                </div>
              </div>

              <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block text-[12.5px] mb-0.5">
                  Reason for missed punch:
                </span>
                <p>{reg.reason}</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleAction(reg.id, 'REJECT')}
                  disabled={actingId === reg.id}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 transition-colors flex items-center gap-1"
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
