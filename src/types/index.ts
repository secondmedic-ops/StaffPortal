export type RoleType = 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'CEO' | 'SYSTEM_ADMIN';

export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  HR = 'HR',
  ACCOUNTS = 'ACCOUNTS',
  CEO = 'CEO',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN'
}

export type EmploymentType = 'FULL_TIME' | 'CONTRACT' | 'INTERN' | 'FIELD' | 'CONSULTANT' | 'PART_TIME';

export type EmployeeStatus = 'ACTIVE' | 'PROBATION' | 'NOTICE_PERIOD' | 'EXITED' | 'SUSPENDED';

export type LeaveStatusCode = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';

export type AttendanceStatusCode = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'WEEK_OFF' | 'HOLIDAY' | 'LOP';

export type PunchSource = 'WEB' | 'MOBILE' | 'WHATSAPP' | 'BIOMETRIC' | 'MANUAL';

export interface Entity {
  id: number;
  code: string; // SM_IN, LCC_MY
  name: string;
  country: string;
  currency: string;
  fyStartMonth: number;
}

export interface Department {
  id: number;
  entityId: number;
  name: string;
  headId?: number;
  headName?: string;
  employeeCount?: number;
}

export interface Employee {
  id: number;
  empCode: string;
  entityId?: number;
  fullName: string;
  officialEmail: string;
  personalEmail?: string;
  mobile?: string;
  phone?: string;
  departmentId: number;
  departmentName: string;
  designation: string;
  employmentType: EmploymentType;
  dateOfJoining?: string; // YYYY-MM-DD
  joiningDate?: string;
  dateOfExit?: string;
  workLocation?: string;
  status: EmployeeStatus;
  managerId?: number;
  managerName?: string;
  avatarUrl?: string;
}

export interface AppUser {
  id: number;
  employeeId: number;
  roles: RoleType[];
  lastLogin?: string;
  isLocked: boolean;
}

export interface SystemUser {
  id: number;
  name: string;
  email: string;
  employeeId: number;
  roles: RoleType[];
  status: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt?: string;
  isLocked: boolean;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  employee: Employee;
  roles: RoleType[];
}

export interface LeaveType {
  id: number;
  entityId?: number;
  code: string; // EL, AL, CL, SL, LOP, COMP_OFF, MATERNITY
  name: string;
  annualQuota: number;
  accrualMode?: 'MONTHLY' | 'ANNUAL' | 'NONE';
  accrualPerMonth?: number;
  carryForwardMax: number;
  encashable?: boolean;
  allowsHalfDay?: boolean;
  allowHalfDay?: boolean;
  requiresDocument?: boolean;
  requiresDocumentAfterDays?: number;
  minNoticeDays?: number;
  isPaid?: boolean;
  probationEligible?: boolean;
  sandwichRule?: boolean;
  active?: boolean;
}

export interface LeaveBalance {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  fyYear: string;
  opening: number;
  accrued: number;
  used: number;
  reserved: number;
  encashed: number;
  lapsed: number;
  available: number; // opening + accrued - used - reserved
}

export interface LeaveApprovalStep {
  level: number;
  approverId: number;
  approverName: string;
  approverRole: string;
  action: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELEGATED' | 'AUTO_ESCALATED';
  remarks?: string;
  actedAt?: string;
}

export interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  fromHalf?: 'FIRST_HALF' | 'SECOND_HALF' | null;
  toHalf?: 'FIRST_HALF' | 'SECOND_HALF' | null;
  totalDays: number;
  reason: string;
  contactDuring?: string;
  documentUrl?: string;
  documentName?: string;
  status: LeaveStatusCode;
  currentLevel: number;
  currentApproverId?: number;
  currentApproverName?: string;
  appliedAt: string;
  closedAt?: string;
  timeline: LeaveApprovalStep[];
  conflicts?: {
    employeeName: string;
    leaveDates: string;
  }[];
}

export interface Holiday {
  id: number;
  entityId?: number;
  holidayDate: string; // YYYY-MM-DD
  name: string;
  isOptional?: boolean;
  isRestricted?: boolean;
  holidayYear?: number;
}

export interface Shift {
  id: number;
  entityId: number;
  name: string;
  startTime: string; // 09:30:00
  endTime: string; // 18:30:00
  graceMinutes: number;
  halfDayHours: number;
  fullDayHours: number;
  weekOffs: string; // 'SUN' or 'SAT,SUN'
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  workDate: string; // YYYY-MM-DD
  shiftId: number;
  punchIn?: string; // ISO
  punchOut?: string; // ISO
  inLat?: number;
  inLng?: number;
  outLat?: number;
  outLng?: number;
  inSource?: PunchSource;
  workedHours?: number;
  status: AttendanceStatusCode;
  leaveRequestId?: number;
  isRegularized: boolean;
  remarks?: string;
}

export interface AttendanceRegularization {
  id: number;
  attendanceId: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  workDate: string;
  requestedIn: string;
  requestedOut: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approverId?: number;
  approverName?: string;
  actedAt?: string;
}

export interface MonthlyAttendanceSummary {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  year: number;
  month: number; // 1-12
  totalDays?: number;
  presentDays: number;
  leaveDays: number;
  weekOffDays?: number;
  holidayDays?: number;
  lopDays: number;
  payableDays: number;
  locked: boolean;
  lockedBy?: string;
  lockedAt?: string;
}

export interface KpiCycle {
  id: number;
  entityId?: number;
  name: string;
  cycleName?: string;
  startDate: string;
  endDate: string;
  selfReviewDue?: string;
  managerReviewDue?: string;
  status: 'DRAFT' | 'OPEN' | 'SELF_DONE' | 'REVIEW' | 'CLOSED';
}

export interface KpiDefinition {
  id: number;
  cycleId: number;
  employeeId: number;
  title: string;
  metricUnit: string; // '%', 'count', 'INR', 'days'
  targetValue: number;
  weightPct: number;
  createdBy: number;
  score?: KpiScore;
}

export interface KpiScore {
  id: number;
  kpiId: number;
  actualValue?: number;
  selfRating?: number; // 1..5
  selfComment?: string;
  managerRating?: number; // 1..5
  managerComment?: string;
  finalRating?: number;
  submittedAt?: string;
  reviewedAt?: string;
}

// RESTRICTED PAYROLL SCHEMAS
export interface SalaryComponent {
  basic: number;
  hra: number;
  specialAllowance: number;
  providentFund?: number;
  pf?: number;
  professionalTax?: number;
  pt?: number;
  tds?: number;
}

export interface SalaryStructure {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  designation: string;
  effectiveFrom: string;
  effectiveTo?: string;
  annualCtc?: number;
  ctcAnnual?: number;
  grossSalary?: number;
  basicSalary?: number;
  hra?: number;
  specialAllowance?: number;
  pfEmployee?: number;
  professionalTax?: number;
  components: SalaryComponent;
  createdAt?: string;
}

export interface PayrollRun {
  id: number;
  month: number;
  year: number;
  status: 'DRAFT' | 'VERIFIED' | 'APPROVED' | 'PUBLISHED';
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  processedBy: string;
  processedAt: string;
}

export interface Payslip {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  designation: string;
  panNumber?: string;
  bankAccount?: string;
  year: number;
  month: number;
  lopDays: number;
  paidDays: number;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  components: {
    basic: number;
    hra: number;
    specialAllowance: number;
    pf: number;
    pt: number;
    tds: number;
    lopDeduction: number;
  };
  source: 'GENERATED' | 'UPLOADED';
  fileKey: string;
  fileName: string;
  fileSha256: string;
  status: 'DRAFT' | 'PUBLISHED' | 'REVOKED';
  generatedBy: number;
  publishedAt?: string;
}

export interface PayslipAccessLog {
  id: number;
  payslipId: number;
  employeeName: string;
  employeeCode: string;
  monthYear: string;
  accessedBy: number;
  accessorName: string;
  accessorRole: string;
  action: 'VIEW' | 'DOWNLOAD' | 'EMAIL' | 'REVOKE';
  ipAddress: string;
  userAgent: string;
  accessedAt: string;
}

export interface SalaryAccessLog {
  id: number;
  timestamp: string;
  action: string;
  performedByName: string;
  performedByRole?: string;
  targetEmployeeName?: string;
  ipAddress: string;
  hashSeal?: string;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  actorId?: number;
  actorName?: string;
  performedByName?: string;
  actorRole?: string;
  module?: 'AUTH' | 'EMPLOYEE' | 'ATTENDANCE' | 'LEAVE' | 'KPI' | 'PAYROLL' | 'ROLES';
  action: string;
  entityType?: string;
  entityId?: number;
  details: string;
  ipAddress: string;
}
