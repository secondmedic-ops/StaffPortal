import { supabase } from '../lib/supabase';
import { getSessionEmployee } from './session';
import { mapWfhRequest } from './mappers';
import type { WfhRequest } from '../types';

export const wfhApi = {
  async getMyWfhRequests(): Promise<WfhRequest[]> {
    const emp = await getSessionEmployee();
    const { data, error } = await supabase
      .from('wfh_requests')
      .select('*, employee:employees!wfh_requests_employee_id_fkey(full_name, emp_code), approver:employees!wfh_requests_approver_id_fkey(full_name)')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to load your WFH requests: ${error.message}`);
    return (data || []).map(mapWfhRequest);
  },

  async getPendingTeamWfhRequests(): Promise<WfhRequest[]> {
    const emp = await getSessionEmployee();
    // Get requests for employees reporting to emp or all pending if HR
    const { data, error } = await supabase
      .from('wfh_requests')
      .select('*, employee:employees!wfh_requests_employee_id_fkey(id, full_name, emp_code, manager_id), approver:employees!wfh_requests_approver_id_fkey(full_name)')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to load team WFH requests: ${error.message}`);
    return (data || []).map(mapWfhRequest);
  },

  async applyWfh(fromDate: string, toDate: string, reason: string): Promise<WfhRequest> {
    const emp = await getSessionEmployee();
    const { data, error } = await supabase
      .from('wfh_requests')
      .insert({
        employee_id: emp.id,
        from_date: fromDate,
        to_date: toDate,
        reason: reason.trim(),
        status: 'PENDING'
      })
      .select('*, employee:employees!wfh_requests_employee_id_fkey(full_name, emp_code)')
      .single();

    if (error) throw new Error(`Failed to submit WFH request: ${error.message}`);
    return mapWfhRequest(data);
  },

  async actionWfh(id: number, status: 'APPROVED' | 'REJECTED', rejectionReason?: string): Promise<void> {
    const { error } = await supabase
      .from('wfh_requests')
      .update({
        status,
        rejection_reason: rejectionReason?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw new Error(`Failed to update WFH request: ${error.message}`);
  },

  async cancelWfh(id: number): Promise<void> {
    const { error } = await supabase
      .from('wfh_requests')
      .update({
        status: 'CANCELLED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw new Error(`Failed to cancel WFH request: ${error.message}`);
  },

  async hasApprovedWfhToday(): Promise<boolean> {
    const emp = await getSessionEmployee();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const { data, error } = await supabase
      .from('wfh_requests')
      .select('id')
      .eq('employee_id', emp.id)
      .eq('status', 'APPROVED')
      .lte('from_date', today)
      .gte('to_date', today)
      .limit(1)
      .maybeSingle();

    if (error) return false;
    return !!data;
  }
};
