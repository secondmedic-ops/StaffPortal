import { supabase } from '../lib/supabase';
import {
  mapEmployee,
  mapAttendanceRecord,
  mapLeaveRequest,
  mapAttendanceRegularization,
  mapKpiCycle,
  mapKpiDefinition
} from './mappers';
import type {
  Employee,
  AttendanceRecord,
  LeaveRequest,
  AttendanceRegularization,
  KpiCycle,
  KpiDefinition
} from '../types';

async function getCurrentEmployee() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Failed to get session: ${sessionError.message}`);
  const user = sessionData.session?.user;
  if (!user) throw new Error('No active user session');

  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('id, emp_code, full_name, manager_id')
    .or(`auth_user_id.eq.${user.id},official_email.eq.${user.email ?? ''}`)
    .single();

  if (empError || !emp) throw new Error('Your login is not linked to a staff record — contact HR');
  return emp;
}

export const teamApi = {
  async getMembers(): Promise<Employee[]> {
    const emp = await getCurrentEmployee();
    const { data, error } = await supabase
      .from('employees')
      .select('*, department:departments(name), manager:employees!employees_manager_id_fkey(full_name)')
      .eq('manager_id', emp.id)
      .order('full_name');

    if (error) throw new Error(`Failed to load team members: ${error.message}`);
    return (data ?? []).map(mapEmployee);
  },

  async getTeamAttendance(date: string): Promise<Array<{ employee: Employee; attendance?: AttendanceRecord }>> {
    const emp = await getCurrentEmployee();
    const { data: members, error: membersError } = await supabase
      .from('employees')
      .select('*, department:departments(name), manager:employees!employees_manager_id_fkey(full_name)')
      .eq('manager_id', emp.id)
      .order('full_name');

    if (membersError) throw new Error(`Failed to load team attendance members: ${membersError.message}`);
    if (!members || members.length === 0) return [];

    const memberIds = members.map(m => m.id);
    const { data: attendanceData, error: attError } = await supabase
      .from('attendance_records')
      .select('*')
      .in('employee_id', memberIds)
      .eq('work_date', date);

    if (attError) throw new Error(`Failed to load team attendance records: ${attError.message}`);

    const attMap = new Map<number, AttendanceRecord>();
    (attendanceData ?? []).forEach(row => {
      attMap.set(row.employee_id, mapAttendanceRecord(row));
    });

    return members.map(row => {
      const employee = mapEmployee(row);
      return {
        employee,
        attendance: attMap.get(employee.id)
      };
    });
  },

  async getPendingLeaves(): Promise<LeaveRequest[]> {
    const emp = await getCurrentEmployee();
    const { data: members } = await supabase
      .from('employees')
      .select('id')
      .eq('manager_id', emp.id);

    const directReportIds = (members ?? []).map(m => m.id);

    let query = supabase
      .from('leave_requests')
      .select('*, employee:employees(emp_code, full_name, department:departments(name)), leave_type:leave_types(code, name), current_approver:employees!leave_requests_current_approver_id_fkey(full_name)')
      .eq('status', 'PENDING');

    if (directReportIds.length > 0) {
      query = query.or(`current_approver_id.eq.${emp.id},employee_id.in.(${directReportIds.join(',')})`);
    } else {
      query = query.eq('current_approver_id', emp.id);
    }

    const { data, error } = await query.order('applied_at', { ascending: false });

    if (error) throw new Error(`Failed to load pending team leaves: ${error.message}`);
    return (data ?? []).map(mapLeaveRequest);
  },

  async actionLeave(requestId: number, action: 'APPROVE' | 'REJECT', remarks?: string): Promise<void> {
    if (action === 'REJECT' && (!remarks || !remarks.trim())) {
      throw new Error('Mandatory remarks are required when rejecting a leave request.');
    }

    const emp = await getCurrentEmployee();
    const { data: req, error: reqError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqError || !req) throw new Error(`Leave request not found: ${reqError?.message}`);

    const existingTimeline = Array.isArray(req.timeline) ? req.timeline : [];
    const newTimeline = [
      ...existingTimeline,
      {
        level: 1,
        approverId: emp.id,
        approverName: emp.full_name,
        approverRole: 'Manager',
        action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        remarks: remarks || (action === 'APPROVE' ? 'Approved by reporting authority.' : 'Rejected'),
        actedAt: new Date().toISOString()
      }
    ];

    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        closed_at: new Date().toISOString(),
        timeline: newTimeline as any
      })
      .eq('id', requestId);

    if (updateError) throw new Error(`Failed to action leave request: ${updateError.message}`);

    // Reconcile balance in leave_balances
    const { data: balance } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', req.employee_id)
      .eq('leave_type_id', req.leave_type_id)
      .maybeSingle();

    if (balance) {
      if (action === 'APPROVE') {
        const reserved = Math.max(0, Number(balance.reserved ?? 0) - Number(req.total_days ?? 0));
        const used = Number(balance.used ?? 0) + Number(req.total_days ?? 0);
        await supabase
          .from('leave_balances')
          .update({ reserved, used })
          .eq('id', balance.id);
      } else {
        const reserved = Math.max(0, Number(balance.reserved ?? 0) - Number(req.total_days ?? 0));
        await supabase
          .from('leave_balances')
          .update({ reserved })
          .eq('id', balance.id);
      }
    }
  },

  async getPendingRegularizations(): Promise<AttendanceRegularization[]> {
    const emp = await getCurrentEmployee();
    const { data: members } = await supabase
      .from('employees')
      .select('id')
      .eq('manager_id', emp.id);

    const directReportIds = (members ?? []).map(m => m.id);

    let query = supabase
      .from('attendance_regularizations')
      .select('*, employee:employees(emp_code, full_name), approver:employees!attendance_regularizations_approver_id_fkey(full_name)')
      .eq('status', 'PENDING');

    if (directReportIds.length > 0) {
      query = query.or(`approver_id.eq.${emp.id},employee_id.in.(${directReportIds.join(',')})`);
    } else {
      query = query.eq('approver_id', emp.id);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load pending regularizations: ${error.message}`);
    return (data ?? []).map(mapAttendanceRegularization);
  },

  async actionRegularization(regId: number, action: 'APPROVE' | 'REJECT'): Promise<void> {
    const emp = await getCurrentEmployee();

    const { data: reg, error: regError } = await supabase
      .from('attendance_regularizations')
      .update({
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approver_id: emp.id,
        acted_at: new Date().toISOString()
      })
      .eq('id', regId)
      .select()
      .single();

    if (regError || !reg) throw new Error(`Failed to action regularization: ${regError?.message}`);

    if (action === 'APPROVE' && reg.attendance_id) {
      await supabase
        .from('attendance_records')
        .update({
          is_regularized: true,
          status: 'PRESENT',
          worked_hours: 8.5,
          remarks: `Regularized by ${emp.full_name}: ${reg.reason}`
        })
        .eq('id', reg.attendance_id);
    }
  },

  async getTeamCalendar(month: number, year: number) {
    const emp = await getCurrentEmployee();
    const { data: reportsData, error: reportsError } = await supabase
      .from('employees')
      .select('*, department:departments(name), manager:employees!employees_manager_id_fkey(full_name)')
      .eq('manager_id', emp.id);

    if (reportsError) throw new Error(`Failed to load team reports: ${reportsError.message}`);
    const directReports = (reportsData ?? []).map(mapEmployee);
    const reportIds = directReports.map(r => r.id);

    if (reportIds.length === 0) {
      return { directReports: [], leaves: [] };
    }

    const monthStr = String(month).padStart(2, '0');
    const startMonth = `${year}-${monthStr}-01`;
    const endMonth = `${year}-${monthStr}-31`;

    const { data: leavesData, error: leavesError } = await supabase
      .from('leave_requests')
      .select('*, employee:employees(emp_code, full_name, department:departments(name)), leave_type:leave_types(code, name), current_approver:employees!leave_requests_current_approver_id_fkey(full_name)')
      .in('employee_id', reportIds)
      .in('status', ['APPROVED', 'PENDING'])
      .lte('from_date', endMonth)
      .gte('to_date', startMonth);

    if (leavesError) throw new Error(`Failed to load team leaves: ${leavesError.message}`);

    return {
      directReports,
      leaves: (leavesData ?? []).map(mapLeaveRequest)
    };
  },

  async getTeamKpis(): Promise<{ cycle: KpiCycle; definitions: KpiDefinition[]; reports: Employee[] }> {
    const emp = await getCurrentEmployee();
    const { data: reportsData, error: reportsError } = await supabase
      .from('employees')
      .select('*, department:departments(name), manager:employees!employees_manager_id_fkey(full_name)')
      .eq('manager_id', emp.id);

    if (reportsError) throw new Error(`Failed to load team members for KPIs: ${reportsError.message}`);
    const reports = (reportsData ?? []).map(mapEmployee);
    const reportIds = reports.map(r => r.id);

    const { data: cycleData, error: cycleError } = await supabase
      .from('kpi_cycles')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (cycleError) throw new Error(`Failed to load KPI cycle: ${cycleError.message}`);

    if (reportIds.length === 0) {
      return { cycle: mapKpiCycle(cycleData), definitions: [], reports: [] };
    }

    const { data: definitionsData, error: defsError } = await supabase
      .from('kpi_definitions')
      .select('*, kpi_scores(*)')
      .in('employee_id', reportIds)
      .eq('cycle_id', cycleData.id);

    if (defsError) throw new Error(`Failed to load KPI definitions: ${defsError.message}`);

    return {
      cycle: mapKpiCycle(cycleData),
      definitions: (definitionsData ?? []).map(mapKpiDefinition),
      reports
    };
  },

  async defineKpi(data: { employeeId: number; title: string; metricUnit: string; targetValue: number; weightPct: number }): Promise<void> {
    const emp = await getCurrentEmployee();
    const { data: cycleData, error: cycleError } = await supabase
      .from('kpi_cycles')
      .select('id')
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (cycleError) throw new Error(`Failed to get active KPI cycle: ${cycleError.message}`);

    const { error } = await supabase
      .from('kpi_definitions')
      .insert({
        cycle_id: cycleData.id,
        employee_id: data.employeeId,
        title: data.title,
        metric_unit: data.metricUnit,
        target_value: data.targetValue,
        weight_pct: data.weightPct,
        created_by: emp.id
      });

    if (error) throw new Error(`Failed to create KPI definition: ${error.message}`);
  },

  async reviewKpi(kpiId: number, data: { managerRating: number; managerComment: string }): Promise<void> {
    const { data: existingScore } = await supabase
      .from('kpi_scores')
      .select('*')
      .eq('kpi_id', kpiId)
      .maybeSingle();

    let finalRating = data.managerRating;
    if (existingScore?.self_rating) {
      finalRating = Number(((Number(existingScore.self_rating) * 0.4) + (data.managerRating * 0.6)).toFixed(1));
    }

    const { error } = await supabase
      .from('kpi_scores')
      .upsert({
        kpi_id: kpiId,
        manager_rating: data.managerRating,
        manager_comment: data.managerComment,
        final_rating: finalRating,
        reviewed_at: new Date().toISOString()
      }, { onConflict: 'kpi_id' });

    if (error) throw new Error(`Failed to submit KPI review: ${error.message}`);
  }
};
