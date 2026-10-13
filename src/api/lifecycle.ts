import { createClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, normalizeSupabaseUrl } from '../lib/supabase';
import { getSessionEmployee, logAudit, financialYearLabel } from './session';
import { mapEmployee, mapEmployeeProfile, mapLeaveType, mapLifecycleTask } from './mappers';
import { splitCtc } from '../lib/payrollEngine';
import { SALARY_SPLIT_POLICY } from '../config/policy';
import type {
  Employee,
  EmployeeProfile,
  EmploymentType,
  LifecycleTask,
  LifecycleTaskOwner,
  RoleType
} from '../types';

const EMPLOYEE_SELECT = '*, department:departments!employees_department_id_fkey(name), manager:employees!employees_manager_id_fkey(full_name)';
const TASK_SELECT =
  '*, employee:employees!lifecycle_tasks_employee_id_fkey(full_name, emp_code), doer:employees!lifecycle_tasks_done_by_fkey(full_name)';

/** Provisioning items HR can request from IT for a new joiner. */
export const PROVISIONING_ITEMS = [
  { id: 'EMAIL', label: 'Official email & portal login' },
  { id: 'LAPTOP', label: 'Laptop' },
  { id: 'MOBILE', label: 'Company mobile handset' },
  { id: 'SIM', label: 'Company SIM / mobile number' },
  { id: 'ID_CARD', label: 'ID card & access badge' },
  { id: 'HIS_ACCESS', label: 'Clinical / HIS software access' }
] as const;

export type ProvisioningItem = (typeof PROVISIONING_ITEMS)[number]['id'];

const ONBOARDING_TEMPLATE: Array<{ owner: LifecycleTaskOwner; title: string; dueOffsetDays: number }> = [
  { owner: 'HR', title: 'Collect signed offer letter & appointment letter', dueOffsetDays: -3 },
  { owner: 'HR', title: 'Verify ID, address proof, education & experience documents', dueOffsetDays: 0 },
  { owner: 'HR', title: 'Background / reference verification', dueOffsetDays: 7 },
  { owner: 'HR', title: 'Induction & policy walkthrough (leave, attendance, code of conduct)', dueOffsetDays: 1 },
  { owner: 'IT', title: 'Provision requested IT assets & accounts', dueOffsetDays: 0 },
  { owner: 'ACCOUNTS', title: 'Verify bank account, PAN & UAN for payroll', dueOffsetDays: 3 },
  { owner: 'ACCOUNTS', title: 'Approve joining salary structure', dueOffsetDays: 3 },
  { owner: 'MANAGER', title: 'Day-1 welcome & role briefing', dueOffsetDays: 0 },
  { owner: 'MANAGER', title: 'Set probation goals / KPIs', dueOffsetDays: 14 }
];

const OFFBOARDING_TEMPLATE: Array<{ owner: LifecycleTaskOwner; title: string; dueOffsetDays: number }> = [
  { owner: 'HR', title: 'Accept resignation & confirm last working day', dueOffsetDays: -25 },
  { owner: 'MANAGER', title: 'Knowledge transfer & handover sign-off', dueOffsetDays: -2 },
  { owner: 'IT', title: 'Collect all assigned assets (laptop, mobile, SIM, ID card)', dueOffsetDays: 0 },
  { owner: 'IT', title: 'Revoke email, portal & software access', dueOffsetDays: 0 },
  { owner: 'ACCOUNTS', title: 'Full & final settlement (leave encashment, recoveries)', dueOffsetDays: 30 },
  { owner: 'HR', title: 'Exit interview', dueOffsetDays: -1 },
  { owner: 'HR', title: 'Issue relieving & experience letters', dueOffsetDays: 30 }
];

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function randomPassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('') + 'A!9';
}

export interface RegistrationPayload {
  employee: {
    empCode: string;
    fullName: string;
    officialEmail: string;
    personalEmail?: string;
    mobile?: string;
    departmentId: number;
    designation: string;
    employmentType: EmploymentType;
    dateOfJoining: string;
    workLocation?: string;
    managerId?: number;
    probation: boolean;
  };
  profile: Omit<EmployeeProfile, 'employeeId'>;
  extraRoles: RoleType[];
  provisioning: ProvisioningItem[];
  offeredCtcAnnual?: number;
  pfApplicable: boolean;
  sendLoginInvite: boolean;
}

export interface RegistrationResult {
  employee: Employee;
  completed: string[];
  warnings: string[];
}

export const lifecycleApi = {
  async suggestEmployeeCode(): Promise<string> {
    const { data, error } = await supabase.from('employees').select('emp_code');
    if (error || !data || data.length === 0) return 'SM001';
    let prefix = 'SM';
    let max = 0;
    let width = 3;
    for (const { emp_code } of data) {
      const m = /^([A-Za-z-]*)(\d+)$/.exec(emp_code ?? '');
      if (m && Number(m[2]) >= max) {
        prefix = m[1];
        max = Number(m[2]);
        width = m[2].length;
      }
    }
    return `${prefix}${String(max + 1).padStart(width, '0')}`;
  },

  /**
   * Register a new staff member end-to-end. The employee row is mandatory; every
   * downstream step (profile, roles, leave, checklist, IT ticket, salary, invite)
   * is attempted and reported individually so HR knows exactly what to follow up.
   */
  async registerEmployee(payload: RegistrationPayload): Promise<RegistrationResult> {
    const me = await getSessionEmployee();
    const completed: string[] = [];
    const warnings: string[] = [];
    const e = payload.employee;

    const { data: created, error } = await supabase
      .from('employees')
      .insert({
        emp_code: e.empCode,
        full_name: e.fullName,
        official_email: e.officialEmail.toLowerCase(),
        personal_email: e.personalEmail || null,
        mobile: e.mobile || null,
        phone: e.mobile || null,
        department_id: e.departmentId,
        designation: e.designation,
        employment_type: e.employmentType,
        date_of_joining: e.dateOfJoining,
        work_location: e.workLocation || null,
        status: e.probation ? 'PROBATION' : 'ACTIVE',
        manager_id: e.managerId ?? null
      })
      .select(EMPLOYEE_SELECT)
      .single();

    if (error || !created) {
      if (error?.code === '23505') throw new Error('Employee code or official email already exists.');
      throw new Error(`Failed to create employee: ${error?.message}`);
    }
    completed.push('Employee record created');
    const employeeId = created.id;

    // Personal, statutory & bank profile
    const p = payload.profile;
    const { error: profileError } = await supabase.from('employee_profiles').upsert({
      employee_id: employeeId,
      date_of_birth: p.dateOfBirth || null,
      gender: p.gender || null,
      blood_group: p.bloodGroup || null,
      marital_status: p.maritalStatus || null,
      father_name: p.fatherName || null,
      current_address: p.currentAddress || null,
      permanent_address: p.permanentAddress || null,
      emergency_contact_name: p.emergencyContactName || null,
      emergency_contact_phone: p.emergencyContactPhone || null,
      emergency_contact_relation: p.emergencyContactRelation || null,
      pan_number: p.panNumber ? p.panNumber.toUpperCase() : null,
      aadhaar_last4: p.aadhaarLast4 || null,
      uan_number: p.uanNumber || null,
      esic_number: p.esicNumber || null,
      bank_name: p.bankName || null,
      bank_account_number: p.bankAccountNumber || null,
      bank_ifsc: p.bankIfsc ? p.bankIfsc.toUpperCase() : null,
      updated_at: new Date().toISOString()
    });
    if (profileError) warnings.push(`Profile not saved: ${profileError.message}`);
    else completed.push('Personal, statutory & bank details saved');

    // Roles & system user
    const roles = Array.from(new Set<RoleType>(['EMPLOYEE', ...payload.extraRoles]));
    const { error: rolesError } = await supabase
      .from('employee_roles')
      .insert(roles.map(role => ({ employee_id: employeeId, role })));
    if (rolesError) warnings.push(`Roles not assigned: ${rolesError.message}`);
    else completed.push(`Access roles: ${roles.join(', ')}`);

    const { error: sysUserError } = await supabase.from('system_users').insert({ employee_id: employeeId });
    if (sysUserError) warnings.push(`System user not registered: ${sysUserError.message}`);

    // Leave balances prorated by joining month within the financial year
    try {
      const { data: typeRows, error: typeError } = await supabase.from('leave_types').select('*');
      if (typeError) throw typeError;
      const doj = new Date(e.dateOfJoining);
      const fyLabel = financialYearLabel(doj);
      const fyStartYear = Number(fyLabel.slice(0, 4));
      const monthsElapsed = (doj.getFullYear() - fyStartYear) * 12 + (doj.getMonth() - 3);
      const monthsRemaining = Math.max(0, 12 - monthsElapsed);
      const balances = (typeRows ?? [])
        .map(mapLeaveType)
        .filter(t => t.active !== false && t.code !== 'LOP')
        .filter(t => !e.probation || t.probationEligible !== false)
        .map(t => {
          const prorated =
            t.accrualMode === 'MONTHLY' ? 0 : Math.floor(((t.annualQuota * monthsRemaining) / 12) * 2) / 2;
          return {
            employee_id: employeeId,
            leave_type_id: t.id,
            fy_year: fyLabel,
            opening: prorated,
            accrued: 0,
            used: 0,
            reserved: 0,
            encashed: 0,
            lapsed: 0
          };
        });
      if (balances.length > 0) {
        const { error: balError } = await supabase.from('leave_balances').insert(balances);
        if (balError) throw balError;
        completed.push(`Leave balances opened for FY ${fyLabel} (prorated ${monthsRemaining}/12)`);
      }
    } catch (err: any) {
      warnings.push(`Leave balances not created: ${err.message ?? err}`);
    }

    // Onboarding checklist for HR / IT / Accounts / Manager
    const { error: taskError } = await supabase.from('lifecycle_tasks').insert(
      ONBOARDING_TEMPLATE.map(t => ({
        employee_id: employeeId,
        kind: 'ONBOARDING' as const,
        owner_role: t.owner,
        title: t.title,
        due_date: addDays(e.dateOfJoining, t.dueOffsetDays)
      }))
    );
    if (taskError) warnings.push(`Onboarding checklist not created: ${taskError.message}`);
    else completed.push(`Onboarding checklist (${ONBOARDING_TEMPLATE.length} tasks)`);

    // IT provisioning ticket
    if (payload.provisioning.length > 0) {
      const items = PROVISIONING_ITEMS.filter(i => payload.provisioning.includes(i.id)).map(i => `• ${i.label}`);
      const { error: itError } = await supabase.from('it_requests').insert({
        employee_id: employeeId,
        request_type: 'ONBOARDING',
        title: `Onboarding: ${e.fullName} (${e.empCode}) joins ${e.dateOfJoining}`,
        details: `${e.designation}${e.workLocation ? ` · ${e.workLocation}` : ''}\nPlease provision:\n${items.join('\n')}`,
        priority: 'HIGH',
        raised_by: me.id
      });
      if (itError) warnings.push(`IT provisioning request not raised: ${itError.message}`);
      else completed.push('IT provisioning request raised');
    }

    // Joining salary proposal for Accounts (HR proposes, Accounts approves)
    if (payload.offeredCtcAnnual && payload.offeredCtcAnnual > 0) {
      const split = splitCtc(
        payload.offeredCtcAnnual,
        SALARY_SPLIT_POLICY.basicPctOfGross,
        SALARY_SPLIT_POLICY.hraPctOfBasic,
        payload.pfApplicable
      );
      const { error: salError } = await supabase.from('salary_revisions').insert({
        employee_id: employeeId,
        revision_type: 'JOINING',
        effective_from: e.dateOfJoining,
        ctc_annual: payload.offeredCtcAnnual,
        basic_monthly: split.basicMonthly,
        hra_monthly: split.hraMonthly,
        special_monthly: split.specialMonthly,
        pf_applicable: payload.pfApplicable,
        reason: 'Offer letter CTC',
        status: 'PROPOSED',
        proposed_by: me.id
      });
      if (salError) warnings.push(`Joining salary not sent to Accounts: ${salError.message}`);
      else completed.push('Joining salary sent to Accounts for approval');
    }

    // Portal login invite (isolated client so HR's own session is untouched)
    if (payload.sendLoginInvite && isSupabaseConfigured) {
      try {
        const inviteClient = createClient(
          normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL),
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sm-invite' } }
        );
        const email = e.officialEmail.toLowerCase();
        const { error: signUpError } = await inviteClient.auth.signUp({
          email,
          password: randomPassword(),
          options: { data: { full_name: e.fullName, emp_code: e.empCode } }
        });
        if (signUpError) throw signUpError;
        await inviteClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        completed.push(`Login invite emailed to ${email}`);
      } catch (err: any) {
        warnings.push(`Login invite not sent: ${err.message ?? err}. Invite them from Supabase Auth instead.`);
      }
    }

    await logAudit(me, 'EMPLOYEE', 'EMPLOYEE_REGISTERED', `${e.fullName} (${e.empCode}) registered`, {
      type: 'employee',
      id: employeeId
    });

    return { employee: mapEmployee(created), completed, warnings };
  },

  async getProfile(employeeId: number): Promise<EmployeeProfile | null> {
    const { data, error } = await supabase
      .from('employee_profiles')
      .select('*')
      .eq('employee_id', employeeId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load profile: ${error.message}`);
    return data ? mapEmployeeProfile(data) : null;
  },

  async getTasks(kind?: LifecycleTask['kind']): Promise<LifecycleTask[]> {
    let query = supabase.from('lifecycle_tasks').select(TASK_SELECT);
    if (kind) query = query.eq('kind', kind);
    const { data, error } = await query.order('due_date', { ascending: true });
    if (error) throw new Error(`Failed to load checklist: ${error.message}`);
    return (data ?? []).map(mapLifecycleTask);
  },

  async setTaskDone(taskId: number, done: boolean): Promise<void> {
    const me = await getSessionEmployee();
    const { error } = await supabase
      .from('lifecycle_tasks')
      .update({ done, done_by: done ? me.id : null, done_at: done ? new Date().toISOString() : null })
      .eq('id', taskId);
    if (error) throw new Error(`Failed to update task: ${error.message}`);
  },

  /** Put an employee on notice and open the exit-clearance checklist. */
  async initiateExit(employeeId: number, lastWorkingDay: string, reason: string): Promise<{ warnings: string[] }> {
    const me = await getSessionEmployee();
    const warnings: string[] = [];

    const { data: emp, error } = await supabase
      .from('employees')
      .update({ status: 'NOTICE_PERIOD', date_of_exit: lastWorkingDay })
      .eq('id', employeeId)
      .select('id, full_name, emp_code')
      .single();
    if (error || !emp) throw new Error(`Failed to update employee: ${error?.message}`);

    const { error: taskError } = await supabase.from('lifecycle_tasks').insert(
      OFFBOARDING_TEMPLATE.map(t => ({
        employee_id: employeeId,
        kind: 'OFFBOARDING' as const,
        owner_role: t.owner,
        title: t.title,
        due_date: addDays(lastWorkingDay, t.dueOffsetDays)
      }))
    );
    if (taskError) warnings.push(`Exit checklist not created: ${taskError.message}`);

    const { data: assets } = await supabase
      .from('assets')
      .select('asset_tag, category, brand, model, phone_number')
      .eq('assigned_to', employeeId);
    const assetLines = (assets ?? []).map(
      a => `• ${a.asset_tag} — ${a.category}${a.brand ? ` ${a.brand}` : ''}${a.model ? ` ${a.model}` : ''}${a.phone_number ? ` (${a.phone_number})` : ''}`
    );
    const { error: itError } = await supabase.from('it_requests').insert({
      employee_id: employeeId,
      request_type: 'OFFBOARDING',
      title: `Exit clearance: ${emp.full_name} (${emp.emp_code}) — LWD ${lastWorkingDay}`,
      details: `Reason: ${reason || '—'}\nCollect assets & revoke access.\n${
        assetLines.length ? assetLines.join('\n') : 'No assets on record — confirm physically.'
      }`,
      priority: 'HIGH',
      raised_by: me.id
    });
    if (itError) warnings.push(`IT exit request not raised: ${itError.message}`);

    await logAudit(me, 'EMPLOYEE', 'EXIT_INITIATED', `${emp.full_name} LWD ${lastWorkingDay}: ${reason}`, {
      type: 'employee',
      id: employeeId
    });
    return { warnings };
  }
};
