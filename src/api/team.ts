import { supabase } from '../lib/supabase';
import { withManagerNames } from './managerNames';
import { monthBounds, getSessionEmployee } from './session';
import { LEAVE_APPROVAL_POLICY } from '../config/policy';
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
  return getSessionEmployee();
}

export const teamApi = {
  async getMembers(): Promise<Employee[]> {
    const emp = await getCurrentEmployee();
    const { data, error } = await supabase
      .from('employees')
      .select('*, department:departments!employees_department_id_fkey(name)')
      .eq('manager_id', emp.id)
      .order('full_name');

    if (error) throw new Error(`Failed to load team members: ${error.message}`);
    return (await withManagerNames(data ?? [])).map(mapEmployee);
  },

  async getTeamAttendance(date: string): Promise<Array<{ employee: Employee; attendance?: AttendanceRecord }>> {
    const emp = await getCurrentEmployee();
    const { data: members, error: membersError } = await supabase
      .from('employees')
      .select('*, department:departments!employees_department_id_fkey(name)')
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

  /**
   * Leave requests waiting on the signed-in user.
   * MINE      — requests where I am the current approver in the reporting line.
   * HR_QUEUE  — requests with no approver (employee has no reporting manager).
   * ALL       — every pending request (HR override view).
   */
  async getPendingLeaves(scope: 'MINE' | 'HR_QUEUE' | 'ALL' = 'MINE'): Promise<LeaveRequest[]> {
    const emp = await getCurrentEmployee();

    let query = supabase
      .from('leave_requests')
      .select('*, employee:employees!leave_requests_employee_id_fkey(emp_code, full_name, department:departments!employees_department_id_fkey(name)), leave_type:leave_types(code, name), current_approver:employees!leave_requests_current_approver_id_fkey(full_name)')
      .eq('status', 'PENDING');

    if (scope === 'MINE') query = query.eq('current_approver_id', emp.id);
    else if (scope === 'HR_QUEUE') query = query.is('current_approver_id', null);

    const { data, error } = await query.order('applied_at', { ascending: false });
    if (error) throw new Error(`Failed to load pending team leaves: ${error.message}`);

    const requests = (data ?? []).map(mapLeaveRequest).filter(r => r.employeeId !== emp.id);
    if (requests.length === 0) return requests;

    // Flag overlapping approved leave among the same manager's team for coverage.
    const { data: overlaps } = await supabase
      .from('leave_requests')
      .select('employee_id, from_date, to_date, employee:employees!leave_requests_employee_id_fkey(full_name, manager_id)')
      .eq('status', 'APPROVED')
      .lte('from_date', requests.reduce((m, r) => (r.toDate > m ? r.toDate : m), requests[0].toDate))
      .gte('to_date', requests.reduce((m, r) => (r.fromDate < m ? r.fromDate : m), requests[0].fromDate));

    const managerOf = new Map<number, number | null>();
    if (overlaps && overlaps.length > 0) {
      const { data: mgrRows } = await supabase
        .from('employees')
        .select('id, manager_id')
        .in('id', requests.map(r => r.employeeId));
      (mgrRows ?? []).forEach(m => managerOf.set(m.id, m.manager_id));
    }

    return requests.map(r => {
      const mgr = managerOf.get(r.employeeId);
      const conflicts = (overlaps ?? [])
        .filter((o: any) => o.employee_id !== r.employeeId && mgr != null && o.employee?.manager_id === mgr)
        .filter((o: any) => o.from_date <= r.toDate && o.to_date >= r.fromDate)
        .map((o: any) => ({ employeeName: o.employee?.full_name ?? '', leaveDates: `${o.from_date} → ${o.to_date}` }));
      return conflicts.length > 0 ? { ...r, conflicts } : r;
    });
  },

  /**
   * Approve or reject following the reporting hierarchy:
   *  L1 — reporting manager. Leave longer than the skip-level threshold is then
   *  forwarded to L2 — the manager's own manager. HR may act as an override.
   */
  async actionLeave(
    requestId: number,
    action: 'APPROVE' | 'REJECT',
    remarks?: string,
    opts: { asHr?: boolean } = {}
  ): Promise<{ forwardedTo?: string }> {
    if (action === 'REJECT' && (!remarks || !remarks.trim())) {
      throw new Error('Mandatory remarks are required when rejecting a leave request.');
    }

    const emp = await getCurrentEmployee();
    const { data: req, error: reqError } = await supabase
      .from('leave_requests')
      .select('*, current_approver:employees!leave_requests_current_approver_id_fkey(full_name)')
      .eq('id', requestId)
      .single();

    if (reqError || !req) throw new Error(`Leave request not found: ${reqError?.message}`);
    if (req.status !== 'PENDING') throw new Error(`This request is already ${req.status.toLowerCase()}.`);
    if (req.employee_id === emp.id) throw new Error('You cannot approve or reject your own leave request.');

    const isCurrentApprover = req.current_approver_id === emp.id;
    if (!isCurrentApprover && !opts.asHr) {
      const waitingOn = (req as any).current_approver?.full_name;
      throw new Error(waitingOn ? `This request is waiting on ${waitingOn}.` : 'This request is in the HR queue.');
    }

    const level = req.current_level ?? 1;
    const nowIso = new Date().toISOString();
    const priorTimeline = (Array.isArray(req.timeline) ? (req.timeline as any[]) : []).filter(
      step => !(step?.action === 'PENDING' && (step?.level ?? 1) === level)
    );
    const actedStep = {
      level,
      approverId: emp.id,
      approverName: emp.full_name,
      approverRole: isCurrentApprover ? (level === 1 ? 'Reporting Manager' : 'Skip-level Manager') : 'HR Override',
      action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      remarks: remarks || (action === 'APPROVE' ? 'Approved' : 'Rejected'),
      actedAt: nowIso
    };

    const needsSkipLevel =
      action === 'APPROVE' &&
      isCurrentApprover &&
      level === 1 &&
      Number(req.total_days ?? 0) > LEAVE_APPROVAL_POLICY.skipLevelThresholdDays &&
      emp.manager_id != null &&
      emp.manager_id !== req.employee_id &&
      emp.manager_id !== emp.id;

    if (needsSkipLevel) {
      const { data: nextApprover } = await supabase
        .from('employees')
        .select('id, full_name, status')
        .eq('id', emp.manager_id as number)
        .maybeSingle();

      if (
        nextApprover &&
        nextApprover.status !== 'EXITED' &&
        nextApprover.id !== req.employee_id &&
        nextApprover.id !== emp.id
      ) {
        const { error } = await supabase
          .from('leave_requests')
          .update({
            current_level: 2,
            current_approver_id: nextApprover.id,
            timeline: [
              ...priorTimeline,
              actedStep,
              { level: 2, approverId: nextApprover.id, approverName: nextApprover.full_name, approverRole: 'Skip-level Manager', action: 'PENDING' }
            ] as any
          })
          .eq('id', requestId)
          .eq('status', 'PENDING');
        if (error) throw new Error(`Failed to forward leave request: ${error.message}`);
        return { forwardedTo: nextApprover.full_name };
      }
    }

    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        closed_at: nowIso,
        timeline: [...priorTimeline, actedStep] as any
      })
      .eq('id', requestId)
      .eq('status', 'PENDING');

    if (updateError) throw new Error(`Failed to action leave request: ${updateError.message}`);

    // Leave balance (reserved → used / released) is updated by the leave_requests_sync_balance trigger.
    return {};
  },

  /**
   * Time-update (regularization) requests waiting on the signed-in user.
   * MINE      — requests addressed to me or raised by my direct reports.
   * HR_QUEUE  — requests with no approver (employee has no reporting manager).
   * ALL       — every pending request (HR override view).
   */
  async getPendingRegularizations(scope: 'MINE' | 'HR_QUEUE' | 'ALL' = 'MINE'): Promise<AttendanceRegularization[]> {
    const emp = await getCurrentEmployee();

    let query = supabase
      .from('attendance_regularizations')
      .select('*, employee:employees!attendance_regularizations_employee_id_fkey(emp_code, full_name), approver:employees!attendance_regularizations_approver_id_fkey(full_name)')
      .eq('status', 'PENDING')
      .neq('employee_id', emp.id);

    if (scope === 'MINE') {
      const { data: members } = await supabase.from('employees').select('id').eq('manager_id', emp.id);
      const directReportIds = (members ?? []).map(m => m.id);
      query = directReportIds.length > 0
        ? query.or(`approver_id.eq.${emp.id},employee_id.in.(${directReportIds.join(',')})`)
        : query.eq('approver_id', emp.id);
    } else if (scope === 'HR_QUEUE') {
      query = query.is('approver_id', null);
    }

    const { data, error } = await query.order('work_date', { ascending: true });
    if (error) throw new Error(`Failed to load pending regularizations: ${error.message}`);
    const regs = (data ?? []).map(mapAttendanceRegularization);
    if (regs.length === 0) return regs;

    // Show the approver what is on record today next to what is being requested.
    const { data: punches } = await supabase
      .from('attendance_records')
      .select('employee_id, work_date, punch_in, punch_out')
      .in('employee_id', [...new Set(regs.map(r => r.employeeId))])
      .in('work_date', [...new Set(regs.map(r => r.workDate))]);
    const punchOf = new Map((punches ?? []).map(p => [`${p.employee_id}|${p.work_date}`, p]));

    return regs.map(r => {
      const p = punchOf.get(`${r.employeeId}|${r.workDate}`);
      return p ? { ...r, currentPunchIn: p.punch_in ?? undefined, currentPunchOut: p.punch_out ?? undefined } : r;
    });
  },

  /**
   * Approve or reject a time update. On approval the database writes the requested
   * times onto that day's attendance (apply_approved_regularization trigger).
   */
  async actionRegularization(
    regId: number,
    action: 'APPROVE' | 'REJECT',
    remarks?: string,
    opts: { asHr?: boolean } = {}
  ): Promise<void> {
    if (action === 'REJECT' && !remarks?.trim()) {
      throw new Error('Remarks are required when rejecting a time update.');
    }
    const emp = await getCurrentEmployee();

    const { data: pending, error: pendingError } = await supabase
      .from('attendance_regularizations')
      .select('employee_id, approver_id, status, employee:employees!attendance_regularizations_employee_id_fkey(manager_id)')
      .eq('id', regId)
      .single();
    if (pendingError || !pending) throw new Error(`Regularization not found: ${pendingError?.message}`);
    if (pending.status !== 'PENDING') throw new Error(`This time update is already ${pending.status.toLowerCase()}.`);
    if (pending.employee_id === emp.id) throw new Error('You cannot approve your own attendance regularization.');
    const isReportingManager =
      pending.approver_id === emp.id || (pending as any).employee?.manager_id === emp.id;
    if (!isReportingManager && !opts.asHr) {
      throw new Error('Only the reporting manager (or HR) can action this regularization.');
    }

    const { data: reg, error: regError } = await supabase
      .from('attendance_regularizations')
      .update({
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approver_id: emp.id,
        approver_remarks: remarks?.trim() || null,
        acted_at: new Date().toISOString()
      })
      .eq('id', regId)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();

    if (regError) throw new Error(`Failed to action regularization: ${regError.message}`);
    if (!reg) throw new Error('This time update was already actioned by someone else. Refresh the queue.');
  },

  async getTeamCalendar(month: number, year: number) {
    const emp = await getCurrentEmployee();
    const { data: reportsData, error: reportsError } = await supabase
      .from('employees')
      .select('*, department:departments!employees_department_id_fkey(name)')
      .eq('manager_id', emp.id);

    if (reportsError) throw new Error(`Failed to load team reports: ${reportsError.message}`);
    const directReports = (await withManagerNames(reportsData ?? [])).map(mapEmployee);
    const reportIds = directReports.map(r => r.id);

    if (reportIds.length === 0) {
      return { directReports: [], leaves: [] };
    }

    const monthStr = String(month).padStart(2, '0');
    const startMonth = `${year}-${monthStr}-01`;
    const endMonth = monthBounds(year, month).end;

    const { data: leavesData, error: leavesError } = await supabase
      .from('leave_requests')
      .select('*, employee:employees!leave_requests_employee_id_fkey(emp_code, full_name, department:departments!employees_department_id_fkey(name)), leave_type:leave_types(code, name), current_approver:employees!leave_requests_current_approver_id_fkey(full_name)')
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
      .select('*, department:departments!employees_department_id_fkey(name)')
      .eq('manager_id', emp.id);

    if (reportsError) throw new Error(`Failed to load team members for KPIs: ${reportsError.message}`);
    const reports = (await withManagerNames(reportsData ?? [])).map(mapEmployee);
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
