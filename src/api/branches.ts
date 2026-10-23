import { supabase } from '../lib/supabase';
import { mapBranch } from './mappers';
import type { Branch } from '../types';

export const branchesApi = {
  async getBranches(includeInactive = false): Promise<Branch[]> {
    let query = supabase.from('branches').select('*').order('name', { ascending: true });
    if (!includeInactive) {
      query = query.eq('active', true);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load branches: ${error.message}`);
    return (data || []).map(mapBranch);
  },

  async getBranchById(id: number): Promise<Branch | null> {
    const { data, error } = await supabase.from('branches').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Failed to load branch: ${error.message}`);
    return data ? mapBranch(data) : null;
  },

  async createBranch(payload: {
    name: string;
    code: string;
    address?: string;
    city?: string;
    state?: string;
    latitude: number;
    longitude: number;
    geofenceRadiusM?: number;
    adminEmployeeIds?: number[];
  }): Promise<Branch> {
    const { data, error } = await supabase
      .from('branches')
      .insert({
        name: payload.name.trim(),
        code: payload.code.trim().toUpperCase(),
        address: payload.address?.trim() || null,
        city: payload.city?.trim() || null,
        state: payload.state?.trim() || null,
        latitude: payload.latitude,
        longitude: payload.longitude,
        geofence_radius_m: payload.geofenceRadiusM || 100,
        admin_employee_ids: payload.adminEmployeeIds || []
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create branch: ${error.message}`);
    return mapBranch(data);
  },

  async updateBranch(id: number, payload: Partial<Branch>): Promise<Branch> {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (payload.name !== undefined) updatePayload.name = payload.name.trim();
    if (payload.code !== undefined) updatePayload.code = payload.code.trim().toUpperCase();
    if (payload.address !== undefined) updatePayload.address = payload.address?.trim() || null;
    if (payload.city !== undefined) updatePayload.city = payload.city?.trim() || null;
    if (payload.state !== undefined) updatePayload.state = payload.state?.trim() || null;
    if (payload.latitude !== undefined) updatePayload.latitude = payload.latitude;
    if (payload.longitude !== undefined) updatePayload.longitude = payload.longitude;
    if (payload.geofenceRadiusM !== undefined) updatePayload.geofence_radius_m = payload.geofenceRadiusM;
    if (payload.active !== undefined) updatePayload.active = payload.active;
    if (payload.adminEmployeeIds !== undefined) updatePayload.admin_employee_ids = payload.adminEmployeeIds;

    const { data, error } = await supabase
      .from('branches')
      .update(updatePayload as any)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update branch: ${error.message}`);
    return mapBranch(data);
  },

  async toggleBranchActive(id: number, active: boolean): Promise<void> {
    const { error } = await supabase
      .from('branches')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(`Failed to update branch status: ${error.message}`);
  }
};
