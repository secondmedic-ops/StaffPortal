/**
 * Company-wide HR & payroll policy.
 *
 * Every rule that drives attendance → salary and leave routing lives here so
 * HR/Accounts can review it in one place. Change values here (or move them to
 * an `org_settings` table later) rather than hard-coding them in components.
 */

export const SHIFT_POLICY = {
  /** Default shift start, local time (HH:MM). */
  startTime: '09:30',
  endTime: '18:00',
  /** Punch-in after start + grace counts as a late mark. */
  graceMinutes: 30,
  /** Minimum worked hours for a full paid day. */
  fullDayHours: 8,
  /** Minimum worked hours for a half paid day. Below this the day is LOP. */
  halfDayHours: 4,
  /** 0 = Sunday … 6 = Saturday. */
  weekOffDays: [0] as number[],
} as const;

export const ATTENDANCE_POLICY = {
  /** Every N late marks in a month deducts half a day of pay. */
  lateMarksPerHalfDayLop: 3,
  /**
   * A punch-in without a punch-out (and no approved regularization)
   * is paid as a half day.
   */
  missingPunchOutAsHalfDay: true,
} as const;

export const PAYROLL_POLICY = {
  /**
   * CALENDAR: monthly salary ÷ days in month × payable days (most common in India).
   * FIXED_26: monthly salary ÷ 26 × payable working days.
   */
  payBasis: 'CALENDAR' as 'CALENDAR' | 'FIXED_26',
  /** Employee PF = 12% of basic, capped at the statutory wage ceiling. */
  pfRate: 0.12,
  pfWageCeiling: 15000,
  /** Employer PF share (shown as CTC component, not deducted). */
  employerPfRate: 0.12,
  /** ESI applies when full monthly gross is at or below this threshold. */
  esiGrossThreshold: 21000,
  esiEmployeeRate: 0.0075,
  esiEmployerRate: 0.0325,
  /** Flat Professional Tax deducted every month when there is any pay. */
  professionalTaxMonthly: 200,
} as const;

export const SALARY_SPLIT_POLICY = {
  /** Basic as % of monthly gross when auto-splitting a CTC. */
  basicPctOfGross: 0.5,
  /** HRA as % of basic (50% metro / 40% non-metro). */
  hraPctOfBasic: 0.4,
} as const;

export const OVERTIME_POLICY = {
  /**
   * For each Sunday/holiday worked the employee chooses comp-off or overtime pay.
   * Overtime = (monthly gross ÷ days in month) × days worked × multiplier.
   */
  payMultiplier: 1,
  /** Claims must be raised within this many days of the date worked. */
  claimWindowDays: 60,
} as const;

export const LEAVE_APPROVAL_POLICY = {
  /**
   * Leave longer than this many days needs a second approval from the
   * reporting manager's own manager (skip-level).
   */
  skipLevelThresholdDays: 3,
  /** If an employee has no reporting manager, HR approves. */
  fallbackToHr: true,
} as const;

export const ASSET_POLICY = {
  /** Warn IT when warranty ends within this many days. */
  warrantyAlertDays: 60,
} as const;

/** Part-time staff are paid worked hours × hourly rate (no paid leave or holidays). */
export const HOURLY_PAY_POLICY = {
  /** PF for hourly staff is a share of gross pay (capped at the PF wage ceiling), as on the part-time payslip. */
  pfOnGross: true,
  /** The part-time payslip carries no Professional Tax line. */
  professionalTax: false,
} as const;

export const STATUTORY_DEDUCTIONS = {
  /** Labour Welfare Fund, employee share, deducted in the listed months (1-12). */
  lwfEmployeeAmount: 25,
  lwfMonths: [6, 12] as number[],
} as const;
