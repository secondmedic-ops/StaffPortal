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
  RoleType,
  Asset,
  AssetAssignment,
  ItRequest,
  LifecycleTask,
  EmployeeProfile,
  SalaryRevision,
  PayrollEntry,
  PayrollLine,
  HolidayWorkClaim,
  Branch,
  WfhRequest,
  EmailOutboxItem,
  EmployeeHistoryItem,
  EmployeeDocument,
  ProfileChangeRequest,
  Resignation,
  FnfSettlement,
  GalleryAlbum,
  GalleryPhoto
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
    division: row.division ?? undefined,
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

const num = (v: any): number => (v == null ? 0 : Number(v));
const opt = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

export function mapEmployeeProfile(row: any): EmployeeProfile {
  return {
    employeeId: row.employee_id,
    dateOfBirth: opt(row.date_of_birth),
    gender: opt(row.gender),
    bloodGroup: opt(row.blood_group),
    maritalStatus: opt(row.marital_status),
    fatherName: opt(row.father_name),
    currentAddress: opt(row.current_address),
    permanentAddress: opt(row.permanent_address),
    emergencyContactName: opt(row.emergency_contact_name),
    emergencyContactPhone: opt(row.emergency_contact_phone),
    emergencyContactRelation: opt(row.emergency_contact_relation),
    panNumber: opt(row.pan_number),
    aadhaarLast4: opt(row.aadhaar_last4),
    aadhaarNumber: opt(row.aadhaar_number),
    uanNumber: opt(row.uan_number),
    esicNumber: opt(row.esic_number),
    bankName: opt(row.bank_name),
    bankAccountNumber: opt(row.bank_account_number),
    bankIfsc: opt(row.bank_ifsc)
  };
}

export function mapAsset(row: any): Asset {
  return {
    id: row.id,
    assetTag: row.asset_tag,
    category: row.category,
    brand: opt(row.brand),
    model: opt(row.model),
    serialNumber: opt(row.serial_number),
    imei: opt(row.imei),
    phoneNumber: opt(row.phone_number),
    carrier: opt(row.carrier),
    planDetails: opt(row.plan_details),
    specs: opt(row.specs),
    purchaseDate: opt(row.purchase_date),
    purchaseCost: row.purchase_cost != null ? Number(row.purchase_cost) : undefined,
    vendor: opt(row.vendor),
    warrantyUntil: opt(row.warranty_until),
    status: row.status,
    condition: row.condition,
    assignedTo: opt(row.assigned_to),
    assignedToName: opt(row.assignee?.full_name),
    assignedToCode: opt(row.assignee?.emp_code),
    assignedAt: opt(row.assigned_at),
    acknowledgedAt: opt(row.acknowledged_at),
    notes: opt(row.notes)
  };
}

export function mapAssetAssignment(row: any): AssetAssignment {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetTag: opt(row.asset?.asset_tag),
    employeeId: row.employee_id,
    employeeName: opt(row.employee?.full_name),
    assignedAt: row.assigned_at,
    assignedByName: opt(row.assigner?.full_name),
    returnedAt: opt(row.returned_at),
    returnCondition: opt(row.return_condition),
    notes: opt(row.notes)
  };
}

export function mapItRequest(row: any): ItRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: opt(row.employee?.full_name),
    employeeCode: opt(row.employee?.emp_code),
    requestType: row.request_type,
    title: row.title,
    details: opt(row.details),
    priority: row.priority,
    status: row.status,
    raisedById: opt(row.raised_by),
    raisedByName: opt(row.raiser?.full_name),
    resolution: opt(row.resolution),
    createdAt: row.created_at,
    closedAt: opt(row.closed_at)
  };
}

export function mapLifecycleTask(row: any): LifecycleTask {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: opt(row.employee?.full_name),
    employeeCode: opt(row.employee?.emp_code),
    kind: row.kind,
    ownerRole: row.owner_role,
    title: row.title,
    dueDate: opt(row.due_date),
    done: Boolean(row.done),
    doneByName: opt(row.doer?.full_name),
    doneAt: opt(row.done_at)
  };
}

export function mapSalaryRevision(row: any): SalaryRevision {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: opt(row.employee?.full_name),
    employeeCode: opt(row.employee?.emp_code),
    designation: opt(row.employee?.designation),
    departmentName: opt(row.employee?.department?.name),
    revisionType: row.revision_type,
    effectiveFrom: row.effective_from,
    ctcAnnual: num(row.ctc_annual),
    basicMonthly: num(row.basic_monthly),
    hraMonthly: num(row.hra_monthly),
    specialMonthly: num(row.special_monthly),
    otherAllowanceMonthly: num(row.other_allowance_monthly),
    tdsMonthly: num(row.tds_monthly),
    pfApplicable: row.pf_applicable !== false,
    payType: row.pay_type === 'DAILY' ? 'DAILY' : 'MONTHLY',
    dailyRate: row.daily_rate != null ? Number(row.daily_rate) : undefined,
    incrementPct: row.increment_pct != null ? Number(row.increment_pct) : undefined,
    newDesignation: opt(row.new_designation),
    reason: opt(row.reason),
    status: row.status,
    proposedById: opt(row.proposed_by),
    proposedByName: opt(row.proposer?.full_name),
    approvedByName: opt(row.approver?.full_name),
    approvedAt: opt(row.approved_at),
    createdAt: opt(row.created_at)
  };
}

const lines = (v: any): PayrollLine[] =>
  Array.isArray(v) ? v.map((l: any) => ({ code: String(l.code), label: String(l.label), amount: num(l.amount) })) : [];

export function mapPayrollEntry(row: any): PayrollEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: opt(row.employee?.full_name),
    employeeCode: opt(row.employee?.emp_code),
    designation: opt(row.employee?.designation),
    departmentName: opt(row.employee?.department?.name),
    year: row.year,
    month: row.month,
    calendarDays: num(row.calendar_days),
    payableDays: num(row.payable_days),
    presentDays: num(row.present_days),
    paidLeaveDays: num(row.paid_leave_days),
    holidayDays: num(row.holiday_days),
    weekOffDays: num(row.week_off_days),
    lopDays: num(row.lop_days),
    lateMarks: num(row.late_marks),
    earnings: lines(row.earnings),
    deductions: lines(row.deductions),
    employerContributions: lines(row.employer_contributions),
    grossEarnings: num(row.gross_earnings),
    totalDeductions: num(row.total_deductions),
    netPay: num(row.net_pay),
    payType: row.pay_type === 'DAILY' ? 'DAILY' : 'MONTHLY',
    workedHours: row.worked_hours != null ? Number(row.worked_hours) : undefined,
    dailyRate: row.daily_rate != null ? Number(row.daily_rate) : undefined,
    status: row.status,
    revisionId: opt(row.revision_id),
    computedById: opt(row.computed_by),
    computedByName: opt(row.computer?.full_name),
    computedAt: opt(row.computed_at),
    publishedAt: opt(row.published_at)
  };
}

export function mapHolidayWorkClaim(row: any): HolidayWorkClaim {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: opt(row.employee?.full_name),
    employeeCode: opt(row.employee?.emp_code),
    workDate: row.work_date,
    workedHours: row.worked_hours != null ? Number(row.worked_hours) : undefined,
    days: num(row.days),
    compensation: row.compensation,
    reason: opt(row.reason),
    status: row.status,
    approverName: opt(row.approver?.full_name),
    approverRemarks: opt(row.approver_remarks),
    actedAt: opt(row.acted_at),
    createdAt: row.created_at
  };
}

export function mapBranch(row: any): Branch {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
    geofenceRadiusM: Number(row.geofence_radius_m ?? 100),
    active: Boolean(row.active),
    adminEmployeeIds: Array.isArray(row.admin_employee_ids) ? row.admin_employee_ids : [],
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export function mapWfhRequest(row: any): WfhRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee?.full_name ?? undefined,
    employeeCode: row.employee?.emp_code ?? undefined,
    fromDate: row.from_date,
    toDate: row.to_date,
    reason: row.reason,
    status: row.status,
    approverId: row.approver_id ?? undefined,
    approverName: row.approver?.full_name ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export function mapEmailOutboxItem(row: any): EmailOutboxItem {
  return {
    id: row.id,
    template: row.template,
    to: row.to,
    cc: row.cc ?? undefined,
    subject: row.subject,
    payload: row.payload ?? {},
    status: row.status,
    attempts: Number(row.attempts ?? 0),
    lastError: row.last_error ?? undefined,
    dedupeKey: row.dedupe_key ?? undefined,
    createdAt: row.created_at,
    sentAt: row.sent_at ?? undefined
  };
}

export function mapEmployeeHistoryItem(row: any): EmployeeHistoryItem {
  return {
    id: row.id,
    employeeId: row.employee_id,
    field: row.field,
    oldValue: row.old_value ?? undefined,
    newValue: row.new_value ?? undefined,
    changedBy: row.changed_by ?? undefined,
    changedByName: row.changer?.full_name ?? undefined,
    changedAt: row.changed_at
  };
}

export function mapEmployeeDocument(row: any): EmployeeDocument {
  return {
    id: row.id,
    employeeId: row.employee_id,
    category: row.category,
    filePath: row.file_path,
    name: row.name,
    size: Number(row.size ?? 0),
    uploadedBy: row.uploaded_by ?? undefined,
    uploadedByName: row.uploader?.full_name ?? undefined,
    uploadedAt: row.uploaded_at
  };
}

export function mapProfileChangeRequest(row: any): ProfileChangeRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee?.full_name ?? undefined,
    employeeCode: row.employee?.emp_code ?? undefined,
    field: row.field,
    oldValue: row.old_value ?? undefined,
    newValue: row.new_value,
    reason: row.reason,
    status: row.status,
    actionedBy: row.actioned_by ?? undefined,
    actionedByName: row.actioner?.full_name ?? undefined,
    actionedAt: row.actioned_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: row.created_at
  };
}

export function mapResignation(row: any): Resignation {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee?.full_name ?? undefined,
    employeeCode: row.employee?.emp_code ?? undefined,
    submittedDate: row.submitted_date,
    reason: row.reason,
    requestedLwd: row.requested_lwd,
    confirmedLwd: row.confirmed_lwd ?? undefined,
    noticeDays: Number(row.notice_days ?? 30),
    status: row.status,
    managerComments: row.manager_comments ?? undefined,
    hrComments: row.hr_comments ?? undefined,
    actionedByManagerAt: row.actioned_by_manager_at ?? undefined,
    actionedByHrAt: row.actioned_by_hr_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapFnfSettlement(row: any): FnfSettlement {
  return {
    id: row.id,
    resignationId: row.resignation_id ?? undefined,
    employeeId: row.employee_id,
    employeeName: row.employee?.full_name ?? undefined,
    employeeCode: row.employee?.emp_code ?? undefined,
    status: row.status,
    lastWorkingDay: row.last_working_day,
    payableDays: Number(row.payable_days ?? 0),
    perDayBasic: Number(row.per_day_basic ?? 0),
    salaryDue: Number(row.salary_due ?? 0),
    leaveEncashmentDays: Number(row.leave_encashment_days ?? 0),
    leaveEncashmentAmount: Number(row.leave_encashment_amount ?? 0),
    gratuityAmount: Number(row.gratuity_amount ?? 0),
    bonusAmount: Number(row.bonus_amount ?? 0),
    noticeShortfallDays: Number(row.notice_shortfall_days ?? 0),
    noticeRecoveryAmount: Number(row.notice_recovery_amount ?? 0),
    assetRecoveryAmount: Number(row.asset_recovery_amount ?? 0),
    otherRecoveries: Number(row.other_recoveries ?? 0),
    otherPayables: Number(row.other_payables ?? 0),
    netPayable: Number(row.net_payable ?? 0),
    remarks: row.remarks ?? undefined,
    preparedBy: row.prepared_by ?? undefined,
    preparedByName: row.preparer?.full_name ?? undefined,
    preparedAt: row.prepared_at ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedByName: row.approver?.full_name ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export function mapGalleryAlbum(row: any): GalleryAlbum {
  return {
    id: row.id,
    branchId: row.branch_id ?? undefined,
    branchName: row.branch?.name ?? undefined,
    title: row.title,
    eventType: row.event_type,
    eventDate: row.event_date,
    description: row.description ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdByName: row.creator?.full_name ?? undefined,
    createdAt: row.created_at ?? undefined,
    photoCount: row.photos ? row.photos.length : undefined
  };
}

export function mapGalleryPhoto(row: any): GalleryPhoto {
  return {
    id: row.id,
    albumId: row.album_id,
    filePath: row.file_path,
    caption: row.caption ?? undefined,
    uploadedBy: row.uploaded_by ?? undefined,
    uploadedByName: row.uploader?.full_name ?? undefined,
    uploadedAt: row.uploaded_at
  };
}
