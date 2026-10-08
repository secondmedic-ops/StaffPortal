import { supabase } from '../lib/supabase';
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

async function getCurrentEmployee() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Failed to get session: ${sessionError.message}`);
  const user = sessionData.session?.user;
  if (!user) throw new Error('No active user session');

  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('id, full_name')
    .or(`auth_user_id.eq.${user.id},official_email.eq.${user.email ?? ''}`)
    .single();

  if (empError || !emp) throw new Error('Your login is not linked to a staff record — contact HR');
  return emp;
}

export const hrApi = {
  async getEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*, department:departments(name), manager:employees!employees_manager_id_fkey(full_name)')
      .order('full_name');

    if (error) throw new Error(`Failed to load employees: ${error.message}`);
    return (data ?? []).map(mapEmployee);
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
      .select('*, department:departments(name), manager:employees!employees_manager_id_fkey(full_name)')
      .single();

    if (error || !created) throw new Error(`Failed to create employee: ${error?.message}`);

    // Initialize default leave balances
    const standardBalances = [
      { employee_id: created.id, leave_type_id: 1, fy_year: '2026-2027', opening: 0, accrued: 1.5, used: 0, reserved: 0, encashed: 0, lapsed: 0 },
      { employee_id: created.id, leave_type_id: 3, fy_year: '2026-2027', opening: 12, accrued: 0, used: 0, reserved: 0, encashed: 0, lapsed: 0 },
      { employee_id: created.id, leave_type_id: 4, fy_year: '2026-2027', opening: 10, accrued: 0, used: 0, reserved: 0, encashed: 0, lapsed: 0 }
    ];

    await supabase.from('leave_balances').insert(standardBalances);

    return mapEmployee(created);
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
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.managerId !== undefined) updatePayload.manager_id = data.managerId;
    if (data.avatarUrl !== undefined) updatePayload.avatar_url = data.avatarUrl;

    const { data: updated, error } = await supabase
      .from('employees')
      .update(updatePayload)
      .eq('id', id)
      .select('*, department:departments(name), manager:employees!employees_manager_id_fkey(full_name)')
      .single();

    if (error || !updated) throw new Error(`Failed to update employee: ${error?.message}`);
    return mapEmployee(updated);
  },

  async getAttendanceSummary(month: number, year: number): Promise<MonthlyAttendanceSummary[]> {
    const { data, error } = await supabase
      .from('monthly_attendance_summaries')
      .select('*, employee:employees(emp_code, full_name, department:departments(name))')
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
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .order('holiday_date', { ascending: true });

    if (error) throw new Error(`Failed to load holidays: ${error.message}`);
    return (data ?? []).map(mapHoliday);
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

  async deleteHoliday(id: number): Promise<void> {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete holiday: ${error.message}`);
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
