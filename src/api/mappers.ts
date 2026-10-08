import type {
  Employee,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  Holiday,
  AttendanceRecord,
  AttendanceRegularization,
  MonthlyAttendanceSummary,
  Department,
  KpiCycle,
  KpiDefinition,
  KpiScore,
  AuditLogEntry,
  SystemUser,
  AppUser,
  RoleType
} from '../types';

export function mapEmployee(row: any): Employee {
  const deptName = row.department?.name ?? (row.department_name as string) ?? '';
  const mgrName = row.manager?.full_name ?? undefined;
  return {
    id: row.id,
    empCode: row.emp_code,
    entityId: row.entity_id ?? undefined,
    fullName: row.full_name,
    officialEmail: row.official_email,
    personalEmail: row.personal_email ?? undefined,
    mobile: row.mobile ?? undefined,
    phone: row.phone ?? row.mobile ?? undefined,
    departmentId: row.department_id,
    departmentName: deptName,
    designation: row.designation,
    employmentType: row.employment_type,
    dateOfJoining: row.date_of_joining ?? undefined,
    joiningDate: row.date_of_joining ?? undefined,
    dateOfExit: row.date_of_exit ?? undefined,
    workLocation: row.work_location ?? undefined,
    status: row.status,
    managerId: row.manager_id ?? undefined,
    managerName: mgrName,
    avatarUrl: row.avatar_url ?? undefined
  };
}

export function mapLeaveBalance(row: any): LeaveBalance {
  const opening = Number(row.opening ?? 0);
  const accrued = Number(row.accrued ?? 0);
  const used = Number(row.used ?? 0);
  const reserved = Number(row.reserved ?? 0);
  const encashed = Number(row.encashed ?? 0);
  const lapsed = Number(row.lapsed ?? 0);
  const available = opening + accrued - used - reserved;

  return {
    id: row.id,
    employeeId: row.employee_id,
    leaveTypeId: row.leave_type_id,
    leaveTypeCode: row.leave_type?.code ?? '',
    leaveTypeName: row.leave_type?.name ?? '',
    fyYear: row.fy_year,
    opening,
    accrued,
    used,
    reserved,
    encashed,
    lapsed,
    available
  };
}

export function mapLeaveRequest(row: any): LeaveRequest {
  const empCode = row.employee?.emp_code ?? '';
  const empName = row.employee?.full_name ?? '';
  const deptName = row.employee?.department?.name ?? '';
  const leaveCode = row.leave_type?.code ?? '';
  const leaveName = row.leave_type?.name ?? '';
  const approverName = row.current_approver?.full_name ?? undefined;

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeCode: empCode,
    employeeName: empName,
    departmentName: deptName,
    leaveTypeId: row.leave_type_id,
    leaveTypeCode: leaveCode,
    leaveTypeName: leaveName,
    fromDate: row.from_date,
    toDate: row.to_date,
    fromHalf: row.from_half ?? undefined,
    toHalf: row.to_half ?? undefined,
    totalDays: Number(row.total_days ?? 0),
    reason: row.reason ?? '',
    contactDuring: row.contact_during ?? undefined,
    documentUrl: row.document_url ?? undefined,
    documentName: row.document_name ?? undefined,
    status: row.status,
    currentLevel: row.current_level ?? 1,
    currentApproverId: row.current_approver_id ?? undefined,
    currentApproverName: approverName,
    appliedAt: row.applied_at,
    closedAt: row.closed_at ?? undefined,
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
    conflicts: undefined
  };
}

export function mapLeaveType(row: any): LeaveType {
  return {
    id: row.id,
    entityId: row.entity_id ?? undefined,
    code: row.code,
    name: row.name,
    annualQuota: Number(row.annual_quota ?? 0),
    accrualMode: row.accrual_mode ?? undefined,
    accrualPerMonth: row.accrual_per_month ? Number(row.accrual_per_month) : undefined,
    carryForwardMax: Number(row.carry_forward_max ?? 0),
    encashable: row.encashable ?? undefined,
    allowsHalfDay: row.allows_half_day ?? row.allow_half_day ?? undefined,
    allowHalfDay: row.allow_half_day ?? row.allows_half_day ?? undefined,
    requiresDocument: row.requires_document ?? undefined,
    requiresDocumentAfterDays: row.requires_document_after_days ? Number(row.requires_document_after_days) : undefined,
    minNoticeDays: row.min_notice_days ? Number(row.min_notice_days) : undefined,
    isPaid: row.is_paid ?? undefined,
    probationEligible: row.probation_eligible ?? undefined,
    sandwichRule: row.sandwich_rule ?? undefined,
    active: row.active ?? undefined
  };
}

export function mapHoliday(row: any): Holiday {
  return {
    id: row.id,
    entityId: row.entity_id ?? undefined,
    holidayDate: row.holiday_date,
    name: row.name,
    isOptional: row.is_optional ?? undefined,
    isRestricted: row.is_restricted ?? undefined,
    holidayYear: row.holiday_year ? Number(row.holiday_year) : undefined
  };
}

export function mapAttendanceRecord(row: any): AttendanceRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    workDate: row.work_date,
    shiftId: row.shift_id,
    punchIn: row.punch_in ?? undefined,
    punchOut: row.punch_out ?? undefined,
    inLat: row.in_lat ? Number(row.in_lat) : undefined,
    inLng: row.in_lng ? Number(row.in_lng) : undefined,
    outLat: row.out_lat ? Number(row.out_lat) : undefined,
    outLng: row.out_lng ? Number(row.out_lng) : undefined,
    inSource: row.in_source ?? undefined,
    workedHours: row.worked_hours != null ? Number(row.worked_hours) : undefined,
    status: row.status,
    leaveRequestId: row.leave_request_id ?? undefined,
    isRegularized: Boolean(row.is_regularized),
    remarks: row.remarks ?? undefined
  };
}

export function mapAttendanceRegularization(row: any): AttendanceRegularization {
  return {
    id: row.id,
    attendanceId: row.attendance_id ?? 0,
    employeeId: row.employee_id,
    employeeName: row.employee?.full_name ?? '',
    employeeCode: row.employee?.emp_code ?? '',
    workDate: row.work_date,
    requestedIn: row.requested_in,
    requestedOut: row.requested_out,
    reason: row.reason,
    status: row.status,
    approverId: row.approver_id ?? undefined,
    approverName: row.approver?.full_name ?? undefined,
    actedAt: row.acted_at ?? undefined
  };
}

export function mapMonthlyAttendanceSummary(row: any): MonthlyAttendanceSummary {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee?.full_name ?? '',
    employeeCode: row.employee?.emp_code ?? '',
    departmentName: row.employee?.department?.name ?? '',
    year: row.year,
    month: row.month,
    totalDays: row.total_days ? Number(row.total_days) : undefined,
    presentDays: Number(row.present_days ?? 0),
    leaveDays: Number(row.leave_days ?? 0),
    weekOffDays: row.week_off_days ? Number(row.week_off_days) : undefined,
    holidayDays: row.holiday_days ? Number(row.holiday_days) : undefined,
    lopDays: Number(row.lop_days ?? 0),
    payableDays: Number(row.payable_days ?? 0),
    locked: Boolean(row.locked),
    lockedBy: row.locked_by ?? undefined,
    lockedAt: row.locked_at ?? undefined
  };
}

export function mapDepartment(row: any): Department {
  return {
    id: row.id,
    entityId: row.entity_id,
    name: row.name,
    headId: row.head_id ?? undefined,
    headName: row.head?.full_name ?? undefined,
    employeeCount: row.employees?.[0]?.count ? Number(row.employees[0].count) : undefined
  };
}

export function mapKpiCycle(row: any): KpiCycle {
  return {
    id: row.id,
    entityId: row.entity_id ?? undefined,
    name: row.name,
    cycleName: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    selfReviewDue: row.self_review_due ?? undefined,
    managerReviewDue: row.manager_review_due ?? undefined,
    status: row.status
  };
}

export function mapKpiScore(row: any): KpiScore {
  return {
    id: row.id,
    kpiId: row.kpi_id,
    actualValue: row.actual_value != null ? Number(row.actual_value) : undefined,
    selfRating: row.self_rating != null ? Number(row.self_rating) : undefined,
    selfComment: row.self_comment ?? undefined,
    managerRating: row.manager_rating != null ? Number(row.manager_rating) : undefined,
    managerComment: row.manager_comment ?? undefined,
    finalRating: row.final_rating != null ? Number(row.final_rating) : undefined,
    submittedAt: row.submitted_at ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined
  };
}

export function mapKpiDefinition(row: any): KpiDefinition {
  const scoreRow = Array.isArray(row.kpi_scores) && row.kpi_scores.length > 0 ? row.kpi_scores[0] : row.score;
  return {
    id: row.id,
    cycleId: row.cycle_id,
    employeeId: row.employee_id,
    title: row.title,
    metricUnit: row.metric_unit,
    targetValue: Number(row.target_value ?? 0),
    weightPct: Number(row.weight_pct ?? 0),
    createdBy: row.created_by,
    score: scoreRow ? mapKpiScore(scoreRow) : undefined
  };
}

export function mapAuditLog(row: any): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    actorId: row.actor_id ?? undefined,
    actorName: row.actor_name ?? undefined,
    performedByName: row.actor_name ?? undefined,
    actorRole: row.actor_role ?? undefined,
    module: row.module ?? undefined,
    action: row.action,
    entityType: row.entity_type ?? undefined,
    entityId: row.entity_id ?? undefined,
    details: row.details,
    ipAddress: row.ip_address ?? ''
  };
}

export function mapSystemUser(row: any): SystemUser {
  const roles: RoleType[] = Array.isArray(row.employee_roles)
    ? row.employee_roles.map((r: any) => r.role)
    : Array.isArray(row.roles)
    ? row.roles
    : [];

  return {
    id: row.id,
    name: row.employee?.full_name ?? '',
    email: row.employee?.official_email ?? '',
    employeeId: row.employee_id,
    roles,
    status: row.is_locked ? 'SUSPENDED' : 'ACTIVE',
    lastLoginAt: row.last_login ?? undefined,
    isLocked: Boolean(row.is_locked)
  };
}

export function mapAppUser(row: any): AppUser {
  const roles: RoleType[] = Array.isArray(row.employee_roles)
    ? row.employee_roles.map((r: any) => r.role)
    : Array.isArray(row.roles)
    ? row.roles
    : [];

  return {
    id: row.id,
    employeeId: row.employee_id,
    roles,
    lastLogin: row.last_login ?? undefined,
    isLocked: Boolean(row.is_locked)
  };
}
