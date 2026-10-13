import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { itApi } from '../../api';
import type { Asset, ItRequest, ItRequestType } from '../../types';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { CheckCircle2, Laptop, LifeBuoy, Plus } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { StatusPill } from '../common/StatusPill';
import { PageHeader, EmptyState, inputClass, labelClass, primaryBtn, secondaryBtn, cardClass } from '../common/PageHeader';
import { CATEGORY_META } from '../it/AssetRegister';
import { REQUEST_TYPE_META } from '../it/ItRequests';

export const MyAssets: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<ItRequest[]>([]);
  const [acking, setAcking] = useState<number | null>(null);

  const [showRaise, setShowRaise] = useState(false);
  const [reqType, setReqType] = useState<ItRequestType>('REPAIR');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<ItRequest['priority']>('MEDIUM');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [a, r] = await Promise.all([itApi.getMyAssets(), itApi.getMyRequests()]);
      setAssets(a);
      setRequests(r);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load your assets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser]);

  const acknowledge = async (a: Asset) => {
    setAcking(a.id);
    try {
      await itApi.acknowledgeAsset(a.id);
      showToast('Receipt acknowledged', `Thanks — ${a.assetTag} is recorded in your custody.`, 'success');
      load();
    } catch (err: any) {
      showToast('Could not acknowledge', err.message, 'error');
    } finally {
      setAcking(null);
    }
  };

  const raise = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await itApi.raiseRequest({ requestType: reqType, title, details, priority });
      showToast('Request raised', 'IT has been notified.', 'success');
      setShowRaise(false);
      setTitle('');
      setDetails('');
      load();
    } catch (err: any) {
      showToast('Could not raise request', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="My Assets & IT Help"
        subtitle="Company devices and numbers issued to you. Acknowledge receipt and raise IT requests here."
        actions={
          <button onClick={() => setShowRaise(true)} className={primaryBtn}>
            <Plus className="w-4 h-4" /> Raise IT Request
          </button>
        }
      />

      {loading ? (
        <SkeletonLoader rows={4} />
      ) : (
        <>
          {assets.length === 0 ? (
            <EmptyState icon={Laptop} title="No company assets issued to you" message="If you hold a company laptop, phone or SIM that isn't listed, raise a request so IT can record it." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assets.map(a => {
                const meta = CATEGORY_META[a.category];
                const Icon = meta.icon;
                return (
                  <div key={a.id} className={`${cardClass} p-4 space-y-3`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {[a.brand, a.model].filter(Boolean).join(' ') || meta.label}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">{a.assetTag}</div>
                        </div>
                      </div>
                      <StatusPill status={a.status} />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      {a.phoneNumber && (
                        <>
                          <dt className="text-slate-500">Mobile no.</dt>
                          <dd className="font-semibold text-slate-800 dark:text-slate-200">{a.phoneNumber} {a.carrier && `(${a.carrier})`}</dd>
                        </>
                      )}
                      {a.serialNumber && (
                        <>
                          <dt className="text-slate-500">Serial</dt>
                          <dd className="font-mono text-slate-800 dark:text-slate-200">{a.serialNumber}</dd>
                        </>
                      )}
                      {a.imei && (
                        <>
                          <dt className="text-slate-500">IMEI</dt>
                          <dd className="font-mono text-slate-800 dark:text-slate-200">{a.imei}</dd>
                        </>
                      )}
                      <dt className="text-slate-500">Issued on</dt>
                      <dd className="text-slate-800 dark:text-slate-200">{formatDate(a.assignedAt)}</dd>
                    </dl>
                    {a.acknowledgedAt ? (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged {formatDateTime(a.acknowledgedAt)}
                      </div>
                    ) : (
                      <button onClick={() => acknowledge(a)} disabled={acking === a.id} className={`${primaryBtn} w-full justify-center`}>
                        <CheckCircle2 className="w-4 h-4" />
                        {acking === a.id ? 'Recording…' : 'I have received this asset'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className={`${cardClass} p-5`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
              <LifeBuoy className="w-4 h-4 text-teal-700 dark:text-teal-400" /> My IT requests
            </h2>
            {requests.length === 0 ? (
              <p className="text-xs text-slate-500">You haven't raised any IT requests.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {requests.map(r => (
                  <li key={r.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{r.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {REQUEST_TYPE_META[r.requestType].label} · {formatDateTime(r.createdAt)}
                        {r.resolution && ` · ${r.resolution}`}
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Modal isOpen={showRaise} onClose={() => setShowRaise(false)} title="Raise IT Request">
        <form onSubmit={raise} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Type</label>
              <select value={reqType} onChange={e => setReqType(e.target.value as ItRequestType)} className={inputClass}>
                <option value="REPAIR">Repair / device issue</option>
                <option value="NEW_ASSET">Need a device / SIM</option>
                <option value="ACCESS">Software / system access</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as ItRequest['priority'])} className={inputClass}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High — blocking my work</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Summary *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} className={inputClass} placeholder="Laptop battery drains in an hour" />
          </div>
          <div>
            <label className={labelClass}>Details</label>
            <textarea rows={3} value={details} onChange={e => setDetails(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowRaise(false)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryBtn}>
              {saving ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
