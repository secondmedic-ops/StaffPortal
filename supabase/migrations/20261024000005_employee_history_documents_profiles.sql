-- -----------------------------------------------------------------------------
-- 20261024000005_employee_history_documents_profiles.sql
-- Feature 5: Employee History & Documents
-- Feature 9: Probation End Date
-- Feature 10: Avatar URL & Profile Change Requests
-- -----------------------------------------------------------------------------

-- 1. Add probation_end_date and avatar_url to employees
alter table public.employees
  add column if not exists probation_end_date date,
  add column if not exists avatar_url text;

-- Backfill probation_end_date for PROBATION employees and any missing
update public.employees
set probation_end_date = coalesce(date_of_joining, current_date) + interval '6 months'
where probation_end_date is null;

-- 2. Create employee_history table
create table if not exists public.employee_history (
  id bigserial primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  changed_by bigint references public.employees(id),
  changed_at timestamptz not null default now()
);

-- Enable RLS
alter table public.employee_history enable row level security;

-- Policies for employee_history
drop policy if exists select_employee_history on public.employee_history;
create policy select_employee_history on public.employee_history
  for select to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.has_role('HR')
    or public.is_in_reporting_line(employee_id)
  );

drop policy if exists hr_inserts_employee_history on public.employee_history;
create policy hr_inserts_employee_history on public.employee_history
  for insert to authenticated
  with check (true);

-- 3. Trigger on employees to populate employee_history
create or replace function public.log_employee_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changer bigint := public.current_employee_id();
  old_val text;
  new_val text;
begin
  -- Designation change
  if old.designation is distinct from new.designation then
    insert into public.employee_history (employee_id, field, old_value, new_value, changed_by)
    values (new.id, 'designation', old.designation, new.designation, changer);
  end if;

  -- Department change
  if old.department_id is distinct from new.department_id then
    select name into old_val from public.departments where id = old.department_id;
    select name into new_val from public.departments where id = new.department_id;
    insert into public.employee_history (employee_id, field, old_value, new_value, changed_by)
    values (new.id, 'department', coalesce(old_val, old.department_id::text), coalesce(new_val, new.department_id::text), changer);
  end if;

  -- Manager change
  if old.manager_id is distinct from new.manager_id then
    select full_name into old_val from public.employees where id = old.manager_id;
    select full_name into new_val from public.employees where id = new.manager_id;
    insert into public.employee_history (employee_id, field, old_value, new_value, changed_by)
    values (new.id, 'manager', coalesce(old_val, 'None'), coalesce(new_val, 'None'), changer);
  end if;

  -- Status change
  if old.status is distinct from new.status then
    insert into public.employee_history (employee_id, field, old_value, new_value, changed_by)
    values (new.id, 'status', old.status::text, new.status::text, changer);
  end if;

  -- Branch change
  if old.branch_id is distinct from new.branch_id then
    select name into old_val from public.branches where id = old.branch_id;
    select name into new_val from public.branches where id = new.branch_id;
    insert into public.employee_history (employee_id, field, old_value, new_value, changed_by)
    values (new.id, 'branch', coalesce(old_val, 'None'), coalesce(new_val, 'None'), changer);
  end if;

  return new;
end $$;

drop trigger if exists employees_log_changes on public.employees;
create trigger employees_log_changes
  after update on public.employees
  for each row execute function public.log_employee_field_changes();

-- 4. Create employee_documents table
create table if not exists public.employee_documents (
  id bigserial primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  category text not null check (category in (
    'Offer letter',
    'Appointment letter',
    'ID proof',
    'Address proof',
    'Education',
    'Experience/Relieving',
    'Medical registration',
    'Other'
  )),
  file_path text not null,
  name text not null,
  size bigint not null default 0,
  uploaded_by bigint references public.employees(id),
  uploaded_at timestamptz not null default now()
);

-- Enable RLS
alter table public.employee_documents enable row level security;

-- Policies: HR only
drop policy if exists hr_select_employee_documents on public.employee_documents;
create policy hr_select_employee_documents on public.employee_documents
  for select to authenticated
  using (public.has_role('HR') or public.has_role('SYSTEM_ADMIN'));

drop policy if exists hr_all_employee_documents on public.employee_documents;
create policy hr_all_employee_documents on public.employee_documents
  for all to authenticated
  using (public.has_role('HR') or public.has_role('SYSTEM_ADMIN'))
  with check (public.has_role('HR') or public.has_role('SYSTEM_ADMIN'));

-- 5. Create profile_change_requests table
create table if not exists public.profile_change_requests (
  id bigserial primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text not null,
  reason text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  actioned_by bigint references public.employees(id),
  actioned_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profile_change_requests enable row level security;

-- Policies for profile_change_requests
drop policy if exists select_profile_change_requests on public.profile_change_requests;
create policy select_profile_change_requests on public.profile_change_requests
  for select to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.has_role('HR')
  );

drop policy if exists insert_profile_change_requests on public.profile_change_requests;
create policy insert_profile_change_requests on public.profile_change_requests
  for insert to authenticated
  with check (employee_id = public.current_employee_id());

drop policy if exists hr_update_profile_change_requests on public.profile_change_requests;
create policy hr_update_profile_change_requests on public.profile_change_requests
  for update to authenticated
  using (public.has_role('HR') or public.has_role('SYSTEM_ADMIN'))
  with check (public.has_role('HR') or public.has_role('SYSTEM_ADMIN'));

-- Trigger on profile_change_requests to apply name changes upon HR approval
create or replace function public.apply_profile_change_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  emp_email text;
  emp_name text;
begin
  if new.status = 'APPROVED' and old.status = 'PENDING' then
    if new.field = 'full_name' then
      update public.employees
      set full_name = new.new_value
      where id = new.employee_id;
    end if;

    new.actioned_by := coalesce(public.current_employee_id(), new.actioned_by);
    new.actioned_at := now();

    -- Notify employee of approval
    select official_email, full_name into emp_email, emp_name
    from public.employees where id = new.employee_id;

    if emp_email is not null then
      perform public.queue_email(
        'profile_change_decided',
        emp_email,
        null,
        'Profile Change Request Approved',
        jsonb_build_object(
          'employeeName', emp_name,
          'field', new.field,
          'newValue', new.new_value,
          'status', 'APPROVED'
        ),
        'profile_change:' || new.id::text || ':APPROVED'
      );
    end if;

  elsif new.status = 'REJECTED' and old.status = 'PENDING' then
    new.actioned_by := coalesce(public.current_employee_id(), new.actioned_by);
    new.actioned_at := now();

    select official_email, full_name into emp_email, emp_name
    from public.employees where id = new.employee_id;

    if emp_email is not null then
      perform public.queue_email(
        'profile_change_decided',
        emp_email,
        null,
        'Profile Change Request Rejected',
        jsonb_build_object(
          'employeeName', emp_name,
          'field', new.field,
          'reason', new.rejection_reason,
          'status', 'REJECTED'
        ),
        'profile_change:' || new.id::text || ':REJECTED'
      );
    end if;
  end if;

  return new;
end $$;

drop trigger if exists profile_change_requests_apply on public.profile_change_requests;
create trigger profile_change_requests_apply
  before update on public.profile_change_requests
  for each row execute function public.apply_profile_change_approval();

grant select, insert, update on public.employee_history to authenticated;
grant select, insert, update, delete on public.employee_documents to authenticated;
grant select, insert, update on public.profile_change_requests to authenticated;
