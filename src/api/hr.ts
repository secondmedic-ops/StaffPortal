import { supabase } from '../lib/supabase';
import { withManagerName, withManagerNames } from './managerNames';
import type { Database } from '../types/database';
import {
  mapEmployee,
  mapMonthlyAttendanceSummary,
  mapLeaveType,
  mapHoliday,
  mapDepartment
} from './mappers';
import type {
  Employee,
  MonthlyAttendanceSummary,
  LeaveType,
  Holiday,
  Department
} from '../types';
import { HOLIDAY_TEMPLATES } from '../config/holidayTemplates';
import { getSessionEmployee } from './session';

async function getCurrentEmployee() {
  return getSessionEmployee();
}

export const hrApi = {
  async getEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*, department:departments!employees_department_id_fkey(name)')
      .order('full_name');

    if (error) throw new Error(`Failed to load employees: ${error.message}`);
    return (await withManagerNames(data ?? [])).map(mapEmployee);
  },

  async createEmployee(data: Omit<Employee, 'id' | 'departmentName' | 'managerName'>): Promise<Employee> {
    const { data: created, error } = await supabase
      .from('employees')
      .insert({
        emp_code: data.empCode,
        entity_id: data.entityId ?? null,
        full_name: data.fullName,
        official_email: data.officialEmail,
        personal_email: data.personalEmail ?? null,
        mobile: data.mobile ?? null,
        phone: data.phone ?? data.mobile ?? null,
        department_id: data.departmentId,
        designation: data.designation,
        employment_type: data.employmentType,
        date_of_joining: data.dateOfJoining ?? data.joiningDate ?? null,
        date_of_exit: data.dateOfExit ?? null,
        work_location: data.workLocation ?? null,
        status: data.status,
        manager_id: data.managerId ?? null,
        avatar_url: data.avatarUrl ?? null
      })
      .select('*, department:departments!employees_department_id_fkey(name)')
      .single();

    if (error || !created) throw new Error(`Failed to create employee: ${error?.message}`);

    // Initialize default leave balances
    const standardBalances = [
      { employee_id: created.id, leave_type_id: 1, fy_year: '2026-2027', opening: 0, accrued: 1.5, used: 0, reserved: 0, encashed: 0, lapsed: 0 },
      { employee_id: created.id, leave_type_id: 3, fy_year: '2026-2027', opening: 12, accrued: 0, used: 0, reserved: 0, encashed: 0, lapsed: 0 },
      { employee_id: created.id, leave_type_id: 4, fy_year: '2026-2027', opening: 10, accrued: 0, used: 0, reserved: 0, encashed: 0, lapsed: 0 }
    ];

    await supabase.from('leave_balances').insert(standardBalances);

    return mapEmployee(await withManagerName(created));
  },

  async updateEmployee(id: number, data: Partial<Employee>): Promise<Employee> {
    const updatePayload: any = {};
    if (data.empCode) updatePayload.emp_code = data.empCode;
    if (data.fullName) updatePayload.full_name = data.fullName;
    if (data.officialEmail) updatePayload.official_email = data.officialEmail;
    if (data.personalEmail !== undefined) updatePayload.personal_email = data.personalEmail;
    if (data.mobile !== undefined) updatePayload.mobile = data.mobile;
    if (data.phone !== undefined) updatePayload.phone = data.phone;
    if (data.departmentId !== undefined) updatePayload.department_id = data.departmentId;
    if (data.designation !== undefined) updatePayload.designation = data.designation;
    if (data.employmentType !== undefined) updatePayload.employment_type = data.employmentType;
    if (data.dateOfJoining !== undefined) updatePayload.date_of_joining = data.dateOfJoining;
    if (data.joiningDate !== undefined) updatePayload.date_of_joining = data.joiningDate;
    if (data.dateOfExit !== undefined) updatePayload.date_of_exit = data.dateOfExit;
    if (data.workLocation !== undefined) updatePayload.work_location = data.workLocation;
    if (data.division !== undefined) updatePayload.division = data.division;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.managerId !== undefined) updatePayload.manager_id = data.managerId;
    if (data.avatarUrl !== undefined) updatePayload.avatar_url = data.avatarUrl;

    const { data: updated, error } = await supabase
      .from('employees')
      .update(updatePayload)
      .eq('id', id)
      .select('*, department:departments!employees_department_id_fkey(name)')
      .single();

    if (error || !updated) throw new Error(`Failed to update employee: ${error?.message}`);
    return mapEmployee(await withManagerName(updated));
  },

  async getAttendanceSummary(month: number, year: number): Promise<MonthlyAttendanceSummary[]> {
    const { data, error } = await supabase
      .from('monthly_attendance_summaries')
      .select('*, employee:employees(emp_code, full_name, department:departments!employees_department_id_fkey(name))')
      .eq('year', year)
      .eq('month', month)
      .order('employee_id');

    if (error) throw new Error(`Failed to load attendance summaries: ${error.message}`);
    return (data ?? []).map(mapMonthlyAttendanceSummary);
  },

  async lockAttendanceMonth(month: number, year: number): Promise<void> {
    const emp = await getCurrentEmployee();
    const { error } = await supabase
      .from('monthly_attendance_summaries')
      .update({
        locked: true,
        locked_by: emp.full_name,
        locked_at: new Date().toISOString()
      })
      .eq('year', year)
      .eq('month', month);

    if (error) throw new Error(`Failed to lock attendance month: ${error.message}`);
  },

  async unlockAttendanceMonth(month: number, year: number, _reason: string): Promise<void> {
    const { error } = await supabase
      .from('monthly_attendance_summaries')
      .update({
        locked: false
      })
      .eq('year', year)
      .eq('month', month);

    if (error) throw new Error(`Failed to unlock attendance month: ${error.message}`);
  },

  async getLeaveTypes(): Promise<LeaveType[]> {
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .order('id');

    if (error) throw new Error(`Failed to load leave types: ${error.message}`);
    return (data ?? []).map(mapLeaveType);
  },

  async createLeaveType(data: Omit<LeaveType, 'id'>): Promise<LeaveType> {
    const { data: created, error } = await supabase
      .from('leave_types')
      .insert({
        entity_id: data.entityId ?? null,
        code: data.code,
        name: data.name,
        annual_quota: data.annualQuota,
        accrual_mode: data.accrualMode ?? null,
        accrual_per_month: data.accrualPerMonth ?? null,
        carry_forward_max: data.carryForwardMax,
        encashable: data.encashable ?? null,
        allow_half_day: data.allowHalfDay ?? data.allowsHalfDay ?? null,
        requires_document: data.requiresDocument ?? null,
        requires_document_after_days: data.requiresDocumentAfterDays ?? null,
        min_notice_days: data.minNoticeDays ?? null,
        is_paid: data.isPaid ?? null,
        probation_eligible: data.probationEligible ?? null,
        sandwich_rule: data.sandwichRule ?? null,
        active: data.active ?? true
      })
      .select()
      .single();

    if (error || !created) throw new Error(`Failed to create leave type: ${error?.message}`);
    return mapLeaveType(created);
  },

  async getHolidays(): Promise<Holiday[]> {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('holiday_date', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map(mapHoliday);
      }
    } catch {}

    const y = new Date().getFullYear();
    const templates = HOLIDAY_TEMPLATES[y] || HOLIDAY_TEMPLATES[2026] || [];
    return templates.map((t, idx) => ({
      id: 9000 + idx,
      holidayDate: t.date,
      name: t.name,
      isOptional: Boolean(t.optional),
      isRestricted: Boolean(t.optional),
      holidayYear: Number(t.date.slice(0, 4)),
      createdAt: new Date().toISOString()
    }));
  },

  async createHoliday(data: Omit<Holiday, 'id'>): Promise<Holiday> {
    const { data: created, error } = await supabase
      .from('holidays')
      .insert({
        entity_id: data.entityId ?? null,
        holiday_date: data.holidayDate,
        name: data.name,
        is_optional: data.isOptional ?? null,
        is_restricted: data.isRestricted ?? null,
        holiday_year: data.holidayYear ?? null
      })
      .select()
      .single();

    if (error || !created) throw new Error(`Failed to create holiday: ${error?.message}`);
    return mapHoliday(created);
  },

  async updateHoliday(id: number, data: Partial<Omit<Holiday, 'id'>>): Promise<void> {
    const payload: Database['public']['Tables']['holidays']['Update'] = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.holidayDate !== undefined) {
      payload.holiday_date = data.holidayDate;
      payload.holiday_year = Number(data.holidayDate.slice(0, 4));
    }
    if (data.isOptional !== undefined) payload.is_optional = data.isOptional;
    if (data.isRestricted !== undefined) payload.is_restricted = data.isRestricted;

    const { error } = await supabase.from('holidays').update(payload).eq('id', id);
    if (error) throw new Error(`Failed to update holiday: ${error.message}`);
  },

  async deleteHoliday(id: number): Promise<void> {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete holiday: ${error.message}`);
  },

  async sendLoginInviteToUnassignedStaff(): Promise<Array<{ id: number; name: string; email: string; status: 'INVITED' | 'FAILED'; error?: string }>> {
    const { data: unassigned, error } = await supabase
      .from('employees')
      .select('id, full_name, official_email')
      .is('auth_user_id', null)
      .neq('status', 'EXITED');

    if (error) throw new Error(`Failed to load staff without login: ${error.message}`);
    const results: Array<{ id: number; name: string; email: string; status: 'INVITED' | 'FAILED'; error?: string }> = [];

    for (const emp of (unassigned || [])) {
      try {
        await (supabase.rpc as any)('queue_email', {
          p_template: 'login_invite',
          p_to: emp.official_email,
          p_cc: null,
          p_subject: 'Welcome to SecondMedic Staff Portal - Your Account is Ready',
          p_payload: {
            employeeName: emp.full_name,
            email: emp.official_email,
            actionUrl: '/login'
          },
          p_dedupe_key: `login_invite:${emp.id}`
        });
        results.push({ id: emp.id, name: emp.full_name, email: emp.official_email, status: 'INVITED' });
      } catch (err: any) {
        results.push({ id: emp.id, name: emp.full_name, email: emp.official_email, status: 'FAILED', error: err.message });
      }
    }
    return results;
  },

  async confirmProbation(employeeId: number): Promise<void> {
    const { error: empError } = await supabase
      .from('employees')
      .update({ status: 'ACTIVE' })
      .eq('id', employeeId);
    if (empError) throw new Error(`Failed to confirm employee: ${empError.message}`);

    // Pro-rate EL leave types (probation_eligible = false)
    const now = new Date();
    const monthsLeftInFy = now.getMonth() >= 3 ? (12 - now.getMonth() + 3) : (3 - now.getMonth());
    const { data: elType } = await supabase
      .from('leave_types')
      .select('id, annual_quota')
      .eq('probation_eligible', false)
      .maybeSingle();

    if (elType) {
      const proratedDays = Math.round((Number(elType.annual_quota) / 12) * monthsLeftInFy);
      const fyYear = now.getMonth() >= 3 ? `${now.getFullYear()}-${now.getFullYear() + 1}` : `${now.getFullYear() - 1}-${now.getFullYear()}`;
      await supabase
        .from('leave_balances')
        .upsert({
          employee_id: employeeId,
          leave_type_id: elType.id,
          fy_year: fyYear,
          accrued: proratedDays
        }, { onConflict: 'employee_id,leave_type_id,fy_year' });
    }
  },

  async extendProbation(employeeId: number, newEndDate: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .update({ probation_end_date: newEndDate })
      .eq('id', employeeId);
    if (error) throw new Error(`Failed to extend probation: ${error.message}`);
  },

  async getFullEmployeeProfile(employeeId: number): Promise<{
    employee: any;
    profile: any;
    financials: any;
    documents: any[];
    history: any[];
  }> {
    const [empRes, profRes, finRes, docRes, histRes] = await Promise.all([
      supabase.from('employees').select('*, department:departments(name), manager:employees!employees_manager_id_fkey(full_name), branch:branches(name)').eq('id', employeeId).single(),
      supabase.from('employee_profiles').select('*').eq('employee_id', employeeId).maybeSingle(),
      supabase.from('employee_financials').select('*').eq('employee_id', employeeId).maybeSingle(),
      supabase.from('employee_documents').select('*, uploader:employees!employee_documents_uploaded_by_fkey(full_name)').eq('employee_id', employeeId).order('uploaded_at', { ascending: false }),
      supabase.from('employee_history').select('*, changer:employees!employee_history_changed_by_fkey(full_name)').eq('employee_id', employeeId).order('changed_at', { ascending: false })
    ]);

    if (empRes.error) throw new Error(`Failed to load employee: ${empRes.error.message}`);
    return {
      employee: empRes.data,
      profile: profRes.data,
      financials: finRes.data,
      documents: docRes.data || [],
      history: histRes.data || []
    };
  },

  async updateFullEmployeeProfile(
    employeeId: number,
    data: {
      employee?: Record<string, any>;
      profile?: Record<string, any>;
      financials?: Record<string, any>;
    }
  ): Promise<void> {
    if (data.employee && Object.keys(data.employee).length > 0) {
      const { error } = await supabase.from('employees').update(data.employee as any).eq('id', employeeId);
      if (error) throw new Error(`Failed to update employee details: ${error.message}`);
    }

    if (data.profile && Object.keys(data.profile).length > 0) {
      const payload = { ...data.profile, employee_id: employeeId };
      const { error } = await supabase.from('employee_profiles').upsert(payload, { onConflict: 'employee_id' });
      if (error) throw new Error(`Failed to update profile details: ${error.message}`);
    }

    if (data.financials && Object.keys(data.financials).length > 0) {
      const payload = { ...data.financials, employee_id: employeeId };
      const { error } = await supabase.from('employee_financials').upsert(payload, { onConflict: 'employee_id' });
      if (error) throw new Error(`Failed to update financials: ${error.message}`);
    }
  },

  async getMissedSignouts(filters?: { startDate?: string; endDate?: string; branchId?: number; managerId?: number }): Promise<any[]> {
    let query = supabase
      .from('attendance_records')
      .select('*, employee:employees!attendance_records_employee_id_fkey(id, full_name, emp_code, manager_id, branch_id, department:departments(name), branch:branches(name))')
      .not('punch_in', 'is', null)
      .is('punch_out', null)
      .eq('is_regularized', false)
      .order('work_date', { ascending: false });

    if (filters?.startDate) query = query.gte('work_date', filters.startDate);
    if (filters?.endDate) query = query.lte('work_date', filters.endDate);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load missed sign-outs: ${error.message}`);

    let list = data || [];
    if (filters?.branchId) {
      list = list.filter((r: any) => r.employee?.branch_id === filters.branchId);
    }
    if (filters?.managerId) {
      list = list.filter((r: any) => r.employee?.manager_id === filters.managerId);
    }
    return list;
  },

  async getDepartments(): Promise<Department[]> {
    const { data, error } = await supabase
      .from('departments')
      .select('*, head:employees!departments_head_id_fkey(full_name)')
      .order('name');

    if (error) throw new Error(`Failed to load departments: ${error.message}`);
    return (data ?? []).map(mapDepartment);
  }
};
