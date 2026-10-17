import { supabase } from '../lib/supabase';
import { withManagerName } from './managerNames';
import { mapEmployee } from './mappers';
import type { AuthResponse, Employee, RoleType } from '../types';

export const authApi = {
  async login(officialEmail: string, password?: string, _otp?: string): Promise<AuthResponse> {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: officialEmail,
      password: password ?? ''
    });

    if (authError) {
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    const user = authData.user;
    if (!user) {
      throw new Error('Authentication failed: No user returned from session');
    }

    const normalizedEmail = (officialEmail || user.email || '').trim().toLowerCase();
    const { data: empData, error: empError } = await supabase
      .from('employees')
      .select('*, department:departments!employees_department_id_fkey(name)')
      .or(`auth_user_id.eq.${user.id},official_email.ilike.${normalizedEmail},personal_email.ilike.${normalizedEmail}`)
      .maybeSingle();

    if (empError || !empData) {
      throw new Error('Your login is not linked to a staff record — contact HR');
    }

    const { data: rolesData, error: rolesError } = await supabase
      .from('employee_roles')
      .select('role')
      .eq('employee_id', empData.id);

    if (rolesError) {
      throw new Error(`Failed to load user roles: ${rolesError.message}`);
    }

    const roles = (rolesData ?? []).map((r: { role: string }) => r.role as RoleType);

    return {
      token: authData.session?.access_token ?? '',
      refreshToken: authData.session?.refresh_token ?? '',
      employee: mapEmployee(await withManagerName(empData)),
      roles
    };
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(`Failed to sign out: ${error.message}`);
    }
  },

  async getMe(): Promise<{ employee: Employee; roles: RoleType[] }> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(`Session retrieval error: ${sessionError.message}`);
    }

    const session = sessionData.session;
    if (!session?.user) {
      throw new Error('No active session found');
    }

    const normalizedEmail = (session.user.email ?? '').trim().toLowerCase();
    const { data: empData, error: empError } = await supabase
      .from('employees')
      .select('*, department:departments!employees_department_id_fkey(name)')
      .or(`auth_user_id.eq.${session.user.id},official_email.ilike.${normalizedEmail},personal_email.ilike.${normalizedEmail}`)
      .maybeSingle();

    if (empError || !empData) {
      throw new Error('Your login is not linked to a staff record — contact HR');
    }

    const { data: rolesData, error: rolesError } = await supabase
      .from('employee_roles')
      .select('role')
      .eq('employee_id', empData.id);

    if (rolesError) {
      throw new Error(`Failed to load roles: ${rolesError.message}`);
    }

    const roles = (rolesData ?? []).map((r: { role: string }) => r.role as RoleType);

    return {
      employee: mapEmployee(await withManagerName(empData)),
      roles
    };
  }
};
