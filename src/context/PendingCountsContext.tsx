import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface PendingCounts {
  leaveApprovals: number;
  regularizations: number;
  itRequests: number;
  salaryRevisions: number;
  myUnacknowledgedAssets: number;
  myLifecycleTasks: number;
}

const EMPTY: PendingCounts = {
  leaveApprovals: 0,
  regularizations: 0,
  itRequests: 0,
  salaryRevisions: 0,
  myUnacknowledgedAssets: 0,
  myLifecycleTasks: 0
};

interface PendingCountsContextType {
  counts: PendingCounts;
  refresh: () => void;
}

const PendingCountsContext = createContext<PendingCountsContextType>({ counts: EMPTY, refresh: () => {} });

/** Count rows, treating a missing table or denied access as zero. */
async function safeCount(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  try {
    const { count, error } = await query;
    return error ? 0 : count ?? 0;
  } catch {
    return 0;
  }
}

export const PendingCountsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, activeNav, isManager, isHr, isIt, isAccounts, isCeo, roles } = useAuth();
  const [counts, setCounts] = useState<PendingCounts>(EMPTY);

  const refresh = useCallback(async () => {
    if (!currentUser || !isSupabaseConfigured) return;
    const me = currentUser.id;
    const head = { count: 'exact' as const, head: true };

    const ownerRoles = roles.filter(r => ['HR', 'IT', 'ACCOUNTS'].includes(r));
    const [leaveMine, leaveHr, regs, it, revisions, assets, tasks] = await Promise.all([
      isManager || isHr
        ? safeCount(supabase.from('leave_requests').select('id', head).eq('status', 'PENDING').eq('current_approver_id', me))
        : 0,
      isHr ? safeCount(supabase.from('leave_requests').select('id', head).eq('status', 'PENDING').is('current_approver_id', null)) : 0,
      isManager ? safeCount(supabase.from('attendance_regularizations').select('id', head).eq('status', 'PENDING').eq('approver_id', me)) : 0,
      isIt ? safeCount(supabase.from('it_requests').select('id', head).in('status', ['OPEN', 'IN_PROGRESS'])) : 0,
      isAccounts || isCeo ? safeCount(supabase.from('salary_revisions').select('id', head).eq('status', 'PROPOSED').neq('proposed_by', me)) : 0,
      safeCount(supabase.from('assets').select('id', head).eq('assigned_to', me).is('acknowledged_at', null)),
      ownerRoles.length > 0
        ? safeCount(supabase.from('lifecycle_tasks').select('id', head).eq('done', false).in('owner_role', ownerRoles as any))
        : 0
    ]);

    setCounts({
      leaveApprovals: leaveMine + leaveHr,
      regularizations: regs,
      itRequests: it,
      salaryRevisions: revisions,
      myUnacknowledgedAssets: assets,
      myLifecycleTasks: tasks
    });
  }, [currentUser, isManager, isHr, isIt, isAccounts, isCeo, roles]);

  // Re-check whenever the user navigates (cheap HEAD counts) and every 2 minutes.
  useEffect(() => {
    refresh();
  }, [refresh, activeNav]);

  useEffect(() => {
    const t = setInterval(refresh, 120000);
    return () => clearInterval(t);
  }, [refresh]);

  return <PendingCountsContext.Provider value={{ counts, refresh }}>{children}</PendingCountsContext.Provider>;
};

export const usePendingCounts = () => useContext(PendingCountsContext);
