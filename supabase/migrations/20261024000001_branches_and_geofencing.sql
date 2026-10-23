-- -----------------------------------------------------------------------------
-- 20261024000001_branches_and_geofencing.sql
-- F1. Branch master & Feature 2: Work mode and 100m geofencing
-- -----------------------------------------------------------------------------

-- 1. Create branches table
create table if not exists public.branches (
  id bigserial primary key,
  name text not null unique,
  code text not null unique,
  address text,
  city text,
  state text,
  latitude double precision not null default 0.0,
  longitude double precision not null default 0.0,
  geofence_radius_m integer not null default 100,
  active boolean not null default true,
  admin_employee_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on branches
alter table public.branches enable row level security;

-- Policies for branches
drop policy if exists everyone_reads_branches on public.branches;
create policy everyone_reads_branches on public.branches
  for select to authenticated
  using (true);

drop policy if exists hr_manages_branches on public.branches;
create policy hr_manages_branches on public.branches
  for all to authenticated
  using (public.has_role('HR') or public.has_role('SYSTEM_ADMIN'))
  with check (public.has_role('HR') or public.has_role('SYSTEM_ADMIN'));

-- 2. Add branch_id to employees
alter table public.employees
  add column if not exists branch_id bigint references public.branches(id) on delete set null;

-- 3. Seed default branches if empty
insert into public.branches (name, code, address, city, state, latitude, longitude, geofence_radius_m, active)
values
  ('Corporate HQ', 'HQ', 'SecondMedic Corporate Headquarters, Mumbai', 'Mumbai', 'Maharashtra', 19.1136, 72.8697, 100, true),
  ('Pune Branch', 'PUN', 'FC Road, Pune', 'Pune', 'Maharashtra', 18.5204, 73.8567, 100, true)
on conflict (name) do update
set
  code = excluded.code,
  address = coalesce(branches.address, excluded.address),
  city = coalesce(branches.city, excluded.city),
  state = coalesce(branches.state, excluded.state);

-- Link existing employees to Corporate HQ if branch_id is null
do $$
declare
  hq_id bigint;
begin
  select id into hq_id from public.branches where name = 'Corporate HQ' limit 1;
  if hq_id is not null then
    update public.employees
    set branch_id = hq_id,
        work_location = coalesce(work_location, 'Corporate HQ')
    where branch_id is null;
  end if;
end $$;

-- 4. Haversine distance function in meters
create or replace function public.calculate_distance_m(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
) returns numeric
language plpgsql
immutable
as $$
declare
  r double precision := 6371000.0; -- Earth radius in meters
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
begin
  if lat1 is null or lon1 is null or lat2 is null or lon2 is null then
    return null;
  end if;

  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);

  a := sin(dlat / 2.0) * sin(dlat / 2.0) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon / 2.0) * sin(dlon / 2.0);

  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));

  return round((r * c)::numeric, 1);
end $$;

-- 5. Add work_mode and field-visit columns to attendance_records
alter table public.attendance_records
  add column if not exists work_mode text not null default 'OFFICE' check (work_mode in ('OFFICE', 'WFH', 'FIELD')),
  add column if not exists visit_location text,
  add column if not exists visit_purpose text,
  add column if not exists visit_client text,
  add column if not exists distance_m numeric;

-- 6. Server-side geofencing trigger on attendance_records
create or replace function public.enforce_geofence_punch()
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
begin
  -- Bypass for service role / automated test scripts without auth uid
  if auth.uid() is null then
    return new;
  end if;

  -- Only check on punch_in
  if new.punch_in is null then
    return new;
  end if;

  if new.work_mode = 'OFFICE' then
    -- Check if branch coords exist
    select b.latitude, b.longitude, b.geofence_radius_m, b.name
    into b_lat, b_lon, b_radius, b_name
    from public.employees e
    join public.branches b on b.id = e.branch_id
    where e.id = new.employee_id and b.active = true;

    if found and b_lat is not null and b_lat != 0.0 and b_lon is not null and b_lon != 0.0 then
      if new.latitude is null or new.longitude is null then
        raise exception 'GPS coordinates are required for Office punch-in';
      end if;

      dist := public.calculate_distance_m(new.latitude, new.longitude, b_lat, b_lon);
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

drop trigger if exists attendance_records_enforce_geofence on public.attendance_records;
create trigger attendance_records_enforce_geofence
  before insert or update of punch_in, work_mode on public.attendance_records
  for each row execute function public.enforce_geofence_punch();

grant select, insert, update, delete on public.branches to authenticated;
