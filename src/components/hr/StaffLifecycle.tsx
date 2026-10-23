import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi, lifecycleApi } from '../../api';
import type { Employee, LifecycleTask } from '../../types';
import { formatDate, getTodayIsoString } from '../../utils/dateUtils';
import { ClipboardCheck, UserMinus, UserPlus, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { PageHeader, EmptyState, inputClass, labelClass, primaryBtn, secondaryBtn, cardClass } from '../common/PageHeader';
import { ProbationAnniversaryWidgets } from './ProbationAnniversaryWidgets';

const OWNER_CLASS: Record<LifecycleTask['ownerRole'], string> = {
  HR: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  IT: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  ACCOUNTS: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  MANAGER: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
};

export const StaffLifecycle: React.FC = () => {
  const { currentUser, roles, isHr, showToast, setActiveNav } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<LifecycleTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [kind, setKind] = useState<LifecycleTask['kind']>('ONBOARDING');
  const [onlyMine, setOnlyMine] = useState(!isHr);
  const [showCompleted, setShowCompleted] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  const [showExit, setShowExit] = useState(false);
  const [exitEmp, setExitEmp] = useState<number | ''>('');
  const [exitDate, setExitDate] = useState(getTodayIsoString());
  const [exitReason, setExitReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [t, e] = await Promise.all([lifecycleApi.getTasks(), hrApi.getEmployees()]);
      setTasks(t);
      setEmployees(e);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load checklists', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser?.id]);

  const managerOf = useMemo(() => new Map(employees.map(e => [e.id, e.managerId])), [employees]);

  const canAct = (t: LifecycleTask) =>
    isHr ||
    roles.includes(t.ownerRole as any) ||
    (t.ownerRole === 'MANAGER' && managerOf.get(t.employeeId) === currentUser?.id);

  const groups = useMemo(() => {
    const filtered = tasks.filter(t => t.kind === kind).filter(t => !onlyMine || canAct(t));
    const byEmp = new Map<number, LifecycleTask[]>();
    filtered.forEach(t => byEmp.set(t.employeeId, [...(byEmp.get(t.employeeId) ?? []), t]));
    return Array.from(byEmp.entries())
      .map(([employeeId, list]) => ({
        employeeId,
        name: list[0].employeeName ?? `#${employeeId}`,
        code: list[0].employeeCode ?? '',
        tasks: list,
        done: list.filter(t => t.done).length
      }))
      .filter(g => showCompleted || g.done < g.tasks.length)
      .sort((a, b) => a.done / a.tasks.length - b.done / b.tasks.length);
  }, [tasks, kind, onlyMine, showCompleted, roles, managerOf]);

  const toggle = async (t: LifecycleTask) => {
    setToggling(t.id);
    try {
      await lifecycleApi.setTaskDone(t.id, !t.done);
      setTasks(prev => prev.map(x => (x.id === t.id ? { ...x, done: !t.done, doneByName: currentUser?.fullName, doneAt: new Date().toISOString() } : x)));
    } catch (err: any) {
      showToast('Update failed', err.message, 'error');
    } finally {
      setToggling(null);
    }
  };

  const initiateExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitEmp) return;
    setSaving(true);
    try {
      const { warnings } = await lifecycleApi.initiateExit(Number(exitEmp), exitDate, exitReason);
      const emp = employees.find(x => x.id === Number(exitEmp));
      showToast(
        'Exit initiated',
        warnings.length ? warnings.join(' ') : `${emp?.fullName} is on notice. IT, Accounts & manager have their clearance tasks.`,
        warnings.length ? 'warning' : 'success'
      );
      setShowExit(false);
      setKind('OFFBOARDING');
      load();
    } catch (err: any) {
      showToast('Could not initiate exit', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const today = getTodayIsoString();

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Onboarding & Exit Checklists"
        subtitle="Every joiner and leaver gets tasks for HR, IT, Accounts and the reporting manager — nothing falls through the cracks"
        actions={
          isHr ? (
            <>
              <button onClick={() => setShowExit(true)} className={secondaryBtn}>
                <UserMinus className="w-4 h-4" /> Initiate Exit
              </button>
              <button onClick={() => setActiveNav('hr-register')} className={primaryBtn}>
                <UserPlus className="w-4 h-4" /> Register New Staff
              </button>
            </>
          ) : undefined
        }
      />

      {/* Probation & Milestone Anniversary Widgets */}
      <ProbationAnniversaryWidgets />

      <div className="flex flex-wrap items-center gap-2">
        {(['ONBOARDING', 'OFFBOARDING'] as const).map(k => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              kind === k ? 'bg-teal-700 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {k === 'ONBOARDING' ? 'Onboarding' : 'Exit clearance'}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} /> Only my tasks
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} /> Show completed
        </label>
      </div>

      {loading ? (
        <SkeletonLoader rows={5} />
      ) : groups.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="All caught up" message="No open checklist items for this view." />
      ) : (
        <div className="space-y-4">
          {groups.map(g => {
            const pct = Math.round((g.done / g.tasks.length) * 100);
            return (
              <div key={g.employeeId} className={`${cardClass} p-4`}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{g.name}</div>
                    <div className="text-[12.5px] text-slate-500 font-mono">{g.code}</div>
                  </div>
                  <div className="w-40">
                    <div className="flex justify-between text-[11.5px] text-slate-500 mb-1">
                      <span>
                        {g.done}/{g.tasks.length} done
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-teal-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {g.tasks.map(t => {
                    const overdue = !t.done && t.dueDate && t.dueDate < today;
                    const allowed = canAct(t);
                    return (
                      <li key={t.id} className="py-2 flex items-center gap-3 text-xs">
                        <button
                          onClick={() => allowed && toggle(t)}
                          disabled={!allowed || toggling === t.id}
                          title={allowed ? 'Toggle done' : `Owned by ${t.ownerRole}`}
                          className={allowed ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                        >
                          {t.done ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />}
                        </button>
                        <span className={`flex-1 ${t.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{t.title}</span>
                        <span className={`text-[11.5px] font-bold px-2 py-0.5 rounded-full border ${OWNER_CLASS[t.ownerRole]}`}>{t.ownerRole}</span>
                        <span className={`w-24 text-right text-[12.5px] ${overdue ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                          {overdue && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                          {t.done ? (t.doneByName ? `✓ ${t.doneByName.split(' ')[0]}` : '✓') : formatDate(t.dueDate)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showExit} onClose={() => setShowExit(false)} title="Initiate Employee Exit" subtitle="Sets notice period, last working day, and opens the clearance checklist">
        <form onSubmit={initiateExit} className="space-y-4">
          <div>
            <label className={labelClass}>Employee *</label>
            <select required value={exitEmp} onChange={e => setExitEmp(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
              <option value="">Select…</option>
              {employees
                .filter(e => e.status !== 'EXITED' && e.status !== 'NOTICE_PERIOD')
                .map(e => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.empCode})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Last working day *</label>
            <input type="date" required value={exitDate} onChange={e => setExitDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Reason</label>
            <textarea rows={2} value={exitReason} onChange={e => setExitReason(e.target.value)} className={inputClass} placeholder="Resignation — higher studies" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowExit(false)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !exitEmp} className={primaryBtn}>
              {saving ? 'Saving…' : 'Initiate Exit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
