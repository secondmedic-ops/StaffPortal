import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { compensationApi, hrApi } from '../../api';
import { supabase } from '../../lib/supabase';
import type { Employee, PayType, SalaryRevision, SalaryRevisionType } from '../../types';
import { SALARY_SPLIT_POLICY } from '../../config/policy';
import { splitCtc, formatInr } from '../../lib/payrollEngine';
import { formatDate } from '../../utils/dateUtils';
import { TrendingUp, Plus, CheckCircle2, XCircle, Users, Clock, History, Search } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { StatusPill } from '../common/StatusPill';
import {
  PageHeader,
  StatCard,
  EmptyState,
  inputClass,
  labelClass,
  primaryBtn,
  secondaryBtn,
  cardClass,
  tableHeadClass
} from '../common/PageHeader';

function firstOfNextMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString('en-CA');
}

const monthlyGross = (r: Pick<SalaryRevision, 'basicMonthly' | 'hraMonthly' | 'specialMonthly' | 'otherAllowanceMonthly'>) =>
  r.basicMonthly + r.hraMonthly + r.specialMonthly + r.otherAllowanceMonthly;

/** "₹4,80,000 p.a." for monthly salaries, "₹300 / day" for part-time. */
export const salaryLabel = (r: Pick<SalaryRevision, 'payType' | 'dailyRate' | 'ctcAnnual'>) =>
  r.payType === 'DAILY' ? `${formatInr(r.dailyRate ?? 0)} / day` : `${formatInr(r.ctcAnnual)} p.a.`;

interface ProposalForm {
  employeeId: number | '';
  revisionType: SalaryRevisionType;
  payType: PayType;
  dailyRate: string;
  effectiveFrom: string;
  incrementPct: string;
  ctcAnnual: string;
  autoSplit: boolean;
  basicMonthly: string;
  hraMonthly: string;
  specialMonthly: string;
  otherAllowanceMonthly: string;
  tdsMonthly: string;
  pfApplicable: boolean;
  newDesignation: string;
  reason: string;
}

const blankForm = (): ProposalForm => ({
  employeeId: '',
  revisionType: 'INCREMENT',
  payType: 'MONTHLY',
  dailyRate: '',
  effectiveFrom: firstOfNextMonth(),
  incrementPct: '',
  ctcAnnual: '',
  autoSplit: true,
  basicMonthly: '',
  hraMonthly: '',
  specialMonthly: '',
  otherAllowanceMonthly: '0',
  tdsMonthly: '0',
  pfApplicable: true,
  newDesignation: '',
  reason: ''
});

export const IncrementsRevisions: React.FC = () => {
  const { currentUser, isCeo, isAccounts, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [revisions, setRevisions] = useState<SalaryRevision[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accountsEmpIds, setAccountsEmpIds] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<'PENDING' | 'REGISTER' | 'HISTORY'>('PENDING');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProposalForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState<number | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [r, e, rolesRes] = await Promise.all([
        compensationApi.getRevisions(),
        hrApi.getEmployees(),
        supabase.from('employee_roles').select('employee_id').eq('role', 'ACCOUNTS')
      ]);
      setRevisions(r);
      setEmployees(e.filter(x => x.status !== 'EXITED'));
      setAccountsEmpIds(new Set((rolesRes.data ?? []).map(x => x.employee_id)));
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load salary data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser?.id]);

  const today = new Date().toLocaleDateString('en-CA');
  const current = useMemo(() => {
    const map = new Map<number, SalaryRevision>();
    revisions
      .filter(r => r.status === 'APPROVED' && r.effectiveFrom <= today)
      .forEach(r => {
        const c = map.get(r.employeeId);
        if (!c || r.effectiveFrom > c.effectiveFrom || (r.effectiveFrom === c.effectiveFrom && r.id > c.id)) map.set(r.employeeId, r);
      });
    return map;
  }, [revisions, today]);

  const pending = revisions.filter(r => r.status === 'PROPOSED');
  const q = search.trim().toLowerCase();
  const matches = (name?: string, code?: string) => !q || (name ?? '').toLowerCase().includes(q) || (code ?? '').toLowerCase().includes(q);

  const set = <K extends keyof ProposalForm>(key: K, value: ProposalForm[K]) => setForm(prev => ({ ...prev, [key]: value }));

  // Recompute components whenever CTC / PF changes and auto-split is on.
  const applyCtc = (ctcText: string, pf: boolean, auto: boolean, base: ProposalForm) => {
    const next = { ...base, ctcAnnual: ctcText, pfApplicable: pf, autoSplit: auto };
    const ctc = Number(ctcText);
    if (auto && ctc > 0) {
      const s = splitCtc(ctc, SALARY_SPLIT_POLICY.basicPctOfGross, SALARY_SPLIT_POLICY.hraPctOfBasic, pf);
      next.basicMonthly = String(s.basicMonthly);
      next.hraMonthly = String(s.hraMonthly);
      next.specialMonthly = String(s.specialMonthly);
      next.otherAllowanceMonthly = '0';
    }
    return next;
  };

  const selectedCurrent = form.employeeId ? current.get(Number(form.employeeId)) : undefined;

  const openPropose = (employeeId?: number) => {
    const base = blankForm();
    if (employeeId) {
      const cur = current.get(employeeId);
      base.employeeId = employeeId;
      base.revisionType = cur ? 'INCREMENT' : 'JOINING';
      if (cur) {
        base.pfApplicable = cur.pfApplicable;
        base.tdsMonthly = String(cur.tdsMonthly);
        base.payType = cur.payType;
      }
    }
    setForm(base);
    setShowForm(true);
  };

  const onEmployeeChange = (id: number | '') => {
    const cur = id ? current.get(Number(id)) : undefined;
    setForm(prev => ({
      ...prev,
      employeeId: id,
      revisionType: cur ? (prev.revisionType === 'JOINING' ? 'INCREMENT' : prev.revisionType) : 'JOINING',
      pfApplicable: cur?.pfApplicable ?? prev.pfApplicable,
      tdsMonthly: cur ? String(cur.tdsMonthly) : prev.tdsMonthly,
      payType: cur?.payType ?? prev.payType,
      dailyRate: '',
      incrementPct: '',
      ctcAnnual: ''
    }));
  };

  const onPctChange = (pct: string) => {
    const base = selectedCurrent?.ctcAnnual ?? 0;
    const ctc = base > 0 && pct !== '' ? String(Math.round(base * (1 + Number(pct) / 100))) : form.ctcAnnual;
    setForm(prev => applyCtc(ctc, prev.pfApplicable, prev.autoSplit, { ...prev, incrementPct: pct }));
  };

  const onCtcChange = (ctc: string) => {
    const base = selectedCurrent?.ctcAnnual ?? 0;
    const pct = base > 0 && Number(ctc) > 0 ? (((Number(ctc) - base) / base) * 100).toFixed(2) : '';
    setForm(prev => applyCtc(ctc, prev.pfApplicable, prev.autoSplit, { ...prev, incrementPct: pct }));
  };

  const selectableEmployees = useMemo(() => {
    let list = employees.filter(e => e.id !== currentUser?.id);
    if (isCeo && !isAccounts) {
      list = list.filter(e => accountsEmpIds.has(e.id));
    }
    return list;
  }, [employees, currentUser?.id, isCeo, isAccounts, accountsEmpIds]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) return;
    const daily = form.payType === 'DAILY';
    const rate = Number(form.dailyRate);
    if (daily && !(rate > 0)) {
      showToast('Daily rate required', 'Enter the per-day rate for this part-time employee.', 'error');
      return;
    }
    const ctc = daily ? 0 : Number(form.ctcAnnual);
    if (!daily && !(ctc > 0)) {
      showToast('CTC required', 'Enter the revised annual CTC or an increment %.', 'error');
      return;
    }
    const basic = daily ? 0 : Number(form.basicMonthly);
    if (!daily && !(basic > 0)) {
      showToast('Basic required', 'Monthly basic must be greater than zero.', 'error');
      return;
    }
    setSaving(true);
    try {
      await compensationApi.proposeRevision({
        employeeId: Number(form.employeeId),
        revisionType: form.revisionType,
        effectiveFrom: form.effectiveFrom,
        ctcAnnual: ctc,
        basicMonthly: basic,
        hraMonthly: daily ? 0 : Number(form.hraMonthly) || 0,
        specialMonthly: daily ? 0 : Number(form.specialMonthly) || 0,
        otherAllowanceMonthly: daily ? 0 : Number(form.otherAllowanceMonthly) || 0,
        tdsMonthly: Number(form.tdsMonthly) || 0,
        pfApplicable: form.pfApplicable,
        payType: form.payType,
        dailyRate: daily ? rate : undefined,
        incrementPct: form.incrementPct !== '' ? Number(form.incrementPct) : undefined,
        newDesignation: form.revisionType === 'PROMOTION' ? form.newDesignation : undefined,
        reason: form.reason
      });
      showToast('Revision proposed', 'The CEO must approve it.', 'success');
      setShowForm(false);
      setTab('PENDING');
      load();
    } catch (err: any) {
      showToast('Could not propose', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const action = async (r: SalaryRevision, act: 'APPROVE' | 'REJECT') => {
    setActioning(r.id);
    try {
      const { warning } = await compensationApi.actionRevision(r, act);
      showToast(
        act === 'APPROVE' ? 'Revision approved' : 'Revision rejected',
        warning ?? (act === 'APPROVE' ? `Payroll from ${formatDate(r.effectiveFrom)} will use the new salary.` : undefined),
        warning ? 'warning' : act === 'APPROVE' ? 'success' : 'info'
      );
      load();
    } catch (err: any) {
      showToast('Action failed', err.message, 'error');
    } finally {
      setActioning(null);
    }
  };

  const formGross = (Number(form.basicMonthly) || 0) + (Number(form.hraMonthly) || 0) + (Number(form.specialMonthly) || 0) + (Number(form.otherAllowanceMonthly) || 0);
  const withoutSalary = employees.filter(e => !current.has(e.id)).length;

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Increments & Salary Revisions"
        subtitle="Joining salary, annual increments and promotions with full history and maker-checker approval"
        actions={
          <button onClick={() => openPropose()} className={primaryBtn}>
            <Plus className="w-4 h-4" /> Propose Revision
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Awaiting approval" value={pending.length} icon={Clock} tone="amber" onClick={() => setTab('PENDING')} />
        <StatCard label="On payroll" value={current.size} icon={Users} onClick={() => setTab('REGISTER')} />
        <StatCard label="No salary on record" value={withoutSalary} hint="Will be skipped in payroll" icon={Users} tone={withoutSalary ? 'rose' : 'slate'} onClick={() => setTab('REGISTER')} />
        <StatCard
          label="Annual CTC (current)"
          value={formatInr(Array.from(current.values()).reduce((s, r) => s + r.ctcAnnual, 0))}
          icon={TrendingUp}
          tone="purple"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['PENDING', `Pending (${pending.length})`],
            ['REGISTER', 'Salary register'],
            ['HISTORY', 'Revision history']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              tab === id ? 'bg-teal-700 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="relative ml-auto w-60">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…" className={`${inputClass} pl-8`} />
        </div>
      </div>

      {loading ? (
        <SkeletonLoader rows={6} />
      ) : tab === 'PENDING' ? (
        pending.filter(r => matches(r.employeeName, r.employeeCode)).length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No revisions awaiting approval" />
        ) : (
          <div className="space-y-3">
            {pending
              .filter(r => matches(r.employeeName, r.employeeCode))
              .map(r => {
                const prev = current.get(r.employeeId);
                const isMine = r.proposedById === currentUser?.id;
                return (
                  <div key={r.id} className={`${cardClass} p-4`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{r.employeeName}</span>
                          <span className="text-[12.5px] font-mono text-slate-500">{r.employeeCode}</span>
                          <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            {r.revisionType}
                          </span>
                        </div>
                        <div className="text-[12.5px] text-slate-500 mt-0.5">
                          {r.designation}
                          {r.newDesignation && ` → ${r.newDesignation}`} · effective {formatDate(r.effectiveFrom)} · proposed by {r.proposedByName ?? '—'}
                        </div>
                        {r.reason && <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">“{r.reason}”</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-[12.5px] text-slate-500">{prev ? `${salaryLabel(prev)} →` : r.payType === 'DAILY' ? 'Daily rate' : 'New CTC'}</div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{salaryLabel(r)}</div>
                        {r.incrementPct != null && (
                          <div className={`text-[12.5px] font-bold ${r.incrementPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {r.incrementPct >= 0 ? '+' : ''}
                            {r.incrementPct}%
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 text-[12.5px]">
                      {(r.payType === 'DAILY'
                        ? [
                            ['Pay type', 'Per day (part-time)'],
                            ['Rate / day', r.dailyRate ?? 0],
                            ['PF', r.pfApplicable ? '12% of gross' : 'No'],
                            ['TDS / month', r.tdsMonthly]
                          ]
                        : [
                        ['Basic', r.basicMonthly],
                        ['HRA', r.hraMonthly],
                        ['Special', r.specialMonthly],
                        ['Gross / month', monthlyGross(r)],
                        ['TDS / month', r.tdsMonthly]
                          ]
                      ).map(([l, v]) => (
                        <div key={l as string} className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <div className="text-slate-500">{l}</div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">{typeof v === 'number' ? formatInr(v) : v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      {!isCeo ? (
                        <span className="text-[12.5px] text-slate-500 italic">Awaiting CEO approval</span>
                      ) : r.employeeId === currentUser?.id ? (
                        <span className="text-[12.5px] text-slate-500 italic">You cannot approve your own salary revision.</span>
                      ) : (
                        <>
                          <button onClick={() => action(r, 'REJECT')} disabled={actioning === r.id} className={secondaryBtn}>
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                          <button onClick={() => action(r, 'APPROVE')} disabled={actioning === r.id} className={primaryBtn}>
                            <CheckCircle2 className="w-4 h-4" /> Approve
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )
      ) : tab === 'REGISTER' ? (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-3 py-3 text-right">Annual CTC</th>
                  <th className="px-3 py-3 text-right">Gross / month</th>
                  <th className="px-3 py-3">Effective since</th>
                  <th className="px-3 py-3">PF</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {employees
                  .filter(e => matches(e.fullName, e.empCode))
                  .map(e => {
                    const cur = current.get(e.id);
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{e.fullName}</div>
                          <div className="text-[12.5px] text-slate-500">
                            {e.empCode} · {e.designation}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{cur ? salaryLabel(cur) : <span className="text-rose-600 font-sans font-semibold">Not set</span>}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{cur ? formatInr(monthlyGross(cur)) : '—'}</td>
                        <td className="px-3 py-2.5">{cur ? `${formatDate(cur.effectiveFrom)} (${cur.revisionType.toLowerCase()})` : '—'}</td>
                        <td className="px-3 py-2.5">{cur ? (cur.pfApplicable ? 'Yes' : 'No') : '—'}</td>
                        <td className="px-3 py-2.5 text-right">
                          {e.id !== currentUser?.id && (!isCeo || isAccounts || accountsEmpIds.has(e.id)) && (
                            <button onClick={() => openPropose(e.id)} className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline">
                              {cur ? 'Increment' : 'Set salary'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Effective</th>
                  <th className="px-3 py-3 text-right">CTC</th>
                  <th className="px-3 py-3 text-right">Change</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Proposed / Approved by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {revisions
                  .filter(r => matches(r.employeeName, r.employeeCode))
                  .map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{r.employeeName}</div>
                        <div className="text-[12.5px] text-slate-500">{r.employeeCode}</div>
                      </td>
                      <td className="px-3 py-2.5">{r.revisionType}</td>
                      <td className="px-3 py-2.5">{formatDate(r.effectiveFrom)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{salaryLabel(r)}</td>
                      <td className="px-3 py-2.5 text-right">{r.incrementPct != null ? `${r.incrementPct}%` : '—'}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-slate-500">
                        {r.proposedByName ?? '—'}
                        {r.approvedByName && ` / ${r.approvedByName}`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {revisions.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <History className="w-6 h-6 text-slate-300" /> No revisions yet.
              </div>
            )}
          </div>
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Propose Salary Revision" subtitle="The CEO must approve" maxWidth="xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Employee *</label>
              <select required value={form.employeeId} onChange={e => onEmployeeChange(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
                <option value="">Select…</option>
                {selectableEmployees
                  .map(e => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.empCode}) — {e.designation}
                    </option>
                  ))}
              </select>
              {form.employeeId && (
                <p className="text-[12.5px] text-slate-500 mt-1">
                  Current: {selectedCurrent ? `${salaryLabel(selectedCurrent)} since ${formatDate(selectedCurrent.effectiveFrom)}` : 'no approved salary yet'}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select value={form.revisionType} onChange={e => set('revisionType', e.target.value as SalaryRevisionType)} className={inputClass}>
                {!selectedCurrent && <option value="JOINING">Joining salary</option>}
                <option value="INCREMENT">Annual increment</option>
                <option value="PROMOTION">Promotion</option>
                <option value="CORRECTION">Correction</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Effective from *</label>
              <input type="date" required value={form.effectiveFrom} onChange={e => set('effectiveFrom', e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Pay type</label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['MONTHLY', 'Monthly salary', 'Prorated by paid days'],
                    ['DAILY', 'Per day (part-time)', 'Days worked × daily rate']
                  ] as Array<[PayType, string, string]>
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${
                      form.payType === value ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <input type="radio" name="payType" checked={form.payType === value} onChange={() => set('payType', value)} className="mt-0.5" />
                    <span>
                      <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">{label}</span>
                      <span className="block text-[12.5px] text-slate-500">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {form.payType === 'DAILY' && (
              <div className="col-span-2 grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Rate per day (₹) *</label>
                  <input type="number" min={0} step="0.01" value={form.dailyRate} onChange={e => set('dailyRate', e.target.value)} className={`${inputClass} font-mono`} placeholder="300" />
                </div>
                <div>
                  <label className={labelClass}>TDS / month (₹)</label>
                  <input type="number" min={0} value={form.tdsMonthly} onChange={e => set('tdsMonthly', e.target.value)} className={`${inputClass} font-mono`} />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 mt-6">
                  <input type="checkbox" checked={form.pfApplicable} onChange={e => set('pfApplicable', e.target.checked)} /> PF (12% of gross)
                </label>
              </div>
            )}
            {form.payType === 'MONTHLY' && selectedCurrent && selectedCurrent.payType === 'MONTHLY' && (
              <div>
                <label className={labelClass}>Increment %</label>
                <input type="number" step="0.01" value={form.incrementPct} onChange={e => onPctChange(e.target.value)} className={inputClass} placeholder="10" />
              </div>
            )}
            {form.payType === 'MONTHLY' && (
              <div className={selectedCurrent?.payType === 'MONTHLY' ? '' : 'col-span-2'}>
                <label className={labelClass}>New annual CTC (₹) *</label>
                <input type="number" min={0} value={form.ctcAnnual} onChange={e => onCtcChange(e.target.value)} className={inputClass} />
              </div>
            )}
            {form.revisionType === 'PROMOTION' && (
              <div className="col-span-2">
                <label className={labelClass}>New designation</label>
                <input value={form.newDesignation} onChange={e => set('newDesignation', e.target.value)} className={inputClass} placeholder="Senior Staff Nurse" />
              </div>
            )}
          </div>

          {form.payType === 'MONTHLY' && (
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Monthly components</span>
              <div className="flex gap-3 text-[12.5px] text-slate-600 dark:text-slate-300">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={form.autoSplit} onChange={e => setForm(prev => applyCtc(prev.ctcAnnual, prev.pfApplicable, e.target.checked, prev))} />
                  Auto-split ({SALARY_SPLIT_POLICY.basicPctOfGross * 100}% basic, HRA {SALARY_SPLIT_POLICY.hraPctOfBasic * 100}% of basic)
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={form.pfApplicable} onChange={e => setForm(prev => applyCtc(prev.ctcAnnual, e.target.checked, prev.autoSplit, prev))} />
                  PF
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(
                [
                  ['basicMonthly', 'Basic'],
                  ['hraMonthly', 'HRA'],
                  ['specialMonthly', 'Special'],
                  ['otherAllowanceMonthly', 'Other'],
                  ['tdsMonthly', 'TDS / month']
                ] as Array<[keyof ProposalForm, string]>
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[11.5px] font-semibold text-slate-500 mb-0.5">{label}</label>
                  <input
                    type="number"
                    min={0}
                    value={form[key] as string}
                    disabled={form.autoSplit && key !== 'tdsMonthly' && key !== 'otherAllowanceMonthly'}
                    onChange={e => set(key, e.target.value as any)}
                    className={`${inputClass} font-mono disabled:opacity-60`}
                  />
                </div>
              ))}
            </div>
            <div className="text-[12.5px] text-slate-500">
              Gross / month: <strong className="text-slate-800 dark:text-slate-200">{formatInr(formGross)}</strong>
            </div>
          </div>
          )}

          <div>
            <label className={labelClass}>Reason / appraisal note</label>
            <textarea rows={2} value={form.reason} onChange={e => set('reason', e.target.value)} className={inputClass} placeholder="FY 26-27 appraisal — rating 4.2/5" />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryBtn}>
              {saving ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
