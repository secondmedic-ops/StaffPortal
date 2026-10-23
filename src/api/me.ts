import { supabase } from '../lib/supabase';
import { monthBounds, getSessionEmployee } from './session';
import {
  mapAttendanceRecord,
  mapAttendanceRegularization,
  mapLeaveBalance,
  mapLeaveRequest,
  mapLeaveType,
  mapHoliday,
  mapKpiCycle,
  mapKpiDefinition
} from './mappers';
import { HOLIDAY_TEMPLATES } from '../config/holidayTemplates';
import type {
  AttendanceRecord,
  AttendanceRegularization,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  Holiday,
  KpiCycle,
  KpiDefinition,
  Payslip
} from '../types';

async function getCurrentEmployee() {
  return getSessionEmployee();
}

export const meApi = {
  async getAttendance(month: number, year: number): Promise<AttendanceRecord[]> {
    const emp = await getCurrentEmployee();
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = monthBounds(year, month).end;

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

  async punch(data: {
    type: 'IN' | 'OUT';
    lat?: number;
    lng?: number;
    source?: string;
    workMode?: 'OFFICE' | 'WFH' | 'FIELD';
    visitLocation?: string;
    visitPurpose?: string;
    visitClient?: string;
  }): Promise<AttendanceRecord> {
    const emp = await getCurrentEmployee();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
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
        // Idempotency: if already punched in, keep original punch_in timestamp
        if (existing.punch_in) {
          return mapAttendanceRecord(existing);
        }
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
      // Idempotency: if already punched out, keep original punch_out
      if (existing?.punch_out) {
        return mapAttendanceRecord(existing);
      }
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
        status: 'PENDING',
        approver_id: emp.manager_id ?? null
      })
      .select('*, employee:employees!attendance_regularizations_employee_id_fkey(emp_code, full_name)')
      .single();

    if (error) throw new Error(`Failed to request attendance regularization: ${error.message}`);
    return mapAttendanceRegularization(reg);
  },

  async getLeaveTypes(): Promise<LeaveType[]> {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .order('id');

      if (!error && data && data.length > 0) {
        return data.map(mapLeaveType);
      }
    } catch {}

    // Fallback standard leave types if table is empty or loading is interrupted
    return [
      { id: 1, code: 'CL', name: 'Casual Leave', annualQuota: 7, carryForwardMax: 0, requiresDocumentAfterDays: 0, allowHalfDay: true, sandwichRule: false, active: true },
      { id: 2, code: 'SL', name: 'Sick Leave', annualQuota: 7, carryForwardMax: 0, requiresDocumentAfterDays: 2, allowHalfDay: true, sandwichRule: false, active: true },
      { id: 3, code: 'EL', name: 'Earned Leave', annualQuota: 18, carryForwardMax: 30, requiresDocumentAfterDays: 0, allowHalfDay: true, sandwichRule: false, active: true },
      { id: 4, code: 'COMP_OFF', name: 'Compensatory Off', annualQuota: 0, carryForwardMax: 0, requiresDocumentAfterDays: 0, allowHalfDay: true, sandwichRule: false, active: true },
      { id: 5, code: 'LOP', name: 'Loss of Pay', annualQuota: 0, carryForwardMax: 0, requiresDocumentAfterDays: 0, allowHalfDay: true, sandwichRule: false, active: true }
    ];
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
      .select('*, employee:employees!leave_requests_employee_id_fkey(emp_code, full_name, department:departments!employees_department_id_fkey(name)), leave_type:leave_types(code, name), current_approver:employees!leave_requests_current_approver_id_fkey(full_name)')
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

    // Block overlapping requests (pending or approved)
    const { data: overlapping, error: overlapError } = await supabase
      .from('leave_requests')
      .select('id, from_date, to_date, status')
      .eq('employee_id', emp.id)
      .in('status', ['PENDING', 'APPROVED'])
      .lte('from_date', data.toDate)
      .gte('to_date', data.fromDate);
    if (overlapError) throw new Error(`Failed to validate leave dates: ${overlapError.message}`);
    if (overlapping && overlapping.length > 0) {
      const o = overlapping[0];
      throw new Error(`You already have a ${o.status.toLowerCase()} leave from ${o.from_date} to ${o.to_date} overlapping these dates.`);
    }

    // Route to the reporting manager; with no manager or self-reporting manager the request goes to the HR queue.
    const approverId = emp.manager_id != null && emp.manager_id !== emp.id ? emp.manager_id : null;
    const approverName = approverId ? (emp.manager as any)?.full_name ?? undefined : undefined;

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
        current_approver_id: approverId,
        applied_at: new Date().toISOString(),
        timeline: [
          {
            level: 1,
            approverId,
            approverName: approverName ?? 'HR Desk',
            approverRole: approverId ? 'Reporting Manager' : 'HR (no reporting manager)',
            action: 'PENDING'
          }
        ]
      })
      .select('*, employee:employees!leave_requests_employee_id_fkey(emp_code, full_name, department:departments!employees_department_id_fkey(name)), leave_type:leave_types(code, name), current_approver:employees!leave_requests_current_approver_id_fkey(full_name)')
      .single();

    if (error) throw new Error(`Failed to apply for leave: ${error.message}`);
    // Balance reservation is handled by the leave_requests_sync_balance trigger.
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
    const endMonth = monthBounds(year, month).end;

    let holidays: Holiday[] = [];
    try {
      const { data: holidaysData, error: holidaysError } = await supabase
        .from('holidays')
        .select('*')
        .order('holiday_date', { ascending: true });

      if (holidaysError) throw holidaysError;
      const mappedDbHolidays = (holidaysData ?? []).map(mapHoliday);
      const hasYearHolidays = mappedDbHolidays.some(h => h.holidayDate.startsWith(String(year)));
      if (hasYearHolidays) {
        holidays = mappedDbHolidays;
      } else {
        const templates = HOLIDAY_TEMPLATES[year] || HOLIDAY_TEMPLATES[2026] || [];
        const fallbackHolidays: Holiday[] = templates.map((t, idx) => ({
          id: 9000 + idx,
          holidayDate: t.date,
          name: t.name,
          isOptional: Boolean(t.optional),
          isRestricted: Boolean(t.optional),
          holidayYear: Number(t.date.slice(0, 4)),
          createdAt: new Date().toISOString()
        }));
        holidays = [...mappedDbHolidays, ...fallbackHolidays];
      }
    } catch {
      const templates = HOLIDAY_TEMPLATES[year] || HOLIDAY_TEMPLATES[2026] || [];
      holidays = templates.map((t, idx) => ({
        id: 9000 + idx,
        holidayDate: t.date,
        name: t.name,
        isOptional: Boolean(t.optional),
        isRestricted: Boolean(t.optional),
        holidayYear: Number(t.date.slice(0, 4)),
        createdAt: new Date().toISOString()
      }));
    }

    const { data: myLeavesData, error: myLeavesError } = await supabase
      .from('leave_requests')
      .select('*, employee:employees!leave_requests_employee_id_fkey(emp_code, full_name, department:departments!employees_department_id_fkey(name)), leave_type:leave_types(code, name), current_approver:employees!leave_requests_current_approver_id_fkey(full_name)')
      .eq('employee_id', emp.id)
      .in('status', ['APPROVED', 'PENDING']);

    if (myLeavesError) throw new Error(`Failed to load my leaves: ${myLeavesError.message}`);

    const { data: teamLeavesData, error: teamLeavesError } = await supabase
      .from('leave_requests')
      .select('from_date, to_date, total_days, employee:employees!leave_requests_employee_id_fkey(full_name)')
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
      holidays,
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
  },

  async getMyProfileDetails(): Promise<{
    employee: any;
    profile: any;
    financials: any;
    statutory?: any;
    avatarSignedUrl: string | null;
  }> {
    const emp = await getCurrentEmployee();
    const { data: employeeData, error: empErr } = await supabase
      .from('employees')
      .select('*, department:departments(name), manager:employees!employees_manager_id_fkey(full_name, official_email)')
      .eq('id', emp.id)
      .single();

    if (empErr) throw new Error(`Failed to load employee details: ${empErr.message}`);

    const [profileRes, statutoryRes] = await Promise.all([
      supabase.from('employee_profiles').select('*').eq('employee_id', emp.id).maybeSingle(),
      supabase.from('employee_financials').select('*').eq('employee_id', emp.id).maybeSingle()
    ]);

    let avatarSignedUrl: string | null = null;
    if (employeeData.avatar_url) {
      try {
        const { data: urlData } = await supabase.storage
          .from('avatars')
          .createSignedUrl(employeeData.avatar_url, 3600);
        avatarSignedUrl = urlData?.signedUrl ?? null;
      } catch {
        avatarSignedUrl = null;
      }
    }

    return {
      employee: employeeData,
      profile: profileRes.data ?? null,
      financials: statutoryRes.data ?? null,
      statutory: statutoryRes.data ?? null,
      avatarSignedUrl
    };
  },

  async updateSelfServiceProfile(data: {
    mobile?: string;
    personalEmail?: string;
    currentAddress?: string;
    emergencyContactName?: string;
    emergencyContactRelation?: string;
    emergencyContactPhone?: string;
  }): Promise<void> {
    const emp = await getCurrentEmployee();

    if (data.mobile !== undefined || data.personalEmail !== undefined) {
      const empUpdate: Record<string, any> = {};
      if (data.mobile !== undefined) empUpdate.mobile = data.mobile;
      if (data.personalEmail !== undefined) empUpdate.personal_email = data.personalEmail;

      const { error: empError } = await supabase
        .from('employees')
        .update(empUpdate as any)
        .eq('id', emp.id);

      if (empError) throw new Error(`Failed to update contact info: ${empError.message}`);
    }

    if (
      data.currentAddress !== undefined ||
      data.emergencyContactName !== undefined ||
      data.emergencyContactRelation !== undefined ||
      data.emergencyContactPhone !== undefined
    ) {
      const { error: profError } = await supabase
        .from('employee_profiles')
        .upsert(
          {
            employee_id: emp.id,
            current_address: data.currentAddress,
            emergency_contact_name: data.emergencyContactName,
            emergency_contact_relation: data.emergencyContactRelation,
            emergency_contact_phone: data.emergencyContactPhone
          },
          { onConflict: 'employee_id' }
        );

      if (profError) throw new Error(`Failed to update emergency/address info: ${profError.message}`);
    }
  },

  async uploadAvatar(file: File): Promise<string> {
    const emp = await getCurrentEmployee();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${emp.id}/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw new Error(`Failed to upload avatar: ${uploadError.message}`);

    const { error: updateError } = await supabase
      .from('employees')
      .update({ avatar_url: storagePath })
      .eq('id', emp.id);

    if (updateError) throw new Error(`Failed to update avatar link: ${updateError.message}`);

    return storagePath;
  }
};
