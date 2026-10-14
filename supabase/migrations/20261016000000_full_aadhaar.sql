-- =============================================================================
-- Full Aadhaar number on the employee profile (printed on payslips)
-- =============================================================================
-- employee_profiles is readable only by the employee, HR and Accounts (RLS).
-- aadhaar_last4 is kept in step automatically so older screens still work.
-- Safe to re-run.
-- =============================================================================

alter table public.employee_profiles
  add column if not exists aadhaar_number text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employee_profiles_aadhaar_number_check') then
    alter table public.employee_profiles
      add constraint employee_profiles_aadhaar_number_check
      check (aadhaar_number is null or aadhaar_number ~ '^[0-9]{12}$');
  end if;
end $$;

create or replace function public.sync_aadhaar_last4()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.aadhaar_number is not null then
    new.aadhaar_last4 := right(new.aadhaar_number, 4);
  end if;
  return new;
end $$;

revoke execute on function public.sync_aadhaar_last4() from public, anon, authenticated;

drop trigger if exists employee_profiles_sync_aadhaar on public.employee_profiles;
create trigger employee_profiles_sync_aadhaar
  before insert or update of aadhaar_number on public.employee_profiles
  for each row execute function public.sync_aadhaar_last4();
