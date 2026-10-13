import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { itApi } from '../../api';
import type { Asset, ItRequest } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { Laptop, Smartphone, CreditCard, Inbox, ShieldAlert, Clock, Wrench, ArrowRight } from 'lucide-react';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { PageHeader, StatCard, cardClass } from '../common/PageHeader';
import { CATEGORY_META, warrantyState } from './AssetRegister';
import { REQUEST_TYPE_META } from './ItRequests';

export const ItDashboard: React.FC = () => {
  const { currentUser, showToast, setActiveNav } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<ItRequest[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [a, r] = await Promise.all([itApi.getAssets(), itApi.getRequests()]);
        setAssets(a);
        setRequests(r);
      } catch (err: any) {
        showToast('Error', err.message || 'Failed to load IT overview', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  const active = assets.filter(a => a.status !== 'RETIRED' && a.status !== 'LOST');
  const byCat = (cats: string[]) => active.filter(a => cats.includes(a.category));
  const laptops = byCat(['LAPTOP', 'DESKTOP']);
  const mobiles = byCat(['MOBILE', 'TABLET']);
  const sims = active.filter(a => a.category === 'SIM' || a.phoneNumber);
  const openRequests = requests.filter(r => r.status === 'OPEN' || r.status === 'IN_PROGRESS');
  const warrantyAlerts = active.filter(a => warrantyState(a)).sort((a, b) => (a.warrantyUntil ?? '').localeCompare(b.warrantyUntil ?? ''));
  const unacknowledged = active.filter(a => a.status === 'ASSIGNED' && !a.acknowledgedAt);
  const inRepair = active.filter(a => a.status === 'IN_REPAIR');
  const inUse = (list: Asset[]) => `${list.filter(a => a.status === 'ASSIGNED').length} issued · ${list.filter(a => a.status === 'IN_STOCK').length} in stock`;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader title="IT Operations Overview" subtitle="Company devices, numbers and service requests at a glance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Laptops & Desktops" value={laptops.length} hint={inUse(laptops)} icon={Laptop} onClick={() => setActiveNav('it-assets')} />
        <StatCard label="Mobile Handsets" value={mobiles.length} hint={inUse(mobiles)} icon={Smartphone} tone="sky" onClick={() => setActiveNav('it-assets')} />
        <StatCard label="Company Numbers" value={sims.length} hint={inUse(sims)} icon={CreditCard} tone="purple" onClick={() => setActiveNav('it-assets')} />
        <StatCard label="Open Requests" value={openRequests.length} hint={`${openRequests.filter(r => r.priority === 'HIGH').length} high priority`} icon={Inbox} tone="amber" onClick={() => setActiveNav('it-requests')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${cardClass} p-5 lg:col-span-2`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Service queue</h2>
            <button onClick={() => setActiveNav('it-requests')} className="text-xs text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-1">
              Open desk <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {openRequests.length === 0 ? (
            <p className="text-xs text-slate-500">Nothing pending.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {openRequests.slice(0, 6).map(r => {
                const Icon = REQUEST_TYPE_META[r.requestType].icon;
                return (
                  <li key={r.id} className="py-2.5 flex items-center gap-3 text-xs">
                    <Icon className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span className="flex-1 truncate text-slate-800 dark:text-slate-200">{r.title}</span>
                    <span className={`text-[10px] font-bold ${r.priority === 'HIGH' ? 'text-rose-600' : 'text-slate-400'}`}>{r.priority}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className={`${cardClass} p-5`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-amber-600" /> Warranty alerts
            </h2>
            {warrantyAlerts.length === 0 ? (
              <p className="text-xs text-slate-500">No warranties expiring soon.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {warrantyAlerts.slice(0, 5).map(a => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {a.assetTag} <span className="font-sans text-slate-400">{CATEGORY_META[a.category].label}</span>
                    </span>
                    <span className={warrantyState(a) === 'EXPIRED' ? 'text-rose-600 font-semibold' : 'text-amber-600 font-semibold'}>
                      {formatDate(a.warrantyUntil)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`${cardClass} p-5 space-y-3 text-xs`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Clock className="w-4 h-4 text-amber-600" /> Awaiting employee acknowledgement
              </span>
              <strong className="text-slate-900 dark:text-slate-100">{unacknowledged.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Wrench className="w-4 h-4 text-orange-600" /> In repair
              </span>
              <strong className="text-slate-900 dark:text-slate-100">{inRepair.length}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
