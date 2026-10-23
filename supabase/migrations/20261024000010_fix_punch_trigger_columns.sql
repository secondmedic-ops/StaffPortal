-- -----------------------------------------------------------------------------
-- 20261024000010_fix_punch_trigger_columns.sql
-- Fix column references in enforce_attendance_punch_rules (work_date, in_lat, in_lng)
-- -----------------------------------------------------------------------------

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
