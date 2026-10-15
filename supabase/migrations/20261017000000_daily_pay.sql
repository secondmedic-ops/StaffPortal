-- =============================================================================
-- Part-time staff are paid per day, not per hour
-- =============================================================================
-- pay_type DAILY replaces HOURLY: pay = days worked x daily_rate.
-- hourly_rate columns from 20261015 are renamed to daily_rate (data kept).
-- Safe to re-run (also after 20261015 re-adds hourly_rate on a re-run).
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['salary_revisions', 'payroll_entries'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'hourly_rate') then
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'daily_rate') then
        execute format('alter table public.%I drop column hourly_rate', t);
      else
        execute format('alter table public.%I rename column hourly_rate to daily_rate', t);
      end if;
    end if;
    execute format('alter table public.%I add column if not exists daily_rate numeric(10,2)', t);
    execute format('update public.%I set pay_type = ''DAILY'' where pay_type = ''HOURLY''', t);
  end loop;
end $$;

alter table public.salary_revisions drop constraint if exists salary_revisions_hourly_rate_check;
alter table public.salary_revisions drop constraint if exists salary_revisions_pay_type_check;
alter table public.salary_revisions
  add constraint salary_revisions_pay_type_check check (pay_type in ('MONTHLY', 'DAILY'));
alter table public.salary_revisions drop constraint if exists salary_revisions_daily_rate_check;
alter table public.salary_revisions
  add constraint salary_revisions_daily_rate_check
  check (pay_type <> 'DAILY' or (daily_rate is not null and daily_rate > 0));

-- Only Accounts may change the days, hours or rate behind a payslip, same as amounts.
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
