-- -----------------------------------------------------------------------------
-- 20261024000006_resignations_and_fnf.sql
-- Feature 8: Resignation Workflow & Full & Final (F&F) Settlement
-- -----------------------------------------------------------------------------

-- 1. Create resignations table
create table if not exists public.resignations (
  id bigserial primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  submitted_date date not null default current_date,
  reason text not null,
  requested_lwd date not null,
  confirmed_lwd date,
  notice_days integer not null default 30,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED', 'ACCEPTED_BY_MANAGER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
  manager_comments text,
  hr_comments text,
  actioned_by_manager_at timestamptz,
  actioned_by_hr_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.resignations enable row level security;

-- Policies for resignations
drop policy if exists select_resignations on public.resignations;
create policy select_resignations on public.resignations
  for select to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.has_role('HR')
    or public.has_role('CEO')
    or public.is_in_reporting_line(employee_id)
  );

drop policy if exists insert_own_resignation on public.resignations;
create policy insert_own_resignation on public.resignations
  for insert to authenticated
  with check (employee_id = public.current_employee_id());

drop policy if exists update_resignations on public.resignations;
create policy update_resignations on public.resignations
  for update to authenticated
  using (
    (employee_id = public.current_employee_id() and status = 'SUBMITTED')
    or public.has_role('HR')
    or public.is_in_reporting_line(employee_id)
  )
  with check (true);

-- Trigger function for resignation workflow & emails
create or replace function public.handle_resignation_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  emp_name text;
  emp_email text;
  mgr_email text;
  mgr_id bigint;
  hr_email text := 'hr@secondmedic.com';
begin
  if auth.uid() is null then
    return new;
  end if;

  select full_name, official_email, manager_id
  into emp_name, emp_email, mgr_id
  from public.employees where id = new.employee_id;

  if mgr_id is not null then
    select official_email into mgr_email from public.employees where id = mgr_id;
  end if;

  if TG_OP = 'INSERT' then
    -- Notify Manager and HR
    if mgr_email is not null then
      perform public.queue_email(
        'resignation_submitted',
        mgr_email,
        hr_email,
        'Resignation Submitted: ' || coalesce(emp_name, 'Employee'),
        jsonb_build_object(
          'employeeName', emp_name,
          'requestedLwd', new.requested_lwd,
          'reason', new.reason,
          'actionUrl', '/team-approvals'
        ),
        'resignation_submit:' || new.id::text
      );
    end if;

    return new;
  end if;

  if TG_OP = 'UPDATE' and new.status is distinct from old.status then
    new.updated_at := now();

    if new.status = 'ACCEPTED_BY_MANAGER' then
      new.actioned_by_manager_at := now();
      -- Notify HR that manager has accepted
      perform public.queue_email(
        'resignation_manager_accepted',
        hr_email,
        null,
        'Resignation Accepted by Manager: ' || coalesce(emp_name, 'Employee'),
        jsonb_build_object(
          'employeeName', emp_name,
          'requestedLwd', new.requested_lwd,
          'comments', new.manager_comments,
          'actionUrl', '/lifecycle'
        ),
        'resignation_mgr_acc:' || new.id::text
      );

    elsif new.status = 'ACCEPTED' then
      new.actioned_by_hr_at := now();
      -- When HR accepts, set employee status to NOTICE_PERIOD
      update public.employees
      set status = 'NOTICE_PERIOD'
      where id = new.employee_id;

      -- Notify employee
      if emp_email is not null then
        perform public.queue_email(
          'resignation_accepted',
          emp_email,
          mgr_email,
          'Resignation Accepted - Notice Period Initiated',
          jsonb_build_object(
            'employeeName', emp_name,
            'confirmedLwd', coalesce(new.confirmed_lwd, new.requested_lwd),
            'comments', new.hr_comments
          ),
          'resignation_acc:' || new.id::text
        );
      end if;

    elsif new.status = 'REJECTED' then
      if emp_email is not null then
        perform public.queue_email(
          'resignation_rejected',
          emp_email,
          null,
          'Resignation Decision Update',
          jsonb_build_object(
            'employeeName', emp_name,
            'comments', coalesce(new.hr_comments, new.manager_comments)
          ),
          'resignation_rej:' || new.id::text
        );
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists resignations_workflow_trigger on public.resignations;
create trigger resignations_workflow_trigger
  before insert or update on public.resignations
  for each row execute function public.handle_resignation_workflow();

-- 2. Create fnf_settlements table
create table if not exists public.fnf_settlements (
  id bigserial primary key,
  resignation_id bigint references public.resignations(id) on delete set null,
  employee_id bigint not null references public.employees(id) on delete cascade,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  last_working_day date not null,
  payable_days numeric not null default 0,
  per_day_basic numeric not null default 0,
  salary_due numeric not null default 0,
  leave_encashment_days numeric not null default 0,
  leave_encashment_amount numeric not null default 0,
  gratuity_amount numeric not null default 0,
  bonus_amount numeric not null default 0,
  notice_shortfall_days numeric not null default 0,
  notice_recovery_amount numeric not null default 0,
  asset_recovery_amount numeric not null default 0,
  other_recoveries numeric not null default 0,
  other_payables numeric not null default 0,
  net_payable numeric not null default 0,
  remarks text,
  prepared_by bigint references public.employees(id),
  prepared_at timestamptz,
  approved_by bigint references public.employees(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.fnf_settlements enable row level security;

-- Policies for fnf_settlements
drop policy if exists select_fnf_settlements on public.fnf_settlements;
create policy select_fnf_settlements on public.fnf_settlements
  for select to authenticated
  using (
    (employee_id = public.current_employee_id() and status = 'APPROVED')
    or public.has_role('ACCOUNTS')
    or public.has_role('CEO')
    or public.has_role('HR')
  );

drop policy if exists accounts_manages_fnf on public.fnf_settlements;
create policy accounts_manages_fnf on public.fnf_settlements
  for insert to authenticated
  with check (public.has_role('ACCOUNTS') or public.has_role('CEO'));

drop policy if exists accounts_updates_draft_fnf on public.fnf_settlements;
create policy accounts_updates_draft_fnf on public.fnf_settlements
  for update to authenticated
  using (
    (public.has_role('ACCOUNTS') and status in ('DRAFT', 'SUBMITTED'))
    or public.has_role('CEO')
  )
  with check (
    (public.has_role('ACCOUNTS') and status in ('DRAFT', 'SUBMITTED'))
    or public.has_role('CEO')
  );

-- Enforce CEO-only approval for F&F
create or replace function public.enforce_fnf_maker_checker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  emp_name text;
  emp_email text;
  ceo_email text := 'durgesh.mishra@secondmedic.com';
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.status = 'APPROVED' and old.status is distinct from 'APPROVED' then
    if not (public.has_role('CEO') or public.has_role('DIRECTOR')) then
      raise exception 'Only the CEO or Director can approve Full & Final settlements';
    end if;

    new.approved_by := coalesce(public.current_employee_id(), new.approved_by);
    new.approved_at := now();

    -- Notify Employee, HR and Accounts
    select full_name, official_email into emp_name, emp_email
    from public.employees where id = new.employee_id;

    if emp_email is not null then
      perform public.queue_email(
        'fnf_approved',
        emp_email,
        'accounts@secondmedic.com',
        'Full & Final Settlement Approved',
        jsonb_build_object(
          'employeeName', emp_name,
          'netPayable', new.net_payable,
          'actionUrl', '/fnf'
        ),
        'fnf_approved:' || new.id::text
      );
    end if;

  elsif new.status = 'SUBMITTED' and old.status = 'DRAFT' then
    new.prepared_by := coalesce(public.current_employee_id(), new.prepared_by);
    new.prepared_at := now();

    -- Notify CEO that F&F is ready for review
    select full_name into emp_name from public.employees where id = new.employee_id;
    perform public.queue_email(
      'fnf_ready_for_approval',
      ceo_email,
      null,
      'F&F Settlement Pending Approval: ' || coalesce(emp_name, 'Employee'),
      jsonb_build_object(
        'employeeName', emp_name,
        'netPayable', new.net_payable,
        'actionUrl', '/ceo-approvals'
      ),
      'fnf_ready:' || new.id::text
    );
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists fnf_maker_checker_trigger on public.fnf_settlements;
create trigger fnf_maker_checker_trigger
  before update on public.fnf_settlements
  for each row execute function public.enforce_fnf_maker_checker();

grant select, insert, update on public.resignations to authenticated;
grant select, insert, update on public.fnf_settlements to authenticated;
