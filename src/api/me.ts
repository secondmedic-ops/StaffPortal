import { supabase } from '../lib/supabase';
import {
  mapAttendanceRecord,
  mapAttendanceRegularization,
  mapLeaveBalance,
  mapLeaveRequest,
  mapHoliday,
  mapKpiCycle,
  mapKpiDefinition
} from './mappers';
import type {
  AttendanceRecord,
  AttendanceRegularization,
  LeaveBalance,
  LeaveRequest,
  Holiday,
  KpiCycle,
  KpiDefinition,
  Payslip
} from '../types';

async function getCurrentEmployee() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Failed to get session: ${sessionError.message}`);
  const user = sessionData.session?.user;
  if (!user) throw new Error('No active user session');

  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('id, emp_code, full_name, department_id, department:departments(name), manager_id, manager:employees!employees_manager_id_fkey(full_name)')
    .or(`auth_user_id.eq.${user.id},official_email.eq.${user.email ?? ''}`)
    .single();

  if (empError || !emp) throw new Error('Your login is not linked to a staff record — contact HR');
  return emp;
}

export const meApi = {
  async getAttendance(month: number, year: number): Promise<AttendanceRecord[]> {
    const emp = await getCurrentEmployee();
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-31`;

    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', emp.id)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true });

    if (error) throw new Error(`Failed to load attendance records: ${error.message}`);
    return (data ?? []).map(mapAttendanceRecord);
  },

  async punch(data: { type: 'IN' | 'OUT'; lat?: number; lng?: number; source?: string }): Promise<AttendanceRecord> {
    const emp = await getCurrentEmployee();
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    const { data: existing, error: findError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', emp.id)
      .eq('work_date', today)
      .maybeSingle();

    if (findError) throw new Error(`Failed to check existing attendance: ${findError.message}`);

    if (data.type === 'IN') {
      if (existing) {
        const { data: updated, error: updateError } = await supabase
          .from('attendance_records')
          .update({
            punch_in: nowIso,
            in_lat: data.lat ?? null,
            in_lng: data.lng ?? null,
            in_source: (data.source as any) || 'WEB',
            status: 'PRESENT'
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw new Error(`Failed to record punch in: ${updateError.message}`);
        return mapAttendanceRecord(updated);
      } else {
        const { data: created, error: insertError } = await supabase
          .from('attendance_records')
          .insert({
            employee_id: emp.id,
            work_date: today,
            shift_id: 1,
            punch_in: nowIso,
            in_lat: data.lat ?? null,
            in_lng: data.lng ?? null,
            in_source: (data.source as any) || 'WEB',
            status: 'PRESENT',
            is_regularized: false
          })
          .select()
          .single();

        if (insertError) throw new Error(`Failed to record punch in: ${insertError.message}`);
        return mapAttendanceRecord(created);
      }
    } else {
      let workedHours: number | null = null;
      if (existing?.punch_in) {
        const diffMs = new Date(nowIso).getTime() - new Date(existing.punch_in).getTime();
        workedHours = Math.max(0.5, Number((diffMs / (1000 * 60 * 60)).toFixed(1)));
      }

      if (existing) {
        const { data: updated, error: updateError } = await supabase
          .from('attendance_records')
          .update({
            punch_out: nowIso,
            out_lat: data.lat ?? null,
            out_lng: data.lng ?? null,
            worked_hours: workedHours
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw new Error(`Failed to record punch out: ${updateError.message}`);
        return mapAttendanceRecord(updated);
      } else {
        const { data: created, error: insertError } = await supabase
          .from('attendance_records')
          .insert({
            employee_id: emp.id,
            work_date: today,
            shift_id: 1,
            punch_out: nowIso,
            out_lat: data.lat ?? null,
            out_lng: data.lng ?? null,
            worked_hours: workedHours,
            status: 'PRESENT',
            is_regularized: false
          })
          .select()
          .single();

        if (insertError) throw new Error(`Failed to record punch out: ${insertError.message}`);
        return mapAttendanceRecord(created);
      }
    }
  },

  async requestRegularization(data: {
    workDate: string;
    requestedIn: string;
    requestedOut: string;
    reason: string;
  }): Promise<AttendanceRegularization> {
    const emp = await getCurrentEmployee();

    const { data: att } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('employee_id', emp.id)
      .eq('work_date', data.workDate)
      .maybeSingle();

    const { data: reg, error } = await supabase
      .from('attendance_regularizations')
      .insert({
        attendance_id: att?.id ?? null,
        employee_id: emp.id,
        work_date: data.workDate,
        requested_in: data.requestedIn,
        requested_out: data.requestedOut,
        reason: data.reason,
        status: 'PENDING'
      })
      .select('*, employee:employees(emp_code, full_name)')
      .single();

    if (error) throw new Error(`Failed to request attendance regularization: ${error.message}`);
    return mapAttendanceRegularization(reg);
  },

  async getLeaveBalances(): Promise<LeaveBalance[]> {
    const emp = await getCurrentEmployee();
    const { data, error } = await supabase
      .from('leave_balances')
      .select('*, leave_type:leave_types(code, name)')
      .eq('employee_id', emp.id)
      .order('leave_type_id');

    if (error) throw new Error(`Failed to load leave balances: ${error.message}`);
    return (data ?? []).map(mapLeaveBalance);
  },

  async getLeaveRequests(): Promise<LeaveRequest[]> {
    const emp = await getCurrentEmployee();
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, employee:employees(emp_code, full_name, department:departments(name)), leave_type:leave_types(code, name), current_approver:employees!leave_requests_current_approver_id_fkey(full_name)')
      .eq('employee_id', emp.id)
      .order('applied_at', { ascending: false });

    if (error) throw new Error(`Failed to load leave requests: ${error.message}`);
    return (data ?? []).map(mapLeaveRequest);
  },

  async applyLeave(data: {
    leaveTypeId: number;
    fromDate: string;
    toDate: string;
    fromHalf?: 'FIRST_HALF' | 'SECOND_HALF' | null;
    toHalf?: 'FIRST_HALF' | 'SECOND_HALF' | null;
    totalDays: number;
    reason: string;
    contactDuring?: string;
    documentUrl?: string;
  }): Promise<LeaveRequest> {
    const emp = await getCurrentEmployee();

    const { data: created, error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: emp.id,
        leave_type_id: data.leaveTypeId,
        from_date: data.fromDate,
        to_date: data.toDate,
        from_half: data.fromHalf ?? null,
        to_half: data.toHalf ?? null,
        total_days: data.totalDays,
        reason: data.reason,
        contact_during: data.contactDuring ?? null,
        document_url: data.documentUrl ?? null,
        status: 'PENDING',
        current_level: 1,
        current_approver_id: emp.manager_id ?? null,
        applied_at: new Date().toISOString(),
        timeline: [
          {
            level: 1,
            approverId: emp.manager_id,
            approverName: (emp.manager as any)?.full_name ?? undefined,
            approverRole: 'Primary Reporting Authority',
            action: 'PENDING'
          }
        ]
      })
      .select('*, employee:employees(emp_code, full_name, department:departments(name)), leave_type:leave_types(code, name), current_approver:employees!leave_requests_current_approver_id_fkey(full_name)')
      .single();

    if (error) throw new Error(`Failed to apply for leave: ${error.message}`);
    return mapLeaveRequest(created);
  },

  async withdrawLeaveRequest(requestId: number): Promise<void> {
    const emp = await getCurrentEmployee();
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'WITHDRAWN',
        closed_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .eq('employee_id', emp.id)
      .eq('status', 'PENDING');

    if (error) throw new Error(`Failed to withdraw leave request: ${error.message}`);
  },

  async getCalendar(month: number, year: number): Promise<{
    holidays: Holiday[];
    myLeaves: LeaveRequest[];
    teamLeaves: { employeeName: string; fromDate: string; toDate: string; totalDays: number }[];
  }> {
    const emp = await getCurrentEmployee();
    const monthStr = String(month).padStart(2, '0');
    const startMonth = `${year}-${monthStr}-01`;
    const endMonth = `${year}-${monthStr}-31`;

    const { data: holidaysData, error: holidaysError } = await supabase
      .from('holidays')
      .select('*')
      .order('holiday_date', { ascending: true });

    if (holidaysError) throw new Error(`Failed to load holidays: ${holidaysError.message}`);

    const { data: myLeavesData, error: myLeavesError } = await supabase
      .from('leave_requests')
      .select('*, employee:employees(emp_code, full_name, department:departments(name)), leave_type:leave_types(code, name), current_approver:employees!leave_requests_current_approver_id_fkey(full_name)')
      .eq('employee_id', emp.id)
      .in('status', ['APPROVED', 'PENDING']);

    if (myLeavesError) throw new Error(`Failed to load my leaves: ${myLeavesError.message}`);

    const { data: teamLeavesData, error: teamLeavesError } = await supabase
      .from('leave_requests')
      .select('from_date, to_date, total_days, employee:employees(full_name)')
      .neq('employee_id', emp.id)
      .eq('status', 'APPROVED')
      .lte('from_date', endMonth)
      .gte('to_date', startMonth);

    if (teamLeavesError) throw new Error(`Failed to load team leaves: ${teamLeavesError.message}`);

    const teamLeaves = (teamLeavesData ?? []).map((r: any) => ({
      employeeName: r.employee?.full_name ?? '',
      fromDate: r.from_date,
      toDate: r.to_date,
      totalDays: Number(r.total_days ?? 0)
    }));

    return {
      holidays: (holidaysData ?? []).map(mapHoliday),
      myLeaves: (myLeavesData ?? []).map(mapLeaveRequest),
      teamLeaves
    };
  },

  async getKpis(): Promise<{ cycle: KpiCycle; kpis: KpiDefinition[] }> {
    const emp = await getCurrentEmployee();

    const { data: cycleData, error: cycleError } = await supabase
      .from('kpi_cycles')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (cycleError) throw new Error(`Failed to load KPI cycle: ${cycleError.message}`);

    const { data: kpisData, error: kpisError } = await supabase
      .from('kpi_definitions')
      .select('*, kpi_scores(*)')
      .eq('employee_id', emp.id)
      .eq('cycle_id', cycleData.id);

    if (kpisError) throw new Error(`Failed to load KPI definitions: ${kpisError.message}`);

    return {
      cycle: mapKpiCycle(cycleData),
      kpis: (kpisData ?? []).map(mapKpiDefinition)
    };
  },

  async submitKpiSelfReview(kpiId: number, data: { actualValue: number; selfRating: number; selfComment: string }): Promise<void> {
    const { error } = await supabase
      .from('kpi_scores')
      .upsert({
        kpi_id: kpiId,
        actual_value: data.actualValue,
        self_rating: data.selfRating,
        self_comment: data.selfComment,
        submitted_at: new Date().toISOString()
      }, { onConflict: 'kpi_id' });

    if (error) throw new Error(`Failed to submit KPI self review: ${error.message}`);
  },

  async getPayslips(year: number): Promise<Array<Pick<Payslip, 'id' | 'year' | 'month' | 'source' | 'status' | 'publishedAt'>>> {
    const { data, error } = await supabase.functions.invoke('payroll', {
      body: { action: 'listMine', year }
    });

    if (error) {
      if (error.status === 403 || error.message?.includes('403')) {
        throw new Error('You do not have access to payroll data');
      }
      throw new Error(`Payroll: ${error.message}`);
    }

    return (data ?? []).map((p: any) => ({
      id: p.id,
      year: p.year,
      month: p.month,
      source: p.source,
      status: p.status,
      publishedAt: p.published_at ?? p.publishedAt
    }));
  },

  async getPayslipDocument(payslipId: number): Promise<Payslip> {
    const { data, error } = await supabase.functions.invoke('payroll', {
      body: { action: 'signedUrl', payslipId }
    });

    if (error) {
      if (error.status === 403 || error.message?.includes('403')) {
        throw new Error('You do not have access to payroll data');
      }
      throw new Error(`Payroll: ${error.message}`);
    }

    return data as Payslip;
  }
};
