/**
 * Attendance-driven payroll engine.
 *
 * Pure functions only: give it a month, a salary revision, attendance punches,
 * approved leaves and holidays, and it returns a day-by-day ledger plus the
 * resulting earnings/deductions. Accounts previews this before saving payroll
 * entries, and employees see the same breakdown on their payslip, so the rule
 * that "salary follows attendance" is transparent to everyone.
 */
import { ATTENDANCE_POLICY, OVERTIME_POLICY, PAYROLL_POLICY, SHIFT_POLICY } from '../config/policy';
import type { AttendanceRecord, PayrollLine } from '../types';
import { toISODate } from '../utils/dateUtils';

export type PayDayKind =
  | 'PRESENT'
  | 'HALF_DAY'
  | 'PAID_LEAVE'
  | 'UNPAID_LEAVE'
  | 'HOLIDAY'
  | 'WEEK_OFF'
  | 'ABSENT'
  | 'PROJECTED'
  | 'NOT_EMPLOYED';

export interface PayDay {
  date: string;
  kind: PayDayKind;
  /** Paid fraction of the day: 0, 0.5 or 1. */
  paid: number;
  late: boolean;
  /** Punched in on a holiday or week-off. */
  workedOnOffDay?: boolean;
  note?: string;
}

export interface PayrollLeave {
  fromDate: string;
  toDate: string;
  fromHalf?: 'FIRST_HALF' | 'SECOND_HALF' | null;
  toHalf?: 'FIRST_HALF' | 'SECOND_HALF' | null;
  isPaid: boolean;
  leaveTypeCode?: string;
}

export interface PayrollSalary {
  basicMonthly: number;
  hraMonthly: number;
  specialMonthly: number;
  otherAllowanceMonthly: number;
  tdsMonthly: number;
  pfApplicable: boolean;
}

export interface PayrollInput {
  year: number;
  month: number; // 1-12
  dateOfJoining?: string;
  dateOfExit?: string;
  salary: PayrollSalary | null;
  attendance: AttendanceRecord[];
  leaves: PayrollLeave[];
  /** Mandatory (non-restricted) holiday dates, YYYY-MM-DD. */
  holidays: string[];
  /** Approved holiday/Sunday work days the employee chose to be paid for (not comp-off). */
  overtimeDays?: number;
  /** Override "today" for deterministic previews/tests. */
  today?: string;
}

export interface PayrollComputation {
  days: PayDay[];
  calendarDays: number;
  employedDays: number;
  payableDays: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  holidayDays: number;
  weekOffDays: number;
  absentDays: number;
  projectedDays: number;
  lateMarks: number;
  lateLopDays: number;
  lopDays: number;
  /** Holidays / week-offs on which the employee punched in. */
  holidayWorkedDays: number;
  overtimeDays: number;
  payFactor: number;
  earnings: PayrollLine[];
  deductions: PayrollLine[];
  employerContributions: PayrollLine[];
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  warnings: string[];
}

const round = (n: number) => Math.round(n);
const sum = (lines: PayrollLine[]) => lines.reduce((acc, l) => acc + l.amount, 0);

function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Fraction of `date` covered by a leave (0, 0.5 or 1). */
function leaveFractionOn(leave: PayrollLeave, date: string): number {
  if (date < leave.fromDate || date > leave.toDate) return 0;
  if (date === leave.fromDate && leave.fromHalf) return 0.5;
  if (date === leave.toDate && leave.toHalf) return 0.5;
  return 1;
}

/** Paid work fraction from a punch record, or null when there is no record. */
function workFraction(
  rec: AttendanceRecord | undefined,
  date: string,
  today: string
): { fraction: number; late: boolean; note?: string } | null {
  if (!rec) return null;
  const lateCutoff = parseHm(SHIFT_POLICY.startTime) + SHIFT_POLICY.graceMinutes;
  const late = Boolean(rec.punchIn) && minutesOfDay(rec.punchIn as string) > lateCutoff;

  // Approved time update without times on record: treat the day as worked.
  if (rec.isRegularized && !rec.punchIn) return { fraction: 1, late: false, note: 'Time update approved' };
  if (rec.status === 'ABSENT' || rec.status === 'LOP') return { fraction: 0, late: false };
  if (rec.status === 'HALF_DAY') return { fraction: 0.5, late };

  if (rec.punchIn) {
    if (rec.workedHours != null && rec.punchOut) {
      if (rec.workedHours >= SHIFT_POLICY.fullDayHours) return { fraction: 1, late };
      if (rec.workedHours >= SHIFT_POLICY.halfDayHours) {
        return { fraction: 0.5, late, note: `Short day (${rec.workedHours}h)` };
      }
      return { fraction: 0, late, note: `Worked only ${rec.workedHours}h` };
    }
    if (!rec.punchOut) {
      if (date >= today) return { fraction: 1, late, note: 'Shift in progress' };
      return ATTENDANCE_POLICY.missingPunchOutAsHalfDay
        ? { fraction: 0.5, late, note: 'Missing punch-out' }
        : { fraction: 0, late, note: 'Missing punch-out' };
    }
    return { fraction: 1, late };
  }

  // Manual / biometric PRESENT without punch timestamps.
  if (rec.status === 'PRESENT') return { fraction: 1, late: false };
  return null;
}

function professionalTax(gross: number): number {
  return gross > 0 ? PAYROLL_POLICY.professionalTaxMonthly : 0;
}

export function computePayroll(input: PayrollInput): PayrollComputation {
  const { year, month } = input;
  const today = input.today ?? toISODate(new Date());
  const calendarDays = new Date(year, month, 0).getDate();
  const holidaySet = new Set(input.holidays);
  const attByDate = new Map(input.attendance.map(a => [a.workDate, a]));
  const warnings: string[] = [];
  const days: PayDay[] = [];

  for (let day = 1; day <= calendarDays; day++) {
    const date = toISODate(new Date(year, month - 1, day));
    const weekday = new Date(year, month - 1, day).getDay();

    if ((input.dateOfJoining && date < input.dateOfJoining) || (input.dateOfExit && date > input.dateOfExit)) {
      days.push({ date, kind: 'NOT_EMPLOYED', paid: 0, late: false });
      continue;
    }
    const workedOff = Boolean(attByDate.get(date)?.punchIn);
    if (holidaySet.has(date)) {
      days.push({ date, kind: 'HOLIDAY', paid: 1, late: false, workedOnOffDay: workedOff, note: workedOff ? 'Worked on holiday' : undefined });
      continue;
    }
    if (SHIFT_POLICY.weekOffDays.includes(weekday)) {
      days.push({ date, kind: 'WEEK_OFF', paid: 1, late: false, workedOnOffDay: workedOff, note: workedOff ? 'Worked on week-off' : undefined });
      continue;
    }

    let paidLeave = 0;
    let unpaidLeave = 0;
    for (const lv of input.leaves) {
      const f = leaveFractionOn(lv, date);
      if (lv.isPaid) paidLeave += f;
      else unpaidLeave += f;
    }
    paidLeave = Math.min(1, paidLeave);
    unpaidLeave = Math.min(1 - paidLeave, unpaidLeave);
    const leaveTotal = paidLeave + unpaidLeave;

    const rec = attByDate.get(date);
    if (rec && (rec.status === 'HOLIDAY' || rec.status === 'WEEK_OFF')) {
      days.push({ date, kind: rec.status, paid: 1, late: false });
      continue;
    }

    if (leaveTotal >= 1) {
      days.push(
        paidLeave >= 1
          ? { date, kind: 'PAID_LEAVE', paid: 1, late: false }
          : unpaidLeave >= 1
          ? { date, kind: 'UNPAID_LEAVE', paid: 0, late: false }
          : { date, kind: 'HALF_DAY', paid: 0.5, late: false, note: 'Half paid leave + half LOP leave' }
      );
      continue;
    }

    if (rec?.status === 'ON_LEAVE' && leaveTotal === 0) {
      days.push({ date, kind: 'PAID_LEAVE', paid: 1, late: false, note: 'Marked on leave in register' });
      continue;
    }

    const work = workFraction(rec, date, today);
    if (!work) {
      if (date >= today) {
        days.push({ date, kind: 'PROJECTED', paid: 1 - unpaidLeave, late: false, note: 'Future day — assumed present' });
      } else if (paidLeave === 0.5) {
        days.push({ date, kind: 'HALF_DAY', paid: 0.5, late: false, note: 'Half-day leave, no punch for other half' });
      } else {
        days.push({ date, kind: 'ABSENT', paid: 0, late: false, note: 'No punch and no approved leave' });
      }
      continue;
    }

    // Work and leave together cannot exceed one day; the unpaid-leave part is never paid.
    const paid = Math.min(1 - unpaidLeave, work.fraction + paidLeave);
    const kind: PayDayKind =
      paid >= 1 ? 'PRESENT' : paid > 0 ? 'HALF_DAY' : 'ABSENT';
    const note = work.note ?? (rec?.isRegularized ? 'Time update approved' : paidLeave ? 'Half-day leave' : undefined);
    days.push({ date, kind, paid, late: work.late, note });
  }

  const count = (kind: PayDayKind) => days.filter(d => d.kind === kind).length;
  const employedDays = days.filter(d => d.kind !== 'NOT_EMPLOYED').length;
  const lateMarks = days.filter(d => d.late).length;
  const lateLopDays = Math.floor(lateMarks / ATTENDANCE_POLICY.lateMarksPerHalfDayLop) * 0.5;
  const rawPaid = days.reduce((acc, d) => acc + d.paid, 0);
  const payableDays = Math.max(0, rawPaid - lateLopDays);
  const lopDays = Math.max(0, employedDays - payableDays);
  const projectedDays = count('PROJECTED');
  if (projectedDays > 0) {
    warnings.push(`${projectedDays} future day(s) assumed present — rerun after month end for final pay.`);
  }

  const payFactor =
    PAYROLL_POLICY.payBasis === 'FIXED_26'
      ? Math.max(0, Math.min(1, (26 - lopDays - (calendarDays - employedDays)) / 26))
      : payableDays / calendarDays;

  const earnings: PayrollLine[] = [];
  const deductions: PayrollLine[] = [];
  const employerContributions: PayrollLine[] = [];
  const salary = input.salary;

  if (!salary) {
    warnings.push('No approved salary revision effective for this month.');
  } else {
    const basic = round(salary.basicMonthly * payFactor);
    earnings.push({ code: 'BASIC', label: 'Basic Salary', amount: basic });
    earnings.push({ code: 'HRA', label: 'House Rent Allowance', amount: round(salary.hraMonthly * payFactor) });
    earnings.push({ code: 'SPECIAL', label: 'Special Allowance', amount: round(salary.specialMonthly * payFactor) });
    if (salary.otherAllowanceMonthly > 0) {
      earnings.push({ code: 'OTHER', label: 'Other Allowance', amount: round(salary.otherAllowanceMonthly * payFactor) });
    }
    const fullGross =
      salary.basicMonthly + salary.hraMonthly + salary.specialMonthly + salary.otherAllowanceMonthly;
    const overtimeDays = input.overtimeDays ?? 0;
    if (overtimeDays > 0) {
      earnings.push({
        code: 'OVERTIME',
        label: `Overtime — holiday/Sunday work (${overtimeDays} day${overtimeDays === 1 ? '' : 's'})`,
        amount: round((fullGross / calendarDays) * overtimeDays * OVERTIME_POLICY.payMultiplier)
      });
    }
    const gross = sum(earnings);

    if (salary.pfApplicable && basic > 0) {
      const pfWage = Math.min(basic, PAYROLL_POLICY.pfWageCeiling);
      deductions.push({ code: 'PF', label: 'Provident Fund (Employee)', amount: round(pfWage * PAYROLL_POLICY.pfRate) });
      employerContributions.push({
        code: 'PF_ER',
        label: 'Provident Fund (Employer)',
        amount: round(pfWage * PAYROLL_POLICY.employerPfRate),
      });
    }
    if (fullGross <= PAYROLL_POLICY.esiGrossThreshold && gross > 0) {
      deductions.push({ code: 'ESI', label: 'ESI (Employee)', amount: Math.ceil(gross * PAYROLL_POLICY.esiEmployeeRate) });
      employerContributions.push({
        code: 'ESI_ER',
        label: 'ESI (Employer)',
        amount: Math.ceil(gross * PAYROLL_POLICY.esiEmployerRate),
      });
    }
    const pt = professionalTax(gross);
    if (pt > 0) deductions.push({ code: 'PT', label: 'Professional Tax', amount: pt });
    if (salary.tdsMonthly > 0 && gross > 0) {
      deductions.push({ code: 'TDS', label: 'Income Tax (TDS)', amount: round(Math.min(salary.tdsMonthly, gross)) });
    }

    const lopAmount = round(fullGross - (gross - (earnings.find(e => e.code === 'OVERTIME')?.amount ?? 0)));
    if (lopAmount > 0) {
      // Informational: LOP is already applied through proration, not deducted twice.
      warnings.push(`Loss of pay: ${lopDays} day(s) ≈ ₹${lopAmount.toLocaleString('en-IN')} withheld.`);
    }
  }

  const grossEarnings = sum(earnings);
  const totalDeductions = sum(deductions);

  return {
    days,
    calendarDays,
    employedDays,
    payableDays,
    presentDays: count('PRESENT') + count('HALF_DAY') * 0.5,
    halfDays: count('HALF_DAY'),
    paidLeaveDays: count('PAID_LEAVE'),
    unpaidLeaveDays: count('UNPAID_LEAVE'),
    holidayDays: count('HOLIDAY'),
    weekOffDays: count('WEEK_OFF'),
    absentDays: count('ABSENT'),
    projectedDays,
    lateMarks,
    lateLopDays,
    lopDays,
    holidayWorkedDays: days.filter(d => d.workedOnOffDay).length,
    overtimeDays: input.overtimeDays ?? 0,
    payFactor,
    earnings,
    deductions,
    employerContributions,
    grossEarnings,
    totalDeductions,
    netPay: Math.max(0, grossEarnings - totalDeductions),
    warnings,
  };
}

/** Split an annual CTC into monthly components using SALARY_SPLIT_POLICY. */
export function splitCtc(
  ctcAnnual: number,
  basicPctOfGross: number,
  hraPctOfBasic: number,
  pfApplicable: boolean
): { basicMonthly: number; hraMonthly: number; specialMonthly: number } {
  const monthlyCtc = ctcAnnual / 12;
  // Employer PF is part of CTC, so solve gross such that gross + employer PF = monthly CTC.
  let gross = monthlyCtc;
  if (pfApplicable) {
    const uncappedGross = monthlyCtc / (1 + basicPctOfGross * PAYROLL_POLICY.employerPfRate);
    const uncappedBasic = uncappedGross * basicPctOfGross;
    gross =
      uncappedBasic <= PAYROLL_POLICY.pfWageCeiling
        ? uncappedGross
        : monthlyCtc - PAYROLL_POLICY.pfWageCeiling * PAYROLL_POLICY.employerPfRate;
  }
  const basicMonthly = round(gross * basicPctOfGross);
  const hraMonthly = round(basicMonthly * hraPctOfBasic);
  const specialMonthly = Math.max(0, round(gross) - basicMonthly - hraMonthly);
  return { basicMonthly, hraMonthly, specialMonthly };
}

/** Convert a number to Indian-English words for payslips. */
export function amountInWords(num: number): string {
  const n0 = Math.round(num);
  if (n0 <= 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const words = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + words(n % 100) : '');
    if (n < 100000) return words(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + words(n % 1000) : '');
    if (n < 10000000) return words(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + words(n % 100000) : '');
    return words(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + words(n % 10000000) : '');
  };
  return `${words(n0)} Rupees Only`;
}

export const formatInr = (n: number) =>
  `₹${Math.round(n).toLocaleString('en-IN')}`;
