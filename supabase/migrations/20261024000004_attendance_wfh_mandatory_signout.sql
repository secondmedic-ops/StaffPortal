-- -----------------------------------------------------------------------------
-- 20261024000004_attendance_wfh_mandatory_signout.sql
-- Feature 2: WFH Requests & Feature 3: Mandatory Sign-Out Trigger
-- -----------------------------------------------------------------------------

-- 1. Create wfh_requests table
create table if not exists public.wfh_requests (
  id bigserial primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  reason text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  approver_id bigint references public.employees(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wfh_date_order check (to_date >= from_date)
);

-- Enable RLS
alter table public.wfh_requests enable row level security;

-- Policies for wfh_requests
drop policy if exists select_wfh_requests on public.wfh_requests;
create policy select_wfh_requests on public.wfh_requests
  for select to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.has_role('HR')
    or public.is_in_reporting_line(employee_id)
  );

drop policy if exists insert_own_wfh_requests on public.wfh_requests;
create policy insert_own_wfh_requests on public.wfh_requests
  for insert to authenticated
  with check (employee_id = public.current_employee_id());

drop policy if exists update_wfh_requests on public.wfh_requests;
create policy update_wfh_requests on public.wfh_requests
  for update to authenticated
  using (
    (employee_id = public.current_employee_id() and status = 'PENDING')
    or public.has_role('HR')
    or public.is_in_reporting_line(employee_id)
  )
  with check (true);

-- 2. Trigger function to enforce WFH approvals and queue emails
create or replace function public.enforce_wfh_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me bigint := public.current_employee_id();
  emp_name text;
  emp_email text;
  mgr_email text;
  mgr_id bigint;
begin
  if auth.uid() is null then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    -- On insert, notify reporting manager
    select e.full_name, e.official_email, m.official_email, e.manager_id
    into emp_name, emp_email, mgr_email, mgr_id
    from public.employees e
    left join public.employees m on m.id = e.manager_id
    where e.id = new.employee_id;

    if mgr_email is not null then
      perform public.queue_email(
        'wfh_applied',
        mgr_email,
        null,
        'WFH Request: ' || coalesce(emp_name, 'Employee'),
        jsonb_build_object(
          'employeeName', emp_name,
          'fromDate', new.from_date,
          'toDate', new.to_date,
          'reason', new.reason,
          'actionUrl', '/team-approvals'
        ),
        'wfh_apply:' || new.id::text
      );
    end if;

    return new;
  end if;

  -- On update: if status changed
  if new.status is distinct from old.status then
    if old.employee_id = me and new.status = 'CANCELLED' and old.status = 'PENDING' then
      return new;
    end if;

    if old.employee_id = me then
      raise exception 'You cannot approve or reject your own WFH request';
    end if;

    if not (public.is_in_reporting_line(old.employee_id) or public.has_role('HR')) then
      raise exception 'Only the reporting authority (or HR) can action this WFH request';
    end if;

    new.approver_id := coalesce(me, new.approver_id);
    new.approved_at := now();
    new.updated_at := now();

    -- Notify employee of decision
    select e.full_name, e.official_email
    into emp_name, emp_email
    from public.employees e
    where e.id = old.employee_id;

    if emp_email is not null then
      perform public.queue_email(
        'wfh_decided',
        emp_email,
        null,
        'WFH Request ' || new.status,
        jsonb_build_object(
          'employeeName', emp_name,
          'status', new.status,
          'fromDate', new.from_date,
          'toDate', new.to_date,
          'rejectionReason', new.rejection_reason
        ),
        'wfh_decision:' || new.id::text || ':' || new.status
      );
    end if;
  end if;

  return new;
end $$;

drop trigger if exists wfh_requests_enforce on public.wfh_requests;
create trigger wfh_requests_enforce
  before insert or update on public.wfh_requests
  for each row execute function public.enforce_wfh_approval();

-- 3. Enhance enforce_geofence_punch() to also enforce WFH approval and mandatory sign-out
create or replace function public.enforce_attendance_punch_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b_lat double precision;
  b_lon double precision;
  b_radius integer;
  b_name text;
  dist numeric;
  unclosed_date date;
  has_wfh boolean;
begin
  -- Bypass for service role / automated test scripts without auth uid
  if auth.uid() is null then
    return new;
  end if;

  -- Only check on punch_in
  if new.punch_in is null then
    return new;
  end if;

  -- Rule A: Feature 3 Mandatory Sign-Out Check
  -- Block punch-in if an earlier working day has punch_in without punch_out and no pending/approved regularization
  select a.work_date into unclosed_date
  from public.attendance_records a
  where a.employee_id = new.employee_id
    and a.work_date < new.work_date
    and a.punch_in is not null
    and a.punch_out is null
    and not exists (
      select 1 from public.attendance_regularizations r
      where r.employee_id = new.employee_id
        and r.work_date = a.work_date
        and r.status in ('PENDING', 'APPROVED')
    )
  order by a.work_date desc
  limit 1;

  if unclosed_date is not null then
    raise exception 'Missed sign-out on %. You must submit an attendance regularization for % before punching in today.',
      unclosed_date, unclosed_date;
  end if;

  -- Rule B: Feature 2 Work Mode validation
  if new.work_mode = 'WFH' then
    select exists (
      select 1 from public.wfh_requests
      where employee_id = new.employee_id
        and status = 'APPROVED'
        and new.work_date >= from_date
        and new.work_date <= to_date
    ) into has_wfh;

    if not has_wfh then
      raise exception 'WFH punch-in is blocked without an approved WFH request for today. Please apply for WFH in advance.';
    end if;

  elsif new.work_mode = 'OFFICE' then
    select b.latitude, b.longitude, b.geofence_radius_m, b.name
    into b_lat, b_lon, b_radius, b_name
    from public.employees e
    join public.branches b on b.id = e.branch_id
    where e.id = new.employee_id and b.active = true;

    if found and b_lat is not null and b_lat != 0.0 and b_lon is not null and b_lon != 0.0 then
      if new.in_lat is null or new.in_lng is null then
        raise exception 'GPS coordinates are required for Office punch-in';
      end if;

      dist := public.calculate_distance_m(new.in_lat, new.in_lng, b_lat, b_lon);
      new.distance_m := dist;

      if dist > coalesce(b_radius, 100) then
        raise exception 'Geofence check failed: You are % m away from % (allowed radius: % m).',
          round(dist)::integer, b_name, coalesce(b_radius, 100);
      end if;
    end if;

  elsif new.work_mode = 'FIELD' then
    if new.visit_location is null or trim(new.visit_location) = '' then
      raise exception 'Visit location is required for Field visit punch-in';
    end if;
    if new.visit_purpose is null or trim(new.visit_purpose) = '' then
      raise exception 'Visit purpose is required for Field visit punch-in';
    end if;
  end if;

  return new;
end $$;

-- Re-point the trigger to enforce_attendance_punch_rules
drop trigger if exists attendance_records_enforce_geofence on public.attendance_records;
drop trigger if exists attendance_records_enforce_rules on public.attendance_records;
create trigger attendance_records_enforce_rules
  before insert or update of punch_in, work_mode on public.attendance_records
  for each row execute function public.enforce_attendance_punch_rules();

grant select, insert, update on public.wfh_requests to authenticated;
