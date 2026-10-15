import { supabase } from '../lib/supabase';

/**
 * Fill `manager: { full_name }` on employee rows with one extra lookup.
 *
 * Embedding the self-referencing manager relationship through PostgREST
 * (`manager:employees!employees_manager_id_fkey(...)`) fails whenever the
 * API's schema cache loses that relationship (PGRST200), which blocked login.
 * A plain lookup by id cannot fail that way.
 */
export async function withManagerNames<T extends { manager_id?: number | null }>(
  rows: T[]
): Promise<Array<T & { manager: { full_name: string } | null }>> {
  const ids = [...new Set(rows.map(r => r.manager_id).filter((v): v is number => v != null))];
  const names = new Map<number, string>();
  if (ids.length > 0) {
    const { data } = await supabase.from('employees').select('id, full_name').in('id', ids);
    (data ?? []).forEach(e => names.set(e.id, e.full_name));
  }
  return rows.map(r => ({
    ...r,
    manager: r.manager_id != null && names.has(r.manager_id) ? { full_name: names.get(r.manager_id)! } : null
  }));
}

export async function withManagerName<T extends { manager_id?: number | null }>(row: T) {
  return (await withManagerNames([row]))[0];
}
