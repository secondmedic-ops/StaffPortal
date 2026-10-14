-- =============================================================================
-- Hourly (part-time) pay and the company payslip format
-- =============================================================================
-- * salary_revisions.pay_type: MONTHLY (salary prorated by paid days) or HOURLY
--   (worked hours x hourly_rate), as on the part-time payslip.
-- * payroll_entries keep the hours and rate used, so the payslip can print
--   "Total Working Hrs / Rate / Earning".
-- * employees.division: the state/division printed on the payslip.
-- Requires 20261014000000_holiday_work_claims.sql. Safe to re-run.
-- =============================================================================

alter table public.salary_revisions
  add column if not exists pay_type text not null default 'MONTHLY',
  add column if not exists hourly_rate numeric(10,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'salary_revisions_pay_type_check') then
    alter table public.salary_revisions
      add constraint salary_revisions_pay_type_check check (pay_type in ('MONTHLY', 'HOURLY'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'salary_revisions_hourly_rate_check') then
    alter table public.salary_revisions
      add constraint salary_revisions_hourly_rate_check
      check (pay_type <> 'HOURLY' or (hourly_rate is not null and hourly_rate > 0));
  end if;
end $$;

alter table public.payroll_entries
  add column if not exists pay_type text not null default 'MONTHLY',
  add column if not exists worked_hours numeric(7,2),
  add column if not exists hourly_rate numeric(10,2);

alter table public.employees
  add column if not exists division text;

-- Only Accounts may change the hours or rate behind a payslip, same as amounts.
create or replace function public.enforce_payroll_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me bigint := public.current_employee_id();
  is_accounts boolean := public.has_role('ACCOUNTS');
  is_approver boolean := old.computed_by is not null and public.is_in_reporting_line(old.computed_by, me);
begin
  if auth.uid() is null then
    return new;
  end if;

  if not is_accounts and (
       new.gross_earnings is distinct from old.gross_earnings
    or new.total_deductions is distinct from old.total_deductions
    or new.net_pay is distinct from old.net_pay
    or new.payable_days is distinct from old.payable_days
    or new.earnings is distinct from old.earnings
    or new.deductions is distinct from old.deductions
    or new.worked_hours is distinct from old.worked_hours
    or new.hourly_rate is distinct from old.hourly_rate
    or new.pay_type is distinct from old.pay_type
    or new.computed_by is distinct from old.computed_by) then
    raise exception 'Only Accounts can change payroll amounts';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'APPROVED' then
      if old.computed_by = me then
        raise exception 'Payroll must be approved by your reporting manager, not by the person who computed it';
      end if;
      if not is_approver then
        raise exception 'Only the reporting manager of the Accounts person who computed this payroll can approve it';
      end if;
    elsif new.status = 'PUBLISHED' then
      if old.status <> 'APPROVED' then
        raise exception 'Payroll must be approved by the reporting manager before publishing';
      end if;
      if not is_accounts then
        raise exception 'Only Accounts publishes payslips';
      end if;
    elsif new.status = 'DRAFT' and old.status = 'APPROVED' and not (is_approver or is_accounts) then
      raise exception 'Only the approver or Accounts can send payroll back';
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.enforce_payroll_approval() from public, anon, authenticated;
