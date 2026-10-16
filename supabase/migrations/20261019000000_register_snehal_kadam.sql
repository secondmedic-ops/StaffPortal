-- =============================================================================
-- Migration / Backend Registration: Snehal Lalit Kadam (HR Staff & Laptop Asset)
-- =============================================================================

do $$
declare
  v_dept_id bigint;
  v_emp_id bigint;
  v_asset_id bigint;
  v_emp_code text := 'HR-002';
begin
  -- 1. Identify HR Department
  select id into v_dept_id from public.departments where name ilike '%Human Resources%' limit 1;
  if v_dept_id is null then
    select id into v_dept_id from public.departments order by id limit 1;
  end if;

  -- 2. Check if employee already exists, or generate next available emp_code
  select id into v_emp_id from public.employees where official_email = 'snehal.kadam@gmail.com';
  
  if v_emp_id is null then
    -- Generate unique emp_code if HR-002 already taken
    if exists (select 1 from public.employees where emp_code = v_emp_code) then
      v_emp_code := 'HR-' || lpad((coalesce((select count(*) from public.employees where department_id = v_dept_id), 0) + 1)::text, 3, '0');
    end if;

    insert into public.employees (
      emp_code,
      full_name,
      official_email,
      personal_email,
      mobile,
      phone,
      department_id,
      designation,
      employment_type,
      date_of_joining,
      work_location,
      status
    ) values (
      v_emp_code,
      'Snehal Lalit Kadam',
      'snehal.kadam@gmail.com',
      'snehal.kadam@gmail.com',
      '8104478856',
      '8104478856',
      v_dept_id,
      'HR Executive',
      'FULL_TIME',
      '2025-12-22',
      'Corporate HQ',
      'ACTIVE'
    )
    returning id into v_emp_id;
  else
    -- Update existing record
    update public.employees set
      full_name = 'Snehal Lalit Kadam',
      mobile = '8104478856',
      phone = '8104478856',
      department_id = coalesce(department_id, v_dept_id),
      designation = coalesce(nullif(designation, ''), 'HR Executive'),
      employment_type = 'FULL_TIME',
      date_of_joining = coalesce(date_of_joining, '2025-12-22'),
      status = 'ACTIVE'
    where id = v_emp_id;
  end if;

  -- 3. Personal Profile (DOB: 06-10-1994)
  insert into public.employee_profiles (
    employee_id,
    date_of_birth
  ) values (
    v_emp_id,
    '1994-10-06'
  )
  on conflict (employee_id) do update set
    date_of_birth = excluded.date_of_birth;

  -- 4. Assign Roles: HR and EMPLOYEE
  insert into public.employee_roles (employee_id, role)
  values 
    (v_emp_id, 'HR'::public.app_role),
    (v_emp_id, 'EMPLOYEE'::public.app_role)
  on conflict (employee_id, role) do nothing;

  -- 5. System User registration
  insert into public.system_users (employee_id)
  values (v_emp_id)
  on conflict (employee_id) do nothing;

  -- 6. IT Asset Registration: Dell Latitude 7480 Laptop (Serial: 3PJL7H2)
  select id into v_asset_id from public.assets where serial_number = '3PJL7H2';
  
  if v_asset_id is null then
    insert into public.assets (
      asset_tag,
      category,
      brand,
      model,
      serial_number,
      specs,
      status,
      condition,
      assigned_to,
      assigned_at,
      acknowledged_at,
      notes
    ) values (
      'SM-LT-3PJL7H2',
      'LAPTOP',
      'Dell Inc.',
      'Latitude 7480',
      '3PJL7H2',
      'CPU: Intel(R) Core(TM) i5-6300U @ 2.40GHz | RAM: 8GB | Disk: C: 237GB (free 165GB) | OS: Windows 11 Pro 10.0.22631 | Hostname: DESKTOP-AUG9RV4 | User: Dell | Antivirus: Windows Defender | MAC: Wi-Fi A0-AF-BD-AD-1B-C3, Eth A4-4C-C8-0F-53-16',
      'ASSIGNED',
      'GOOD',
      v_emp_id,
      '2025-12-22 10:00:00+05:30',
      now(),
      'Assigned to HR Executive Snehal Lalit Kadam'
    )
    returning id into v_asset_id;
  else
    update public.assets set
      assigned_to = v_emp_id,
      assigned_at = coalesce(assigned_at, '2025-12-22 10:00:00+05:30'),
      status = 'ASSIGNED',
      specs = 'CPU: Intel(R) Core(TM) i5-6300U @ 2.40GHz | RAM: 8GB | Disk: C: 237GB (free 165GB) | OS: Windows 11 Pro 10.0.22631 | Hostname: DESKTOP-AUG9RV4 | User: Dell | Antivirus: Windows Defender | MAC: Wi-Fi A0-AF-BD-AD-1B-C3, Eth A4-4C-C8-0F-53-16'
    where id = v_asset_id;
  end if;

  -- 7. Asset Assignment History
  if not exists (select 1 from public.asset_assignments where asset_id = v_asset_id and employee_id = v_emp_id) then
    insert into public.asset_assignments (
      asset_id,
      employee_id,
      assigned_at,
      notes
    ) values (
      v_asset_id,
      v_emp_id,
      '2025-12-22 10:00:00+05:30',
      'Initial onboarding hardware issue'
    );
  end if;

  -- 8. Open standard leave balances for FY 2025-2026 and 2026-2027
  insert into public.leave_balances (employee_id, leave_type_id, fy_year, opening, accrued, used, reserved, encashed, lapsed)
  select 
    v_emp_id,
    lt.id,
    fy.year_label,
    case when lt.accrual_mode = 'MONTHLY' then 0 else lt.annual_quota end,
    0, 0, 0, 0, 0
  from public.leave_types lt
  cross join (values ('2025-2026'), ('2026-2027')) as fy(year_label)
  where lt.is_active = true and lt.code <> 'LOP'
  on conflict (employee_id, leave_type_id, fy_year) do nothing;

  raise notice 'Successfully registered Snehal Lalit Kadam (ID: %, Emp Code: %) with HR role and assigned Dell Latitude 7480.', v_emp_id, v_emp_code;
end $$;

