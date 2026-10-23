import { supabase } from '../lib/supabase';
import { getSessionEmployee } from './session';
import { mapResignation } from './mappers';
import type { Resignation } from '../types';

export const resignationsApi = {
  async getMyResignation(): Promise<Resignation | null> {
    const emp = await getSessionEmployee();
    const { data, error } = await supabase
      .from('resignations')
      .select('*, employee:employees!resignations_employee_id_fkey(full_name, emp_code)')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to load your resignation: ${error.message}`);
    return data ? mapResignation(data) : null;
  },

  async getAllResignations(status?: string): Promise<Resignation[]> {
    let query = supabase
      .from('resignations')
      .select('*, employee:employees!resignations_employee_id_fkey(full_name, emp_code, designation, department:departments(name))')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status as any);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load resignations: ${error.message}`);
    return (data || []).map(mapResignation);
  },

  async submitResignation(payload: {
    reason: string;
    requestedLwd: string;
    noticeDays?: number;
  }): Promise<Resignation> {
    const emp = await getSessionEmployee();
    const { data, error } = await supabase
      .from('resignations')
      .insert({
        employee_id: emp.id,
        reason: payload.reason.trim(),
        requested_lwd: payload.requestedLwd,
        notice_days: payload.noticeDays || 30,
        status: 'SUBMITTED',
      })
      .select('*, employee:employees!resignations_employee_id_fkey(full_name, emp_code)')
      .single();

    if (error) throw new Error(`Failed to submit resignation: ${error.message}`);
    return mapResignation(data);
  },

  async managerAction(id: number, action: 'ACCEPT' | 'REJECT', comments?: string): Promise<void> {
    const status = action === 'ACCEPT' ? 'ACCEPTED_BY_MANAGER' : 'REJECTED';
    const { error } = await supabase
      .from('resignations')
      .update({
        status,
        manager_comments: comments?.trim() || null,
        actioned_by_manager_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw new Error(`Failed to record manager resignation decision: ${error.message}`);
  },

  async hrAction(id: number, action: 'ACCEPT' | 'REJECT', confirmedLwd?: string, comments?: string): Promise<void> {
    const status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    const updateData: Record<string, any> = {
      status,
      hr_comments: comments?.trim() || null,
      actioned_by_hr_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (confirmedLwd) {
      updateData.confirmed_lwd = confirmedLwd;
    }

    const { error } = await supabase
      .from('resignations')
      .update(updateData as any)
      .eq('id', id);

    if (error) throw new Error(`Failed to record HR resignation decision: ${error.message}`);
  },

  async withdrawResignation(id: number): Promise<void> {
    const { error } = await supabase
      .from('resignations')
      .update({
        status: 'WITHDRAWN',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw new Error(`Failed to withdraw resignation: ${error.message}`);
  }
};
