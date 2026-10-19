-- =============================================================================
-- Migration: Only the CEO Approves Salary Revisions and Monthly Payroll
-- =============================================================================
-- 1. Salary Revisions:
--    - Only the CEO role can approve or reject (Accounts can no longer approve).
--    - Accounts (and HR for JOINING) propose revisions.
--    - The CEO can propose a revision for staff with the ACCOUNTS role.
--    - Maker-checker: proposer cannot approve own proposal, EXCEPT the CEO.
--    - Nobody can approve a revision of their own salary.
--    - Accounts can still read all revisions and edit their own PROPOSED ones.
-- 2. Monthly Payroll:
--    - DRAFT -> APPROVED: Only the CEO, and never the person who computed it.
--    - APPROVED -> DRAFT (send back): CEO or Accounts.
--    - APPROVED -> PUBLISHED: Accounts only (unchanged). Amounts: Accounts only.
--    - Reporting-line managers no longer see or approve payroll drafts.
-- =============================================================================

-- 1. Salary revisions insert policy
drop policy if exists salary_revisions_insert on public.salary_revisions;
create policy salary_revisions_insert on public.salary_revisions for insert to authenticated
  with check (
    status = 'PROPOSED'
    and proposed_by = public.current_employee_id()
    and (
      public.has_role('ACCOUNTS')
      or (public.has_role('HR') and revision_type = 'JOINING')
      or (public.has_role('CEO') and exists (
            select 1 from public.employee_roles er
            where er.employee_id = salary_revisions.employee_id and er.role = 'ACCOUNTS'
          ))
    )
  );

-- 2. Salary revisions update policy
drop policy if exists salary_revisions_update on public.salary_revisions;
create policy salary_revisions_update on public.salary_revisions for update to authenticated
  using (
    public.has_role('CEO')
    or (public.has_role('ACCOUNTS') and status = 'PROPOSED' and proposed_by = public.current_employee_id())
  )
  with check (
    public.has_role('CEO')
    or (public.has_role('ACCOUNTS') and status = 'PROPOSED' and proposed_by = public.current_employee_id())
  );

-- 3. Salary revisions maker-checker trigger function
create or replace function public.enforce_salary_maker_checker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me bigint := public.current_employee_id();
  is_ceo boolean := public.has_role('CEO');
begin
  if new.status <> old.status and new.status in ('APPROVED', 'REJECTED') then
    if not is_ceo then
      raise exception 'Only the CEO can approve or reject salary revisions';
    end if;
    if auth.uid() is not null and old.employee_id = me then
      raise exception 'You cannot approve your own salary revision';
    end if;
    if auth.uid() is not null and old.proposed_by = me and not is_ceo then
      raise exception 'Maker-checker: the person who proposed a salary revision cannot approve or reject it';
    end if;
    new.approved_by := me;
    new.approved_at := now();
  end if;
  return new;
end $$;

revoke execute on function public.enforce_salary_maker_checker() from public, anon, authenticated;

-- 4. Payroll entries select policy
drop policy if exists payroll_entries_select on public.payroll_entries;
create policy payroll_entries_select on public.payroll_entries for select to authenticated
  using (
    public.has_role('ACCOUNTS')
    or (public.has_role('CEO') and status in ('DRAFT', 'APPROVED'))
    or (employee_id = public.current_employee_id() and status = 'PUBLISHED')
  );

-- 5. Payroll entries approver update policy
drop policy if exists payroll_entries_approver_update on public.payroll_entries;
create policy payroll_entries_approver_update on public.payroll_entries for update to authenticated
  using (public.has_role('CEO'))
  with check (public.has_role('CEO'));

-- 6. Payroll approval enforcement trigger function
create or replace function public.enforce_payroll_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me bigint := public.current_employee_id();
  is_accounts boolean := public.has_role('ACCOUNTS');
  is_ceo boolean := public.has_role('CEO');
begin
  if auth.uid() is null then
    return new;
  end if;

  if not is_accounts and (
       new.gross_earnings is distinct from old.gross_earnings
    or new.total_deductions is distinct from old.total_deductions
    or new.net_pay is distinct from old.net_pay
    or new.payable_days is distinct from old.payable_days
    or new.present_days is distinct from old.present_days
    or new.earnings is distinct from old.earnings
    or new.deductions is distinct from old.deductions
    or new.worked_hours is distinct from old.worked_hours
    or new.daily_rate is distinct from old.daily_rate
    or new.pay_type is distinct from old.pay_type
    or new.computed_by is distinct from old.computed_by) then
    raise exception 'Only Accounts can change payroll amounts';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'APPROVED' then
      if not is_ceo then
        raise exception 'Only the CEO can approve monthly payroll';
      end if;
      if old.computed_by = me then
        raise exception 'Payroll must be approved by the CEO, not by the person who computed it';
      end if;
    elsif new.status = 'PUBLISHED' then
      if old.status <> 'APPROVED' then
        raise exception 'Payroll must be approved by the CEO before publishing';
      end if;
      if not is_accounts then
        raise exception 'Only Accounts publishes payslips';
      end if;
    elsif new.status = 'DRAFT' and old.status = 'APPROVED' then
      if not (is_ceo or is_accounts) then
        raise exception 'Only the CEO or Accounts can send payroll back';
      end if;
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.enforce_payroll_approval() from public, anon, authenticated;

notify pgrst, 'reload schema';
