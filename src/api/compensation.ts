import { supabase } from '../lib/supabase';
import { getSessionEmployee, logAudit, monthBounds } from './session';
import {
  mapAttendanceRecord,
  mapEmployee,
  mapPayrollEntry,
  mapSalaryRevision
} from './mappers';
import { overtimeApi } from './overtime';
import { computePayroll, type PayrollComputation, type PayrollInput, type PayrollLeave } from '../lib/payrollEngine';
import type {
  AttendanceRecord,
  Employee,
  PayrollEntry,
  PayType,
  SalaryRevision,
  SalaryRevisionType
} from '../types';

const REVISION_SELECT =
  '*, employee:employees!salary_revisions_employee_id_fkey(full_name, emp_code, designation, department:departments!employees_department_id_fkey(name)), proposer:employees!salary_revisions_proposed_by_fkey(full_name), approver:employees!salary_revisions_approved_by_fkey(full_name)';
const ENTRY_SELECT =
  '*, employee:employees!payroll_entries_employee_id_fkey(full_name, emp_code, designation, department:departments!employees_department_id_fkey(name)), computer:employees!payroll_entries_computed_by_fkey(full_name)';

export interface PayrollPreviewRow {
  employee: Employee;
  revision: SalaryRevision | null;
  computation: PayrollComputation;
  /** Engine input, kept so Accounts can re-run it after entering arrears or an advance. */
  input: PayrollInput;
  existing?: PayrollEntry;
}

/** Re-run one employee's pay with new one-off amounts. */
export function recomputeRow(row: PayrollPreviewRow, adjustments: { arrears?: number; advance?: number }): PayrollPreviewRow {
  const input = { ...row.input, ...adjustments };
  return { ...row, input, computation: computePayroll(input) };
}

const lineAmount = (lines: { code: string; amount: number }[] | undefined, code: string) =>
  lines?.find(l => l.code === code)?.amount ?? 0;

/** Supabase caps responses at 1,000 rows; page through month-wide attendance. */
async function fetchMonthAttendance(start: string, end: string) {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .gte('work_date', start)
      .lte('work_date', end)
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}

/** Latest approved revision per employee effective on or before `asOf`. */
function pickEffective(revisions: SalaryRevision[], asOf: string): Map<number, SalaryRevision> {
  const map = new Map<number, SalaryRevision>();
  for (const r of revisions) {
    if (r.status !== 'APPROVED' || r.effectiveFrom > asOf) continue;
    const current = map.get(r.employeeId);
    if (!current || r.effectiveFrom > current.effectiveFrom || (r.effectiveFrom === current.effectiveFrom && r.id > current.id)) {
      map.set(r.employeeId, r);
    }
  }
  return map;
}

export const compensationApi = {
  // ---- Salary revisions / increments ----------------------------------------

  async getRevisions(): Promise<SalaryRevision[]> {
    const { data, error } = await supabase
      .from('salary_revisions')
      .select(REVISION_SELECT)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load salary revisions: ${error.message}`);
    return (data ?? []).map(mapSalaryRevision);
  },

  async getCurrentSalaries(asOf: string = new Date().toISOString().split('T')[0]): Promise<Map<number, SalaryRevision>> {
    return pickEffective(await this.getRevisions(), asOf);
  },

  async proposeRevision(data: {
    employeeId: number;
    revisionType: SalaryRevisionType;
    effectiveFrom: string;
    ctcAnnual: number;
    basicMonthly: number;
    hraMonthly: number;
    specialMonthly: number;
    otherAllowanceMonthly: number;
    tdsMonthly: number;
    pfApplicable: boolean;
    payType?: PayType;
    hourlyRate?: number;
    incrementPct?: number;
    newDesignation?: string;
    reason?: string;
  }): Promise<SalaryRevision> {
    const me = await getSessionEmployee();
    if (data.employeeId === me.id) throw new Error('You cannot propose a revision to your own salary.');
    const { data: created, error } = await supabase
      .from('salary_revisions')
      .insert({
        employee_id: data.employeeId,
        revision_type: data.revisionType,
        effective_from: data.effectiveFrom,
        ctc_annual: data.ctcAnnual,
        basic_monthly: data.basicMonthly,
        hra_monthly: data.hraMonthly,
        special_monthly: data.specialMonthly,
        other_allowance_monthly: data.otherAllowanceMonthly,
        tds_monthly: data.tdsMonthly,
        pf_applicable: data.pfApplicable,
        pay_type: data.payType ?? 'MONTHLY',
        hourly_rate: data.payType === 'HOURLY' ? data.hourlyRate ?? null : null,
        increment_pct: data.incrementPct ?? null,
        new_designation: data.newDesignation || null,
        reason: data.reason || null,
        status: 'PROPOSED',
        proposed_by: me.id
      })
      .select(REVISION_SELECT)
      .single();
    if (error || !created) throw new Error(`Failed to propose revision: ${error?.message}`);
    await logAudit(me, 'PAYROLL', 'SALARY_REVISION_PROPOSED', `${data.revisionType} for employee #${data.employeeId}`, {
      type: 'salary_revision',
      id: created.id
    });
    return mapSalaryRevision(created);
  },

  /** Maker-checker approval. Returns a warning when the designation could not be updated. */
  async actionRevision(revision: SalaryRevision, action: 'APPROVE' | 'REJECT'): Promise<{ warning?: string }> {
    const me = await getSessionEmployee();
    if (revision.proposedById === me.id) {
      throw new Error('Maker-checker: a different Accounts/CEO user must approve a revision you proposed.');
    }
    if (revision.employeeId === me.id) throw new Error('You cannot approve your own salary revision.');

    const { error } = await supabase
      .from('salary_revisions')
      .update({
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approved_by: me.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', revision.id)
      .eq('status', 'PROPOSED');
    if (error) throw new Error(`Failed to ${action.toLowerCase()} revision: ${error.message}`);

    await logAudit(me, 'PAYROLL', `SALARY_REVISION_${action}D`, `${revision.revisionType} for ${revision.employeeName}`, {
      type: 'salary_revision',
      id: revision.id
    });

    if (action === 'APPROVE' && revision.newDesignation) {
      const { error: desError } = await supabase
        .from('employees')
        .update({ designation: revision.newDesignation })
        .eq('id', revision.employeeId);
      if (desError) return { warning: `Approved, but designation not updated (ask HR): ${desError.message}` };
    }
    return {};
  },

  // ---- Attendance-based payroll ---------------------------------------------

  /** Gather attendance, leave, holidays and salaries, then compute every employee's pay. */
  async previewMonth(year: number, month: number): Promise<{ rows: PayrollPreviewRow[]; warnings: string[] }> {
    const { start, end } = monthBounds(year, month);
    const warnings: string[] = [];

    const [empRes, attRes, leaveRes, typeRes, holRes, revisions, entryRes] = await Promise.all([
      supabase.from('employees').select('*, department:departments!employees_department_id_fkey(name)').order('full_name'),
      fetchMonthAttendance(start, end),
      supabase
        .from('leave_requests')
        .select('employee_id, leave_type_id, from_date, to_date, from_half, to_half, status')
        .eq('status', 'APPROVED')
        .lte('from_date', end)
        .gte('to_date', start),
      supabase.from('leave_types').select('id, code, is_paid'),
      supabase.from('holidays').select('holiday_date, is_restricted, is_optional').gte('holiday_date', start).lte('holiday_date', end),
      this.getRevisions(),
      supabase.from('payroll_entries').select(ENTRY_SELECT).eq('year', year).eq('month', month)
    ]);

    for (const [label, res] of [
      ['employees', empRes],
      ['attendance', attRes],
      ['leave requests', leaveRes],
      ['leave types', typeRes],
      ['holidays', holRes],
      ['payroll entries', entryRes]
    ] as const) {
      if (res.error) throw new Error(`Failed to load ${label}: ${res.error.message}`);
    }

    const leaveTypeById = new Map((typeRes.data ?? []).map(t => [t.id, t]));
    const holidays = (holRes.data ?? []).filter(h => !h.is_restricted && !h.is_optional).map(h => h.holiday_date);
    const salaryMap = pickEffective(revisions, end);
    const existingMap = new Map((entryRes.data ?? []).map(r => [r.employee_id, mapPayrollEntry(r)]));

    const attendanceByEmp = new Map<number, AttendanceRecord[]>();
    for (const row of attRes.data ?? []) {
      const list = attendanceByEmp.get(row.employee_id) ?? [];
      list.push(mapAttendanceRecord(row));
      attendanceByEmp.set(row.employee_id, list);
    }

    const leavesByEmp = new Map<number, PayrollLeave[]>();
    for (const lr of leaveRes.data ?? []) {
      const type = leaveTypeById.get(lr.leave_type_id);
      const list = leavesByEmp.get(lr.employee_id) ?? [];
      list.push({
        fromDate: lr.from_date,
        toDate: lr.to_date,
        fromHalf: lr.from_half,
        toHalf: lr.to_half,
        isPaid: type ? type.is_paid !== false && type.code !== 'LOP' : true,
        leaveTypeCode: type?.code
      });
      leavesByEmp.set(lr.employee_id, list);
    }

    const employees = (empRes.data ?? [])
      .map(mapEmployee)
      .filter(e => (!e.dateOfJoining || e.dateOfJoining <= end) && (!e.dateOfExit || e.dateOfExit >= start))
      .filter(e => e.status !== 'EXITED' || (e.dateOfExit && e.dateOfExit >= start));

    let overtimeByEmp = new Map<number, number>();
    try {
      overtimeByEmp = await overtimeApi.getApprovedOvertimeDays(start, end);
    } catch (err: any) {
      warnings.push(`Approved overtime could not be loaded, so no overtime is included: ${err.message}`);
    }

    const pastMonth = end < new Date().toISOString().split('T')[0];
    if (pastMonth && employees.length > 0 && (attRes.data ?? []).length === 0) {
      warnings.push(
        'No attendance punches are visible for this month. Everyone will show as absent — check that attendance was captured and that your login can read attendance records before saving.'
      );
    }

    const rows: PayrollPreviewRow[] = employees.map(employee => {
      const revision = salaryMap.get(employee.id) ?? null;
      const existing = existingMap.get(employee.id);
      const input: PayrollInput = {
        year,
        month,
        dateOfJoining: employee.dateOfJoining,
        dateOfExit: employee.dateOfExit,
        salary: revision,
        attendance: attendanceByEmp.get(employee.id) ?? [],
        leaves: leavesByEmp.get(employee.id) ?? [],
        holidays,
        overtimeDays: overtimeByEmp.get(employee.id) ?? 0,
        // Keep one-off amounts Accounts entered on a saved draft.
        arrears: lineAmount(existing?.earnings, 'ARREARS'),
        advance: lineAmount(existing?.deductions, 'ADVANCE')
      };
      return { employee, revision, input, computation: computePayroll(input), existing };
    });

    return { rows, warnings };
  },

  /** Save computed rows as DRAFT entries (published entries are never overwritten). */
  async saveDrafts(year: number, month: number, rows: PayrollPreviewRow[]): Promise<number> {
    const me = await getSessionEmployee();
    const payload = rows
      .filter(r => r.revision && r.existing?.status !== 'PUBLISHED')
      .map(({ employee, revision, computation: c }) => ({
        employee_id: employee.id,
        year,
        month,
        calendar_days: c.calendarDays,
        payable_days: c.payableDays,
        present_days: c.presentDays,
        paid_leave_days: c.paidLeaveDays,
        holiday_days: c.holidayDays,
        week_off_days: c.weekOffDays,
        lop_days: c.lopDays,
        late_marks: c.lateMarks,
        earnings: c.earnings as any,
        deductions: c.deductions as any,
        employer_contributions: c.employerContributions as any,
        gross_earnings: c.grossEarnings,
        total_deductions: c.totalDeductions,
        net_pay: c.netPay,
        pay_type: c.payType,
        worked_hours: c.workedHours,
        hourly_rate: c.hourlyRate ?? null,
        status: 'DRAFT' as const,
        revision_id: revision?.id ?? null,
        computed_by: me.id,
        computed_at: new Date().toISOString()
      }));
    if (payload.length === 0) return 0;

    const { error } = await supabase.from('payroll_entries').upsert(payload, { onConflict: 'employee_id,year,month' });
    if (error) throw new Error(`Failed to save payroll: ${error.message}`);
    await logAudit(me, 'PAYROLL', 'PAYROLL_COMPUTED', `${payload.length} draft entries for ${month}/${year}`);
    return payload.length;
  },

  async setEntriesStatus(year: number, month: number, from: 'DRAFT' | 'APPROVED', to: 'DRAFT' | 'APPROVED' | 'PUBLISHED'): Promise<number> {
    const me = await getSessionEmployee();
    let query = supabase
      .from('payroll_entries')
      .update({ status: to, published_at: to === 'PUBLISHED' ? new Date().toISOString() : null })
      .eq('year', year)
      .eq('month', month)
      .eq('status', from);
    // Approvers never act on payroll they computed themselves.
    if (to === 'APPROVED') query = query.neq('computed_by', me.id);
    const { data, error } = await query.select('id');
    if (error) throw new Error(`Failed to update payroll status: ${error.message}`);
    await logAudit(me, 'PAYROLL', `PAYROLL_${to}`, `${data?.length ?? 0} entries for ${month}/${year}`);
    return data?.length ?? 0;
  },

  // ---- Payroll approval (reporting manager of the Accounts person) ----------

  /** Months that have drafts visible to me (RLS limits approvers to their reporting line). */
  async getMonthsAwaitingApproval(): Promise<Array<{ year: number; month: number; count: number }>> {
    const me = await getSessionEmployee();
    const { data, error } = await supabase
      .from('payroll_entries')
      .select('year, month, computed_by')
      .eq('status', 'DRAFT')
      .neq('computed_by', me.id);
    if (error) throw new Error(`Failed to load payroll awaiting approval: ${error.message}`);
    const map = new Map<string, { year: number; month: number; count: number }>();
    (data ?? []).forEach(r => {
      const key = `${r.year}-${r.month}`;
      const cur = map.get(key) ?? { year: r.year, month: r.month, count: 0 };
      cur.count++;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.year - a.year || b.month - a.month);
  },

  async getEntries(year: number, month: number): Promise<PayrollEntry[]> {
    const { data, error } = await supabase
      .from('payroll_entries')
      .select(ENTRY_SELECT)
      .eq('year', year)
      .eq('month', month)
      .order('employee_id');
    if (error) throw new Error(`Failed to load payroll: ${error.message}`);
    return (data ?? []).map(mapPayrollEntry);
  },

  // ---- Employee self-service -------------------------------------------------

  async getMyPublishedEntries(): Promise<PayrollEntry[]> {
    const me = await getSessionEmployee();
    const { data, error } = await supabase
      .from('payroll_entries')
      .select(ENTRY_SELECT)
      .eq('employee_id', me.id)
      .eq('status', 'PUBLISHED')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (error) throw new Error(`Failed to load your salary slips: ${error.message}`);
    return (data ?? []).map(mapPayrollEntry);
  },

  async getMySalaryHistory(): Promise<SalaryRevision[]> {
    const me = await getSessionEmployee();
    const { data, error } = await supabase
      .from('salary_revisions')
      .select(REVISION_SELECT)
      .eq('employee_id', me.id)
      .eq('status', 'APPROVED')
      .order('effective_from', { ascending: false });
    if (error) throw new Error(`Failed to load salary history: ${error.message}`);
    return (data ?? []).map(mapSalaryRevision);
  }
};
