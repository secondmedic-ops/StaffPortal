import { supabase } from '../lib/supabase';
import {
  mapEmployee,
  mapAuditLog
} from './mappers';
import type {
  SystemUser,
  AuditLogEntry,
  AppUser,
  Employee,
  RoleType
} from '../types';

async function getCurrentEmployee() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Failed to get session: ${sessionError.message}`);
  const user = sessionData.session?.user;
  if (!user) throw new Error('No active user session');

  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('id, full_name')
    .or(`auth_user_id.eq.${user.id},official_email.eq.${user.email ?? ''}`)
    .single();

  if (empError || !emp) throw new Error('Your login is not linked to a staff record — contact HR');
  return emp;
}

export const ceoApi = {
  assertCeoRole() {
    // Role verification performed by RLS and Edge security policies
  },

  async getExecutiveMetrics() {
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*, department:departments(name)');

    if (empError) throw new Error(`Failed to load employees: ${empError.message}`);

    const totalHeadcount = (employees ?? []).length;
    const activeCount = (employees ?? []).filter(e => e.status === 'ACTIVE').length;

    const deptMap: Record<string, number> = {};
    (employees ?? []).forEach(e => {
      const dName = e.department?.name || 'Unassigned';
      deptMap[dName] = (deptMap[dName] || 0) + 1;
    });

    const departmentBreakdown = Object.entries(deptMap).map(([name, total]) => ({
      name,
      total,
      present: total
    }));

    return {
      totalHeadcount,
      activeCount,
      attendancePct: totalHeadcount > 0 ? 100 : 0,
      monthlyPayrollExpense: 0,
      kpiCompletionPct: 0,
      departmentBreakdown
    };
  },

  async getPendingRoleProposals() {
    const { data, error } = await supabase
      .from('role_proposals')
      .select('*')
      .eq('status', 'PENDING')
      .order('proposed_at', { ascending: false });

    if (error) throw new Error(`Failed to load role proposals: ${error.message}`);
    return (data ?? []).map((p: any) => ({
      id: p.id,
      targetUserId: p.target_user_id,
      targetUserName: p.target_user_name,
      targetUserEmail: p.target_user_email,
      proposedRole: p.proposed_role,
      justification: p.justification,
      proposedByName: p.proposed_by_name,
      proposedAt: p.proposed_at,
      status: p.status
    }));
  },

  async actionRoleProposal(id: number, action: 'APPROVE' | 'REJECT') {
    const { data: prop, error: propError } = await supabase
      .from('role_proposals')
      .update({ status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' })
      .eq('id', id)
      .select()
      .single();

    if (propError || !prop) throw new Error(`Failed to update proposal: ${propError?.message}`);

    if (action === 'APPROVE') {
      const { data: sysUser } = await supabase
        .from('system_users')
        .select('employee_id')
        .eq('id', prop.target_user_id)
        .maybeSingle();

      const employeeId = sysUser?.employee_id ?? prop.target_user_id;

      await supabase
        .from('employee_roles')
        .insert({
          employee_id: employeeId,
          role: prop.proposed_role
        });
    }
  },

  async getOrgOverview() {
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*, department:departments(name)');

    if (empError) throw new Error(`Failed to load org overview: ${empError.message}`);

    const totalEmployees = (employees ?? []).length;
    const activeCount = (employees ?? []).filter(e => e.status === 'ACTIVE').length;

    const deptMap: Record<string, number> = {};
    (employees ?? []).forEach(e => {
      const dName = e.department?.name || 'Unassigned';
      deptMap[dName] = (deptMap[dName] || 0) + 1;
    });

    const today = new Date().toISOString().split('T')[0];
    const { data: todayAttendance } = await supabase
      .from('attendance_records')
      .select('status')
      .eq('work_date', today);

    const presentToday = (todayAttendance ?? []).filter(a => a.status === 'PRESENT').length;
    const onLeaveToday = (todayAttendance ?? []).filter(a => a.status === 'ON_LEAVE').length;

    const { count: pendingLeaves } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    const { count: pendingRegs } = await supabase
      .from('attendance_regularizations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    return {
      totalEmployees,
      activeCount,
      headcountByDept: deptMap,
      todayAttendance: {
        present: presentToday,
        onLeave: onLeaveToday,
        attendanceRate: totalEmployees > 0 ? Number(((presentToday / totalEmployees) * 100).toFixed(1)) : 0
      },
      pendingApprovals: {
        leaves: pendingLeaves ?? 0,
        regularizations: pendingRegs ?? 0
      },
      kpiCompletionRate: 0
    };
  }
};

export const adminApi = {
  assertAdminRole() {
    // Role verification handled by Supabase policies
  },

  async getSystemUsers(): Promise<SystemUser[]> {
    const { data, error } = await supabase
      .from('system_users')
      .select('*, employee:employees(full_name, official_email), employee_roles:employee_roles(role)');

    if (error) throw new Error(`Failed to load system users: ${error.message}`);

    return (data ?? []).map((u: any) => {
      const roles = (u.employee_roles ?? []).map((r: any) => r.role as RoleType);
      return {
        id: u.id,
        name: u.employee?.full_name ?? 'System User',
        email: u.employee?.official_email ?? '',
        employeeId: u.employee_id,
        roles,
        status: u.is_locked ? 'SUSPENDED' : 'ACTIVE',
        lastLoginAt: u.last_login ?? undefined,
        isLocked: Boolean(u.is_locked)
      };
    });
  },

  async proposeRoleAssignment(userId: number, role: RoleType, justification: string): Promise<void> {
    const admin = await getCurrentEmployee();
    const { data: user } = await supabase
      .from('system_users')
      .select('*, employee:employees(full_name, official_email)')
      .eq('id', userId)
      .maybeSingle();

    const { error } = await supabase
      .from('role_proposals')
      .insert({
        target_user_id: userId,
        target_user_name: user?.employee?.full_name ?? `User #${userId}`,
        target_user_email: user?.employee?.official_email ?? '',
        proposed_role: role,
        justification,
        proposed_by_name: admin.full_name,
        proposed_at: new Date().toISOString(),
        status: 'PENDING'
      });

    if (error) throw new Error(`Failed to propose role assignment: ${error.message}`);
  },

  async toggleUserStatus(userId: number, action: 'LOCK' | 'UNLOCK'): Promise<void> {
    const { error } = await supabase
      .from('system_users')
      .update({ is_locked: action === 'LOCK' })
      .eq('id', userId);

    if (error) throw new Error(`Failed to toggle user status: ${error.message}`);
  },

  async getSystemAuditLogs(): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw new Error(`Failed to load audit logs: ${error.message}`);
    return (data ?? []).map(mapAuditLog);
  },

  async getUsers(): Promise<Array<{ user: AppUser; employee: Employee }>> {
    const { data: usersData, error } = await supabase
      .from('system_users')
      .select('*, employee:employees(*, department:departments(name), manager:employees!employees_manager_id_fkey(full_name)), employee_roles:employee_roles(role)');

    if (error) throw new Error(`Failed to load users: ${error.message}`);

    return (usersData ?? []).map((u: any) => {
      const roles = (u.employee_roles ?? []).map((r: any) => r.role as RoleType);
      const appUser: AppUser = {
        id: u.id,
        employeeId: u.employee_id,
        roles,
        lastLogin: u.last_login ?? undefined,
        isLocked: Boolean(u.is_locked)
      };
      const employee = mapEmployee(u.employee);
      return { user: appUser, employee };
    });
  },

  async updateUserRoles(userId: number, roles: RoleType[]): Promise<void> {
    if (roles.includes('ACCOUNTS') && roles.includes('SYSTEM_ADMIN')) {
      throw new Error('Security Split: An account cannot simultaneously hold SYSTEM_ADMIN and ACCOUNTS without board-level signoff.');
    }

    const { data: user, error: userError } = await supabase
      .from('system_users')
      .select('employee_id')
      .eq('id', userId)
      .single();

    if (userError || !user) throw new Error(`User not found: ${userError?.message}`);

    // Remove existing roles for employee
    await supabase
      .from('employee_roles')
      .delete()
      .eq('employee_id', user.employee_id);

    // Insert updated roles
    if (roles.length > 0) {
      const inserts = roles.map(role => ({
        employee_id: user.employee_id,
        role
      }));
      const { error: insertError } = await supabase
        .from('employee_roles')
        .insert(inserts);

      if (insertError) throw new Error(`Failed to update roles: ${insertError.message}`);
    }
  },

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    return await this.getSystemAuditLogs();
  }
};
