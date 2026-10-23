import { supabase } from '../lib/supabase';
import { getSessionEmployee } from './session';
import { mapFnfSettlement } from './mappers';
import type { FnfSettlement } from '../types';

export const fnfApi = {
  async getFnfList(): Promise<FnfSettlement[]> {
    const { data, error } = await supabase
      .from('fnf_settlements')
      .select('*, employee:employees!fnf_settlements_employee_id_fkey(full_name, emp_code, designation), preparer:employees!fnf_settlements_prepared_by_fkey(full_name), approver:employees!fnf_settlements_approved_by_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to load F&F settlements: ${error.message}`);
    return (data || []).map(mapFnfSettlement);
  },

  async getFnfById(id: number): Promise<FnfSettlement | null> {
    const { data, error } = await supabase
      .from('fnf_settlements')
      .select('*, employee:employees!fnf_settlements_employee_id_fkey(id, full_name, emp_code, designation, date_of_joining, work_location), preparer:employees!fnf_settlements_prepared_by_fkey(full_name), approver:employees!fnf_settlements_approved_by_fkey(full_name)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to load F&F settlement: ${error.message}`);
    return data ? mapFnfSettlement(data) : null;
  },

  async getMyFnf(): Promise<FnfSettlement | null> {
    const emp = await getSessionEmployee();
    const { data, error } = await supabase
      .from('fnf_settlements')
      .select('*, employee:employees!fnf_settlements_employee_id_fkey(id, full_name, emp_code, designation, date_of_joining, work_location), preparer:employees!fnf_settlements_prepared_by_fkey(full_name), approver:employees!fnf_settlements_approved_by_fkey(full_name)')
      .eq('employee_id', emp.id)
      .eq('status', 'APPROVED')
      .maybeSingle();

    if (error) throw new Error(`Failed to load personal F&F settlement: ${error.message}`);
    return data ? mapFnfSettlement(data) : null;
  },

  async saveFnfDraft(payload: {
    resignationId?: number;
    employeeId: number;
    lastWorkingDay: string;
    payableDays: number;
    perDayBasic: number;
    salaryDue: number;
    leaveEncashmentDays: number;
    leaveEncashmentAmount: number;
    gratuityAmount?: number;
    bonusAmount?: number;
    noticeShortfallDays?: number;
    noticeRecoveryAmount?: number;
    assetRecoveryAmount?: number;
    otherRecoveries?: number;
    otherPayables?: number;
    netPayable: number;
    remarks?: string;
  }): Promise<FnfSettlement> {
    const preparer = await getSessionEmployee();
    const { data, error } = await supabase
      .from('fnf_settlements')
      .insert({
        resignation_id: payload.resignationId || null,
        employee_id: payload.employeeId,
        last_working_day: payload.lastWorkingDay,
        payable_days: payload.payableDays,
        per_day_basic: payload.perDayBasic,
        salary_due: payload.salaryDue,
        leave_encashment_days: payload.leaveEncashmentDays,
        leave_encashment_amount: payload.leaveEncashmentAmount,
        gratuity_amount: payload.gratuityAmount || 0,
        bonus_amount: payload.bonusAmount || 0,
        notice_shortfall_days: payload.noticeShortfallDays || 0,
        notice_recovery_amount: payload.noticeRecoveryAmount || 0,
        asset_recovery_amount: payload.assetRecoveryAmount || 0,
        other_recoveries: payload.otherRecoveries || 0,
        other_payables: payload.otherPayables || 0,
        net_payable: payload.netPayable,
        remarks: payload.remarks || null,
        status: 'DRAFT',
        prepared_by: preparer.id,
        prepared_at: new Date().toISOString()
      })
      .select('*, employee:employees!fnf_settlements_employee_id_fkey(full_name, emp_code)')
      .single();

    if (error) throw new Error(`Failed to save F&F draft: ${error.message}`);
    return mapFnfSettlement(data);
  },

  async submitFnf(id: number): Promise<void> {
    const { error } = await supabase
      .from('fnf_settlements')
      .update({
        status: 'SUBMITTED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw new Error(`Failed to submit F&F settlement for approval: ${error.message}`);
  },

  async ceoActionFnf(id: number, action: 'APPROVE' | 'REJECT', remarks?: string): Promise<void> {
    const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    };
    if (remarks) updateData.remarks = remarks;

    const { error } = await supabase
      .from('fnf_settlements')
      .update(updateData as any)
      .eq('id', id);

    if (error) throw new Error(`Failed to record CEO decision: ${error.message}`);
  }
};
