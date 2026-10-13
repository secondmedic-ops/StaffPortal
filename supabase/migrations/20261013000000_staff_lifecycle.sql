-- =============================================================================
-- SecondMedic Staff Portal — staff lifecycle, IT assets, compensation & payroll
-- =============================================================================
-- Adds:
--   * IT role
--   * Hierarchy helpers (current_employee_id, has_role, is_in_reporting_line)
--   * employee_profiles   — personal, statutory & bank details captured by HR
--   * assets / asset_assignments — laptops, mobiles, SIMs (company numbers) …
--   * it_requests         — provisioning / repair / access tickets
--   * lifecycle_tasks     — onboarding & exit-clearance checklists per owner
--   * salary_revisions    — joining salary, increments, promotions (maker-checker)
--   * payroll_entries     — attendance-based monthly pay, published to staff
--   * Triggers enforcing that only the reporting line (or HR) approves leave
--     and attendance regularizations.
-- Safe to re-run: every statement is idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. IT role (works whether role columns use a Postgres enum or a CHECK)
-- -----------------------------------------------------------------------------
do $$
declare
  tbl text;
  col_type text;
  c record;
begin
  foreach tbl in array array['employee_roles', 'role_proposals'] loop
    select udt_name into col_type
      from information_schema.columns
     where table_schema = 'public'
       and table_name = tbl
       and column_name = case when tbl = 'employee_roles' then 'role' else 'proposed_role' end;

    if col_type is null then
      continue;
    elsif exists (select 1 from pg_type where typname = col_type and typtype = 'e') then
      execute format('alter type %I add value if not exists %L', col_type, 'IT');
    else
      for c in
        select conname from pg_constraint
         where conrelid = format('public.%I', tbl)::regclass
           and contype = 'c'
           and pg_get_constraintdef(oid) ilike '%SYSTEM_ADMIN%'
      loop
        execute format('alter table public.%I drop constraint %I', tbl, c.conname);
      end loop;
      execute format(
        'alter table public.%I add constraint %I check (%I in (''EMPLOYEE'',''MANAGER'',''HR'',''ACCOUNTS'',''IT'',''CEO'',''SYSTEM_ADMIN''))',
        tbl,
        tbl || '_role_check',
        case when tbl = 'employee_roles' then 'role' else 'proposed_role' end
      );
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Hierarchy & role helpers (security definer so RLS can call them cheaply)
-- -----------------------------------------------------------------------------
create or replace function public.current_employee_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select e.id
    from employees e
   where e.auth_user_id = auth.uid()
      or lower(e.official_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
   order by (e.auth_user_id = auth.uid()) desc nulls last
   limit 1
$$;

create or replace function public.has_role(r text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from employee_roles er
     where er.employee_id = public.current_employee_id()
       and er.role::text = r
  )
$$;

-- True when `mgr` sits anywhere above `target` in the reporting chain.
create or replace function public.is_in_reporting_line(target bigint, mgr bigint default public.current_employee_id())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain(id, manager_id, depth) as (
    select e.id, e.manager_id, 0 from employees e where e.id = target
    union all
    select e.id, e.manager_id, c.depth + 1
      from employees e join chain c on e.id = c.manager_id
     where c.depth < 12
  )
  select mgr is not null and exists (select 1 from chain where manager_id = mgr)
$$;

grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.is_in_reporting_line(bigint, bigint) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Employee profiles (HR-owned, visible to self, HR and Accounts)
-- -----------------------------------------------------------------------------
create table if not exists public.employee_profiles (
  employee_id bigint primary key references public.employees(id) on delete cascade,
  date_of_birth date,
  gender text,
  blood_group text,
  marital_status text,
  father_name text,
  current_address text,
  permanent_address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  pan_number text,
  aadhaar_last4 text check (aadhaar_last4 is null or aadhaar_last4 ~ '^[0-9]{4}$'),
  uan_number text,
  esic_number text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  updated_at timestamptz not null default now()
);

alter table public.employee_profiles enable row level security;

drop policy if exists employee_profiles_select on public.employee_profiles;
create policy employee_profiles_select on public.employee_profiles for select to authenticated
  using (employee_id = public.current_employee_id() or public.has_role('HR') or public.has_role('ACCOUNTS'));

drop policy if exists employee_profiles_insert on public.employee_profiles;
create policy employee_profiles_insert on public.employee_profiles for insert to authenticated
  with check (public.has_role('HR'));

drop policy if exists employee_profiles_update on public.employee_profiles;
create policy employee_profiles_update on public.employee_profiles for update to authenticated
  using (employee_id = public.current_employee_id() or public.has_role('HR'))
  with check (employee_id = public.current_employee_id() or public.has_role('HR'));

-- -----------------------------------------------------------------------------
-- 4. IT assets (laptops, mobiles, SIM / company numbers, accessories)
-- -----------------------------------------------------------------------------
create table if not exists public.assets (
  id bigint generated by default as identity primary key,
  asset_tag text not null unique,
  category text not null check (category in ('LAPTOP','DESKTOP','MOBILE','SIM','TABLET','MONITOR','ACCESSORY','ID_CARD','OTHER')),
  brand text,
  model text,
  serial_number text,
  imei text,
  phone_number text,
  carrier text,
  plan_details text,
  specs text,
  purchase_date date,
  purchase_cost numeric(12,2),
  vendor text,
  warranty_until date,
  status text not null default 'IN_STOCK' check (status in ('IN_STOCK','ASSIGNED','IN_REPAIR','RETIRED','LOST')),
  condition text not null default 'GOOD' check (condition in ('NEW','GOOD','FAIR','DAMAGED')),
  assigned_to bigint references public.employees(id) on delete set null,
  assigned_at timestamptz,
  acknowledged_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists assets_phone_number_key on public.assets (phone_number) where phone_number is not null and status <> 'RETIRED';
create index if not exists assets_assigned_to_idx on public.assets (assigned_to);

create table if not exists public.asset_assignments (
  id bigint generated by default as identity primary key,
  asset_id bigint not null references public.assets(id) on delete cascade,
  employee_id bigint not null references public.employees(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by bigint references public.employees(id) on delete set null,
  returned_at timestamptz,
  return_condition text check (return_condition in ('NEW','GOOD','FAIR','DAMAGED')),
  notes text
);

create index if not exists asset_assignments_employee_idx on public.asset_assignments (employee_id);

alter table public.assets enable row level security;
alter table public.asset_assignments enable row level security;

drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets for select to authenticated
  using (public.has_role('IT') or public.has_role('HR') or public.has_role('SYSTEM_ADMIN')
         or assigned_to = public.current_employee_id());

drop policy if exists assets_write on public.assets;
create policy assets_write on public.assets for all to authenticated
  using (public.has_role('IT')) with check (public.has_role('IT'));

drop policy if exists asset_assignments_select on public.asset_assignments;
create policy asset_assignments_select on public.asset_assignments for select to authenticated
  using (public.has_role('IT') or public.has_role('HR') or employee_id = public.current_employee_id());

drop policy if exists asset_assignments_write on public.asset_assignments;
create policy asset_assignments_write on public.asset_assignments for all to authenticated
  using (public.has_role('IT')) with check (public.has_role('IT'));

-- Employees acknowledge receipt of their own asset without broader write access.
create or replace function public.acknowledge_asset(p_asset_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update assets
     set acknowledged_at = now()
   where id = p_asset_id
     and assigned_to = public.current_employee_id();
  if not found then
    raise exception 'Asset % is not assigned to you', p_asset_id;
  end if;
end $$;

grant execute on function public.acknowledge_asset(bigint) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. IT requests
-- -----------------------------------------------------------------------------
create table if not exists public.it_requests (
  id bigint generated by default as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  request_type text not null check (request_type in ('ONBOARDING','OFFBOARDING','NEW_ASSET','REPAIR','ACCESS','OTHER')),
  title text not null,
  details text,
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH')),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','DONE','CANCELLED')),
  raised_by bigint references public.employees(id) on delete set null,
  resolution text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.it_requests enable row level security;

drop policy if exists it_requests_select on public.it_requests;
create policy it_requests_select on public.it_requests for select to authenticated
  using (public.has_role('IT') or public.has_role('HR')
         or employee_id = public.current_employee_id()
         or raised_by = public.current_employee_id());

drop policy if exists it_requests_insert on public.it_requests;
create policy it_requests_insert on public.it_requests for insert to authenticated
  with check (raised_by = public.current_employee_id()
              and (employee_id = public.current_employee_id() or public.has_role('HR') or public.has_role('IT')));

drop policy if exists it_requests_update on public.it_requests;
create policy it_requests_update on public.it_requests for update to authenticated
  using (public.has_role('IT')) with check (public.has_role('IT'));

-- -----------------------------------------------------------------------------
-- 6. Onboarding / exit checklists
-- -----------------------------------------------------------------------------
create table if not exists public.lifecycle_tasks (
  id bigint generated by default as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  kind text not null check (kind in ('ONBOARDING','OFFBOARDING')),
  owner_role text not null check (owner_role in ('HR','IT','ACCOUNTS','MANAGER')),
  title text not null,
  due_date date,
  done boolean not null default false,
  done_by bigint references public.employees(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lifecycle_tasks_employee_idx on public.lifecycle_tasks (employee_id);

alter table public.lifecycle_tasks enable row level security;

drop policy if exists lifecycle_tasks_select on public.lifecycle_tasks;
create policy lifecycle_tasks_select on public.lifecycle_tasks for select to authenticated
  using (public.has_role('HR') or public.has_role('IT') or public.has_role('ACCOUNTS')
         or employee_id = public.current_employee_id()
         or public.is_in_reporting_line(employee_id));

drop policy if exists lifecycle_tasks_insert on public.lifecycle_tasks;
create policy lifecycle_tasks_insert on public.lifecycle_tasks for insert to authenticated
  with check (public.has_role('HR'));

drop policy if exists lifecycle_tasks_update on public.lifecycle_tasks;
create policy lifecycle_tasks_update on public.lifecycle_tasks for update to authenticated
  using (public.has_role('HR')
         or public.has_role(owner_role)
         or (owner_role = 'MANAGER' and public.is_in_reporting_line(employee_id)));

-- -----------------------------------------------------------------------------
-- 7. Salary revisions (joining, increments, promotions) — maker/checker
-- -----------------------------------------------------------------------------
create table if not exists public.salary_revisions (
  id bigint generated by default as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  revision_type text not null check (revision_type in ('JOINING','INCREMENT','PROMOTION','CORRECTION')),
  effective_from date not null,
  ctc_annual numeric(14,2) not null check (ctc_annual >= 0),
  basic_monthly numeric(12,2) not null default 0,
  hra_monthly numeric(12,2) not null default 0,
  special_monthly numeric(12,2) not null default 0,
  other_allowance_monthly numeric(12,2) not null default 0,
  tds_monthly numeric(12,2) not null default 0,
  pf_applicable boolean not null default true,
  increment_pct numeric(6,2),
  new_designation text,
  reason text,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','APPROVED','REJECTED')),
  proposed_by bigint references public.employees(id) on delete set null,
  approved_by bigint references public.employees(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists salary_revisions_employee_idx on public.salary_revisions (employee_id, effective_from desc);

alter table public.salary_revisions enable row level security;

drop policy if exists salary_revisions_select on public.salary_revisions;
create policy salary_revisions_select on public.salary_revisions for select to authenticated
  using (public.has_role('ACCOUNTS') or public.has_role('CEO')
         or (employee_id = public.current_employee_id() and status = 'APPROVED'));

drop policy if exists salary_revisions_insert on public.salary_revisions;
create policy salary_revisions_insert on public.salary_revisions for insert to authenticated
  with check (
    status = 'PROPOSED'
    and proposed_by = public.current_employee_id()
    and (public.has_role('ACCOUNTS') or (public.has_role('HR') and revision_type = 'JOINING'))
  );

drop policy if exists salary_revisions_update on public.salary_revisions;
create policy salary_revisions_update on public.salary_revisions for update to authenticated
  using (public.has_role('ACCOUNTS') or public.has_role('CEO'))
  with check (public.has_role('ACCOUNTS') or public.has_role('CEO'));

create or replace function public.enforce_salary_maker_checker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> old.status and new.status in ('APPROVED', 'REJECTED') then
    if auth.uid() is not null and old.proposed_by = public.current_employee_id() then
      raise exception 'Maker-checker: the person who proposed a salary revision cannot approve or reject it';
    end if;
    if auth.uid() is not null and old.employee_id = public.current_employee_id() then
      raise exception 'You cannot approve your own salary revision';
    end if;
    new.approved_by := public.current_employee_id();
    new.approved_at := now();
  end if;
  return new;
end $$;

drop trigger if exists salary_revisions_maker_checker on public.salary_revisions;
create trigger salary_revisions_maker_checker
  before update on public.salary_revisions
  for each row execute function public.enforce_salary_maker_checker();

-- -----------------------------------------------------------------------------
-- 8. Attendance-based payroll entries
-- -----------------------------------------------------------------------------
create table if not exists public.payroll_entries (
  id bigint generated by default as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  calendar_days int not null default 0,
  payable_days numeric(5,2) not null default 0,
  present_days numeric(5,2) not null default 0,
  paid_leave_days numeric(5,2) not null default 0,
  holiday_days numeric(5,2) not null default 0,
  week_off_days numeric(5,2) not null default 0,
  lop_days numeric(5,2) not null default 0,
  late_marks int not null default 0,
  earnings jsonb not null default '[]'::jsonb,
  deductions jsonb not null default '[]'::jsonb,
  employer_contributions jsonb not null default '[]'::jsonb,
  gross_earnings numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,
  net_pay numeric(14,2) not null default 0,
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','PUBLISHED')),
  revision_id bigint references public.salary_revisions(id) on delete set null,
  computed_by bigint references public.employees(id) on delete set null,
  computed_at timestamptz not null default now(),
  published_at timestamptz,
  unique (employee_id, year, month)
);

alter table public.payroll_entries enable row level security;

drop policy if exists payroll_entries_select on public.payroll_entries;
create policy payroll_entries_select on public.payroll_entries for select to authenticated
  using (public.has_role('ACCOUNTS')
         or (employee_id = public.current_employee_id() and status = 'PUBLISHED'));

drop policy if exists payroll_entries_write on public.payroll_entries;
create policy payroll_entries_write on public.payroll_entries for all to authenticated
  using (public.has_role('ACCOUNTS')) with check (public.has_role('ACCOUNTS'));

-- Published payslips are immutable; revert to DRAFT is not allowed.
create or replace function public.protect_published_payroll()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'PUBLISHED' then
    raise exception 'Payslip for %/% is already published and cannot be changed', old.month, old.year;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists payroll_entries_protect on public.payroll_entries;
create trigger payroll_entries_protect
  before update or delete on public.payroll_entries
  for each row execute function public.protect_published_payroll();

-- -----------------------------------------------------------------------------
-- 9. Hierarchy enforcement: only the reporting line (or HR) approves
-- -----------------------------------------------------------------------------
create or replace function public.enforce_leave_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me bigint := public.current_employee_id();
begin
  if auth.uid() is null then
    return new; -- service role / backend jobs
  end if;

  if new.status is distinct from old.status
     or new.current_level is distinct from old.current_level
     or new.current_approver_id is distinct from old.current_approver_id then

    if old.employee_id = me then
      if new.status in ('WITHDRAWN', 'CANCELLED') and old.status = 'PENDING' then
        return new;
      end if;
      raise exception 'You cannot approve or reject your own leave request';
    end if;

    if old.status <> 'PENDING' then
      raise exception 'This leave request is already %', old.status;
    end if;

    if old.current_approver_id = me or public.has_role('HR') then
      return new;
    end if;

    raise exception 'Only the current approver in the reporting line (or HR) can action this request';
  end if;
  return new;
end $$;

drop trigger if exists leave_requests_enforce_approval on public.leave_requests;
create trigger leave_requests_enforce_approval
  before update on public.leave_requests
  for each row execute function public.enforce_leave_approval();

create or replace function public.enforce_regularization_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me bigint := public.current_employee_id();
begin
  if auth.uid() is null or new.status is not distinct from old.status then
    return new;
  end if;
  if old.employee_id = me then
    raise exception 'You cannot approve your own attendance regularization';
  end if;
  if public.is_in_reporting_line(old.employee_id, me) or public.has_role('HR') then
    return new;
  end if;
  raise exception 'Only the reporting manager (or HR) can action this regularization';
end $$;

drop trigger if exists attendance_regularizations_enforce_approval on public.attendance_regularizations;
create trigger attendance_regularizations_enforce_approval
  before update on public.attendance_regularizations
  for each row execute function public.enforce_regularization_approval();

-- -----------------------------------------------------------------------------
-- 10. Leave balances maintained server-side (no client writes needed)
--     PENDING   → reserve days
--     APPROVED  → move reserved → used
--     REJECTED / WITHDRAWN / CANCELLED → release (or give back used days)
-- -----------------------------------------------------------------------------
create or replace function public.sync_leave_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bal_id bigint;
  days numeric := coalesce(new.total_days, 0);
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select id into bal_id
    from leave_balances
   where employee_id = new.employee_id and leave_type_id = new.leave_type_id
   order by fy_year desc
   limit 1;
  if bal_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'PENDING' then
      update leave_balances set reserved = reserved + days where id = bal_id;
    elsif new.status = 'APPROVED' then
      update leave_balances set used = used + days where id = bal_id;
    end if;
  elsif old.status = 'PENDING' and new.status = 'APPROVED' then
    update leave_balances set reserved = greatest(0, reserved - days), used = used + days where id = bal_id;
  elsif old.status = 'PENDING' and new.status in ('REJECTED', 'WITHDRAWN', 'CANCELLED') then
    update leave_balances set reserved = greatest(0, reserved - days) where id = bal_id;
  elsif old.status = 'APPROVED' and new.status in ('CANCELLED', 'WITHDRAWN') then
    update leave_balances set used = greatest(0, used - days) where id = bal_id;
  end if;
  return new;
end $$;

drop trigger if exists leave_requests_sync_balance on public.leave_requests;
create trigger leave_requests_sync_balance
  after insert or update of status on public.leave_requests
  for each row execute function public.sync_leave_balance();

-- -----------------------------------------------------------------------------
-- 11. Read access on existing tables needed by the hierarchy & payroll.
--     These policies only ADD access (permissive); they have no effect on a
--     table that does not have RLS enabled.
-- -----------------------------------------------------------------------------
drop policy if exists hierarchy_attendance_select on public.attendance_records;
create policy hierarchy_attendance_select on public.attendance_records for select to authenticated
  using (employee_id = public.current_employee_id()
         or public.has_role('HR') or public.has_role('ACCOUNTS') or public.has_role('CEO')
         or public.is_in_reporting_line(employee_id));

drop policy if exists hierarchy_leave_select on public.leave_requests;
create policy hierarchy_leave_select on public.leave_requests for select to authenticated
  using (employee_id = public.current_employee_id()
         or current_approver_id = public.current_employee_id()
         or public.has_role('HR') or public.has_role('ACCOUNTS')
         or public.is_in_reporting_line(employee_id));

drop policy if exists hierarchy_leave_update on public.leave_requests;
create policy hierarchy_leave_update on public.leave_requests for update to authenticated
  using (employee_id = public.current_employee_id()
         or current_approver_id = public.current_employee_id()
         or public.has_role('HR'))
  -- Forwarding hands the row to the next approver; enforce_leave_approval validates the change.
  with check (true);

drop policy if exists hierarchy_regularization_select on public.attendance_regularizations;
create policy hierarchy_regularization_select on public.attendance_regularizations for select to authenticated
  using (employee_id = public.current_employee_id()
         or public.has_role('HR')
         or public.is_in_reporting_line(employee_id));

drop policy if exists hierarchy_regularization_update on public.attendance_regularizations;
create policy hierarchy_regularization_update on public.attendance_regularizations for update to authenticated
  using (public.has_role('HR') or public.is_in_reporting_line(employee_id))
  with check (true);

drop policy if exists everyone_reads_holidays on public.holidays;
create policy everyone_reads_holidays on public.holidays for select to authenticated using (true);

drop policy if exists everyone_reads_leave_types on public.leave_types;
create policy everyone_reads_leave_types on public.leave_types for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- 12. Grants (Supabase usually grants these by default; explicit for clarity)
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on
  public.employee_profiles,
  public.assets,
  public.asset_assignments,
  public.it_requests,
  public.lifecycle_tasks,
  public.salary_revisions,
  public.payroll_entries
to authenticated;
