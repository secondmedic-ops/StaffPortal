import { supabase } from '../lib/supabase';
import { mapEmployeeHistoryItem } from './mappers';
import type { EmployeeHistoryItem } from '../types';

export const historyApi = {
  async getEmployeeHistory(employeeId: number): Promise<EmployeeHistoryItem[]> {
    const { data, error } = await supabase
      .from('employee_history')
      .select('*, changer:employees!employee_history_changed_by_fkey(full_name)')
      .eq('employee_id', employeeId)
      .order('changed_at', { ascending: false });

    if (error) throw new Error(`Failed to load employee history: ${error.message}`);
    return (data || []).map(mapEmployeeHistoryItem);
  }
};
