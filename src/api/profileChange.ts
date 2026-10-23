import { supabase } from '../lib/supabase';
import { getSessionEmployee } from './session';
import { mapProfileChangeRequest } from './mappers';
import type { ProfileChangeRequest } from '../types';

export const profileChangeApi = {
  async getMyRequests(): Promise<ProfileChangeRequest[]> {
    const emp = await getSessionEmployee();
    const { data, error } = await supabase
      .from('profile_change_requests')
      .select('*, employee:employees!profile_change_requests_employee_id_fkey(full_name, emp_code), actioner:employees!profile_change_requests_actioned_by_fkey(full_name)')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to load your profile change requests: ${error.message}`);
    return (data || []).map(mapProfileChangeRequest);
  },

  async getAllRequests(status?: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<ProfileChangeRequest[]> {
    let query = supabase
      .from('profile_change_requests')
      .select('*, employee:employees!profile_change_requests_employee_id_fkey(full_name, emp_code), actioner:employees!profile_change_requests_actioned_by_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load profile change requests: ${error.message}`);
    return (data || []).map(mapProfileChangeRequest);
  },

  async submitRequest(field: string, oldValue: string | undefined, newValue: string, reason: string): Promise<ProfileChangeRequest> {
    const emp = await getSessionEmployee();
    const { data, error } = await supabase
      .from('profile_change_requests')
      .insert({
        employee_id: emp.id,
        field,
        old_value: oldValue || null,
        new_value: newValue.trim(),
        reason: reason.trim(),
        status: 'PENDING',
      })
      .select('*, employee:employees!profile_change_requests_employee_id_fkey(full_name, emp_code)')
      .single();

    if (error) throw new Error(`Failed to submit profile change request: ${error.message}`);
    return mapProfileChangeRequest(data);
  },

  async actionRequest(id: number, status: 'APPROVED' | 'REJECTED', rejectionReason?: string): Promise<void> {
    const { error } = await supabase
      .from('profile_change_requests')
      .update({
        status,
        rejection_reason: rejectionReason?.trim() || null,
        actioned_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw new Error(`Failed to update profile change request: ${error.message}`);
  }
};
