import { supabase } from '../lib/supabase';
import { getSessionEmployee, logAudit } from './session';
import { mapAttendanceRecord, mapHolidayWorkClaim } from './mappers';
import { OVERTIME_POLICY, SHIFT_POLICY } from '../config/policy';
import { toISODate } from '../utils/dateUtils';
import type { HolidayWorkClaim, HolidayWorkCompensation } from '../types';

const CLAIM_SELECT =
  '*, employee:employees!holiday_work_claims_employee_id_fkey(full_name, emp_code), approver:employees!holiday_work_claims_approver_id_fkey(full_name)';

export interface EligibleOffDay {
  date: string;
  reason: string; // "Sunday" or holiday name
  workedHours: number;
  days: number; // 1 or 0.5
}

/** Paid days earned for working an off-day: full ≥ full-day hours, half ≥ half-day hours. */
export function offDayCredit(workedHours: number): number {
  if (workedHours >= SHIFT_POLICY.fullDayHours) return 1;
  if (workedHours >= SHIFT_POLICY.halfDayHours) return 0.5;
  return 0;
}

const localDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const overtimeApi = {
  /** Sundays / holidays the employee worked recently that haven't been claimed yet. */
  async getMyEligibleDays(): Promise<EligibleOffDay[]> {
    const me = await getSessionEmployee();
    const since = new Date();
    since.setDate(since.getDate() - OVERTIME_POLICY.claimWindowDays);
    const sinceIso = toISODate(since);

    const [attRes, holRes, claimRes] = await Promise.all([
      supabase.from('attendance_records').select('*').eq('employee_id', me.id).gte('work_date', sinceIso).not('punch_in', 'is', null),
      supabase.from('holidays').select('holiday_date, name, is_restricted, is_optional').gte('holiday_date', sinceIso),
      supabase.from('holiday_work_claims').select('work_date').eq('employee_id', me.id).gte('work_date', sinceIso)
    ]);
    if (attRes.error) throw new Error(`Failed to load attendance: ${attRes.error.message}`);
    if (holRes.error) throw new Error(`Failed to load holidays: ${holRes.error.message}`);
    if (claimRes.error) throw new Error(`Failed to load claims: ${claimRes.error.message}`);

    const holidays = new Map(
      (holRes.data ?? []).filter(h => !h.is_restricted && !h.is_optional).map(h => [h.holiday_date, h.name])
    );
    const claimed = new Set((claimRes.data ?? []).map(c => c.work_date));

    return (attRes.data ?? [])
      .map(mapAttendanceRecord)
      .filter(a => !claimed.has(a.workDate))
      .map(a => {
        const isWeekOff = SHIFT_POLICY.weekOffDays.includes(localDate(a.workDate).getDay());
        const holidayName = holidays.get(a.workDate);
        const workedHours = a.workedHours ?? 0;
        return {
          date: a.workDate,
          reason: holidayName ?? (isWeekOff ? 'Sunday / week-off' : ''),
          workedHours,
          days: offDayCredit(workedHours)
        };
      })
      .filter(d => d.reason && d.days > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async getMyClaims(): Promise<HolidayWorkClaim[]> {
    const me = await getSessionEmployee();
    const { data, error } = await supabase
      .from('holiday_work_claims')
      .select(CLAIM_SELECT)
      .eq('employee_id', me.id)
      .order('work_date', { ascending: false });
    if (error) throw new Error(`Failed to load your claims: ${error.message}`);
    return (data ?? []).map(mapHolidayWorkClaim);
  },

  async submitClaim(day: EligibleOffDay, compensation: HolidayWorkCompensation, reason: string): Promise<void> {
    const me = await getSessionEmployee();
    const { error } = await supabase.from('holiday_work_claims').insert({
      employee_id: me.id,
      work_date: day.date,
      worked_hours: day.workedHours,
      days: day.days,
      compensation,
      reason: reason || null
    });
    if (error) {
      if (error.code === '23505') throw new Error('You have already claimed this date.');
      throw new Error(`Failed to submit claim: ${error.message}`);
    }
  },

  async withdrawClaim(id: number): Promise<void> {
    const { error } = await supabase.from('holiday_work_claims').delete().eq('id', id).eq('status', 'PENDING');
    if (error) throw new Error(`Failed to withdraw claim: ${error.message}`);
  },

  /** Pending claims from my direct reports (HR: everyone). */
  async getPendingClaims(asHr: boolean): Promise<HolidayWorkClaim[]> {
    const me = await getSessionEmployee();
    let query = supabase.from('holiday_work_claims').select(CLAIM_SELECT).eq('status', 'PENDING');
    if (!asHr) {
      const { data: reports, error: repError } = await supabase.from('employees').select('id').eq('manager_id', me.id);
      if (repError) throw new Error(`Failed to load your team: ${repError.message}`);
      const ids = (reports ?? []).map(r => r.id);
      if (ids.length === 0) return [];
      query = query.in('employee_id', ids);
    }
    const { data, error } = await query.order('work_date', { ascending: true });
    if (error) throw new Error(`Failed to load claims: ${error.message}`);
    return (data ?? []).map(mapHolidayWorkClaim).filter(c => c.employeeId !== me.id);
  },

  async actionClaim(claim: HolidayWorkClaim, action: 'APPROVE' | 'REJECT', remarks?: string): Promise<void> {
    const me = await getSessionEmployee();
    if (claim.employeeId === me.id) throw new Error('You cannot approve your own claim.');
    const { data, error } = await supabase
      .from('holiday_work_claims')
      .update({
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approver_id: me.id,
        approver_remarks: remarks || null,
        acted_at: new Date().toISOString()
      })
      .eq('id', claim.id)
      .eq('status', 'PENDING')
      .select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('Claim not updated — it may already be actioned or outside your reporting line.');
    await logAudit(
      me,
      'ATTENDANCE',
      `HOLIDAY_WORK_${action}D`,
      `${claim.employeeName} ${claim.workDate}: ${claim.days} day ${claim.compensation === 'COMP_OFF' ? 'comp-off' : 'overtime'}`,
      { type: 'holiday_work_claim', id: claim.id }
    );
  },

  /** Approved overtime days per employee for a payroll month. Missing table → empty. */
  async getApprovedOvertimeDays(start: string, end: string): Promise<Map<number, number>> {
    const { data, error } = await supabase
      .from('holiday_work_claims')
      .select('employee_id, days')
      .eq('status', 'APPROVED')
      .eq('compensation', 'OVERTIME')
      .gte('work_date', start)
      .lte('work_date', end);
    if (error) throw new Error(`Failed to load approved overtime: ${error.message}`);
    const map = new Map<number, number>();
    (data ?? []).forEach(r => map.set(r.employee_id, (map.get(r.employee_id) ?? 0) + Number(r.days)));
    return map;
  }
};
