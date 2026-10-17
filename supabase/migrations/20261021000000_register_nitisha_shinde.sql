-- =============================================================================
-- Migration / Backend Registration: Nitisha Anant Shinde (Staff & HP Laptop Asset)
-- Official Email: nitisha.shinde@secondmedic.com
-- Personal Email: nitisha.shinde@gmail.com
-- =============================================================================

do $$
declare
  v_dept_id bigint;
  v_emp_id bigint;
  v_asset_id bigint;
  v_emp_code text;
begin
  -- 1. Identify Department (Operations or first available department)
  select id into v_dept_id from public.departments where name ilike '%Operations%' limit 1;
  if v_dept_id is null then
    select id into v_dept_id from public.departments order by id limit 1;
  end if;

  -- 2. Check if employee already exists under either official or personal email
  select id into v_emp_id 
  from public.employees 
  where official_email in ('nitisha.shinde@secondmedic.com', 'nitisha.shinde@gmail.com')
     or personal_email = 'nitisha.shinde@gmail.com'
  limit 1;
  
  if v_emp_id is null then
    v_emp_code := 'SM-' || lpad((coalesce((select count(*) from public.employees), 0) + 1)::text, 3, '0');
    while exists (select 1 from public.employees where emp_code = v_emp_code) loop
      v_emp_code := 'SM-' || lpad((substring(v_emp_code from 4)::int + 1)::text, 3, '0');
    end loop;

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
      'Nitisha Anant Shinde',
      'nitisha.shinde@secondmedic.com',
      'nitisha.shinde@gmail.com',
      '9082679523',
      '9082679523',
      v_dept_id,
      'Operations Executive',
      'FULL_TIME',
      '2024-12-03',
      'Corporate HQ',
      'ACTIVE'
    )
    returning id into v_emp_id;
  else
    update public.employees set
      full_name = 'Nitisha Anant Shinde',
      official_email = 'nitisha.shinde@secondmedic.com',
      personal_email = 'nitisha.shinde@gmail.com',
      mobile = '9082679523',
      phone = '9082679523',
      department_id = coalesce(department_id, v_dept_id),
      designation = coalesce(nullif(designation, ''), 'Operations Executive'),
      employment_type = 'FULL_TIME',
      date_of_joining = coalesce(date_of_joining, '2024-12-03'),
      status = 'ACTIVE'
    where id = v_emp_id;
  end if;

  -- 3. If an auth user already existed under the gmail address, update it to the company domain
  update auth.users 
  set email = 'nitisha.shinde@secondmedic.com',
      updated_at = now()
  where email = 'nitisha.shinde@gmail.com';

  -- 4. Personal Profile (DOB: 10-10-2001)
  insert into public.employee_profiles (
    employee_id,
    date_of_birth
  ) values (
    v_emp_id,
    '2001-10-10'
  )
  on conflict (employee_id) do update set
    date_of_birth = excluded.date_of_birth;

  -- 5. Assign Role: EMPLOYEE
  insert into public.employee_roles (employee_id, role)
  values 
    (v_emp_id, 'EMPLOYEE'::public.app_role)
  on conflict (employee_id, role) do nothing;

  -- 6. System User registration (for portal login & user directory)
  insert into public.system_users (employee_id)
  values (v_emp_id)
  on conflict (employee_id) do nothing;

  -- 7. IT Asset Registration: HP 255 15.6 inch G9 Notebook PC (Serial: CND32508H5)
  select id into v_asset_id from public.assets where serial_number = 'CND32508H5';
  
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
      'SM-LT-CND32508H5',
      'LAPTOP',
      'HP',
      'HP 255 15.6 inch G9 Notebook PC',
      'CND32508H5',
      'CPU: AMD Ryzen 3 3250U with Radeon Graphics | RAM: 6GB | Disk: C: 280GB (free 165GB); D: 195GB (free 194GB) | OS: Microsoft Windows 11 Pro 10.0.26200 | Hostname: DESKTOP-4MF5EV2 | User: admin | Antivirus: Windows Defender | MAC: Ethernet: BC-0F-F3-D2-3A-F0; Wi-Fi: 00-41-0E-B8-E8-CD',
      'ASSIGNED',
      'GOOD',
      v_emp_id,
      '2024-12-03 10:00:00+05:30',
      now(),
      'Assigned to Nitisha Anant Shinde'
    )
    returning id into v_asset_id;
  else
    update public.assets set
      assigned_to = v_emp_id,
      assigned_at = coalesce(assigned_at, '2024-12-03 10:00:00+05:30'),
      status = 'ASSIGNED',
      specs = 'CPU: AMD Ryzen 3 3250U with Radeon Graphics | RAM: 6GB | Disk: C: 280GB (free 165GB); D: 195GB (free 194GB) | OS: Microsoft Windows 11 Pro 10.0.26200 | Hostname: DESKTOP-4MF5EV2 | User: admin | Antivirus: Windows Defender | MAC: Ethernet: BC-0F-F3-D2-3A-F0; Wi-Fi: 00-41-0E-B8-E8-CD'
    where id = v_asset_id;
  end if;

  -- 8. Asset Assignment History
  if not exists (select 1 from public.asset_assignments where asset_id = v_asset_id and employee_id = v_emp_id) then
    insert into public.asset_assignments (
      asset_id,
      employee_id,
      assigned_at,
      notes
    ) values (
      v_asset_id,
      v_emp_id,
      '2024-12-03 10:00:00+05:30',
      'Initial onboarding hardware issue'
    );
  end if;

  -- 9. Open standard leave balances for FY 2024-2025, 2025-2026, and 2026-2027
  insert into public.leave_balances (employee_id, leave_type_id, fy_year, opening, accrued, used, reserved, encashed, lapsed)
  select 
    v_emp_id,
    lt.id,
    fy.year_label,
    case when lt.accrual_mode = 'MONTHLY' then 0 else lt.annual_quota end,
    0, 0, 0, 0, 0
  from public.leave_types lt
  cross join (values ('2024-2025'), ('2025-2026'), ('2026-2027')) as fy(year_label)
  where coalesce(lt.active, true) = true and lt.code <> 'LOP'
  on conflict (employee_id, leave_type_id, fy_year) do nothing;

  raise notice 'Successfully registered/updated Nitisha Anant Shinde (ID: %, Emp Code: %, Email: nitisha.shinde@secondmedic.com).', v_emp_id, v_emp_code;
end $$;
