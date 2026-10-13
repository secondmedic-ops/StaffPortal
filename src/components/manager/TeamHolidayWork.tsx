import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { overtimeApi } from '../../api/overtime';
import type { HolidayWorkClaim } from '../../types';
import { OVERTIME_POLICY } from '../../config/policy';
import { formatDate } from '../../utils/dateUtils';
import { CheckCircle2, XCircle, CalendarHeart } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { PageHeader, EmptyState, inputClass, labelClass, primaryBtn, secondaryBtn, cardClass } from '../common/PageHeader';

export const TeamHolidayWork: React.FC = () => {
  const { currentUser, showToast, isHr, isManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<HolidayWorkClaim[]>([]);
  const [acting, setActing] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<HolidayWorkClaim | null>(null);
  const [remarks, setRemarks] = useState('');

  const asHr = isHr && !isManager;

  const load = async () => {
    try {
      setLoading(true);
      setClaims(await overtimeApi.getPendingClaims(isHr));
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load claims', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser]);

  const act = async (c: HolidayWorkClaim, action: 'APPROVE' | 'REJECT', note?: string) => {
    setActing(c.id);
    try {
      await overtimeApi.actionClaim(c, action, note);
      showToast(
        action === 'APPROVE' ? 'Claim approved' : 'Claim rejected',
        action === 'APPROVE'
          ? c.compensation === 'COMP_OFF'
            ? `${c.days} comp-off day credited to ${c.employeeName}.`
            : `Overtime will be paid in ${c.employeeName}'s payslip for ${formatDate(c.workDate).slice(3)}.`
          : undefined,
        action === 'APPROVE' ? 'success' : 'info'
      );
      setRejecting(null);
      load();
    } catch (err: any) {
      showToast('Action failed', err.message, 'error');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Comp-off & Overtime Approvals"
        subtitle={`Sunday / holiday work claimed by ${asHr ? 'staff' : 'your team'}. Comp-off credits leave; overtime pays ${OVERTIME_POLICY.payMultiplier}× a day's salary.`}
      />

      {loading ? (
        <SkeletonLoader rows={4} />
      ) : claims.length === 0 ? (
        <EmptyState icon={CalendarHeart} title="No pending claims" />
      ) : (
        <div className="space-y-3">
          {claims.map(c => (
            <div key={c.id} className={`${cardClass} p-4 flex flex-col md:flex-row md:items-center justify-between gap-3`}>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{c.employeeName}</span>
                  <span className="text-[11px] font-mono text-slate-500">{c.employeeCode}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      c.compensation === 'COMP_OFF'
                        ? 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    {c.compensation === 'COMP_OFF' ? 'Comp-off' : 'Overtime pay'} · {c.days} day
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Worked {formatDate(c.workDate)}
                  {c.workedHours != null && ` · ${c.workedHours}h punched`}
                </div>
                {c.reason && <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">“{c.reason}”</div>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRejecting(c);
                    setRemarks('');
                  }}
                  disabled={acting === c.id}
                  className={secondaryBtn}
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button onClick={() => act(c, 'APPROVE')} disabled={acting === c.id} className={primaryBtn}>
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} title={`Reject claim · ${rejecting?.employeeName ?? ''}`}>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (rejecting) act(rejecting, 'REJECT', remarks);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Reason *</label>
            <textarea rows={3} required value={remarks} onChange={e => setRemarks(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRejecting(null)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" className={primaryBtn}>
              Reject
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
