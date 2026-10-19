import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi, lifecycleApi } from '../../api';
import { PROVISIONING_ITEMS, type ProvisioningItem, type RegistrationPayload, type RegistrationResult } from '../../api/lifecycle';
import type { Department, Employee, EmploymentType, RoleType } from '../../types';
import { SALARY_SPLIT_POLICY } from '../../config/policy';
import { splitCtc, formatInr } from '../../lib/payrollEngine';
import { getTodayIsoString } from '../../utils/dateUtils';
import {
  Briefcase,
  User,
  KeyRound,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  UserPlus
} from 'lucide-react';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { COMPANY } from '../../config/company';
import { PageHeader, inputClass, labelClass, primaryBtn, secondaryBtn, cardClass } from '../common/PageHeader';

const STEPS = [
  { id: 'job', label: 'Job & Reporting', icon: Briefcase },
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'access', label: 'Access & Salary', icon: KeyRound },
  { id: 'review', label: 'Review', icon: ClipboardCheck }
] as const;

const MOBILE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/;

interface FormState {
  empCode: string;
  fullName: string;
  officialEmail: string;
  personalEmail: string;
  mobile: string;
  departmentId: number | '';
  designation: string;
  employmentType: EmploymentType;
  dateOfJoining: string;
  workLocation: string;
  division: string;
  managerId: number | '' | 'NONE';
  probation: boolean;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  maritalStatus: string;
  fatherName: string;
  currentAddress: string;
  permanentAddress: string;
  sameAddress: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  extraRoles: RoleType[];
  provisioning: ProvisioningItem[];
  offeredCtc: string;
  pfApplicable: boolean;
  sendLoginInvite: boolean;
}

const initialState = (): FormState => ({
  empCode: '',
  fullName: '',
  officialEmail: '',
  personalEmail: '',
  mobile: '',
  departmentId: '',
  designation: '',
  employmentType: 'FULL_TIME',
  dateOfJoining: getTodayIsoString(),
  workLocation: '',
  division: COMPANY.defaultDivision,
  managerId: '',
  probation: true,
  dateOfBirth: '',
  gender: '',
  bloodGroup: '',
  maritalStatus: '',
  fatherName: '',
  currentAddress: '',
  permanentAddress: '',
  sameAddress: true,
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  extraRoles: [],
  provisioning: ['EMAIL', 'LAPTOP', 'ID_CARD'],
  offeredCtc: '',
  pfApplicable: true,
  sendLoginInvite: true
});

export const NewStaffRegistration: React.FC = () => {
  const { currentUser, showToast, setActiveNav, isCeo, isAdmin } = useAuth();
  // Only the CEO / system admin may hand out Accounts or Director access.
  const assignableRoles: RoleType[] = isCeo || isAdmin ? ['MANAGER', 'DIRECTOR', 'HR', 'ACCOUNTS', 'IT'] : ['MANAGER', 'HR', 'IT'];
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);

  const loadRefs = async () => {
    try {
      setLoading(true);
      const [d, e, code] = await Promise.all([hrApi.getDepartments(), hrApi.getEmployees(), lifecycleApi.suggestEmployeeCode()]);
      setDepartments(d);
      setEmployees(e.filter(x => x.status !== 'EXITED'));
      setForm(prev => ({ ...prev, empCode: prev.empCode || code }));
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load departments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefs();
  }, [currentUser?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleList = <T extends string>(key: 'extraRoles' | 'provisioning', value: T) =>
    setForm(prev => {
      const list = prev[key] as string[];
      return { ...prev, [key]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] };
    });

  const deptHeadId = departments.find(d => d.id === form.departmentId)?.headId;

  const ctcSplit = useMemo(() => {
    const ctc = Number(form.offeredCtc);
    return ctc > 0 ? splitCtc(ctc, SALARY_SPLIT_POLICY.basicPctOfGross, SALARY_SPLIT_POLICY.hraPctOfBasic, form.pfApplicable) : null;
  }, [form.offeredCtc, form.pfApplicable]);

  const validate = (s: number): string | null => {
    if (s === 0) {
      if (!form.fullName.trim()) return 'Full name is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.officialEmail)) return 'Enter a valid official email.';
      if (employees.some(e => e.officialEmail.toLowerCase() === form.officialEmail.toLowerCase())) return 'This official email already belongs to an employee.';
      if (!form.empCode.trim()) return 'Employee code is required.';
      if (employees.some(e => e.empCode.toLowerCase() === form.empCode.toLowerCase())) return 'Employee code already in use.';
      if (form.mobile && !MOBILE_RE.test(form.mobile.replace(/\s/g, ''))) return 'Enter a valid 10-digit Indian mobile number.';
      if (!form.departmentId) return 'Select a department.';
      if (!form.designation.trim()) return 'Designation is required.';
      if (!form.dateOfJoining) return 'Date of joining is required.';
      if (!form.managerId) return 'Select a reporting manager (or choose "None — Top Executive / Reports to Board").';
    }
    if (s === 1) {
      if (form.emergencyContactPhone && !MOBILE_RE.test(form.emergencyContactPhone.replace(/\s/g, ''))) return 'Emergency contact number looks invalid.';
    }
    return null;
  };

  const next = () => {
    const err = validate(step);
    if (err) {
      showToast('Check this step', err, 'error');
      return;
    }
    setStep(s => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = async () => {
    for (let s = 0; s < 2; s++) {
      const err = validate(s);
      if (err) {
        setStep(s);
        showToast('Check this step', err, 'error');
        return;
      }
    }
    const payload: RegistrationPayload = {
      employee: {
        empCode: form.empCode.trim(),
        fullName: form.fullName.trim(),
        officialEmail: form.officialEmail.trim(),
        personalEmail: form.personalEmail.trim() || undefined,
        mobile: form.mobile.trim() || undefined,
        departmentId: Number(form.departmentId),
        designation: form.designation.trim(),
        employmentType: form.employmentType,
        dateOfJoining: form.dateOfJoining,
        workLocation: form.workLocation.trim() || undefined,
        division: form.division.trim() || undefined,
        managerId: form.managerId && form.managerId !== 'NONE' ? Number(form.managerId) : undefined,
        probation: form.probation
      },
      profile: {
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        bloodGroup: form.bloodGroup || undefined,
        maritalStatus: form.maritalStatus || undefined,
        fatherName: form.fatherName || undefined,
        currentAddress: form.currentAddress || undefined,
        permanentAddress: (form.sameAddress ? form.currentAddress : form.permanentAddress) || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        emergencyContactRelation: form.emergencyContactRelation || undefined
      },
      extraRoles: form.extraRoles,
      provisioning: form.provisioning,
      offeredCtcAnnual: Number(form.offeredCtc) || undefined,
      pfApplicable: form.pfApplicable,
      sendLoginInvite: form.sendLoginInvite
    };

    setSubmitting(true);
    try {
      const res = await lifecycleApi.registerEmployee(payload);
      setResult(res);
      showToast(
        'Staff registered',
        `${res.employee.fullName} (${res.employee.empCode}) added${res.warnings.length ? ` with ${res.warnings.length} follow-up(s)` : ''}.`,
        res.warnings.length ? 'warning' : 'success'
      );
    } catch (err: any) {
      showToast('Registration failed', err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = async () => {
    setResult(null);
    setStep(0);
    setForm(initialState());
    loadRefs();
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (result) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <div className={`${cardClass} p-6 space-y-5`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{result.employee.fullName} is registered</h1>
              <p className="text-xs text-slate-500">
                {result.employee.empCode} · {result.employee.designation} · reports to {result.employee.managerName ?? '—'}
              </p>
            </div>
          </div>
          <ul className="space-y-1.5 text-xs">
            {result.completed.map(c => (
              <li key={c} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> {c}
              </li>
            ))}
            {result.warnings.map(w => (
              <li key={w} className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" /> {w}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={reset} className={primaryBtn}>
              <UserPlus className="w-4 h-4" /> Register another
            </button>
            <button onClick={() => setActiveNav('hr-lifecycle')} className={secondaryBtn}>
              <ClipboardCheck className="w-4 h-4" /> Open onboarding checklist
            </button>
          </div>
        </div>
      </div>
    );
  }

  const field = (label: string, node: React.ReactNode, span2 = false) => (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className={labelClass}>{label}</label>
      {node}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="New Staff Registration"
        subtitle="One form creates the employee, profile, leave balances, onboarding checklist, IT provisioning ticket, joining salary for Accounts, and portal login"
      />

      {/* Stepper */}
      <ol className="grid grid-cols-5 gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const state = i < step ? 'done' : i === step ? 'current' : 'todo';
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className={`w-full flex flex-col sm:flex-row items-center gap-1.5 p-2 rounded-lg text-[12.5px] font-semibold border transition-colors ${
                  state === 'current'
                    ? 'bg-teal-700 text-white border-teal-700'
                    : state === 'done'
                    ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className={`${cardClass} p-5`}>
        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Full name *', <input value={form.fullName} onChange={e => set('fullName', e.target.value)} className={inputClass} placeholder="Dr. Priya Nair" />)}
            {field('Employee code *', <input value={form.empCode} onChange={e => set('empCode', e.target.value)} className={`${inputClass} font-mono`} />)}
            {field('Official email *', <input type="email" value={form.officialEmail} onChange={e => set('officialEmail', e.target.value)} className={inputClass} placeholder="priya.nair@secondmedic.com" />)}
            {field('Personal email', <input type="email" value={form.personalEmail} onChange={e => set('personalEmail', e.target.value)} className={inputClass} />)}
            {field('Personal mobile', <input value={form.mobile} onChange={e => set('mobile', e.target.value)} className={inputClass} placeholder="98xxxxxxxx" />)}
            {field('Work location', <input value={form.workLocation} onChange={e => set('workLocation', e.target.value)} className={inputClass} placeholder="Mumbai HQ / Field" />)}
            {field('Division (state)', <input value={form.division} onChange={e => set('division', e.target.value)} className={inputClass} placeholder="Maharashtra" />)}
            {field(
              'Department *',
              <select
                value={form.departmentId}
                onChange={e => {
                  const id = e.target.value ? Number(e.target.value) : '';
                  const head = departments.find(d => d.id === id)?.headId;
                  setForm(prev => ({ ...prev, departmentId: id, managerId: prev.managerId || head || '' }));
                }}
                className={inputClass}
              >
                <option value="">Select…</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
            {field('Designation *', <input value={form.designation} onChange={e => set('designation', e.target.value)} className={inputClass} placeholder="Staff Nurse" />)}
            {field(
              'Employment type',
              <select value={form.employmentType} onChange={e => set('employmentType', e.target.value as EmploymentType)} className={inputClass}>
                <option value="FULL_TIME">Full time</option>
                <option value="PART_TIME">Part time</option>
                <option value="CONTRACT">Contract</option>
                <option value="CONSULTANT">Consultant</option>
                <option value="FIELD">Field staff</option>
                <option value="INTERN">Intern</option>
              </select>
            )}
            {field('Date of joining *', <input type="date" value={form.dateOfJoining} onChange={e => set('dateOfJoining', e.target.value)} className={inputClass} />)}
            {field(
              'Reporting manager * (approves leave & attendance)',
              <select
                value={form.managerId}
                onChange={e => {
                  const val = e.target.value;
                  set('managerId', val === 'NONE' ? 'NONE' : val ? Number(val) : '');
                }}
                className={inputClass}
              >
                <option value="">Select…</option>
                <option value="NONE">None — Top-level executive / reports to Board (Approvals route to HR)</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} — {e.designation}
                    {e.id === deptHeadId ? ' (dept head)' : ''}
                  </option>
                ))}
              </select>,
              true
            )}
            <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={form.probation} onChange={e => set('probation', e.target.checked)} />
              Starts on probation (probation-ineligible leave types won't be credited)
            </label>

            <div className="sm:col-span-2 p-3 rounded-lg border border-teal-200 dark:border-teal-800/80 bg-teal-50/50 dark:bg-teal-950/30">
              <label className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.extraRoles.includes('MANAGER')}
                  onChange={() => toggleList('extraRoles', 'MANAGER')}
                  className="mt-0.5 rounded text-teal-700 focus:ring-teal-700 w-4 h-4"
                />
                <div>
                  <span className="font-bold text-teal-950 dark:text-teal-200">Register as a Manager / Team Lead</span>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Grants access to the <strong>"My Team"</strong> workspace (approving team leave, attendance regularization, holiday work claims, and team KPIs).
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Date of birth', <input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} className={inputClass} />)}
            {field(
              'Gender',
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className={inputClass}>
                <option value="">—</option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            )}
            {field(
              'Blood group',
              <select value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)} className={inputClass}>
                <option value="">—</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            )}
            {field(
              'Marital status',
              <select value={form.maritalStatus} onChange={e => set('maritalStatus', e.target.value)} className={inputClass}>
                <option value="">—</option>
                <option>Single</option>
                <option>Married</option>
                <option>Other</option>
              </select>
            )}
            {field("Father's / guardian's name", <input value={form.fatherName} onChange={e => set('fatherName', e.target.value)} className={inputClass} />, true)}
            {field('Current address', <textarea rows={2} value={form.currentAddress} onChange={e => set('currentAddress', e.target.value)} className={inputClass} />, true)}
            <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={form.sameAddress} onChange={e => set('sameAddress', e.target.checked)} />
              Permanent address same as current
            </label>
            {!form.sameAddress &&
              field('Permanent address', <textarea rows={2} value={form.permanentAddress} onChange={e => set('permanentAddress', e.target.value)} className={inputClass} />, true)}
            {field('Emergency contact name', <input value={form.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)} className={inputClass} />)}
            {field('Relation', <input value={form.emergencyContactRelation} onChange={e => set('emergencyContactRelation', e.target.value)} className={inputClass} placeholder="Spouse / Parent" />)}
            {field('Emergency contact number', <input value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} className={inputClass} />)}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">Portal access</h3>
              <p className="text-[12.5px] text-slate-500 mb-2">
                Everyone gets Employee self-service. Manager approvals switch on automatically once someone reports to them. Bank and ID details are added later by Accounts.
              </p>
              <div className="flex flex-wrap gap-2">
                {assignableRoles.map(r => (
                  <label
                    key={r}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                      form.extraRoles.includes(r)
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <input type="checkbox" className="hidden" checked={form.extraRoles.includes(r)} onChange={() => toggleList('extraRoles', r)} />
                    {r}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 mt-3">
                <input type="checkbox" checked={form.sendLoginInvite} onChange={e => set('sendLoginInvite', e.target.checked)} />
                Email a portal login (set-password link) to the official email
              </label>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">IT provisioning (raises a ticket for IT)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PROVISIONING_ITEMS.map(item => (
                  <label key={item.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={form.provisioning.includes(item.id)} onChange={() => toggleList('provisioning', item.id)} />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">Joining salary (sent to Accounts for approval)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Offered CTC per annum (₹)', <input type="number" min={0} value={form.offeredCtc} onChange={e => set('offeredCtc', e.target.value)} className={inputClass} placeholder="480000" />)}
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 sm:mt-6">
                  <input type="checkbox" checked={form.pfApplicable} onChange={e => set('pfApplicable', e.target.checked)} />
                  PF applicable
                </label>
              </div>
              {ctcSplit && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-[12.5px]">
                  {[
                    ['Basic / month', ctcSplit.basicMonthly],
                    ['HRA / month', ctcSplit.hraMonthly],
                    ['Special / month', ctcSplit.specialMonthly]
                  ].map(([l, v]) => (
                    <div key={l as string} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="text-slate-500">{l}</div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{formatInr(v as number)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-xs">
            <ReviewBlock
              title="Job"
              rows={[
                ['Name', form.fullName],
                ['Code', form.empCode],
                ['Email', form.officialEmail],
                ['Department', departments.find(d => d.id === form.departmentId)?.name],
                ['Designation', form.designation],
                ['Joining', form.dateOfJoining],
                ['Reports to', form.managerId === 'NONE' ? 'None (Reports to Board / HR Queue)' : employees.find(e => e.id === form.managerId)?.fullName || '—'],
                ['Status', form.probation ? 'Probation' : 'Active']
              ]}
            />
            <ReviewBlock
              title="Access & provisioning"
              rows={[
                ['Roles', ['EMPLOYEE', ...form.extraRoles].join(', ')],
                ['IT items', PROVISIONING_ITEMS.filter(i => form.provisioning.includes(i.id)).map(i => i.label).join(', ') || 'None'],
                ['Offered CTC', form.offeredCtc ? formatInr(Number(form.offeredCtc)) : 'Not set'],
                ['Login invite', form.sendLoginInvite ? 'Yes' : 'No']
              ]}
            />
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className={secondaryBtn}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className={primaryBtn}>
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={submitting} className={primaryBtn}>
            <UserPlus className="w-4 h-4" /> {submitting ? 'Registering…' : 'Register Staff Member'}
          </button>
        )}
      </div>
    </div>
  );
};

const ReviewBlock: React.FC<{ title: string; rows: Array<[string, React.ReactNode]> }> = ({ title, rows }) => (
  <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2">{title}</h3>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-slate-500">{k}</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100 text-right">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  </div>
);
