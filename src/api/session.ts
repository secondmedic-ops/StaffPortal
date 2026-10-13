import { supabase } from '../lib/supabase';

export interface SessionEmployee {
  id: number;
  emp_code: string;
  full_name: string;
  manager_id: number | null;
}

/** Resolve the employee row behind the signed-in Supabase user. */
export async function getSessionEmployee(): Promise<SessionEmployee> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Failed to get session: ${sessionError.message}`);
  const user = sessionData.session?.user;
  if (!user) throw new Error('No active user session');

  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('id, emp_code, full_name, manager_id')
    .or(`auth_user_id.eq.${user.id},official_email.eq.${user.email ?? ''}`)
    .single();

  if (empError || !emp) throw new Error('Your login is not linked to a staff record — contact HR');
  return emp;
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
