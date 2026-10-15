import { supabase } from '../lib/supabase';

export interface SessionEmployee {
  id: number;
  emp_code: string;
  full_name: string;
  manager_id: number | null;
  department_id?: number | null;
  department?: { name: string } | null;
  manager?: { full_name: string } | null;
}

export function getDemoSessionEmployee(): SessionEmployee | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('staffportal_demo_session') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.employee) {
        return {
          id: parsed.employee.id,
          emp_code: parsed.employee.empCode,
          full_name: parsed.employee.fullName,
          manager_id: parsed.employee.managerId ?? null,
          department_id: parsed.employee.departmentId ?? 1,
          department: { name: parsed.employee.departmentName ?? 'Executive & Systems' },
        };
      }
    }
  } catch {}
  return null;
}

/** Resolve the employee row behind the signed-in Supabase user. */
export async function getSessionEmployee(): Promise<SessionEmployee> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (user) {
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('id, emp_code, full_name, manager_id, department_id, department:departments!employees_department_id_fkey(name)')
        .or(`auth_user_id.eq.${user.id},official_email.eq.${user.email ?? ''}`)
        .single();

      if (!empError && emp) {
        return {
          id: emp.id,
          emp_code: emp.emp_code,
          full_name: emp.full_name,
          manager_id: emp.manager_id,
          department_id: emp.department_id,
          department: emp.department,
        };
      }
    }
  } catch {}

  const demo = getDemoSessionEmployee();
  if (demo) return demo;

  throw new Error('Your login is not linked to a staff record — contact HR');
}

export async function getSessionRoles(empId: number): Promise<string[]> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('staffportal_demo_session') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.employee?.id === empId && Array.isArray(parsed?.roles)) {
        return parsed.roles;
      }
    }
  } catch {}

  const { data } = await supabase
    .from('employee_roles')
    .select('role')
    .eq('employee_id', empId);
  return (data ?? []).map((r: any) => r.role);
}

/** Asserts that the signed-in user has ACCOUNTS, CEO, or SYSTEM_ADMIN role, throwing 403 otherwise. */
export async function assertPayrollAccess(): Promise<SessionEmployee> {
  const me = await getSessionEmployee();
  const roles = await getSessionRoles(me.id);
  const authorized = roles.some(r => ['ACCOUNTS', 'CEO', 'SYSTEM_ADMIN'].includes(r));
  if (!authorized) {
    const err: any = new Error('403 Forbidden: You do not have access to payroll data');
    err.status = 403;
    throw err;
  }
  return me;
}

type AuditModule = 'AUTH' | 'EMPLOYEE' | 'ATTENDANCE' | 'LEAVE' | 'KPI' | 'PAYROLL' | 'ROLES';

/** Best-effort audit trail entry; never blocks the business action. */
export async function logAudit(
  actor: SessionEmployee,
  module: AuditModule,
  action: string,
  details: string,
  entity?: { type: string; id: number }
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_name: actor.full_name,
      module,
      action,
      details,
      entity_type: entity?.type ?? null,
      entity_id: entity?.id ?? null,
    });
  } catch {
    // Audit logging must not fail the user's action.
  }
}

/** Indian financial year label used by leave balances, e.g. "2026-2027". */
export function financialYearLabel(date: Date = new Date()): string {
  const y = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}
