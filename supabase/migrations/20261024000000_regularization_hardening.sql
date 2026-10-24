-- =============================================================================
-- Attendance regularization ("time update") hardening
--  * approver_remarks: the team lead's note, mandatory when rejecting
--  * a request can be actioned once (PENDING → APPROVED / REJECTED only)
--  * no requests or approvals for a month HR has already locked for payroll
--  * requests: 24h HH:MM times, out after in, not in the future,
--    one pending request per employee per day
-- Idempotent: safe to re-run.
-- =============================================================================

alter table public.attendance_regularizations add column if not exists approver_remarks text;

create index if not exists attendance_regularizations_pending_idx
  on public.attendance_regularizations (approver_id) where status = 'PENDING';

-- Older duplicates would block the unique index; keep it optional rather than failing the migration.
do $$ begin
  create unique index if not exists attendance_regularizations_one_pending_per_day
    on public.attendance_regularizations (employee_id, work_date) where status = 'PENDING';
exception when unique_violation then
  raise notice 'Duplicate pending regularizations exist; one-per-day index skipped (trigger still blocks new duplicates).';
end $$;

create or replace function public.is_attendance_month_locked(emp bigint, d date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from monthly_attendance_summaries s
     where s.employee_id = emp
       and s.year = extract(year from d)::int
       and s.month = extract(month from d)::int
       and s.locked
  )
$$;

create or replace function public.validate_regularization_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new; -- service role / backend jobs
  end if;
  if new.requested_in !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or new.requested_out !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Times must be in 24-hour HH:MM format';
  end if;
  if new.requested_out <= new.requested_in then
    raise exception 'Punch-out time must be after punch-in time';
  end if;
  if new.work_date > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'You cannot request a time update for a future date';
  end if;
  if public.is_attendance_month_locked(new.employee_id, new.work_date) then
    raise exception 'Attendance for this month is locked by HR for payroll';
  end if;
  if exists (select 1 from attendance_regularizations r
              where r.employee_id = new.employee_id and r.work_date = new.work_date and r.status = 'PENDING') then
    raise exception 'A time update for this date is already waiting for approval';
  end if;
  return new;
end $$;

drop trigger if exists attendance_regularizations_validate_insert on public.attendance_regularizations;
create trigger attendance_regularizations_validate_insert
  before insert on public.attendance_regularizations
  for each row execute function public.validate_regularization_request();

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
  if old.status <> 'PENDING' then
    raise exception 'This time update is already %', lower(old.status);
  end if;
  if new.status = 'REJECTED' and coalesce(btrim(new.approver_remarks), '') = '' then
    raise exception 'Remarks are required when rejecting a time update';
  end if;
  if new.status = 'APPROVED' and public.is_attendance_month_locked(old.employee_id, old.work_date) then
    raise exception 'Attendance for this month is locked by HR for payroll';
  end if;
  if public.is_in_reporting_line(old.employee_id, me) or public.has_role('HR') then
    return new;
  end if;
  raise exception 'Only the reporting manager (or HR) can action this regularization';
end $$;

-- Approval writes the requested times onto the day's attendance in the same
-- transaction, so a request is never "approved" without the attendance change.
-- Times are IST wall-clock; legacy "06:30 PM" style values are parsed by ::time.
create or replace function public.apply_approved_regularization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t_in timestamptz := (new.work_date + new.requested_in::time) at time zone 'Asia/Kolkata';
  t_out timestamptz := (new.work_date + new.requested_out::time) at time zone 'Asia/Kolkata';
  hours numeric := round((extract(epoch from (t_out - t_in)) / 3600)::numeric, 1);
  note text := 'Time updated, approved by '
               || coalesce((select full_name from employees where id = new.approver_id), 'HR')
               || ': ' || new.reason;
  att_id bigint;
begin
  if new.status <> 'APPROVED' or old.status = 'APPROVED' then
    return new;
  end if;
  if t_out <= t_in then
    raise exception 'Punch-out time must be after punch-in time';
  end if;

  insert into attendance_records as a (employee_id, work_date, punch_in, punch_out, worked_hours, is_regularized, status, remarks)
  values (new.employee_id, new.work_date, t_in, t_out, hours, true, 'PRESENT', note)
  on conflict (employee_id, work_date) do update
     set punch_in = excluded.punch_in,
         punch_out = excluded.punch_out,
         worked_hours = excluded.worked_hours,
         is_regularized = true,
         status = 'PRESENT',
         remarks = excluded.remarks,
         updated_at = now()
  returning a.id into att_id;

  if new.attendance_id is null then
    update attendance_regularizations set attendance_id = att_id where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists attendance_regularizations_apply_approval on public.attendance_regularizations;
create trigger attendance_regularizations_apply_approval
  after update of status on public.attendance_regularizations
  for each row execute function public.apply_approved_regularization();
