-- =============================================================================
-- Migration / Backend Registration: Pratik Navin Darji (BD Manager & HP Laptop Asset)
-- Official Email: pratik.darji@secondmedic.com
-- Manager / Direct Report To: Durgesh Mishra (Director, durgesh.mishra@secondmedic.com)
-- Department: Sales & Marketing
-- =============================================================================

do $$
declare
  v_director_id bigint;
  v_dept_id bigint;
  v_auth_user_id uuid;
  v_emp_id bigint;
  v_emp_code text;
  v_asset_id bigint;
begin
  -- 1. Look up the Director's employee id by official_email = 'durgesh.mishra@secondmedic.com'
  -- If missing, RAISE EXCEPTION. Never create a duplicate director.
  select id into v_director_id
  from public.employees
  where official_email = 'durgesh.mishra@secondmedic.com';

  if v_director_id is null then
    raise exception 'Director record for durgesh.mishra@secondmedic.com not found. Aborting migration.';
  end if;

  -- 2. Department: Use existing 'Sales & Marketing' department or insert if missing
  -- Do NOT make Pratik the department head (leave departments.head_id unchanged).
  select id into v_dept_id 
  from public.departments 
  where name ilike '%Sales%' 
  limit 1;

  if v_dept_id is null then
    insert into public.departments (name)
    values ('Sales & Marketing')
    returning id into v_dept_id;
  end if;

  -- 3. Auth login (Supabase Auth)
  -- Email: pratik.darji@secondmedic.com, email_confirmed_at = now()
  -- Password must be changed on first login.
  select id into v_auth_user_id 
  from auth.users 
  where email = 'pratik.darji@secondmedic.com';

  if v_auth_user_id is null then
    v_auth_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_auth_user_id,
      'authenticated',
      'authenticated',
      'pratik.darji@secondmedic.com',
      crypt('Pr7!k#Nav9$Dar26^Q', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', 'Pratik Navin Darji',
        'email', 'pratik.darji@secondmedic.com',
        'email_verified', true,
        'sub', v_auth_user_id::text
      ),
      now(),
      now()
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_auth_user_id::text,
      v_auth_user_id,
      jsonb_build_object(
        'sub', v_auth_user_id::text,
        'email', 'pratik.darji@secondmedic.com',
        'email_verified', false,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    );
  else
    -- If auth user already exists, ensure email is confirmed without resetting password
    update auth.users set
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change = coalesce(email_change, '')
    where id = v_auth_user_id;

    update auth.identities set
      identity_data = jsonb_build_object(
        'sub', v_auth_user_id::text,
        'email', 'pratik.darji@secondmedic.com',
        'email_verified', false,
        'phone_verified', false
      )
    where user_id = v_auth_user_id;
  end if;

  -- 4. Employee record (public.employees), insert or update by official_email
  select id into v_emp_id 
  from public.employees 
  where official_email = 'pratik.darji@secondmedic.com'
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
      mobile,
      phone,
      department_id,
      designation,
      employment_type,
      date_of_joining,
      work_location,
      status,
      manager_id,
      auth_user_id
    ) values (
      v_emp_code,
      'Pratik Navin Darji',
      'pratik.darji@secondmedic.com',
      '9653313178',
      '9653313178',
      v_dept_id,
      'BD Manager',
      'FULL_TIME',
      '2023-12-01',
      'Corporate HQ',
      'ACTIVE',
      v_director_id,
      v_auth_user_id
    )
    returning id into v_emp_id;
  else
    update public.employees set
      full_name = 'Pratik Navin Darji',
      mobile = '9653313178',
      phone = '9653313178',
      designation = 'BD Manager',
      department_id = v_dept_id,
      manager_id = v_director_id,
      employment_type = 'FULL_TIME',
      date_of_joining = coalesce(date_of_joining, '2023-12-01'),
      work_location = coalesce(work_location, 'Corporate HQ'),
      status = 'ACTIVE',
      auth_user_id = coalesce(auth_user_id, v_auth_user_id)
    where id = v_emp_id;
  end if;

  -- 5. employee_profiles: date_of_birth = '1996-09-14' (upsert on employee_id)
  insert into public.employee_profiles (
    employee_id,
    date_of_birth
  ) values (
    v_emp_id,
    '1996-09-14'
  )
  on conflict (employee_id) do update set
    date_of_birth = excluded.date_of_birth;

  -- 6. Roles (public.employee_roles): MANAGER and EMPLOYEE, using ON CONFLICT DO NOTHING.
  -- Ensure no DIRECTOR, CEO, HR, ACCOUNTS or SYSTEM_ADMIN roles are assigned.
  delete from public.employee_roles
  where employee_id = v_emp_id
    and role not in ('MANAGER'::public.app_role, 'EMPLOYEE'::public.app_role);

  insert into public.employee_roles (employee_id, role)
  values 
    (v_emp_id, 'MANAGER'::public.app_role),
    (v_emp_id, 'EMPLOYEE'::public.app_role)
  on conflict (employee_id, role) do nothing;

  -- 7. system_users: upsert (employee_id, is_locked = false)
  insert into public.system_users (employee_id, is_locked)
  values (v_emp_id, false)
  on conflict (employee_id) do update set is_locked = false;

  -- 8. IT asset (public.assets plus asset_assignments history row), keyed on serial_number
  select id into v_asset_id from public.assets where serial_number = '5CG020245H';

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
      'SM-LT-5CG020245H',
      'LAPTOP',
      'HP',
      'HP EliteBook 840 G6',
      '5CG020245H',
      'CPU: Intel(R) Core(TM) i5-8365U CPU @ 1.60GHz | RAM: 8GB | Disk: C: 182GB (free 40GB); D: 293GB (free 293GB) | OS: Microsoft Windows 11 Pro 10.0.26200 | Hostname: DESKTOP-MCQIJPE | User: Dell | Antivirus: Windows Defender | MAC: Wi-Fi: 74-D8-3E-80-FA-2F; Ethernet: B0-5C-DA-E8-D8-18',
      'ASSIGNED',
      'GOOD',
      v_emp_id,
      '2023-12-01 10:00:00+05:30',
      now(),
      'Assigned to Pratik Navin Darji (BD Manager)'
    )
    returning id into v_asset_id;
  else
    update public.assets set
      asset_tag = 'SM-LT-5CG020245H',
      category = 'LAPTOP',
      brand = 'HP',
      model = 'HP EliteBook 840 G6',
      assigned_to = v_emp_id,
      assigned_at = coalesce(assigned_at, '2023-12-01 10:00:00+05:30'),
      acknowledged_at = coalesce(acknowledged_at, now()),
      status = 'ASSIGNED',
      condition = 'GOOD',
      specs = 'CPU: Intel(R) Core(TM) i5-8365U CPU @ 1.60GHz | RAM: 8GB | Disk: C: 182GB (free 40GB); D: 293GB (free 293GB) | OS: Microsoft Windows 11 Pro 10.0.26200 | Hostname: DESKTOP-MCQIJPE | User: Dell | Antivirus: Windows Defender | MAC: Wi-Fi: 74-D8-3E-80-FA-2F; Ethernet: B0-5C-DA-E8-D8-18',
      notes = 'Assigned to Pratik Navin Darji (BD Manager)'
    where id = v_asset_id;
  end if;

  -- Asset Assignment History row
  if not exists (select 1 from public.asset_assignments where asset_id = v_asset_id and employee_id = v_emp_id) then
    insert into public.asset_assignments (
      asset_id,
      employee_id,
      assigned_at,
      notes
    ) values (
      v_asset_id,
      v_emp_id,
      '2023-12-01 10:00:00+05:30',
      'Assigned to Pratik Navin Darji (BD Manager)'
    );
  end if;

  -- 9. Initialize standard leave balances for FYs 2023-2024, 2024-2025, 2025-2026, 2026-2027
  insert into public.leave_balances (employee_id, leave_type_id, fy_year, opening, accrued, used, reserved, encashed, lapsed)
  select 
    v_emp_id,
    lt.id,
    fy.year_label,
    case when lt.accrual_mode = 'MONTHLY' then 0 else lt.annual_quota end,
    0, 0, 0, 0, 0
  from public.leave_types lt
  cross join (values ('2023-2024'), ('2024-2025'), ('2025-2026'), ('2026-2027')) as fy(year_label)
  where coalesce(lt.active, true) = true and lt.code <> 'LOP'
  on conflict (employee_id, leave_type_id, fy_year) do nothing;

  raise notice 'Successfully registered Pratik Navin Darji (ID: %, Emp Code: %, Email: pratik.darji@secondmedic.com) reporting to Director (ID: %).', v_emp_id, v_emp_code, v_director_id;
end $$;
