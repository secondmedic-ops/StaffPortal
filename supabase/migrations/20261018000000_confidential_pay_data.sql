-- =============================================================================
-- Confidential pay data
-- =============================================================================
--   * Bank account, Aadhaar, PAN, UAN and ESIC move out of employee_profiles
--     into employee_financials: readable only by the employee and Accounts,
--     written only by Accounts. HR keeps personal details (address, contacts).
--   * Managers see the approved salary (CTC) of people in their reporting line.
--   * HR can no longer grant the ACCOUNTS / CEO / SYSTEM_ADMIN roles; only the
--     CEO or a system admin can.
-- Safe to re-run.
-- =============================================================================

create table if not exists public.employee_financials (
  employee_id bigint primary key references public.employees(id) on delete cascade,
  pan_number text,
  aadhaar_number text check (aadhaar_number is null or aadhaar_number ~ '^[0-9]{12}$'),
  aadhaar_last4 text check (aadhaar_last4 is null or aadhaar_last4 ~ '^[0-9]{4}$'),
  uan_number text,
  esic_number text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  updated_at timestamptz not null default now()
);

alter table public.employee_financials enable row level security;

drop policy if exists employee_financials_select on public.employee_financials;
create policy employee_financials_select on public.employee_financials for select to authenticated
  using (employee_id = public.current_employee_id() or public.has_role('ACCOUNTS'));

drop policy if exists employee_financials_insert on public.employee_financials;
create policy employee_financials_insert on public.employee_financials for insert to authenticated
  with check (public.has_role('ACCOUNTS'));

drop policy if exists employee_financials_update on public.employee_financials;
create policy employee_financials_update on public.employee_financials for update to authenticated
  using (public.has_role('ACCOUNTS'))
  with check (public.has_role('ACCOUNTS'));

revoke all on public.employee_financials from anon;
grant select, insert, update on public.employee_financials to authenticated;

-- Move existing data across, then drop the columns from the HR-readable table.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'employee_profiles' and column_name = 'bank_account_number') then
    insert into public.employee_financials
      (employee_id, pan_number, aadhaar_number, aadhaar_last4, uan_number, esic_number, bank_name, bank_account_number, bank_ifsc)
    select employee_id, pan_number, aadhaar_number, aadhaar_last4, uan_number, esic_number, bank_name, bank_account_number, bank_ifsc
      from public.employee_profiles
     where coalesce(pan_number, aadhaar_number, aadhaar_last4, uan_number, esic_number, bank_name, bank_account_number, bank_ifsc) is not null
    on conflict (employee_id) do nothing;
  end if;
end $$;

drop trigger if exists employee_profiles_sync_aadhaar on public.employee_profiles;
alter table public.employee_profiles
  drop column if exists pan_number,
  drop column if exists aadhaar_number,
  drop column if exists aadhaar_last4,
  drop column if exists uan_number,
  drop column if exists esic_number,
  drop column if exists bank_name,
  drop column if exists bank_account_number,
  drop column if exists bank_ifsc;

drop trigger if exists employee_financials_sync_aadhaar on public.employee_financials;
create trigger employee_financials_sync_aadhaar
  before insert or update of aadhaar_number on public.employee_financials
  for each row execute function public.sync_aadhaar_last4();

-- Managers see the approved salary of their reporting line.
drop policy if exists salary_revisions_select on public.salary_revisions;
create policy salary_revisions_select on public.salary_revisions for select to authenticated
  using (
    public.has_role('ACCOUNTS')
    or public.has_role('CEO')
    or (status = 'APPROVED' and (employee_id = public.current_employee_id() or public.is_in_reporting_line(employee_id)))
  );

-- Only the CEO / system admin can grant or remove the roles that unlock pay data.
drop policy if exists employee_roles_write on public.employee_roles;
create policy employee_roles_write on public.employee_roles for all to authenticated
  using (
    employee_id <> public.current_employee_id()
    and (public.has_role('SYSTEM_ADMIN') or public.has_role('CEO')
         or (public.has_role('HR') and role not in ('ACCOUNTS', 'CEO', 'SYSTEM_ADMIN')))
  )
  with check (
    employee_id <> public.current_employee_id()
    and (public.has_role('SYSTEM_ADMIN') or public.has_role('CEO')
         or (public.has_role('HR') and role not in ('ACCOUNTS', 'CEO', 'SYSTEM_ADMIN')))
  );

notify pgrst, 'reload schema';
