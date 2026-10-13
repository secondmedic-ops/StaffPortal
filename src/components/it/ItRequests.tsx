import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { itApi } from '../../api';
import type { ItRequest, ItRequestStatus } from '../../types';
import { formatDateTime } from '../../utils/dateUtils';
import { Inbox, PlayCircle, CheckCircle2, XCircle, UserPlus, UserMinus, Wrench, KeyRound, Package } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { StatusPill } from '../common/StatusPill';
import { PageHeader, EmptyState, inputClass, labelClass, primaryBtn, secondaryBtn, cardClass } from '../common/PageHeader';

export const REQUEST_TYPE_META: Record<ItRequest['requestType'], { label: string; icon: React.ElementType }> = {
  ONBOARDING: { label: 'New joiner setup', icon: UserPlus },
  OFFBOARDING: { label: 'Exit clearance', icon: UserMinus },
  NEW_ASSET: { label: 'New asset', icon: Package },
  REPAIR: { label: 'Repair / issue', icon: Wrench },
  ACCESS: { label: 'Access request', icon: KeyRound },
  OTHER: { label: 'Other', icon: Inbox }
};

const PRIORITY_CLASS: Record<ItRequest['priority'], string> = {
  HIGH: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
};

export const ItRequests: React.FC = () => {
  const { currentUser, showToast, setActiveNav } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ItRequest[]>([]);
  const [tab, setTab] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE');
  const [closing, setClosing] = useState<{ req: ItRequest; status: ItRequestStatus } | null>(null);
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setRequests(await itApi.getRequests());
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load IT requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser]);

  const visible = useMemo(
    () =>
      requests
        .filter(r => (tab === 'ACTIVE' ? r.status === 'OPEN' || r.status === 'IN_PROGRESS' : r.status === 'DONE' || r.status === 'CANCELLED'))
        .sort((a, b) => {
          const p = { HIGH: 0, MEDIUM: 1, LOW: 2 };
          return tab === 'ACTIVE' ? p[a.priority] - p[b.priority] || a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
        }),
    [requests, tab]
  );

  const setStatus = async (req: ItRequest, status: ItRequestStatus, note?: string) => {
    setSaving(true);
    try {
      await itApi.updateRequestStatus(req.id, status, note);
      showToast('Request updated', `#${req.id} marked ${status.replace('_', ' ').toLowerCase()}.`, 'success');
      setClosing(null);
      load();
    } catch (err: any) {
      showToast('Update failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = requests.filter(r => r.status === 'OPEN' || r.status === 'IN_PROGRESS').length;

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="IT Service Desk"
        subtitle="New-joiner provisioning, exit clearances, repairs and access requests raised by HR and staff"
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
            {activeCount} open
          </span>
        }
        actions={
          <button onClick={() => setActiveNav('it-assets')} className={secondaryBtn}>
            <Package className="w-4 h-4" /> Asset Register
          </button>
        }
      />

      <div className="flex gap-1.5">
        {(['ACTIVE', 'CLOSED'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              tab === t ? 'bg-teal-700 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t === 'ACTIVE' ? 'Open & in progress' : 'Closed'}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonLoader rows={5} />
      ) : visible.length === 0 ? (
        <EmptyState icon={Inbox} title={tab === 'ACTIVE' ? 'Queue is clear' : 'No closed requests yet'} />
      ) : (
        <div className="space-y-3">
          {visible.map(r => {
            const meta = REQUEST_TYPE_META[r.requestType];
            const Icon = meta.icon;
            return (
              <div key={r.id} className={`${cardClass} p-4 space-y-3`}>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12.5px] font-mono text-slate-400">#{r.id}</span>
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{r.title}</span>
                      </div>
                      <div className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {meta.label} · For <strong>{r.employeeName}</strong> ({r.employeeCode}) · Raised by {r.raisedByName ?? '—'} ·{' '}
                        {formatDateTime(r.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11.5px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_CLASS[r.priority]}`}>{r.priority}</span>
                    <StatusPill status={r.status} />
                  </div>
                </div>
                {r.details && (
                  <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    {r.details}
                  </pre>
                )}
                {r.resolution && (
                  <div className="text-xs text-emerald-800 dark:text-emerald-300">
                    <strong>Resolution:</strong> {r.resolution} {r.closedAt && `· ${formatDateTime(r.closedAt)}`}
                  </div>
                )}
                {tab === 'ACTIVE' && (
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => { setClosing({ req: r, status: 'CANCELLED' }); setResolution(''); }} className={secondaryBtn}>
                      <XCircle className="w-4 h-4" /> Cancel
                    </button>
                    {r.status === 'OPEN' && (
                      <button onClick={() => setStatus(r, 'IN_PROGRESS')} disabled={saving} className={secondaryBtn}>
                        <PlayCircle className="w-4 h-4" /> Start
                      </button>
                    )}
                    {(r.requestType === 'ONBOARDING' || r.requestType === 'OFFBOARDING' || r.requestType === 'NEW_ASSET') && (
                      <button onClick={() => setActiveNav('it-assets')} className={secondaryBtn}>
                        <Package className="w-4 h-4" /> {r.requestType === 'OFFBOARDING' ? 'Collect assets' : 'Issue assets'}
                      </button>
                    )}
                    <button onClick={() => { setClosing({ req: r, status: 'DONE' }); setResolution(''); }} className={primaryBtn}>
                      <CheckCircle2 className="w-4 h-4" /> Resolve
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!closing}
        onClose={() => setClosing(null)}
        title={closing?.status === 'DONE' ? `Resolve #${closing?.req.id}` : `Cancel #${closing?.req.id}`}
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            if (closing) setStatus(closing.req, closing.status, resolution);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>{closing?.status === 'DONE' ? 'What was done?' : 'Reason for cancelling'} *</label>
            <textarea rows={3} required value={resolution} onChange={e => setResolution(e.target.value)} className={inputClass} placeholder="Issued SM-LT-014 & SIM 98xxxxxx12; email created" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setClosing(null)} className={secondaryBtn}>
              Back
            </button>
            <button type="submit" disabled={saving} className={primaryBtn}>
              {saving ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
