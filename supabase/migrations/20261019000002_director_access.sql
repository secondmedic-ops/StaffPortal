-- =============================================================================
-- Migration: Director Role Access & Governance Rules
-- =============================================================================
-- The Director runs operations. They get leadership visibility (read-only)
-- into the organization, and acts as a manager over their reporting line.
-- CEO-only powers (salary/payroll approvals, IAM roles, audit logs) remain CEO-only.
-- Safe to re-run (idempotent).
-- =============================================================================

-- 1. Read-only org visibility: System users
drop policy if exists system_users_read on public.system_users;
create policy system_users_read on public.system_users for select to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.has_role('HR')
    or public.has_role('SYSTEM_ADMIN')
    or public.has_role('CEO')
    or public.has_role('DIRECTOR')
  );

-- 2. Read-only org visibility: Staff lifecycle tasks
drop policy if exists lifecycle_tasks_select on public.lifecycle_tasks;
create policy lifecycle_tasks_select on public.lifecycle_tasks for select to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.is_in_reporting_line(employee_id)
    or public.has_role('HR')
    or public.has_role('ACCOUNTS')
    or public.has_role('CEO')
    or public.has_role('DIRECTOR')
  );

-- 3. IAM governance: HR cannot grant DIRECTOR (only CEO or SYSTEM_ADMIN can)
drop policy if exists employee_roles_write on public.employee_roles;
create policy employee_roles_write on public.employee_roles for all to authenticated
  using (
    employee_id <> public.current_employee_id()
    and (
      public.has_role('SYSTEM_ADMIN')
      or public.has_role('CEO')
      or (public.has_role('HR') and role not in ('ACCOUNTS', 'CEO', 'SYSTEM_ADMIN', 'DIRECTOR'))
    )
  )
  with check (
    employee_id <> public.current_employee_id()
    and (
      public.has_role('SYSTEM_ADMIN')
      or public.has_role('CEO')
      or (public.has_role('HR') and role not in ('ACCOUNTS', 'CEO', 'SYSTEM_ADMIN', 'DIRECTOR'))
    )
  );

-- 4. Ensure role_proposals check constraint (if defined as text check) accepts DIRECTOR
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.role_proposals'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%SYSTEM_ADMIN%'
  loop
    execute format('alter table public.role_proposals drop constraint %I', c.conname);
  end loop;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'role_proposals' and column_name = 'proposed_role' and data_type = 'text'
  ) then
    alter table public.role_proposals add constraint role_proposals_proposed_role_check
      check (proposed_role in ('EMPLOYEE','MANAGER','HR','ACCOUNTS','IT','CEO','SYSTEM_ADMIN','DIRECTOR'));
  end if;
end $$;

-- 5. Role proposals access: CEO and SYSTEM_ADMIN only (Director cannot read or action)
alter table public.role_proposals enable row level security;

drop policy if exists role_proposals_read on public.role_proposals;
create policy role_proposals_read on public.role_proposals
  for select to authenticated
  using (public.has_role('CEO') or public.has_role('SYSTEM_ADMIN'));

drop policy if exists role_proposals_insert on public.role_proposals;
create policy role_proposals_insert on public.role_proposals
  for insert to authenticated
  with check (public.has_role('HR') or public.has_role('CEO') or public.has_role('SYSTEM_ADMIN'));


drop policy if exists role_proposals_update on public.role_proposals;
create policy role_proposals_update on public.role_proposals
  for update to authenticated
  using (public.has_role('CEO') or public.has_role('SYSTEM_ADMIN'))
  with check (public.has_role('CEO') or public.has_role('SYSTEM_ADMIN'));

notify pgrst, 'reload schema';

