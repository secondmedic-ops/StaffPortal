import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi, itApi } from '../../api';
import type { AssetInput } from '../../api/it';
import type { Asset, AssetAssignment, AssetCategory, AssetCondition, Employee } from '../../types';
import { ASSET_POLICY } from '../../config/policy';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import {
  Laptop,
  Smartphone,
  CreditCard,
  Monitor,
  Package,
  Plus,
  Search,
  UserPlus,
  Undo2,
  Pencil,
  History,
  Download,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { StatusPill } from '../common/StatusPill';
import {
  PageHeader,
  EmptyState,
  inputClass,
  compactInputClass,
  labelClass,
  primaryBtn,
  secondaryBtn,
  cardClass,
  tableHeadClass
} from '../common/PageHeader';

export const CATEGORY_META: Record<AssetCategory, { label: string; icon: React.ElementType }> = {
  LAPTOP: { label: 'Laptop', icon: Laptop },
  DESKTOP: { label: 'Desktop', icon: Monitor },
  MOBILE: { label: 'Mobile Handset', icon: Smartphone },
  SIM: { label: 'SIM / Mobile No.', icon: CreditCard },
  TABLET: { label: 'Tablet', icon: Smartphone },
  MONITOR: { label: 'Monitor', icon: Monitor },
  ACCESSORY: { label: 'Accessory', icon: Package },
  ID_CARD: { label: 'ID / Access Card', icon: CreditCard },
  OTHER: { label: 'Other', icon: Package }
};

const FILTERS: Array<{ id: string; label: string; match: (a: Asset) => boolean }> = [
  { id: 'ALL', label: 'All', match: () => true },
  { id: 'LAPTOP', label: 'Laptops & Desktops', match: a => a.category === 'LAPTOP' || a.category === 'DESKTOP' },
  { id: 'MOBILE', label: 'Mobiles & Tablets', match: a => a.category === 'MOBILE' || a.category === 'TABLET' },
  { id: 'SIM', label: 'Company Numbers', match: a => a.category === 'SIM' || Boolean(a.phoneNumber) },
  { id: 'OTHER', label: 'Other', match: a => ['MONITOR', 'ACCESSORY', 'ID_CARD', 'OTHER'].includes(a.category) }
];

const EMPTY_FORM: AssetInput = {
  assetTag: '',
  category: 'LAPTOP',
  condition: 'NEW'
};

export function warrantyState(a: Asset): 'EXPIRED' | 'EXPIRING' | null {
  if (!a.warrantyUntil) return null;
  const days = (new Date(a.warrantyUntil).getTime() - Date.now()) / 86400000;
  if (days < 0) return 'EXPIRED';
  if (days <= ASSET_POLICY.warrantyAlertDays) return 'EXPIRING';
  return null;
}

function nextTag(assets: Asset[], category: AssetCategory): string {
  const prefix = { LAPTOP: 'LT', DESKTOP: 'DT', MOBILE: 'MB', SIM: 'SIM', TABLET: 'TB', MONITOR: 'MN', ACCESSORY: 'AC', ID_CARD: 'ID', OTHER: 'AS' }[category];
  const max = assets
    .map(a => new RegExp(`^SM-${prefix}-(\\d+)$`).exec(a.assetTag))
    .reduce((m, r) => (r ? Math.max(m, Number(r[1])) : m), 0);
  return `SM-${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export const AssetRegister: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<Asset | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AssetInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [assigning, setAssigning] = useState<Asset | null>(null);
  const [assignee, setAssignee] = useState<number | ''>('');
  const [assignNotes, setAssignNotes] = useState('');

  const [returning, setReturning] = useState<Asset | null>(null);
  const [returnCondition, setReturnCondition] = useState<AssetCondition>('GOOD');
  const [returnNotes, setReturnNotes] = useState('');

  const [historyFor, setHistoryFor] = useState<Asset | null>(null);
  const [history, setHistory] = useState<AssetAssignment[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const [a, e] = await Promise.all([itApi.getAssets(), hrApi.getEmployees()]);
      setAssets(a);
      setEmployees(e.filter(emp => emp.status !== 'EXITED'));
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load asset register', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser]);

  const visible = useMemo(() => {
    const f = FILTERS.find(x => x.id === filter) ?? FILTERS[0];
    const q = search.trim().toLowerCase();
    return assets
      .filter(f.match)
      .filter(a => statusFilter === 'ALL' || a.status === statusFilter)
      .filter(a =>
        !q
          ? true
          : [a.assetTag, a.brand, a.model, a.serialNumber, a.imei, a.phoneNumber, a.assignedToName, a.assignedToCode, a.carrier]
              .filter(Boolean)
              .some(v => String(v).toLowerCase().includes(q))
      );
  }, [assets, filter, statusFilter, search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, assetTag: nextTag(assets, 'LAPTOP') });
    setShowForm(true);
  };

  const openEdit = (a: Asset) => {
    setEditing(a);
    const { id, status, assignedTo, assignedToName, assignedToCode, assignedAt, acknowledgedAt, ...rest } = a;
    setForm({ ...rest, status });
    setShowForm(true);
  };

  const setField = <K extends keyof AssetInput>(key: K, value: AssetInput[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.category === 'SIM' && !form.phoneNumber) {
      showToast('Mobile number required', 'Enter the company mobile number for this SIM.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await itApi.updateAsset(editing.id, form);
        showToast('Asset updated', `${form.assetTag} saved.`, 'success');
      } else {
        await itApi.createAsset(form);
        showToast('Asset added', `${form.assetTag} is now in stock.`, 'success');
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      showToast('Save failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigning || !assignee) return;
    setSaving(true);
    try {
      await itApi.assignAsset(assigning.id, Number(assignee), assignNotes);
      const emp = employees.find(x => x.id === Number(assignee));
      showToast('Asset issued', `${assigning.assetTag} issued to ${emp?.fullName}. Awaiting their acknowledgement.`, 'success');
      setAssigning(null);
      load();
    } catch (err: any) {
      showToast('Assignment failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returning) return;
    setSaving(true);
    try {
      await itApi.returnAsset(returning.id, returnCondition, returnNotes);
      showToast(
        'Asset returned',
        `${returning.assetTag} ${returnCondition === 'DAMAGED' ? 'sent for repair' : 'back in stock'}.`,
        'success'
      );
      setReturning(null);
      load();
    } catch (err: any) {
      showToast('Return failed', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (a: Asset) => {
    setHistoryFor(a);
    setHistory([]);
    try {
      setHistory(await itApi.getAssetHistory(a.id));
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    }
  };

  const exportCsv = () => {
    const header = ['Asset Tag', 'Category', 'Brand', 'Model', 'Serial', 'IMEI', 'Mobile No.', 'Carrier', 'Plan', 'Status', 'Condition', 'Assigned To', 'Emp Code', 'Assigned On', 'Warranty Until'];
    const rows = visible.map(a => [
      a.assetTag, a.category, a.brand, a.model, a.serialNumber, a.imei, a.phoneNumber, a.carrier, a.planDetails,
      a.status, a.condition, a.assignedToName, a.assignedToCode, a.assignedAt?.split('T')[0], a.warrantyUntil
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `asset-register-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const showsNumber = form.category === 'SIM' || form.category === 'MOBILE' || form.category === 'TABLET';
  const showsImei = form.category === 'MOBILE' || form.category === 'TABLET';

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="IT Asset Register"
        subtitle="Laptops, mobile handsets, company SIMs/numbers and accessories — who holds what, since when, and in what condition"
        actions={
          <>
            <button onClick={exportCsv} className={secondaryBtn}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={openAdd} className={primaryBtn}>
              <Plus className="w-4 h-4" /> Add Asset
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className={`${cardClass} p-3 flex flex-col lg:flex-row gap-3 lg:items-center justify-between`}>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === f.id
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">{assets.filter(f.match).length}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${compactInputClass} w-36`}>
            <option value="ALL">All statuses</option>
            <option value="IN_STOCK">In stock</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_REPAIR">In repair</option>
            <option value="RETIRED">Retired</option>
            <option value="LOST">Lost</option>
          </select>
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tag, serial, IMEI, mobile no., employee…"
              className={`${inputClass} pl-8`}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonLoader rows={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Laptop}
          title={assets.length === 0 ? 'No assets recorded yet' : 'No assets match these filters'}
          message="Record every laptop, handset and company SIM so you always know who holds it and can recover it at exit."
          action={assets.length === 0 ? <button onClick={openAdd} className={`${primaryBtn} mx-auto`}><Plus className="w-4 h-4" /> Add first asset</button> : undefined}
        />
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Identifiers</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Held By</th>
                  <th className="px-4 py-3">Warranty</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map(a => {
                  const meta = CATEGORY_META[a.category];
                  const Icon = meta.icon;
                  const w = warrantyState(a);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <Icon className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 font-mono">{a.assetTag}</div>
                            <div className="text-[12.5px] text-slate-500">
                              {meta.label}
                              {(a.brand || a.model) && ` · ${[a.brand, a.model].filter(Boolean).join(' ')}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] space-y-0.5">
                        {a.phoneNumber && (
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            📱 {a.phoneNumber}
                            {a.carrier && <span className="font-normal text-slate-500"> · {a.carrier}</span>}
                          </div>
                        )}
                        {a.serialNumber && <div className="font-mono">S/N {a.serialNumber}</div>}
                        {a.imei && <div className="font-mono">IMEI {a.imei}</div>}
                        {!a.phoneNumber && !a.serialNumber && !a.imei && <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={a.status} />
                        <div className="text-[11.5px] text-slate-500 mt-1">Condition: {a.condition.toLowerCase()}</div>
                      </td>
                      <td className="px-4 py-3">
                        {a.assignedToName ? (
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{a.assignedToName}</div>
                            <div className="text-[12.5px] text-slate-500">
                              {a.assignedToCode} · since {formatDate(a.assignedAt)}
                            </div>
                            {a.acknowledgedAt ? (
                              <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                                <CheckCircle2 className="w-3 h-3" /> Acknowledged
                              </span>
                            ) : (
                              <span className="text-[11.5px] text-amber-700 dark:text-amber-400 font-semibold">Awaiting acknowledgement</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px]">
                        {a.warrantyUntil ? (
                          <span
                            className={
                              w === 'EXPIRED'
                                ? 'text-rose-600 font-semibold'
                                : w === 'EXPIRING'
                                ? 'text-amber-600 font-semibold'
                                : ''
                            }
                          >
                            {w && <ShieldAlert className="w-3 h-3 inline mr-1" />}
                            {formatDate(a.warrantyUntil)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {a.status === 'IN_STOCK' && (
                            <button
                              onClick={() => {
                                setAssigning(a);
                                setAssignee('');
                                setAssignNotes('');
                              }}
                              className="p-1.5 rounded text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50"
                              title="Issue to employee"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}
                          {a.status === 'ASSIGNED' && (
                            <button
                              onClick={() => {
                                setReturning(a);
                                setReturnCondition('GOOD');
                                setReturnNotes('');
                              }}
                              className="p-1.5 rounded text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                              title="Collect / return"
                            >
                              <Undo2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(a)}
                            className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openHistory(a)}
                            className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Custody history"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / edit */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `Edit ${editing.assetTag}` : 'Add Asset to Register'}
        subtitle="Mobile numbers are unique across active SIMs"
        maxWidth="xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Category *</label>
              <select
                value={form.category}
                onChange={e => {
                  const category = e.target.value as AssetCategory;
                  setForm(prev => ({
                    ...prev,
                    category,
                    assetTag: editing ? prev.assetTag : nextTag(assets, category)
                  }));
                }}
                className={inputClass}
              >
                {Object.entries(CATEGORY_META).map(([id, m]) => (
                  <option key={id} value={id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Asset Tag *</label>
              <input value={form.assetTag} onChange={e => setField('assetTag', e.target.value)} className={`${inputClass} font-mono`} required />
            </div>
            {form.category !== 'SIM' && (
              <>
                <div>
                  <label className={labelClass}>Brand</label>
                  <input value={form.brand ?? ''} onChange={e => setField('brand', e.target.value)} placeholder="Dell / Apple / Samsung" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Model</label>
                  <input value={form.model ?? ''} onChange={e => setField('model', e.target.value)} placeholder="Latitude 5440 / Galaxy A55" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Serial Number</label>
                  <input value={form.serialNumber ?? ''} onChange={e => setField('serialNumber', e.target.value)} className={`${inputClass} font-mono`} />
                </div>
              </>
            )}
            {showsImei && (
              <div>
                <label className={labelClass}>IMEI</label>
                <input value={form.imei ?? ''} onChange={e => setField('imei', e.target.value.replace(/\D/g, '').slice(0, 15))} className={`${inputClass} font-mono`} placeholder="15 digits" />
              </div>
            )}
            {showsNumber && (
              <>
                <div>
                  <label className={labelClass}>Company Mobile No. {form.category === 'SIM' && '*'}</label>
                  <input value={form.phoneNumber ?? ''} onChange={e => setField('phoneNumber', e.target.value)} placeholder="+91 98xxxxxxx" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Carrier</label>
                  <select value={form.carrier ?? ''} onChange={e => setField('carrier', e.target.value)} className={inputClass}>
                    <option value="">—</option>
                    <option>Jio</option>
                    <option>Airtel</option>
                    <option>Vi</option>
                    <option>BSNL</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Plan / Billing</label>
                  <input value={form.planDetails ?? ''} onChange={e => setField('planDetails', e.target.value)} placeholder="Corporate postpaid ₹399 · 2GB/day · billed to SecondMedic" className={inputClass} />
                </div>
              </>
            )}
            {(form.category === 'LAPTOP' || form.category === 'DESKTOP') && (
              <div className="col-span-2">
                <label className={labelClass}>Specs</label>
                <input value={form.specs ?? ''} onChange={e => setField('specs', e.target.value)} placeholder="i5 13th gen · 16GB · 512GB SSD · Win 11 Pro" className={inputClass} />
              </div>
            )}
            <div>
              <label className={labelClass}>Purchase Date</label>
              <input type="date" value={form.purchaseDate ?? ''} onChange={e => setField('purchaseDate', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Warranty Until</label>
              <input type="date" value={form.warrantyUntil ?? ''} onChange={e => setField('warrantyUntil', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Cost (₹)</label>
              <input
                type="number"
                min={0}
                value={form.purchaseCost ?? ''}
                onChange={e => setField('purchaseCost', e.target.value ? Number(e.target.value) : undefined)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Vendor</label>
              <input value={form.vendor ?? ''} onChange={e => setField('vendor', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Condition</label>
              <select value={form.condition} onChange={e => setField('condition', e.target.value as AssetCondition)} className={inputClass}>
                <option value="NEW">New</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="DAMAGED">Damaged</option>
              </select>
            </div>
            {editing && editing.status !== 'ASSIGNED' && (
              <div>
                <label className={labelClass}>Status</label>
                <select value={form.status} onChange={e => setField('status', e.target.value as Asset['status'])} className={inputClass}>
                  <option value="IN_STOCK">In stock</option>
                  <option value="IN_REPAIR">In repair</option>
                  <option value="RETIRED">Retired</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea rows={2} value={form.notes ?? ''} onChange={e => setField('notes', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryBtn}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add to Register'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign */}
      <Modal
        isOpen={!!assigning}
        onClose={() => setAssigning(null)}
        title={`Issue ${assigning?.assetTag ?? ''}`}
        subtitle="The employee will be asked to acknowledge receipt in My Assets"
      >
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className={labelClass}>Employee *</label>
            <select value={assignee} onChange={e => setAssignee(e.target.value ? Number(e.target.value) : '')} className={inputClass} required>
              <option value="">Select employee…</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.empCode}) — {emp.designation}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Handover notes</label>
            <textarea rows={2} value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder="Charger, bag & mouse included" className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAssigning(null)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !assignee} className={primaryBtn}>
              <UserPlus className="w-4 h-4" /> {saving ? 'Issuing…' : 'Issue Asset'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Return */}
      <Modal
        isOpen={!!returning}
        onClose={() => setReturning(null)}
        title={`Collect ${returning?.assetTag ?? ''}`}
        subtitle={returning?.assignedToName ? `Currently with ${returning.assignedToName}` : undefined}
      >
        <form onSubmit={handleReturn} className="space-y-4">
          <div>
            <label className={labelClass}>Condition on return</label>
            <select value={returnCondition} onChange={e => setReturnCondition(e.target.value as AssetCondition)} className={inputClass}>
              <option value="GOOD">Good — back to stock</option>
              <option value="FAIR">Fair — back to stock</option>
              <option value="DAMAGED">Damaged — send to repair</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea rows={2} value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Screen scratch, charger missing…" className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setReturning(null)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryBtn}>
              <Undo2 className="w-4 h-4" /> {saving ? 'Saving…' : 'Confirm Return'}
            </button>
          </div>
        </form>
      </Modal>

      {/* History */}
      <Modal isOpen={!!historyFor} onClose={() => setHistoryFor(null)} title={`Custody history · ${historyFor?.assetTag ?? ''}`}>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">No assignments recorded yet.</p>
        ) : (
          <ol className="space-y-3">
            {history.map(h => (
              <li key={h.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{h.employeeName}</div>
                <div className="text-slate-500 mt-0.5">
                  Issued {formatDateTime(h.assignedAt)}
                  {h.assignedByName && ` by ${h.assignedByName}`}
                </div>
                <div className="text-slate-500">
                  {h.returnedAt ? `Returned ${formatDateTime(h.returnedAt)} · ${h.returnCondition?.toLowerCase()}` : 'Currently held'}
                </div>
                {h.notes && <div className="mt-1 text-slate-600 dark:text-slate-400 italic">{h.notes}</div>}
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </div>
  );
};
