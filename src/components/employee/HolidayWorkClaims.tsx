import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { overtimeApi, type EligibleOffDay } from '../../api/overtime';
import type { HolidayWorkClaim, HolidayWorkCompensation } from '../../types';
import { OVERTIME_POLICY } from '../../config/policy';
import { formatDate } from '../../utils/dateUtils';
import { CalendarHeart, Coins, CalendarPlus, Undo2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { StatusPill } from '../common/StatusPill';
import { PageHeader, EmptyState, inputClass, labelClass, primaryBtn, secondaryBtn, cardClass, tableHeadClass } from '../common/PageHeader';

export const HolidayWorkClaims: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState<EligibleOffDay[]>([]);
  const [claims, setClaims] = useState<HolidayWorkClaim[]>([]);
  const [claiming, setClaiming] = useState<EligibleOffDay | null>(null);
  const [choice, setChoice] = useState<HolidayWorkCompensation>('COMP_OFF');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [e, c] = await Promise.all([overtimeApi.getMyEligibleDays(), overtimeApi.getMyClaims()]);
      setEligible(e);
      setClaims(c);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load holiday work', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claiming) return;
    setSaving(true);
    try {
      await overtimeApi.submitClaim(claiming, choice, reason);
      showToast('Claim submitted', `Sent to ${currentUser?.managerName ?? 'your manager'} for approval.`, 'success');
      setClaiming(null);
      setReason('');
      load();
    } catch (err: any) {
      showToast('Could not submit', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async (c: HolidayWorkClaim) => {
    try {
      await overtimeApi.withdrawClaim(c.id);
      showToast('Claim withdrawn', `${formatDate(c.workDate)} can be claimed again.`, 'info');
      load();
    } catch (err: any) {
      showToast('Could not withdraw', err.message, 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Comp-off & Overtime"
        subtitle={`Worked on a Sunday or holiday? Choose a comp-off day or overtime pay (${OVERTIME_POLICY.payMultiplier}× a day's salary). Claim within ${OVERTIME_POLICY.claimWindowDays} days.`}
      />

      {loading ? (
        <SkeletonLoader rows={4} />
      ) : (
        <>
          <div className={`${cardClass} p-5`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Days you can claim</h2>
            {eligible.length === 0 ? (
              <p className="text-xs text-slate-500">
                No unclaimed Sundays or holidays with at least a half day of punched work in the last {OVERTIME_POLICY.claimWindowDays} days.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {eligible.map(d => (
                  <li key={d.date} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatDate(d.date)} · {d.reason}
                      </div>
                      <div className="text-[12.5px] text-slate-500">
                        Worked {d.workedHours}h → {d.days === 1 ? 'full day' : 'half day'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setClaiming(d);
                        setChoice('COMP_OFF');
                        setReason('');
                      }}
                      className={primaryBtn}
                    >
                      <CalendarHeart className="w-4 h-4" /> Claim
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {claims.length === 0 ? (
            <EmptyState icon={CalendarHeart} title="No claims yet" />
          ) : (
            <div className={`${cardClass} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-4 py-3">Date worked</th>
                      <th className="px-4 py-3">Chosen</th>
                      <th className="px-4 py-3 text-center">Days</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Approver</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {claims.map(c => (
                      <tr key={c.id}>
                        <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{formatDate(c.workDate)}</td>
                        <td className="px-4 py-2.5">{c.compensation === 'COMP_OFF' ? 'Comp-off day' : 'Overtime pay'}</td>
                        <td className="px-4 py-2.5 text-center">{c.days}</td>
                        <td className="px-4 py-2.5">
                          <StatusPill status={c.status} />
                        </td>
                        <td className="px-4 py-2.5 text-[12.5px] text-slate-500">
                          {c.approverName ?? '—'}
                          {c.approverRemarks && ` · ${c.approverRemarks}`}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {c.status === 'PENDING' && (
                            <button onClick={() => withdraw(c)} className="text-xs font-semibold text-slate-500 hover:text-rose-600 inline-flex items-center gap-1">
                              <Undo2 className="w-3.5 h-3.5" /> Withdraw
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={!!claiming}
        onClose={() => setClaiming(null)}
        title={claiming ? `Claim ${formatDate(claiming.date)}` : ''}
        subtitle={claiming ? `${claiming.reason} · ${claiming.days === 1 ? 'full day' : 'half day'} worked` : undefined}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['COMP_OFF', CalendarPlus, 'Comp-off day', `${claiming?.days ?? 1} day added to your comp-off leave balance`],
                ['OVERTIME', Coins, 'Overtime pay', `${OVERTIME_POLICY.payMultiplier}× a day's salary added to this month's payslip`]
              ] as const
            ).map(([id, Icon, title, hint]) => (
              <button
                type="button"
                key={id}
                onClick={() => setChoice(id)}
                className={`p-3 rounded-lg border text-left ${
                  choice === id
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/50 ring-1 ring-teal-600'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="w-5 h-5 text-teal-700 dark:text-teal-400 mb-1" />
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{title}</div>
                <div className="text-[12.5px] text-slate-500 mt-0.5">{hint}</div>
              </button>
            ))}
          </div>
          <div>
            <label className={labelClass}>What did you work on?</label>
            <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} className={inputClass} placeholder="Covered OPD shift / month-end closing" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setClaiming(null)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryBtn}>
              {saving ? 'Submitting…' : 'Submit for approval'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
